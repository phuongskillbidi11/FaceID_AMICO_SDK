# Expected capture inputs

This directory is the expected location for traffic captures of the AMICO
VL70LF Web UI (device `192.168.2.156`), used by `scripts/analyze_amico_capture.py`
and by `docs/amico-protocol-map.md`.

None of these files are present yet:

- `amico_login_readonly.pcapng` — packet capture of a read-only login/browse session
- `amico_webui.har` — HAR export of a Web UI session (browser DevTools → Network → "Save all as HAR")
- `fiddler_sessions.saz` — Fiddler session archive (Fiddler-specific zip format; not parsed by
  the analyzer script directly — export the relevant sessions to `.har` from Fiddler first,
  since `.saz` is a proprietary container, not raw HTTP)

Drop the files here (or pass explicit paths to the analyzer with `--pcap` / `--har`) and
re-run:

```
python scripts/analyze_amico_capture.py --pcap captures/amico_login_readonly.pcapng --har captures/amico_webui.har
```
