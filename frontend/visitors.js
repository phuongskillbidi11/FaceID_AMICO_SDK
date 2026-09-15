"use strict";

initUserListPage({
  tabId: "visitors",
  apiPath: "/visitors",
  itemSingular: "Visitor",
  itemPlural: "visitors",
  // CPF (Brazil-region custom field, `c_users` table) -- LIVE-CONFIRMED
  // on the real device's own Add/Edit Visitor form this session; see
  // .plans/2026-09-14-implement-visitors-enroll-visitors-list-/spec.md.
  extraGeneralFields: [{ key: "cpf", label: "CPF" }],
  // The real device's own Visitor form has no Administrator toggle
  // (confirmed live this session) -- no /visitors/:id/administrator
  // route exists either (deliberately, matching that same evidence).
  showAdministrator: false,
});
