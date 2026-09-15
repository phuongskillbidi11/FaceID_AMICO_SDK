#pragma once

// Internal, purpose-built object read/write body builders.
//
// Deliberately NOT a generic `object`/`fields`/`where` builder that takes
// caller-supplied strings: this file's functions are the entire
// internal query surface, each hardcoding a confirmed field set and
// filter shape. No parameter here can carry an arbitrary object name,
// field name, or `where.connector` string -- see docs/amico-protocol-map.md's
// security notes on why that matters for this specific device (the search
// box's raw text flows into a SQL LIKE pattern; `where.connector` looks
// like string-concatenated SQL). This header is not installed under
// include/ and is not part of the public API.
//
// Hard rule (Decision 4, corrected Phase 2 spec): every read builder here
// always emits a non-empty "fields" array. Omitting "fields" was
// confirmed live to return every column of an object, including
// `panic_password`/`panic_salt` on `users` -- there is no code path in
// read builders that can produce a body without "fields". Write builders
// use the confirmed "values"/"where" shapes, not a "fields" array.

#include <cstdint>
#include <optional>
#include <string>
#include <vector>

#include <nlohmann/json.hpp>

namespace amico::detail {

/// GET-listing body for the Users page's confirmed default filter
/// (`user_type_id = 0 OR user_type_id IS NULL`), ordered by name.
/// `userTypeId` unset (default) preserves this exact filter; set,
/// it switches to a single `user_types.id = *userTypeId` clause
/// instead (Visitors plan, 2026-09-14, LIVE-CONFIRMED shape).
nlohmann::json buildUsersListBody(int limit, int offset, std::optional<int64_t> userTypeId = std::nullopt);

/// Single-user lookup by id (LIVE_CONFIRMED shape: a single `where`
/// clause needs no `connector`).
nlohmann::json buildUserGetBody(int64_t id);

/// Access-logs listing, newest first. Both `from` and `to` are applied
/// server-side as inclusive time bounds. Chained `where` array clauses
/// use implicit AND (LIVE_CONFIRMED 2026-09-14, spec.md Decision 5).
nlohmann::json buildAccessLogsListBody(std::optional<int64_t> from, std::optional<int64_t> to,
                                       int limit, int offset, const std::optional<std::vector<int64_t>>& userIds = std::nullopt, const std::optional<std::vector<int64_t>>& groupIds = std::nullopt, const std::optional<std::vector<int64_t>>& timeZoneIds = std::nullopt);

/// Access-log count with the same inclusive server-side bounds as listing.
nlohmann::json buildAccessLogsCountBody(std::optional<int64_t> from, std::optional<int64_t> to, const std::optional<std::vector<int64_t>>& userIds = std::nullopt, const std::optional<std::vector<int64_t>>& groupIds = std::nullopt, const std::optional<std::vector<int64_t>>& timeZoneIds = std::nullopt);

/// Minimal, unpaginated portal/time-zone name lookups (LIVE_CONFIRMED 2026-09-14).
nlohmann::json buildPortalsListBody();

/// Full name-only groups list for report filters.
nlohmann::json buildGroupsListBody();
nlohmann::json buildTimeZonesListBody();

/// Batch user name/registration lookup using the confirmed users.id array filter.
nlohmann::json buildUsersByIdsBody(const std::vector<int64_t>& ids);

/// Access-log -> access-rule join, batched by access_log_id (first hop of
/// the 2-hop time-zone join -- LIVE-CAPTURED schema, spec.md Decision 2b:
/// `access_logs` has no direct `time_zone_id`).
nlohmann::json buildAccessLogAccessRulesBody(const std::vector<int64_t>& accessLogIds);

/// Access-rule -> time-zone join, batched by access_rule_id (second hop of
/// the same join).
nlohmann::json buildAccessRuleTimeZonesBody(const std::vector<int64_t>& accessRuleIds);

/// Reads the `c_users` row (if any) for a given user id -- id, cpf
/// (Visitors plan, 2026-09-14; LIVE-CONFIRMED field set via
/// `object_metadata.fcgi` and direct `window['c_users']` class
/// introspection).
nlohmann::json buildCUsersGetBody(int64_t userId);
/// Creates a `c_users` row linking userId to a CPF value.
nlohmann::json buildCUsersCreateBody(int64_t userId, const std::string& cpf);
/// Updates an existing `c_users` row's cpf value by its own row id.
nlohmann::json buildCUsersUpdateBody(int64_t cUsersRowId, const std::string& cpf);
/// Defensive cleanup: destroys any `c_users` row for a given user id.
/// Whether the device cascades this on its own is unconfirmed -- this
/// mirrors the existing `buildFaceTemplatesDeleteBody` precedent of
/// not assuming cascade delete without evidence.
nlohmann::json buildCUsersDeleteBody(int64_t userId);

/// GET-listing body for `visits`, matching the real device's own
/// default filter (`finished != 1`) -- LIVE_CONFIRMED shape via
/// class.js's own `defaultWhere`
/// (.plans/2026-09-14-implement-visits-enroll-visits-crud/spec.md
/// Background).
nlohmann::json buildVisitsListBody(int limit, int offset);

/// Single-visit lookup by id -- no `finished` filter (a specific known
/// id, regardless of state), same pattern as buildUserGetBody.
nlohmann::json buildVisitGetBody(int64_t id);

/// Single-visit creation body for `create_objects.fcgi`.
/// LIVE_CONFIRMED wire shape 2026-09-14 via XHR-interceptor capture
/// (spec.md Background): `join:"LEFT"`, `fields` lists all 6 columns,
/// `where:[]`, `order:["id"]`, one-element `values` array with
/// visitor_id/host_id/begin_time/end_time/finished:0. Unlike
/// `buildUserCreateBody`, this real capture DOES include
/// join/fields/where/order alongside `values` -- kept verbatim rather
/// than "cleaned up" to match `buildUserCreateBody`'s leaner shape,
/// since this is what was actually observed on the wire for this
/// specific object.
nlohmann::json buildVisitCreateBody(int64_t visitorId, int64_t hostId,
                                     int64_t beginTime, int64_t endTime);

/// Single-visit partial-update body for `modify_objects.fcgi`. Unset
/// values are omitted. NOT live-captured this session (spec.md Risks)
/// -- built by symmetry with buildUserUpdateBody's confirmed
/// bare-object `values` + scalar `where.id` shape. Never includes
/// `finished` (see VisitUpdate's own doc comment).
nlohmann::json buildVisitUpdateBody(int64_t id,
                                     std::optional<int64_t> visitorId = std::nullopt,
                                     std::optional<int64_t> hostId = std::nullopt,
                                     std::optional<int64_t> beginTime = std::nullopt,
                                     std::optional<int64_t> endTime = std::nullopt);

/// Single-visit deletion body for `destroy_objects.fcgi`. Does NOT
/// touch the visitor's cards (spec.md Risks -- only finish() does
/// that, matching confirmed device behavior).
nlohmann::json buildVisitDeleteBody(int64_t id);

/// Sets a visit's `finished`/`end_time` fields directly (internal use
/// only, by VisitsApi::finish() -- never exposed via VisitUpdate).
/// LIVE_CONFIRMED shape via class.js's own finished-branch save()
/// (spec.md Background): `values: {"finished": 1, "end_time": <now>}`.
nlohmann::json buildVisitFinishBody(int64_t id, int64_t endTime);

/// Revokes every card currently issued to a given user id. LIVE_
/// CONFIRMED literal shape via class.js's own finish-branch
/// destroy_objects call (spec.md Background):
/// `{object:"cards", where:{cards:{user_id:{"==":userId}}}}`. Used by
/// VisitsApi::finish() to revoke the visitor's cards; deliberately a
/// distinct builder from the existing single-card
/// buildCardRemoveBody(cardId) (removes ALL of one user's cards, not
/// one card by its own id).
nlohmann::json buildUserCardsDeleteBody(int64_t userId);

/// Single-user creation body for `create_objects.fcgi` (JS_CONFIRMED,
/// wire-verified live 2026-09-12). `values` is always a one-element
/// array -- the server rejects a bare object with HTTP 400
/// (`create_objects` supports bulk-create of multiple objects; this SDK
/// only ever creates one at a time). Strings are field values, never
/// object/field/connector names. No password/salt fields are accepted.
/// `userTypeId` unset (default) omits `user_type_id` from `values`
/// entirely -- byte-for-byte the same body regular User creation has
/// always sent. Set, it adds `"user_type_id": *userTypeId` to the
/// same values object (Visitors plan, 2026-09-14, LIVE-CONFIRMED via
/// direct browser class introspection of the device's own save()
/// mechanism -- see spec.md's Background section).
nlohmann::json buildUserCreateBody(const std::string& name, const std::string& registration,
                                    std::optional<int64_t> userTypeId = std::nullopt);

/// Single-user partial-update body for `modify_objects.fcgi` (JS_CONFIRMED).
/// Unset values are omitted; an explicitly empty string is sent unchanged.
/// The id filter is a scalar and has no connector. `beginTime`/`endTime`
/// (unix epoch seconds) LIVE-CONFIRMED 2026-09-14 via the real device's
/// own "Default Users" edit form -- see `UserUpdate`'s own doc comment.
nlohmann::json buildUserUpdateBody(int64_t id, const std::optional<std::string>& name,
                                  const std::optional<std::string>& registration,
                                  std::optional<int64_t> beginTime = std::nullopt,
                                  std::optional<int64_t> endTime = std::nullopt);

/// Single-user deletion body for `destroy_objects.fcgi` (JS_CONFIRMED).
/// The id filter is always a one-element array; no bulk-delete surface.
nlohmann::json buildUserDeleteBody(int64_t id);

/// Single-group membership creation body for `create_objects.fcgi`
/// (JS_CONFIRMED: class/intermediatetable.js add(), class/user.js's
/// user_groups instantiation; docs/ui-action-protocol-map.md, Task 0.3).
/// `values` is always a one-element array with group_id and user_id.
nlohmann::json buildGroupAddBody(int64_t userId, int64_t groupId);

/// Single-group membership deletion body for `destroy_objects.fcgi`
/// (JS_CONFIRMED: class/intermediatetable.js remove();
/// docs/ui-action-protocol-map.md, Task 0.3). The group_id filter is a
/// one-element array; user_id is a scalar.
nlohmann::json buildGroupRemoveBody(int64_t userId, int64_t groupId);

/// Single-card creation body for `create_objects.fcgi` (JS_CONFIRMED:
/// class/user.js's Card.save()/setValue(); docs/ui-action-protocol-map.md,
/// Task 0.4). Packs the numeric value as areaCode * 4294967296 + cardNumber;
/// the caller must supply components whose packed value fits int64_t.
/// `values` is always a one-element array.
nlohmann::json buildCardAddBody(int64_t userId, int64_t areaCode, int64_t cardNumber);

/// Single-card deletion body for `destroy_objects.fcgi` (JS_CONFIRMED:
/// class/user.js's Card and Messenger removal path;
/// docs/ui-action-protocol-map.md, Task 0.4). The id filter is always a
/// one-element array; no bulk-delete surface.
nlohmann::json buildCardRemoveBody(int64_t cardId);

/// Administrator grant/revoke body (JS_CONFIRMED: class/user.js's
/// UserRole.save(); docs/ui-action-protocol-map.md, Task 0.5). Grant uses
/// `create_objects.fcgi` with a one-element values array; revoke uses
/// `destroy_objects.fcgi` with scalar user_id and role filters. Role is
/// always 1. The caller checks current state and skips redundant writes.
nlohmann::json buildAdministratorSetBody(int64_t userId, bool isAdmin);

/// Password/PIN set body for `modify_objects.fcgi` (JS_CONFIRMED:
/// class/user.js's User.save() -- password/salt are merged into the same
/// `values` object as name/registration and sent via the modify path for
/// an existing user). Takes an ALREADY-HASHED password+salt pair -- the
/// caller (Client.cpp) hashes via the device's own `user_hash_password`
/// command first, mirroring the real UI's flow. This function never
/// reads a value back; it only places the two strings into the outgoing
/// body. Deliberately NOT part of kUserWritableFields / buildUserUpdateBody
/// -- a caller cannot reach this path through the ordinary update() call,
/// keeping the "always ask before live execution" boundary structural,
/// not just a convention (see feedback_never_expose_password_hash.md).
nlohmann::json buildPasswordSetBody(int64_t userId, const std::string& hashedPassword,
                                     const std::string& salt);

/// `hasPassword` derivation body for `load_objects.fcgi` (see
/// docs/ui-action-protocol-map.md's "hasPassword derivation" section).
/// Requests ONLY the `password` field (never `salt`) for a single user.
/// Per JS_CONFIRMED evidence (class/user.js's validate() special-casing
/// the literal string "*****"), the device never returns the real
/// password hash on this or any read path -- only a fixed masked
/// sentinel when a password is set, or an empty/null value otherwise.
/// The caller (Client.cpp) must reduce the response to a boolean
/// immediately and must never store or expose the raw field value
/// through any public type.
nlohmann::json buildUserHasPasswordBody(int64_t id);

/// Group-membership read body for `load_objects.fcgi` -- lists the
/// `group_id`s a user belongs to. Reuses the `user_groups` table shape
/// already confirmed for writes (Task 0.3) rather than the real UI's
/// own users-keyed join read path (`User.getGroups()`), since this SDK
/// only needs the id list, not full Group name/detail rows, and the
/// `user_groups`-keyed where clause is the more directly evidenced
/// shape (identical to Task 0.3's add/remove).
nlohmann::json buildUserGroupIdsBody(int64_t userId);

/// Administrator-flag read body for `load_objects.fcgi` -- reuses the
/// `user_roles` table shape already confirmed for writes (Task 0.5):
/// presence of any row for this `user_id` means the user is an admin
/// (revoke deletes the row entirely; it never sets `role` to 0).
nlohmann::json buildUserIsAdminBody(int64_t userId);

/// Card count for a user, via `cards`' generic `COUNT(*)` shape
/// (JS_CONFIRMED: class/user.js's `Card`/`Messenger.countBy()` path).
nlohmann::json buildCardCountBody(int64_t userId);

/// Face-template count for a user (JS_CONFIRMED, literal call site:
/// class/user.js's `getCountFace()`). Count only -- this SDK never
/// requests or exposes raw template bytes.
nlohmann::json buildFaceCountBody(int64_t userId);

/// Other-biometric (e.g. fingerprint) template count for a user
/// (JS_CONFIRMED, literal call site: class/user.js's `getCountBio()`).
/// Count only, same rationale as `buildFaceCountBody`.
nlohmann::json buildBioCountBody(int64_t userId);

/// Body for `user_destroy_image.fcgi` (JS_CONFIRMED, Task 0.6) -- the
/// plain `.send()` JSON path, not `create_objects`/`destroy_objects`.
nlohmann::json buildUserDestroyImageBody(int64_t userId);

/// Body for `destroy_objects.fcgi` against `face_templates`, scoped to
/// one user (LIVE_CONFIRMED 2026-09-13, `en_US/js/CID.js`'s generic
/// image-field save handler: removing a user's image also destroys
/// their face_templates rows in the same real-UI flow -- `user_set_image`
/// is coupled to face-recognition enrollment, not a purely cosmetic
/// photo store; see docs/ui-action-protocol-map.md's "Image encoding
/// requirement" section, amended 2026-09-13).
nlohmann::json buildFaceTemplatesDeleteBody(int64_t userId);

/// Field lists used by the builders above, exposed so tests
/// can assert on them without re-deriving the literals.
extern const std::vector<std::string> kUserFields;
extern const std::vector<std::string> kAccessLogFields;
extern const std::vector<std::string> kUserWritableFields;
extern const std::vector<std::string> kUserGroupWritableFields;
extern const std::vector<std::string> kCardWritableFields;
extern const std::vector<std::string> kUserRoleWritableFields;
extern const std::vector<std::string> kVisitFields;

}  // namespace amico::detail
