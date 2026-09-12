#!/usr/bin/env python3
"""Offline, read-only analyzer for AMICO Web UI HTTP traffic captures.

Parses PCAP/PCAPNG (via a local `tshark` binary) and/or HAR files, extracts
HTTP transaction metadata (method, URI, status, content type, headers,
paired request/response), classifies payload kind and static-vs-API traffic,
and emits a Markdown report + JSON artifact.

Safety properties (do not weaken these):
  - Never writes to, or modifies, any input capture file.
  - Never makes any network connection (all parsing is local/offline).
  - Redacts passwords, tokens, session identifiers, cookies, Set-Cookie
    headers and API keys before they are ever written to disk or printed.

Usage:
    python scripts/analyze_amico_capture.py \\
        --pcap captures/amico_login_readonly.pcapng \\
        --har captures/amico_webui.har \\
        --out-json artifacts/amico_capture_analysis.json \\
        --out-md artifacts/amico_capture_analysis.md
"""
from __future__ import annotations

import argparse
import json
import re
import shutil
import subprocess
import sys
import urllib.parse
from dataclasses import dataclass, field, asdict
from pathlib import Path
from typing import Any, Optional

REDACTED = "***REDACTED***"

# Any header/param/JSON-key/form-key name matching this is redacted, whatever
# its value is. Matches password, token, session*, cookie, set-cookie,
# api_key/apikey/api-key, authorization, secret, auth*.
SENSITIVE_KEY_RE = re.compile(
    r"(pass(w(or)?d)?|token|session\w*|cookie|api[_-]?key|authoriz(e|ation)|secret|auth\w*)",
    re.IGNORECASE,
)

STATIC_EXTENSIONS = {
    ".js", ".css", ".png", ".jpg", ".jpeg", ".gif", ".ico", ".svg",
    ".woff", ".woff2", ".ttf", ".eot", ".map", ".bmp", ".webp",
}

STATIC_CONTENT_TYPES = (
    "text/css", "application/javascript", "text/javascript",
    "image/", "font/", "application/font", "text/html",
)

WRITE_METHODS = {"POST", "PUT", "PATCH", "DELETE"}
READ_METHODS = {"GET", "HEAD", "OPTIONS"}


# --------------------------------------------------------------------------
# Redaction helpers
# --------------------------------------------------------------------------

def redact_headers(headers: dict[str, str]) -> dict[str, str]:
    out = {}
    for k, v in (headers or {}).items():
        if SENSITIVE_KEY_RE.search(k or ""):
            out[k] = REDACTED
        else:
            out[k] = v
    return out


def redact_cookie_header_value(value: str) -> str:
    """Redact a `Cookie: a=1; b=2` header value, keeping cookie names."""
    parts = [p.strip() for p in value.split(";") if p.strip()]
    redacted = []
    for part in parts:
        if "=" in part:
            name, _, _ = part.partition("=")
            redacted.append(f"{name.strip()}={REDACTED}")
        else:
            redacted.append(part)
    return "; ".join(redacted)


def _redact_json_value(obj: Any) -> Any:
    if isinstance(obj, dict):
        return {
            k: (REDACTED if SENSITIVE_KEY_RE.search(str(k)) else _redact_json_value(v))
            for k, v in obj.items()
        }
    if isinstance(obj, list):
        return [_redact_json_value(v) for v in obj]
    return obj


def redact_body_text(text: Optional[str], content_type: Optional[str]) -> Optional[str]:
    if not text:
        return text
    ct = (content_type or "").lower()
    try:
        if "json" in ct:
            return json.dumps(_redact_json_value(json.loads(text)))
        if "x-www-form-urlencoded" in ct:
            pairs = urllib.parse.parse_qsl(text, keep_blank_values=True)
            redacted_pairs = [
                (k, REDACTED if SENSITIVE_KEY_RE.search(k) else v) for k, v in pairs
            ]
            return urllib.parse.urlencode(redacted_pairs)
        if "multipart/form-data" in ct:
            return "<multipart form body: not printed, field names not parsed>"
    except Exception:
        pass
    # Fallback: best-effort regex redaction for "key":"value" / key=value shapes
    # inside otherwise-unparsed text bodies.
    text = re.sub(
        r'("(?:[^"]*(?:pass(?:w(?:or)?d)?|token|session\w*|api[_-]?key|secret|auth\w*)[^"]*)"\s*:\s*)"[^"]*"',
        lambda m: m.group(1) + f'"{REDACTED}"',
        text,
        flags=re.IGNORECASE,
    )
    return text


def redact_query_string(url: str) -> str:
    parsed = urllib.parse.urlsplit(url)
    if not parsed.query:
        return url
    pairs = urllib.parse.parse_qsl(parsed.query, keep_blank_values=True)
    redacted_pairs = [
        (k, REDACTED if SENSITIVE_KEY_RE.search(k) else v) for k, v in pairs
    ]
    new_query = urllib.parse.urlencode(redacted_pairs)
    return urllib.parse.urlunsplit(
        (parsed.scheme, parsed.netloc, parsed.path, new_query, parsed.fragment)
    )


# --------------------------------------------------------------------------
# Classification helpers
# --------------------------------------------------------------------------

def classify_payload_kind(content_type: Optional[str], body: Optional[str]) -> str:
    ct = (content_type or "").lower()
    if "json" in ct:
        return "json"
    if "x-www-form-urlencoded" in ct:
        return "form-urlencoded"
    if "multipart/form-data" in ct:
        return "multipart"
    if not body:
        return "none"
    if ct.startswith("text/") or "html" in ct or "xml" in ct:
        return "text"
    if ct:
        return "binary"
    return "unknown"


def is_static_asset(path: str, content_type: Optional[str]) -> bool:
    p = path.lower().split("?", 1)[0]
    if any(p.endswith(ext) for ext in STATIC_EXTENSIONS):
        return True
    ct = (content_type or "").lower()
    if any(ct.startswith(prefix) for prefix in STATIC_CONTENT_TYPES):
        # index.html-style navigation pages count as static too.
        return True
    return False


def read_write_from_method(method: str) -> str:
    m = (method or "").upper()
    if m in WRITE_METHODS:
        return "write"
    if m in READ_METHODS:
        return "read"
    return "unknown"


# --------------------------------------------------------------------------
# Transaction model
# --------------------------------------------------------------------------

@dataclass
class Transaction:
    evidence_source: str          # "PCAP" or "HAR"
    source_file: str
    stream_id: Optional[str]
    seq: int
    method: str
    url: str
    path: str
    host: Optional[str]
    request_headers: dict = field(default_factory=dict)
    request_content_type: Optional[str] = None
    request_body: Optional[str] = None
    status_code: Optional[int] = None
    response_headers: dict = field(default_factory=dict)
    response_content_type: Optional[str] = None
    response_body_preview: Optional[str] = None
    payload_kind: str = "unknown"
    is_static: bool = False
    read_write: str = "unknown"
    paired: bool = False


# --------------------------------------------------------------------------
# HAR parsing
# --------------------------------------------------------------------------

def parse_har(path: Path) -> list[Transaction]:
    with open(path, "r", encoding="utf-8", errors="replace") as f:
        har = json.load(f)

    entries = har.get("log", {}).get("entries", [])
    transactions: list[Transaction] = []

    for i, entry in enumerate(entries):
        req = entry.get("request", {})
        res = entry.get("response", {})

        url = req.get("url", "")
        parsed_url = urllib.parse.urlsplit(url)
        method = req.get("method", "")

        req_headers = {h.get("name", ""): h.get("value", "") for h in req.get("headers", [])}
        res_headers = {h.get("name", ""): h.get("value", "") for h in res.get("headers", [])}

        req_content_type = req_headers.get("Content-Type") or req_headers.get("content-type")
        res_content_type = res_headers.get("Content-Type") or res_headers.get("content-type")

        post_data = req.get("postData", {}) or {}
        raw_body = post_data.get("text")

        content = res.get("content", {}) or {}
        res_text = content.get("text")
        if content.get("encoding") == "base64":
            # Don't decode binary response bodies; just note size/type.
            res_text = f"<binary response body, {content.get('size', 'unknown size')} bytes>"

        redacted_req_headers = redact_headers(req_headers)
        if "Cookie" in redacted_req_headers and redacted_req_headers["Cookie"] != REDACTED:
            redacted_req_headers["Cookie"] = redact_cookie_header_value(req_headers["Cookie"])
        redacted_res_headers = redact_headers(res_headers)

        redacted_body = redact_body_text(raw_body, req_content_type)
        redacted_res_preview = redact_body_text(res_text, res_content_type)
        if redacted_res_preview and len(redacted_res_preview) > 2000:
            redacted_res_preview = redacted_res_preview[:2000] + "...<truncated>"

        path_only = parsed_url.path or "/"
        payload_kind = classify_payload_kind(req_content_type, raw_body)
        static = is_static_asset(path_only, res_content_type)

        txn = Transaction(
            evidence_source="HAR",
            source_file=str(path),
            stream_id=None,
            seq=i,
            method=method,
            url=redact_query_string(url),
            path=path_only,
            host=parsed_url.netloc or None,
            request_headers=redacted_req_headers,
            request_content_type=req_content_type,
            request_body=redacted_body,
            status_code=res.get("status"),
            response_headers=redacted_res_headers,
            response_content_type=res_content_type,
            response_body_preview=redacted_res_preview,
            payload_kind=payload_kind,
            is_static=static,
            read_write=read_write_from_method(method),
            paired=True,  # HAR entries are inherently request+response paired
        )
        transactions.append(txn)

    return transactions


# --------------------------------------------------------------------------
# PCAP/PCAPNG parsing (via tshark)
# --------------------------------------------------------------------------

def find_tshark(explicit_path: Optional[str]) -> Optional[str]:
    if explicit_path:
        return explicit_path if shutil.which(explicit_path) or Path(explicit_path).exists() else None
    return shutil.which("tshark")


def parse_pcap(path: Path, tshark_path: str) -> list[Transaction]:
    # Ask tshark for full JSON dissection of HTTP packets only. Read-only:
    # tshark is invoked with -r (read) and never -w (write), so the capture
    # file itself is never modified.
    cmd = [
        tshark_path,
        "-r", str(path),
        "-Y", "http",
        "-T", "json",
    ]
    try:
        proc = subprocess.run(
            cmd, capture_output=True, text=True, check=True, timeout=300
        )
    except subprocess.CalledProcessError as e:
        raise RuntimeError(f"tshark failed on {path}: {e.stderr[:500]}") from e
    except subprocess.TimeoutExpired as e:
        raise RuntimeError(f"tshark timed out on {path}") from e

    try:
        packets = json.loads(proc.stdout or "[]")
    except json.JSONDecodeError as e:
        raise RuntimeError(f"tshark produced non-JSON output for {path}: {e}") from e

    # Index packets by frame number for request/response pairing.
    by_frame: dict[str, dict] = {}
    for pkt in packets:
        layers = pkt.get("_source", {}).get("layers", {})
        frame = layers.get("frame", {})
        frame_num = frame.get("frame.number")
        if frame_num:
            by_frame[frame_num] = pkt

    def get_field(layers: dict, *names: str) -> Optional[str]:
        http = layers.get("http", {})
        if isinstance(http, list):
            http = http[0] if http else {}
        for name in names:
            if name in http:
                v = http[name]
                if isinstance(v, list):
                    return v[0]
                return v
        return None

    def headers_from_http_layer(layers: dict, prefix: str) -> dict[str, str]:
        http = layers.get("http", {})
        if isinstance(http, list):
            http = http[0] if http else {}
        out = {}
        # tshark nests raw header lines under a key like
        # "http.request.line" (list of "Name: value\r\n" strings) in some
        # versions; fall back to scanning top-level http.* fields.
        for k, v in http.items():
            if k.lower().endswith(".line") or k.lower() == prefix:
                lines = v if isinstance(v, list) else [v]
                for line in lines:
                    if isinstance(line, str) and ":" in line:
                        name, _, value = line.partition(":")
                        out[name.strip()] = value.strip().rstrip("\r\n")
        return out

    transactions: list[Transaction] = []
    seq = 0
    seen_requests: dict[str, Transaction] = {}

    for pkt in packets:
        layers = pkt.get("_source", {}).get("layers", {})
        http = layers.get("http", {})
        if isinstance(http, list):
            http = http[0] if http else {}
        if not http:
            continue

        tcp = layers.get("tcp", {})
        stream_id = tcp.get("tcp.stream") if isinstance(tcp, dict) else None
        frame_num = layers.get("frame", {}).get("frame.number")

        is_request = "1" == str(http.get("http.request", "0"))
        is_response = "1" == str(http.get("http.response", "0"))

        if is_request:
            method = http.get("http.request.method", "")
            uri = http.get("http.request.uri", "")
            host = http.get("http.host", "")
            req_content_type = http.get("http.content_type") or http.get("http.content_type_header")
            file_data = http.get("http.file_data")

            full_url = f"http://{host}{uri}" if host else uri
            path_only = urllib.parse.urlsplit(uri).path or uri or "/"
            req_headers = headers_from_http_layer(layers, "http.request.line")

            redacted_req_headers = redact_headers(req_headers)
            if "Cookie" in redacted_req_headers and redacted_req_headers["Cookie"] != REDACTED:
                redacted_req_headers["Cookie"] = redact_cookie_header_value(req_headers["Cookie"])
            redacted_body = redact_body_text(file_data, req_content_type)

            txn = Transaction(
                evidence_source="PCAP",
                source_file=str(path),
                stream_id=str(stream_id) if stream_id is not None else None,
                seq=seq,
                method=method,
                url=redact_query_string(full_url),
                path=path_only,
                host=host or None,
                request_headers=redacted_req_headers,
                request_content_type=req_content_type,
                request_body=redacted_body,
                payload_kind=classify_payload_kind(req_content_type, file_data),
                read_write=read_write_from_method(method),
            )
            seq += 1
            transactions.append(txn)
            if frame_num:
                seen_requests[frame_num] = txn

            # tshark links a response to its request via http.request_in on
            # the *response* packet, not the reverse; nothing more to do here.

        if is_response:
            status_code = http.get("http.response.code")
            res_content_type = http.get("http.content_type") or http.get("http.content_type_header")
            file_data = http.get("http.file_data")
            request_in = http.get("http.request_in")

            res_headers = headers_from_http_layer(layers, "http.response.line")
            redacted_res_headers = redact_headers(res_headers)
            preview = redact_body_text(file_data, res_content_type)
            if preview and len(preview) > 2000:
                preview = preview[:2000] + "...<truncated>"

            matched = seen_requests.get(request_in) if request_in else None
            if matched is not None:
                matched.status_code = int(status_code) if status_code and status_code.isdigit() else status_code
                matched.response_headers = redacted_res_headers
                matched.response_content_type = res_content_type
                matched.response_body_preview = preview
                matched.is_static = is_static_asset(matched.path, res_content_type)
                matched.paired = True
            else:
                # Unmatched response (request outside capture window, or
                # tshark didn't expose http.request_in): record standalone.
                txn = Transaction(
                    evidence_source="PCAP",
                    source_file=str(path),
                    stream_id=str(stream_id) if stream_id is not None else None,
                    seq=seq,
                    method="(response-only)",
                    url="",
                    path="",
                    host=None,
                    status_code=int(status_code) if status_code and status_code.isdigit() else status_code,
                    response_headers=redacted_res_headers,
                    response_content_type=res_content_type,
                    response_body_preview=preview,
                    payload_kind=classify_payload_kind(res_content_type, file_data),
                    is_static=is_static_asset("", res_content_type),
                    paired=False,
                )
                seq += 1
                transactions.append(txn)

    return transactions


# --------------------------------------------------------------------------
# Report generation
# --------------------------------------------------------------------------

def build_summary(transactions: list[Transaction]) -> dict:
    streams = {t.stream_id for t in transactions if t.stream_id is not None}
    endpoints = {(t.method, t.path) for t in transactions if t.method and t.path}
    read_endpoints = {(t.method, t.path) for t in transactions if t.read_write == "read" and t.path}
    write_endpoints = {(t.method, t.path) for t in transactions if t.read_write == "write" and t.path}
    unresolved = [
        t for t in transactions
        if not t.paired or t.payload_kind == "unknown" or t.read_write == "unknown" or not t.method
    ]
    return {
        "total_transactions": len(transactions),
        "stream_count": len(streams),
        "endpoint_count": len(endpoints),
        "read_endpoint_count": len(read_endpoints),
        "write_endpoint_count": len(write_endpoints),
        "unresolved_count": len(unresolved),
        "unresolved_examples": [
            {"seq": t.seq, "source": t.evidence_source, "method": t.method, "path": t.path}
            for t in unresolved[:20]
        ],
    }


def to_markdown(transactions: list[Transaction], summary: dict, sources: list[str]) -> str:
    lines = []
    lines.append("# AMICO capture analysis (auto-generated)")
    lines.append("")
    lines.append(f"Sources analyzed: {', '.join(sources) if sources else '(none)'}")
    lines.append("")
    lines.append("## Summary")
    lines.append("")
    lines.append(f"- Total HTTP transactions: {summary['total_transactions']}")
    lines.append(f"- TCP streams (PCAP only): {summary['stream_count']}")
    lines.append(f"- Distinct (method, path) endpoints: {summary['endpoint_count']}")
    lines.append(f"- Read-only endpoints (GET/HEAD/OPTIONS): {summary['read_endpoint_count']}")
    lines.append(f"- Write endpoints (POST/PUT/PATCH/DELETE): {summary['write_endpoint_count']}")
    lines.append(f"- Unresolved/ambiguous transactions: {summary['unresolved_count']}")
    lines.append("")
    lines.append("## Transactions")
    lines.append("")
    lines.append("| # | Evidence | Stream | Method | Path | Status | Req Content-Type | Resp Content-Type | Static | Payload | R/W |")
    lines.append("|---|---|---|---|---|---|---|---|---|---|---|")
    for t in transactions:
        lines.append(
            f"| {t.seq} | {t.evidence_source} | {t.stream_id or ''} | {t.method} | "
            f"`{t.path}` | {t.status_code or ''} | {t.request_content_type or ''} | "
            f"{t.response_content_type or ''} | {'yes' if t.is_static else 'no'} | "
            f"{t.payload_kind} | {t.read_write} |"
        )
    lines.append("")
    return "\n".join(lines)


def main() -> int:
    ap = argparse.ArgumentParser(
        description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    ap.add_argument("--pcap", action="append", default=[], help="Path to a .pcap/.pcapng file (repeatable)")
    ap.add_argument("--har", action="append", default=[], help="Path to a .har file (repeatable)")
    ap.add_argument("--tshark-path", default=None, help="Path to tshark binary (default: search PATH)")
    ap.add_argument("--out-json", default="artifacts/amico_capture_analysis.json")
    ap.add_argument("--out-md", default="artifacts/amico_capture_analysis.md")
    args = ap.parse_args()

    if not args.pcap and not args.har:
        ap.error("at least one --pcap or --har must be given")

    all_transactions: list[Transaction] = []
    sources: list[str] = []
    errors: list[str] = []

    for har_path in args.har:
        p = Path(har_path)
        if not p.exists():
            errors.append(f"HAR file not found: {har_path}")
            continue
        try:
            all_transactions.extend(parse_har(p))
            sources.append(str(p))
        except Exception as e:
            errors.append(f"Failed to parse HAR {har_path}: {e}")

    if args.pcap:
        tshark_path = find_tshark(args.tshark_path)
        if not tshark_path:
            errors.append(
                "tshark not found on PATH; PCAP/PCAPNG files were not analyzed. "
                "Install Wireshark/tshark or pass --tshark-path."
            )
        else:
            for pcap_path in args.pcap:
                p = Path(pcap_path)
                if not p.exists():
                    errors.append(f"PCAP file not found: {pcap_path}")
                    continue
                try:
                    all_transactions.extend(parse_pcap(p, tshark_path))
                    sources.append(str(p))
                except Exception as e:
                    errors.append(f"Failed to parse PCAP {pcap_path}: {e}")

    summary = build_summary(all_transactions)

    out_json_path = Path(args.out_json)
    out_md_path = Path(args.out_md)
    out_json_path.parent.mkdir(parents=True, exist_ok=True)
    out_md_path.parent.mkdir(parents=True, exist_ok=True)

    artifact = {
        "sources": sources,
        "errors": errors,
        "summary": summary,
        "transactions": [asdict(t) for t in all_transactions],
    }
    out_json_path.write_text(json.dumps(artifact, indent=2), encoding="utf-8")
    out_md_path.write_text(to_markdown(all_transactions, summary, sources), encoding="utf-8")

    print(f"Analyzed {len(all_transactions)} HTTP transactions from {len(sources)} source file(s).")
    print(f"  Streams: {summary['stream_count']}")
    print(f"  Endpoints: {summary['endpoint_count']} (read: {summary['read_endpoint_count']}, write: {summary['write_endpoint_count']})")
    print(f"  Unresolved: {summary['unresolved_count']}")
    if errors:
        print("Errors/warnings:", file=sys.stderr)
        for e in errors:
            print(f"  - {e}", file=sys.stderr)
    print(f"JSON report: {out_json_path}")
    print(f"Markdown report: {out_md_path}")
    return 1 if errors and not all_transactions else 0


if __name__ == "__main__":
    sys.exit(main())
