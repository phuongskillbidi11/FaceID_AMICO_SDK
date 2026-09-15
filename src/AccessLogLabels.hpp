#pragma once

#include <cstdint>
#include <string>

namespace amico::detail {

inline std::string authorizationLabel(int64_t event) {
    switch (event) {
        case 7: case 10: case 11: case 12: case 15: return "Granted";
        case 6: return "Not authorized";
        default: return "Not recognized";
    }
}

inline int64_t packIdentifierTag(const char* tag, int n) {
    // ports report.js's getIdentifierId(s, n): first 3 chars only.
    unsigned char b0 = tag[0], b1 = tag[1], b2 = tag[2];
    return (static_cast<int64_t>(b0) << 24) | (static_cast<int64_t>(b1) << 16) |
           (static_cast<int64_t>(b2) << 8) | n;
}

inline std::string identificationLabel(int64_t identifierId) {
    int64_t tag = identifierId >> 8;
    if (tag == (packIdentifierTag("bio", 0) >> 8)) return "Biometry";
    if (tag == (packIdentifierTag("fac", 0) >> 8)) return "Facial";     // "face" -> first 3 chars "fac"
    if (tag == (packIdentifierTag("win", 0) >> 8) || tag == (packIdentifierTag("mag", 0) >> 8) ||
        tag == (packIdentifierTag("rfi", 0) >> 8) || tag == (packIdentifierTag("mif", 0) >> 8)) return "Card";
    if (tag == (packIdentifierTag("gui", 0) >> 8)) {
        return identifierId == packIdentifierTag("gui", 1) ? "PIN" : "Password";
    }
    if (tag == (packIdentifierTag("qrc", 0) >> 8)) return "QR Code";    // "qrcode" -> first 3 chars "qrc"
    if (tag == (packIdentifierTag("rex", 0) >> 8)) return "REX button";
    if (tag == (packIdentifierTag("web", 0) >> 8)) return "Web Interface";
    if (tag == (packIdentifierTag("int", 0) >> 8)) return "Intercom";   // "intercom" -> first 3 chars "int"
    return "Unknown";  // no fallback case in report.js's switch -- picked deliberately, see tests.md T-5
}

// **The `"Unknown"` default above is final — do not change it.**
// `report.js`'s own generic column-formatter has an outer
// `default: return value;` case (returning the raw number) one level
// above the `case 'identification'` switch — but that outer case
// exists for *entirely different* column types (`boolean`, `datetime`,
// `alarmevent`, etc.), not for `identification` specifically, whose
// own inner tag-matching logic has no fallback branch at all in the
// source. Do not port that unrelated outer `default` into this
// function, and do not replace `"Unknown"` with the raw `identifierId`
// value even though that would be closer to literally mirroring
// `report.js` — see tests.md Test L-3 for the full rationale (this
// path is unreachable on the one real device tested this session, so
// it is a deliberate presentation choice for an unreached edge case,
// not a guess about a reachable one).

}  // namespace amico::detail
