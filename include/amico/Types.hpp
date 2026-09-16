#pragma once

#include <cstdint>
#include <optional>
#include <string>
#include <vector>

namespace amico {

/// POST /system_information.fcgi — confirmed schema (Phase 1, LIVE_CONFIRMED).
/// Only the fields this SDK's callers need are surfaced; the raw response
/// has more (uptime, memory, biometrics limits, auth802_1x) that callers
/// can get to later if a real need shows up — not invented here.
struct NetworkInfo {
    std::string mac;
    std::string ip;
    std::string netmask;
    std::string gateway;
    bool sslEnabled = false;
    bool selfSignedCertificate = false;
    bool dhcpEnabled = false;
};

struct SystemInformation {
    std::string serial;
    std::string firmwareVersion;  // "version", e.g. "2.4.5"
    std::string secboxVersion;    // "secbox_version" (EAM), e.g. "2.2.3"
    std::string deviceName;
    std::string deviceId;
    bool online = false;
    NetworkInfo network;
};

/// Public user-facing view of the `users` object. Deliberately has no
/// `password`, `salt`, `panic_password`, or `panic_salt` member.
/// `hasPassword` is the one exception to "never requested": the SDK
/// does request the `password` field internally (see
/// ObjectQuery::buildUserHasPasswordBody), but only to reduce it to
/// this boolean before it ever reaches a public type — per
/// docs/ui-action-protocol-map.md's "hasPassword derivation" finding,
/// the device only ever returns a masked sentinel or empty/null on this
/// field, never the real hash. There is no member, getter, or code path
/// anywhere in this SDK that can return the raw string.
struct AmicoUser {
    int64_t id = 0;
    std::string name;
    std::string registration;
    int userTypeId = 0;
    int64_t beginTime = 0;
    int64_t endTime = 0;
    int64_t lastAccess = 0;

    /// Ids of the groups this user belongs to (`user_groups`,
    /// JS_CONFIRMED — see docs/ui-action-protocol-map.md, Task 0.3).
    std::vector<int64_t> groupIds;
    /// `groupIds.size()` at the time `get()`/`list()` populated this
    /// object — a convenience mirror of the Users table's "Nº of
    /// Groups" column, not a separately-fetched value.
    int groupCount = 0;
    /// Number of cards (`cards` table) assigned to this user
    /// (JS_CONFIRMED — Task 0.4).
    int cardCount = 0;
    /// Whether this user currently holds the Administrator role
    /// (`user_roles`, JS_CONFIRMED — Task 0.5).
    bool isAdministrator = false;
    /// Number of face templates enrolled for this user (count only —
    /// this SDK never exposes raw biometric template data). Directly
    /// affected by `UsersApi::setImage()`/`removeImage()` — confirmed
    /// live 2026-09-13 that the "profile image" upload is coupled to
    /// face-recognition enrollment, not a separate cosmetic photo (see
    /// docs/ui-action-protocol-map.md's Image section).
    int faceCount = 0;
    /// Number of other biometric templates (e.g. fingerprint) enrolled
    /// for this user (count only, same rationale as `faceCount`).
    int bioCount = 0;
    /// Whether a door-entry password/PIN is set for this user
    /// (JS_CONFIRMED derivation — see the struct-level comment above).
    /// The actual value is never retrievable through this SDK; use
    /// `AmicoClient::UsersApi::setPassword()` to change it.
    bool hasPassword = false;
    /// URL path for this user's profile photo
    /// (`/user_get_image.fcgi?user_id=<id>`, LIVE_CONFIRMED) — a URL,
    /// not pre-fetched image bytes; empty if the user has no photo.
    std::string imageUrl;
    /// CPF (Brazil-region custom field, `c_users` table), if a row
    /// exists for this user. `std::nullopt` when no `c_users` row
    /// exists at all -- never an empty-string sentinel (Visitors
    /// plan, 2026-09-14, spec.md Decision 3).
    std::optional<std::string> cpf;
};

/// Raw profile photo and its device-provided media type.
struct UserImage {
    std::vector<uint8_t> bytes;
    std::string contentType;
};

/// Creation parameters for the `users` object. Deliberately has no
/// `password`, `salt`, `panic_password`, or `panic_salt` member — those
/// fields are never accepted for writes by this SDK, so the type simply
/// cannot represent them. `beginTime`/`endTime` remain absent *here*
/// specifically because no create-time (`create_objects.fcgi`) write
/// payload including them has been confirmed -- this is narrower than it
/// used to be: `UserUpdate` (a separate struct) now has both, confirmed
/// live via `modify_objects.fcgi` this session (2026-09-14). Whether the
/// same two fields are also accepted at creation time is a distinct,
/// unconfirmed question, deliberately not assumed here.
/// `userTypeId` was originally absent for the same reason (no
/// confirmed Web UI write payload included it) -- that finding covered
/// the plain `user.js`'s own `User.save()` path. The Visitors plan
/// (2026-09-14) found new, narrower live evidence (direct browser
/// class introspection of `window.usertype1`, see
/// `.plans/2026-09-14-implement-visitors-enroll-visitors-list-/spec.md`'s
/// Background section) that the device's generic "usertype" wrapper
/// *does* set `user_type_id` via each type's own `defaultValue` before
/// calling that same shared save() -- so `userTypeId` is now a real,
/// optional field here. Unset (the default) preserves today's exact
/// create behavior for regular Users -- `user_type_id` is only ever
/// sent when a caller (in practice, only the `/visitors` route)
/// explicitly sets it.
/// There is no `id` member; the device assigns it when creating the user.
struct NewUser {
    std::string name;
    std::string registration;
    std::optional<int64_t> userTypeId;
    /// CPF custom field (see `AmicoUser::cpf`) -- when set, a second
    /// `c_users` row is created after the main user record saves,
    /// mirroring the real device's own two-call `afterSave` mechanism
    /// (Visitors plan, spec.md Decision 3).
    std::optional<std::string> cpf;
};

/// Update parameters for the `users` object. Deliberately has no
/// `password`, `salt`, `panic_password`, or `panic_salt` member — those
/// fields are never accepted for writes by this SDK, so the type simply
/// cannot represent them. `userTypeId` remains deliberately absent *here*
/// even after the Visitors plan (2026-09-14): a visitor's type is fixed
/// at creation in that plan's scope and is never changed afterward, so
/// there is no confirmed (or needed) update path for it, unlike `NewUser`.
/// Callers set only the fields they want to change.
struct UserUpdate {
    int64_t id = 0;
    std::optional<std::string> name;
    std::optional<std::string> registration;
    /// CPF custom field (see `AmicoUser::cpf`) -- when set, creates or
    /// updates the companion `c_users` row (Visitors plan, spec.md
    /// Decision 3).
    std::optional<std::string> cpf;
    /// Start/end of this user's valid access window, as unix epoch
    /// seconds (same representation as `AmicoUser::beginTime`/`endTime`).
    /// LIVE-CONFIRMED writable this session (2026-09-14): the real
    /// device's own per-user-type "Default Users" edit form (a
    /// dynamically-referenced generic widget, distinct from the plain
    /// `user.js`'s own `save()` that an earlier discovery pass checked --
    /// same "usertypeN wrapper does more than the base class" pattern
    /// already documented for the Visitors plan's `userTypeId` finding)
    /// sends a `POST /modify_objects.fcgi` with
    /// `values: {"begin_time": <epoch>, "end_time": <epoch>}` on Save.
    /// Captured safely via a client-side XHR interceptor that recorded
    /// the exact request body and then blocked it from ever reaching the
    /// device -- no real write was made to confirm this shape. Only the
    /// update path is confirmed/implemented; whether `NewUser`'s own
    /// create call also accepts these is unconfirmed and deliberately
    /// left unsupported (see `NewUser`'s own doc comment).
    std::optional<int64_t> beginTime;
    std::optional<int64_t> endTime;
};

/// List query for `AmicoClient::UsersApi::list()`. Intentionally has no
/// search/sort field — the real Web UI has no user-triggered sort control
/// on this page (confirmed in the P1 discovery pass), and adding search
/// now would be scope beyond the original request.
struct UserQuery {
    int limit = 0;   // 0 -> AmicoConfig::defaultPageSize
    int offset = 0;
    /// Unset (default) = today's exact existing filter (`user_type_id
    /// = 0 OR user_type_id IS NULL`), zero behavior change. Set = the
    /// Visitors plan's `user_types.id = *userTypeId` filter
    /// (2026-09-14, spec.md Decision 1) -- LIVE-CONFIRMED shape via a
    /// direct network capture of the real device's own Visitors page.
    std::optional<int64_t> userTypeId;
};

/// Public view of the `access_logs` object.
struct AccessLogEntry {
    int64_t id = 0;
    int64_t time = 0;
    std::optional<int64_t> userId;
    std::optional<int64_t> portalId;
    int64_t logTypeId = 0;
    int64_t event = 0;
    int64_t identifierId = 0;
};

/// Both `from` and `to` are sent as server-side `where` clauses
/// (`time >= from` AND `time <= to`). LIVE_CONFIRMED 2026-09-14:
/// chained array clauses on the same field returned the expected
/// 15-row window with a matching COUNT(*).
struct AccessLogQuery {
    std::optional<int64_t> from;
    std::optional<int64_t> to;
    int limit = 0;  // 0 -> AmicoConfig::defaultPageSize
    int offset = 0;
    std::optional<std::vector<int64_t>> userIds;
    std::optional<std::vector<int64_t>> groupIds;
    std::optional<std::vector<int64_t>> timeZoneIds;
};

/// Public view of the `portals` object (name only — no CRUD support
/// in this SDK; used solely to resolve access-log portal names).
struct Portal {
    int64_t id = 0;
    std::string name;
};

/// Public view of the `time_zones` object (name only — same
/// rationale as Portal). Create/update/remove added by the
/// 2026-09-15-timezones-write-side plan -- see `NewTimeZone`/
/// `TimeZoneUpdate`/`TimeSpan` below.
struct TimeZone {
    int64_t id = 0;
    std::string name;
};

/// Creation parameters for the `time_zones` object. LIVE_CONFIRMED
/// 2026-09-15 via XHR-interceptor capture of the real device's own Add
/// Time Zone form -- see
/// .plans/2026-09-15-timezones-write-side/spec.md Background.
struct NewTimeZone {
    std::string name;
};

/// Update parameters for the `time_zones` object. `name` is the only
/// writable field on the zone record itself (its `time_spans` are a
/// separate nested object, see below).
struct TimeZoneUpdate {
    int64_t id = 0;
    std::string name;
};

/// Public view of the `time_spans` object -- one day/time/holiday rule
/// belonging to a time zone. `start`/`end` are seconds-since-midnight
/// (e.g. 0 = 00:00:00, 86399 = 23:59:59).
struct TimeSpan {
    int64_t id = 0;
    int64_t timeZoneId = 0;
    int64_t start = 0;
    int64_t end = 86399;
    bool sun = true;
    bool mon = true;
    bool tue = true;
    bool wed = true;
    bool thu = true;
    bool fri = true;
    bool sat = true;
    bool hol1 = true;
    bool hol2 = true;
    bool hol3 = true;
};

/// Creation parameters for the `time_spans` object.
struct NewTimeSpan {
    int64_t timeZoneId = 0;
    int64_t start = 0;
    int64_t end = 86399;
    bool sun = true;
    bool mon = true;
    bool tue = true;
    bool wed = true;
    bool thu = true;
    bool fri = true;
    bool sat = true;
    bool hol1 = true;
    bool hol2 = true;
    bool hol3 = true;
};

/// Update parameters for the `time_spans` object. `timeZoneId` is
/// absent -- a span never changes which zone it belongs to in this
/// plan's scope.
struct TimeSpanUpdate {
    int64_t id = 0;
    int64_t start = 0;
    int64_t end = 86399;
    bool sun = true;
    bool mon = true;
    bool tue = true;
    bool wed = true;
    bool thu = true;
    bool fri = true;
    bool sat = true;
    bool hol1 = true;
    bool hol2 = true;
    bool hol3 = true;
};

/// Public view of the `groups` object. Create/update/remove added by
/// the 2026-09-15-groups-write-side plan -- see `NewGroup`/
/// `GroupUpdate` below. `timeZoneIds` added by the
/// 2026-09-16-groups-timezones-write-side plan -- resolved through a
/// 2-hop join (`access_rules`/`access_rule_time_zones`), not a real
/// device column, same mechanism already confirmed for
/// `ScheduledUnlock.timeZoneIds` -- see
/// .plans/2026-09-16-groups-timezones-write-side/spec.md Background.
struct Group {
    int64_t id = 0;
    std::string name;
    std::vector<int64_t> timeZoneIds;
};

/// Creation parameters for the `groups` object. LIVE_CONFIRMED
/// 2026-09-15 via XHR-interceptor capture of the real device's own
/// Add Group form -- see
/// .plans/2026-09-15-groups-write-side/spec.md Background.
struct NewGroup {
    std::string name;
};

/// Update parameters for the `groups` object. `name` is the only
/// writable field the device exposes for this object -- unlike
/// `UserUpdate`/`VisitUpdate`, there is no meaningful "partial" update
/// here.
struct GroupUpdate {
    int64_t id = 0;
    std::string name;
};

/// Public view of the `holidays` object. `end` is always
/// `start + 86399` (LIVE_CONFIRMED via the create payload -- see
/// .plans/2026-09-15-holidays-write-side/spec.md Background/Decision 1)
/// -- a derived field, never independently entered in the real
/// device's own UI.
struct Holiday {
    int64_t id = 0;
    std::string name;
    int64_t start = 0;
    bool hol1 = true;
    bool hol2 = true;
    bool hol3 = true;
    bool repeats = true;
    int64_t end = 86399;
};

/// Creation parameters for the `holidays` object. Deliberately has no
/// `end` member -- this SDK always computes it as `start + 86399`
/// server-side (spec.md Decision 1), matching the real device's own
/// `beforeSave` hook; there is no code path to set an inconsistent
/// start/end pair.
struct NewHoliday {
    std::string name;
    int64_t start = 0;
    bool hol1 = true;
    bool hol2 = true;
    bool hol3 = true;
    bool repeats = true;
};

/// Update parameters for the `holidays` object. Same no-`end`-member
/// rationale as `NewHoliday`.
struct HolidayUpdate {
    int64_t id = 0;
    std::string name;
    int64_t start = 0;
    bool hol1 = true;
    bool hol2 = true;
    bool hol3 = true;
    bool repeats = true;
};

/// Public view of the `scheduled_unlocks` object. `timeZoneIds` is
/// resolved through a 2-hop join (`access_rules`/`access_rule_time_zones`)
/// -- not a real device column -- LIVE_CONFIRMED via
/// .plans/2026-09-15-scheduled-unlock-write-side/spec.md Background.
struct ScheduledUnlock {
    int64_t id = 0;
    std::string name;
    std::string message;
    std::vector<int64_t> timeZoneIds;
};

/// Creation parameters for the `scheduled_unlocks` object.
/// Deliberately has no `timeZoneIds` member -- create() never
/// auto-links any time zone (spec.md Decision 1); use
/// ScheduledUnlocksApi::addTimeZone() afterward.
struct NewScheduledUnlock {
    std::string name;
    std::string message;
};

/// Update parameters for the `scheduled_unlocks` object. Same
/// no-timeZoneIds rationale as NewScheduledUnlock -- linking is only
/// ever done via addTimeZone()/removeTimeZone().
struct ScheduledUnlockUpdate {
    int64_t id = 0;
    std::string name;
    std::string message;
};

/// Public view of the `user_types` object (User Types write-side
/// plan, 2026-09-16). `name` is NOT a `user_types` column -- it lives
/// on the linked `custom_tables` row and is resolved client-side by
/// UserTypesApi::list() (spec.md Decision 2). `customTableId` is
/// exposed read-only, informational only -- never caller-settable
/// (spec.md Decision 4).
struct UserType {
    int64_t id = 0;
    int64_t customTableId = 0;
    std::string name;
    bool requireVisitor = false;
};

/// Creation parameters. Deliberately has no `customTableId` member --
/// the dynamic table is always internally created (spec.md Decision 1).
struct NewUserType {
    std::string name;
    bool requireVisitor = false;
};

/// Update parameters. Same no-customTableId rationale as NewUserType.
struct UserTypeUpdate {
    int64_t id = 0;
    std::string name;
    bool requireVisitor = false;
};

/// Public view of the `custom_columns` object (Custom Fields
/// write-side plan, 2026-09-16). `table` is resolved from
/// `custom_table_id` via a join with `custom_tables`, the same
/// pattern as UserType.name. `type`/`mandatory` are deliberately NOT
/// exposed here -- LIVE_CONFIRMED that `custom_columns` has no such
/// column at all (device returns 400 for either field name); they are
/// write-only, present only on NewCustomField (spec.md Decision 2).
struct CustomField {
    int64_t id = 0;
    int64_t customTableId = 0;
    std::string table;
    std::string name;
};

/// Creation parameters. `table` must be one of "Users"/"Visitors"/
/// "Visits"; `type` must be one of "Text"/"Number" -- both validated
/// against these fixed sets before any device call (spec.md
/// Decision 4).
struct NewCustomField {
    std::string table;
    std::string type;
    std::string name;
    bool mandatory = false;
};

/// Update parameters. Deliberately has no table/type/mandatory member
/// -- LIVE_CONFIRMED immutable after creation, since custom_columns
/// has nowhere to store them (spec.md Decision 2).
struct CustomFieldUpdate {
    int64_t id = 0;
    std::string name;
};

/// Public view of the `reports` object (Reports read+export plan,
/// 2026-09-16). `object` is the report's backing table
/// (access_logs/users/alarm_logs/call_logs on this device). `header`
/// is a `delimiter`-joined string of display column labels -- the
/// CSV file's own header line.
struct ReportDefinition {
    int64_t id = 0;
    std::string name;
    std::string object;
    std::string header;
    std::string delimiter;
    std::string lineBreak;
};

/// Public view of the `report_filters` object -- a self-describing
/// filter widget. `value` is the device's own default (empty for
/// id-type filters, a JSON-encoded object string for range filters
/// like "time"). See ReportsApi::exportCsv() for how overrides work.
struct ReportFilter {
    int64_t id = 0;
    int64_t reportId = 0;
    std::string object;
    std::string field;
    std::string value;
    bool visible = true;
    bool editable = true;
};

/// Public view of the `visits` object (Visits plan, 2026-09-14).
/// `visitorName`/`hostName`/`cardCount` are enrichment fields this SDK
/// resolves via the already-existing UsersApi::getNamesByIds() and
/// detail::buildCardCountBody() -- not raw device columns themselves
/// (.plans/2026-09-14-implement-visits-enroll-visits-crud/spec.md
/// Decision 2).
struct Visit {
    int64_t id = 0;
    int64_t visitorId = 0;
    int64_t hostId = 0;
    std::string visitorName;
    std::string hostName;
    int64_t beginTime = 0;
    int64_t endTime = 0;
    bool finished = false;
    int cardCount = 0;
};

/// Creation parameters for the `visits` object. LIVE_CONFIRMED
/// 2026-09-14 via XHR-interceptor capture of the real device's own Add
/// Visit form (spec.md Background) -- `endTime` defaults to 0 (open-
/// ended), matching the captured payload's own convention. There is no
/// `finished` member -- a new visit is never created pre-finished
/// (spec.md Decision 4).
struct NewVisit {
    int64_t visitorId = 0;
    int64_t hostId = 0;
    int64_t beginTime = 0;
    int64_t endTime = 0;
};

/// Update parameters for the `visits` object. Callers set only the
/// fields they want to change. Deliberately has no `finished` member --
/// use VisitsApi::finish() instead, a dedicated method with its own
/// real device-side side effect (revoking the visitor's cards) that a
/// plain field edit must never trigger silently (spec.md Decision 4).
/// NOTE: the exact modify_objects.fcgi wire shape this builds is
/// inferred by symmetry with the confirmed create shape and this
/// codebase's existing buildUserUpdateBody convention -- not itself
/// live-captured this session (spec.md Risks). Confirm before/at
/// Group 8's live check.
struct VisitUpdate {
    int64_t id = 0;
    std::optional<int64_t> visitorId;
    std::optional<int64_t> hostId;
    std::optional<int64_t> beginTime;
    std::optional<int64_t> endTime;
};

/// List query for VisitsApi::list(). Matches the real device's own
/// default list filter (finished != 1, i.e. active/upcoming visits
/// only) -- no "include finished" toggle (spec.md Scope: out of
/// scope for this plan). No search/filter fields either (spec.md
/// Scope).
struct VisitQuery {
    int limit = 0;   // 0 -> AmicoConfig::defaultPageSize
    int offset = 0;
};

}  // namespace amico
