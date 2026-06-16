# ATLAS LMS — WIREFRAMES v1
## Phase 0 + Phase 1A + Phase 1B

**Role:** Principal Product Architect · Principal UX Architect · Principal SaaS Architect · Principal LMS Architect · Principal Security Architect · CTO
**Status:** Implementation-ready wireframe specification — structure only
**Scope:** Phase 0 + Phase 1A + Phase 1B only. No Phase 2/3/4 screens, workflows, APIs, roles, entities, permissions, or entitlements are introduced.

## 0. Binding Contract

This document sits entirely on top of the locked Atlas LMS artifacts. It does not redesign product behavior, create new screens, create new APIs, create new permissions, create new workflows, create new roles, or create new entities. Screen Inventory v1 is the authoritative screen list. API Inventory v1 is the authoritative route/API list. Permission Matrix v1 is the authorization source of truth. User Flows & Journey Maps v1 is the traversal source of truth.

No visual styling, color system, design language, or component-library decision is defined here. These wireframes define only structure, states, navigation, actions, and engineering constraints.

## 1. Global Wireframe Rules

1. **No render before gates.** Protected screens render only after host resolution, tenant-state gate, authentication, ACTIVE membership, transaction-local tenant context, entitlement gate if any, and `can()` permission check pass.
2. **Public allow-list only.** Anonymous surfaces are limited to A1–A10 as declared; public community/catalog/admin/platform routes do not exist.
3. **Permission and entitlement are both required.** Entitlement failure uses `ENTITLEMENT_REQUIRED` and hides route navigation where the entire route is gated. Permission failure uses safe denial without leaking cross-tenant existence.
4. **Platform isolation is physical and navigational.** P-series screens live only in the platform console and require platform role + reason-bound scope where actioning tenants.
5. **Human gate remains explicit.** Publish/issue/review transitions route through S1 or the declared workflow API. No builder flips directly from DRAFT to PUBLISHED unless configured pass-through still records workflow transition.
6. **Mobile behavior is responsive web only in this scope.** Native mobile app builds are Phase 3 and not specified here.

## 2. Shell-Level Structural Wireframes

### 2.1 Public Site Shell
```text
+------------------------------------------------------------+
| Tenant brand / public nav / login-signup                   |
+------------------------------------------------------------+
| Public page main content                                   |
| CTA / form / public result / verification card              |
+------------------------------------------------------------+
| Footer / legal / support                                   |
+------------------------------------------------------------+
```

### 2.2 Learner App Shell
```text
+--------------------------------------------------------------------------------+
| Tenant header / search / notifications / profile                               |
+-------------------+------------------------------------------------------------+
| Learner navigation| Page-specific main content                                |
| collapses mobile  | Primary action region / cards / feed / runner             |
+-------------------+------------------------------------------------------------+
```

### 2.3 Studio / Admin / Moderation Control Shell
```text
+--------------------------------------------------------------------------------+
| Control-plane header / page title / guarded primary action                      |
+-------------------+------------------------------------------------------------+
| Role nav          | Table/editor/detail/queue region                          |
|                   | Secondary panels, validation, history, confirmation areas   |
+-------------------+------------------------------------------------------------+
```

### 2.4 Platform Console Shell
```text
+--------------------------------------------------------------------------------+
| Platform header / MFA/session status / reason context                           |
+-------------------+------------------------------------------------------------+
| Platform nav      | Cross-tenant platform tables/details                       |
| isolated only     | Reason-bound lifecycle/support/audit actions               |
+-------------------+------------------------------------------------------------+
```

## 3. Screen Wireframes

### A1 — Public Academy Home / Landing

1. **Screen ID:** A1
2. **Screen Name:** Public Academy Home / Landing
3. **Route:** `/` , `/p/:slug`
4. **Actor:** Anonymous Visitor (Public site shell)
5. **Entry Sources:** Tenant host root, campaign links, public slug route.
6. **Exit Destinations:** → A2, A6, A7
7. **Required Permission:** pub
8. **Required Entitlement:** None declared for this screen in Phase 0/1.
9. **Data Sources / APIs:** Declared APIs: `GET /public/landing/:slug`; branding/theme (resolved at edge). Data projection is limited to entities reachable through those APIs and the resolved tenant context; UI must not query tables directly.
10. **Layout Structure:** Public shell with tenant branding/header, single main content region, and footer/system prompt region. Core regions: Hero + primary CTA, trust/funded-count copy (config), featured-cert verify entry, footer.
11. **Navigation Areas:** Public topbar/inline CTA only; no tenant-member nav. Inventory nav: Topbar logo, hero CTA.
12. **Page Sections:** Hero + primary CTA, trust/funded-count copy (config), featured-cert verify entry, footer
13. **Primary Actions:** Mint attribution token and continue to external CTA only after policy gate.
14. **Secondary Actions:** Navigate to declared child/destination screens only.
15. **Empty States:** Show tenant-branded minimal content and the next safe public action; do not expose protected data.
16. **Loading States:** Resolve tenant + public data first; show minimal skeleton and never flash another tenant brand.
17. **Error States:** Use standard error envelope handling: validation errors inline; 401 to login; 403 permission/ownership/relationship denial as disabled action or role home; 404 without cross-tenant existence leakage; 409 idempotency/conflict where applicable; 429/503 as safe retry/tenant-state messaging.
18. **Membership Gate States:** No ACTIVE membership required. If authenticated user lacks membership, remain in public flow except A9 invite acceptance.
19. **Entitlement Failure States:** Not applicable; screen has no declared route-level entitlement. Still hide/disable sub-actions if their API entitlement fails.
20. **Mobile Behavior:** Single-column public layout; forms/results fit one viewport column; CTA remains reachable without obscuring content.
21. **Accessibility Notes:** Keyboard navigable; focus order follows header/nav/main/actions; visible labels for forms/actions; server errors announced in an accessible region.
22. **Audit-Relevant Actions:** No sensitive tenant mutation; public diagnostic/session events may be telemetry/audit where declared.
23. **Notes for Engineering:** Screen must use only declared APIs and route metadata; no client-supplied `tenant_id`; host resolution is authoritative.

### A2 — Public Diagnostic (anonymous)

1. **Screen ID:** A2
2. **Screen Name:** Public Diagnostic (anonymous)
3. **Route:** `/diagnostic`
4. **Actor:** Anonymous Visitor (Public site shell)
5. **Entry Sources:** A1 hero CTA, direct diagnostic link, campaign link.
6. **Exit Destinations:** Identity Gate modal (A3)
7. **Required Permission:** pub `diagnostic.start` variant
8. **Required Entitlement:** None declared for this screen in Phase 0/1.
9. **Data Sources / APIs:** Declared APIs: `POST /public/diagnostic/start`; `GET /public/diagnostic/:anonId/result`. Data projection is limited to entities reachable through those APIs and the resolved tenant context; UI must not query tables directly.
10. **Layout Structure:** Public shell with tenant branding/header, single main content region, and footer/system prompt region. Core regions: Question runner (progress bar, mobile-first), per-item card.
11. **Navigation Areas:** Public topbar/inline CTA only; no tenant-member nav. Inventory nav: Hero CTA.
12. **Page Sections:** Question runner (progress bar, mobile-first), per-item card
13. **Primary Actions:** Start or continue the declared run/attempt when allowed; Create/submit the primary resource or state transition.
14. **Secondary Actions:** Open declared modal/confirmation path; Navigate to declared child/destination screens only.
15. **Empty States:** Show tenant-branded minimal content and the next safe public action; do not expose protected data.
16. **Loading States:** Resolve tenant + public data first; show minimal skeleton and never flash another tenant brand.
17. **Error States:** Use standard error envelope handling: validation errors inline; 401 to login; 403 permission/ownership/relationship denial as disabled action or role home; 404 without cross-tenant existence leakage; 409 idempotency/conflict where applicable; 429/503 as safe retry/tenant-state messaging.
18. **Membership Gate States:** No ACTIVE membership required. If authenticated user lacks membership, remain in public flow except A9 invite acceptance.
19. **Entitlement Failure States:** Not applicable; screen has no declared route-level entitlement. Still hide/disable sub-actions if their API entitlement fails.
20. **Mobile Behavior:** Single-column public layout; forms/results fit one viewport column; CTA remains reachable without obscuring content.
21. **Accessibility Notes:** Keyboard navigable; focus order follows header/nav/main/actions; visible labels for forms/actions; server errors announced in an accessible region. Modals trap focus, provide escape/close semantics where safe, and return focus to the opener.
22. **Audit-Relevant Actions:** No sensitive tenant mutation; public diagnostic/session events may be telemetry/audit where declared.
23. **Notes for Engineering:** Screen must use only declared APIs and route metadata; no client-supplied `tenant_id`; host resolution is authoritative. Require idempotency/confirmation where route/table requires it; optimistic UI must roll back on server denial.

### A3 — Diagnostic Identity Gate

1. **Screen ID:** A3
2. **Screen Name:** Diagnostic Identity Gate
3. **Route:** modal on `/diagnostic`
4. **Actor:** Anonymous Visitor (Public site shell)
5. **Entry Sources:** A2 completion gate or A4 unlock-full-score prompt.
6. **Exit Destinations:** Signup (A7)
7. **Required Permission:** pub → signup
8. **Required Entitlement:** None declared for this screen in Phase 0/1.
9. **Data Sources / APIs:** Declared APIs: `POST /public/auth/signup`; `POST /public/diagnostic/:anonId/merge`. Data projection is limited to entities reachable through those APIs and the resolved tenant context; UI must not query tables directly.
10. **Layout Structure:** Public shell with tenant branding/header, single main content region, and footer/system prompt region. Core regions: Signup form, "unlock full scorecard" framing.
11. **Navigation Areas:** Public topbar/inline CTA only; no tenant-member nav. Inventory nav: Inline modal.
12. **Page Sections:** Signup form, "unlock full scorecard" framing
13. **Primary Actions:** Create/submit the primary resource or state transition.
14. **Secondary Actions:** Navigate to declared child/destination screens only.
15. **Empty States:** Show tenant-branded minimal content and the next safe public action; do not expose protected data.
16. **Loading States:** Resolve tenant + public data first; show minimal skeleton and never flash another tenant brand.
17. **Error States:** Use standard error envelope handling: validation errors inline; 401 to login; 403 permission/ownership/relationship denial as disabled action or role home; 404 without cross-tenant existence leakage; 409 idempotency/conflict where applicable; 429/503 as safe retry/tenant-state messaging.
18. **Membership Gate States:** No ACTIVE membership required. If authenticated user lacks membership, remain in public flow except A9 invite acceptance.
19. **Entitlement Failure States:** Not applicable; screen has no declared route-level entitlement. Still hide/disable sub-actions if their API entitlement fails.
20. **Mobile Behavior:** Single-column public layout; forms/results fit one viewport column; CTA remains reachable without obscuring content.
21. **Accessibility Notes:** Keyboard navigable; focus order follows header/nav/main/actions; visible labels for forms/actions; server errors announced in an accessible region. Charts/scores require text alternatives, tabular fallback, and non-color-only status indicators.
22. **Audit-Relevant Actions:** No sensitive tenant mutation; public diagnostic/session events may be telemetry/audit where declared.
23. **Notes for Engineering:** Screen must use only declared APIs and route metadata; no client-supplied `tenant_id`; host resolution is authoritative. Require idempotency/confirmation where route/table requires it; optimistic UI must roll back on server denial.

### A4 — Anonymous Diagnostic Scorecard

1. **Screen ID:** A4
2. **Screen Name:** Anonymous Diagnostic Scorecard
3. **Route:** `/diagnostic/result`
4. **Actor:** Anonymous Visitor (Public site shell)
5. **Entry Sources:** A2 diagnostic completion with anonymous session token.
6. **Exit Destinations:** → A3 / app dashboard
7. **Required Permission:** pub (session token)
8. **Required Entitlement:** None declared for this screen in Phase 0/1.
9. **Data Sources / APIs:** Declared APIs: `GET /public/diagnostic/:anonId/result`. Data projection is limited to entities reachable through those APIs and the resolved tenant context; UI must not query tables directly.
10. **Layout Structure:** Public shell with tenant branding/header, single main content region, and footer/system prompt region. Core regions: Radar/bar of 5 dimensions, band, single prescribed next action.
11. **Navigation Areas:** Public topbar/inline CTA only; no tenant-member nav. Inventory nav: post-runner.
12. **Page Sections:** Radar/bar of 5 dimensions, band, single prescribed next action
13. **Primary Actions:** View/read the declared resource projection.
14. **Secondary Actions:** Navigate to declared child/destination screens only.
15. **Empty States:** Show tenant-branded minimal content and the next safe public action; do not expose protected data.
16. **Loading States:** Resolve tenant + public data first; show minimal skeleton and never flash another tenant brand.
17. **Error States:** Use standard error envelope handling: validation errors inline; 401 to login; 403 permission/ownership/relationship denial as disabled action or role home; 404 without cross-tenant existence leakage; 409 idempotency/conflict where applicable; 429/503 as safe retry/tenant-state messaging.
18. **Membership Gate States:** No ACTIVE membership required. If authenticated user lacks membership, remain in public flow except A9 invite acceptance.
19. **Entitlement Failure States:** Not applicable; screen has no declared route-level entitlement. Still hide/disable sub-actions if their API entitlement fails.
20. **Mobile Behavior:** Single-column public layout; forms/results fit one viewport column; CTA remains reachable without obscuring content.
21. **Accessibility Notes:** Keyboard navigable; focus order follows header/nav/main/actions; visible labels for forms/actions; server errors announced in an accessible region. Charts/scores require text alternatives, tabular fallback, and non-color-only status indicators.
22. **Audit-Relevant Actions:** No sensitive tenant mutation; public diagnostic/session events may be telemetry/audit where declared.
23. **Notes for Engineering:** Screen must use only declared APIs and route metadata; no client-supplied `tenant_id`; host resolution is authoritative.

### A5 — Certificate Verification

1. **Screen ID:** A5
2. **Screen Name:** Certificate Verification
3. **Route:** `/verify/:credentialId`
4. **Actor:** Anonymous Visitor (Public site shell)
5. **Entry Sources:** Certificate QR/share link, A1 verify entry.
6. **Exit Destinations:** Back to public landing, authentication, or relevant public result state.
7. **Required Permission:** pub
8. **Required Entitlement:** None declared for this screen in Phase 0/1.
9. **Data Sources / APIs:** Declared APIs: `GET /public/verify/:credentialId`. Data projection is limited to entities reachable through those APIs and the resolved tenant context; UI must not query tables directly.
10. **Layout Structure:** Public shell with tenant branding/header, single main content region, and footer/system prompt region. Core regions: Credential status card (minimal projection), issuer brand.
11. **Navigation Areas:** Public topbar/inline CTA only; no tenant-member nav. Inventory nav: direct link / QR.
12. **Page Sections:** Credential status card (minimal projection), issuer brand
13. **Primary Actions:** Issue credential when workflow/permission allows.
14. **Secondary Actions:** Open declared modal/confirmation path; Navigate to declared child/destination screens only.
15. **Empty States:** Show tenant-branded minimal content and the next safe public action; do not expose protected data.
16. **Loading States:** Resolve tenant + public data first; show minimal skeleton and never flash another tenant brand.
17. **Error States:** Use standard error envelope handling: validation errors inline; 401 to login; 403 permission/ownership/relationship denial as disabled action or role home; 404 without cross-tenant existence leakage; 409 idempotency/conflict where applicable; 429/503 as safe retry/tenant-state messaging.
18. **Membership Gate States:** No ACTIVE membership required. If authenticated user lacks membership, remain in public flow except A9 invite acceptance.
19. **Entitlement Failure States:** Not applicable; screen has no declared route-level entitlement. Still hide/disable sub-actions if their API entitlement fails.
20. **Mobile Behavior:** Single-column public layout; forms/results fit one viewport column; CTA remains reachable without obscuring content.
21. **Accessibility Notes:** Keyboard navigable; focus order follows header/nav/main/actions; visible labels for forms/actions; server errors announced in an accessible region.
22. **Audit-Relevant Actions:** No sensitive tenant mutation; public diagnostic/session events may be telemetry/audit where declared.
23. **Notes for Engineering:** Screen must use only declared APIs and route metadata; no client-supplied `tenant_id`; host resolution is authoritative.

### A6 — Login

1. **Screen ID:** A6
2. **Screen Name:** Login
3. **Route:** `/login`
4. **Actor:** Anonymous Visitor (Public site shell)
5. **Entry Sources:** Topbar login, protected-route 401 redirect, admin-login path from A10.
6. **Exit Destinations:** Password Reset (A8), MFA modal
7. **Required Permission:** pub
8. **Required Entitlement:** None declared for this screen in Phase 0/1.
9. **Data Sources / APIs:** Declared APIs: `POST /public/auth/login`. Data projection is limited to entities reachable through those APIs and the resolved tenant context; UI must not query tables directly.
10. **Layout Structure:** Public shell with tenant branding/header, single main content region, and footer/system prompt region. Core regions: Email/password form, MFA challenge, error states.
11. **Navigation Areas:** Public topbar/inline CTA only; no tenant-member nav. Inventory nav: Topbar.
12. **Page Sections:** Email/password form, MFA challenge, error states
13. **Primary Actions:** Create/submit the primary resource or state transition.
14. **Secondary Actions:** Open declared modal/confirmation path; Navigate to declared child/destination screens only.
15. **Empty States:** Show tenant-branded minimal content and the next safe public action; do not expose protected data.
16. **Loading States:** Resolve tenant + public data first; show minimal skeleton and never flash another tenant brand.
17. **Error States:** Use standard error envelope handling: validation errors inline; 401 to login; 403 permission/ownership/relationship denial as disabled action or role home; 404 without cross-tenant existence leakage; 409 idempotency/conflict where applicable; 429/503 as safe retry/tenant-state messaging.
18. **Membership Gate States:** No ACTIVE membership required. If authenticated user lacks membership, remain in public flow except A9 invite acceptance.
19. **Entitlement Failure States:** Not applicable; screen has no declared route-level entitlement. Still hide/disable sub-actions if their API entitlement fails.
20. **Mobile Behavior:** Single-column public layout; forms/results fit one viewport column; CTA remains reachable without obscuring content.
21. **Accessibility Notes:** Keyboard navigable; focus order follows header/nav/main/actions; visible labels for forms/actions; server errors announced in an accessible region. Modals trap focus, provide escape/close semantics where safe, and return focus to the opener.
22. **Audit-Relevant Actions:** Auth/invite events are audit/security-log relevant; no tenant data mutation outside declared public auth/invite APIs.
23. **Notes for Engineering:** Screen must use only declared APIs and route metadata; no client-supplied `tenant_id`; host resolution is authoritative. Require idempotency/confirmation where route/table requires it; optimistic UI must roll back on server denial.

### A7 — Signup

1. **Screen ID:** A7
2. **Screen Name:** Signup
3. **Route:** `/signup`
4. **Actor:** Anonymous Visitor (Public site shell)
5. **Entry Sources:** Topbar signup, A3 identity gate, public CTA.
6. **Exit Destinations:** Email-verify notice
7. **Required Permission:** pub
8. **Required Entitlement:** None declared for this screen in Phase 0/1.
9. **Data Sources / APIs:** Declared APIs: `POST /public/auth/signup`. Data projection is limited to entities reachable through those APIs and the resolved tenant context; UI must not query tables directly.
10. **Layout Structure:** Public shell with tenant branding/header, single main content region, and footer/system prompt region. Core regions: Signup form, email-verification notice.
11. **Navigation Areas:** Public topbar/inline CTA only; no tenant-member nav. Inventory nav: Topbar / A3.
12. **Page Sections:** Signup form, email-verification notice
13. **Primary Actions:** Create/submit the primary resource or state transition.
14. **Secondary Actions:** Navigate to declared child/destination screens only.
15. **Empty States:** Show tenant-branded minimal content and the next safe public action; do not expose protected data.
16. **Loading States:** Resolve tenant + public data first; show minimal skeleton and never flash another tenant brand.
17. **Error States:** Use standard error envelope handling: validation errors inline; 401 to login; 403 permission/ownership/relationship denial as disabled action or role home; 404 without cross-tenant existence leakage; 409 idempotency/conflict where applicable; 429/503 as safe retry/tenant-state messaging.
18. **Membership Gate States:** No ACTIVE membership required. If authenticated user lacks membership, remain in public flow except A9 invite acceptance.
19. **Entitlement Failure States:** Not applicable; screen has no declared route-level entitlement. Still hide/disable sub-actions if their API entitlement fails.
20. **Mobile Behavior:** Single-column public layout; forms/results fit one viewport column; CTA remains reachable without obscuring content.
21. **Accessibility Notes:** Keyboard navigable; focus order follows header/nav/main/actions; visible labels for forms/actions; server errors announced in an accessible region.
22. **Audit-Relevant Actions:** Auth/invite events are audit/security-log relevant; no tenant data mutation outside declared public auth/invite APIs.
23. **Notes for Engineering:** Screen must use only declared APIs and route metadata; no client-supplied `tenant_id`; host resolution is authoritative. Require idempotency/confirmation where route/table requires it; optimistic UI must roll back on server denial.

### A8 — Password Reset

1. **Screen ID:** A8
2. **Screen Name:** Password Reset
3. **Route:** `/reset-password`
4. **Actor:** Anonymous Visitor (Public site shell)
5. **Entry Sources:** A6 password reset link.
6. **Exit Destinations:** Back to public landing, authentication, or relevant public result state.
7. **Required Permission:** pub (Supabase Auth)
8. **Required Entitlement:** None declared for this screen in Phase 0/1.
9. **Data Sources / APIs:** Declared APIs: Supabase Auth flow (no Atlas tenant API). Data projection is limited to entities reachable through those APIs and the resolved tenant context; UI must not query tables directly.
10. **Layout Structure:** Public shell with tenant branding/header, single main content region, and footer/system prompt region. Core regions: Request form, reset form.
11. **Navigation Areas:** Public topbar/inline CTA only; no tenant-member nav. Inventory nav: from A6.
12. **Page Sections:** Request form, reset form
13. **Primary Actions:** View/read the declared resource projection.
14. **Secondary Actions:** Navigate to declared child/destination screens only.
15. **Empty States:** Show tenant-branded minimal content and the next safe public action; do not expose protected data.
16. **Loading States:** Resolve tenant + public data first; show minimal skeleton and never flash another tenant brand.
17. **Error States:** Use standard error envelope handling: validation errors inline; 401 to login; 403 permission/ownership/relationship denial as disabled action or role home; 404 without cross-tenant existence leakage; 409 idempotency/conflict where applicable; 429/503 as safe retry/tenant-state messaging.
18. **Membership Gate States:** No ACTIVE membership required. If authenticated user lacks membership, remain in public flow except A9 invite acceptance.
19. **Entitlement Failure States:** Not applicable; screen has no declared route-level entitlement. Still hide/disable sub-actions if their API entitlement fails.
20. **Mobile Behavior:** Single-column public layout; forms/results fit one viewport column; CTA remains reachable without obscuring content.
21. **Accessibility Notes:** Keyboard navigable; focus order follows header/nav/main/actions; visible labels for forms/actions; server errors announced in an accessible region.
22. **Audit-Relevant Actions:** No sensitive tenant mutation; public diagnostic/session events may be telemetry/audit where declared.
23. **Notes for Engineering:** Screen must use only declared APIs and route metadata; no client-supplied `tenant_id`; host resolution is authoritative.

### A9 — Invitation Acceptance

1. **Screen ID:** A9
2. **Screen Name:** Invitation Acceptance
3. **Route:** `/invite/accept?token=`
4. **Actor:** Anonymous Visitor (Public site shell)
5. **Entry Sources:** Single-use invitation email link.
6. **Exit Destinations:** → app
7. **Required Permission:** pub (invite token)
8. **Required Entitlement:** None declared for this screen in Phase 0/1.
9. **Data Sources / APIs:** Declared APIs: `POST /public/invitations/accept`. Data projection is limited to entities reachable through those APIs and the resolved tenant context; UI must not query tables directly.
10. **Layout Structure:** Public shell with tenant branding/header, single main content region, and footer/system prompt region. Core regions: Token validation, accept CTA, role/tenant context.
11. **Navigation Areas:** Public topbar/inline CTA only; no tenant-member nav. Inventory nav: invite link.
12. **Page Sections:** Token validation, accept CTA, role/tenant context
13. **Primary Actions:** Create/submit the primary resource or state transition; Mint attribution token and continue to external CTA only after policy gate.
14. **Secondary Actions:** Navigate to declared child/destination screens only.
15. **Empty States:** Show tenant-branded minimal content and the next safe public action; do not expose protected data.
16. **Loading States:** Resolve tenant + public data first; show minimal skeleton and never flash another tenant brand.
17. **Error States:** Use standard error envelope handling: validation errors inline; 401 to login; 403 permission/ownership/relationship denial as disabled action or role home; 404 without cross-tenant existence leakage; 409 idempotency/conflict where applicable; 429/503 as safe retry/tenant-state messaging.
18. **Membership Gate States:** No ACTIVE membership required. If authenticated user lacks membership, remain in public flow except A9 invite acceptance.
19. **Entitlement Failure States:** Not applicable; screen has no declared route-level entitlement. Still hide/disable sub-actions if their API entitlement fails.
20. **Mobile Behavior:** Single-column public layout; forms/results fit one viewport column; CTA remains reachable without obscuring content.
21. **Accessibility Notes:** Keyboard navigable; focus order follows header/nav/main/actions; visible labels for forms/actions; server errors announced in an accessible region.
22. **Audit-Relevant Actions:** Auth/invite events are audit/security-log relevant; no tenant data mutation outside declared public auth/invite APIs.
23. **Notes for Engineering:** Screen must use only declared APIs and route metadata; no client-supplied `tenant_id`; host resolution is authoritative. Require idempotency/confirmation where route/table requires it; optimistic UI must roll back on server denial.

### A10 — Tenant Unavailable / Suspended Notice

1. **Screen ID:** A10
2. **Screen Name:** Tenant Unavailable / Suspended Notice
3. **Route:** system (503/404)
4. **Actor:** Anonymous Visitor (Public site shell)
5. **Entry Sources:** Tenant state gate before screen render.
6. **Exit Destinations:** A6 (admin only)
7. **Required Permission:** n/a
8. **Required Entitlement:** None declared for this screen in Phase 0/1.
9. **Data Sources / APIs:** Declared APIs: tenant-state gate. Data projection is limited to entities reachable through those APIs and the resolved tenant context; UI must not query tables directly.
10. **Layout Structure:** Public shell with tenant branding/header, single main content region, and footer/system prompt region. Core regions: Status message, admin-login allowed path.
11. **Navigation Areas:** Public topbar/inline CTA only; no tenant-member nav. Inventory nav: system.
12. **Page Sections:** Status message, admin-login allowed path
13. **Primary Actions:** Execute guarded lifecycle/destructive action with confirmation.
14. **Secondary Actions:** Navigate to declared child/destination screens only.
15. **Empty States:** Show tenant-branded minimal content and the next safe public action; do not expose protected data.
16. **Loading States:** Resolve tenant + public data first; show minimal skeleton and never flash another tenant brand.
17. **Error States:** Use standard error envelope handling: validation errors inline; 401 to login; 403 permission/ownership/relationship denial as disabled action or role home; 404 without cross-tenant existence leakage; 409 idempotency/conflict where applicable; 429/503 as safe retry/tenant-state messaging.
18. **Membership Gate States:** No ACTIVE membership required. If authenticated user lacks membership, remain in public flow except A9 invite acceptance.
19. **Entitlement Failure States:** Not applicable; screen has no declared route-level entitlement. Still hide/disable sub-actions if their API entitlement fails.
20. **Mobile Behavior:** Single-column public layout; forms/results fit one viewport column; CTA remains reachable without obscuring content.
21. **Accessibility Notes:** Keyboard navigable; focus order follows header/nav/main/actions; visible labels for forms/actions; server errors announced in an accessible region.
22. **Audit-Relevant Actions:** No sensitive tenant mutation; public diagnostic/session events may be telemetry/audit where declared.
23. **Notes for Engineering:** Screen must use only declared APIs and route metadata; no client-supplied `tenant_id`; host resolution is authoritative.

### L1 — Trader Dashboard (Home)

1. **Screen ID:** L1
2. **Screen Name:** Trader Dashboard (Home)
3. **Route:** `/`
4. **Actor:** Learner (Learner app shell)
5. **Entry Sources:** Sidebar (Home); post-login routing from A6 when learner permissions resolve; authorized deep link.
6. **Exit Destinations:** Learner dashboard, prior learner route, notification/search branch, or logout/settings as applicable.
7. **Required Permission:** `profile.read`, `competency.score.read` (self), `gamification.profile.read` (self), `progress.read` (self)
8. **Required Entitlement:** None declared for this screen in Phase 0/1.
9. **Data Sources / APIs:** Declared APIs: `GET /me`, `/me/competency`, `/me/gamification`, `/me/streaks`, `/learning-paths/:id/progress`, `/readiness-policy`. Data projection is limited to entities reachable through those APIs and the resolved tenant context; UI must not query tables directly.
10. **Layout Structure:** Complex split layout. See ASCII wireframe below. Core regions: Readiness band card, streak/XP widget, "continue" card, next-gate card, recommended swipe/lesson, stage CTA.
11. **Navigation Areas:** Learner sidebar or mobile bottom nav; topbar search/notifications when available. Inventory nav: Sidebar (Home).
12. **Page Sections:** Readiness band card, streak/XP widget, "continue" card, next-gate card, recommended swipe/lesson, stage CTA
13. **Primary Actions:** Mint attribution token and continue to external CTA only after policy gate.
14. **Secondary Actions:** Navigate to declared child/destination screens only.
15. **Empty States:** Show neutral empty state with role-appropriate next action or back navigation.
16. **Loading States:** Skeleton for header/nav and page body after membership/entitlement/permission checks; action buttons disabled until resource loaders complete.
17. **Error States:** Use standard error envelope handling: validation errors inline; 401 to login; 403 permission/ownership/relationship denial as disabled action or role home; 404 without cross-tenant existence leakage; 409 idempotency/conflict where applicable; 429/503 as safe retry/tenant-state messaging.
18. **Membership Gate States:** ACTIVE membership in resolved tenant is required. INVITED routes only to A9; SUSPENDED/REMOVED/no row routes to branded blocked/public state; stale tokens are never trusted.
19. **Entitlement Failure States:** Not applicable; screen has no declared route-level entitlement. Still hide/disable sub-actions if their API entitlement fails.
20. **Mobile Behavior:** Responsive learner web: sidebar collapses to bottom/accordion nav; cards stack; primary CTA sticky only when it does not hide content.
21. **Accessibility Notes:** Keyboard navigable; focus order follows header/nav/main/actions; visible labels for forms/actions; server errors announced in an accessible region.
22. **Audit-Relevant Actions:** Routine read screen; no per-action audit beyond access telemetry/rate limiting unless API declares it.
23. **Notes for Engineering:** Screen must use only declared APIs and route metadata; no client-supplied `tenant_id`; host resolution is authoritative. Server resource loader must declare permission, entitlement if any, and ownership/relationship loader before render.

**ASCII wireframe:**
```text
+--------------------------------------------------------------------------------+
| Tenant header / learner search / notifications / profile                         |
+-------------------+------------------------------------------------------------+
| Learner nav       | Readiness band + current stage                             |
| Home              | [Band] [5D summary] [primary next action]                  |
| Learn             +------------------------------------------------------------+
| Roadmap           | Continue learning        | Swipe due / weak dimension      |
| Practice          | course/lesson card       | practice card                  |
| Readiness         +------------------------------------------------------------+
| Community         | Next gate / checklist    | Streak / XP / certificate hints |
| Achievements      +------------------------------------------------------------+
| Settings          | Stage CTA / outbound CTA only when readiness policy allows |
+-------------------+------------------------------------------------------------+
```

### L2 — Course Catalog

1. **Screen ID:** L2
2. **Screen Name:** Course Catalog
3. **Route:** `/courses`
4. **Actor:** Learner (Learner app shell)
5. **Entry Sources:** Sidebar (Learn); post-login routing from A6 when learner permissions resolve; authorized deep link.
6. **Exit Destinations:** → L3
7. **Required Permission:** `course.read`, `search.query`
8. **Required Entitlement:** None declared for this screen in Phase 0/1.
9. **Data Sources / APIs:** Declared APIs: `GET /courses`, `GET /search`. Data projection is limited to entities reachable through those APIs and the resolved tenant context; UI must not query tables directly.
10. **Layout Structure:** Learner app shell with header, learner navigation, main content column, and contextual action area. Core regions: Filter rail (stage/dimension/persona/cert), course cards, lock badges, search box.
11. **Navigation Areas:** Learner sidebar or mobile bottom nav; topbar search/notifications when available. Inventory nav: Sidebar (Learn).
12. **Page Sections:** Filter rail (stage/dimension/persona/cert), course cards, lock badges, search box
13. **Primary Actions:** View/read the declared resource projection.
14. **Secondary Actions:** Search/filter/sort within allowed indexed fields; Navigate to declared child/destination screens only.
15. **Empty States:** Show an empty list/table/feed with a single permitted CTA when create/join/invite is allowed; otherwise show read-only explanatory copy.
16. **Loading States:** Skeleton for header/nav and page body after membership/entitlement/permission checks; action buttons disabled until resource loaders complete.
17. **Error States:** Use standard error envelope handling: validation errors inline; 401 to login; 403 permission/ownership/relationship denial as disabled action or role home; 404 without cross-tenant existence leakage; 409 idempotency/conflict where applicable; 429/503 as safe retry/tenant-state messaging.
18. **Membership Gate States:** ACTIVE membership in resolved tenant is required. INVITED routes only to A9; SUSPENDED/REMOVED/no row routes to branded blocked/public state; stale tokens are never trusted.
19. **Entitlement Failure States:** Not applicable; screen has no declared route-level entitlement. Still hide/disable sub-actions if their API entitlement fails.
20. **Mobile Behavior:** Responsive learner web: sidebar collapses to bottom/accordion nav; cards stack; primary CTA sticky only when it does not hide content.
21. **Accessibility Notes:** Keyboard navigable; focus order follows header/nav/main/actions; visible labels for forms/actions; server errors announced in an accessible region.
22. **Audit-Relevant Actions:** Routine read screen; no per-action audit beyond access telemetry/rate limiting unless API declares it.
23. **Notes for Engineering:** Screen must use only declared APIs and route metadata; no client-supplied `tenant_id`; host resolution is authoritative. Server resource loader must declare permission, entitlement if any, and ownership/relationship loader before render.

### L3 — Course Detail

1. **Screen ID:** L3
2. **Screen Name:** Course Detail
3. **Route:** `/courses/:id`
4. **Actor:** Learner (Learner app shell)
5. **Entry Sources:** from L2; post-login routing from A6 when learner permissions resolve; authorized deep link.
6. **Exit Destinations:** → L4; Enroll confirm modal
7. **Required Permission:** `course.read`, `enrollment.create` (self)
8. **Required Entitlement:** None declared for this screen in Phase 0/1.
9. **Data Sources / APIs:** Declared APIs: `GET /courses/:id`, `GET /courses/:id/modules`, `POST /enrollments`. Data projection is limited to entities reachable through those APIs and the resolved tenant context; UI must not query tables directly.
10. **Layout Structure:** Learner app shell with header, learner navigation, main content column, and contextual action area. Core regions: Module/lesson outline, enroll CTA, progress meter.
11. **Navigation Areas:** Learner sidebar or mobile bottom nav; topbar search/notifications when available. Inventory nav: from L2.
12. **Page Sections:** Module/lesson outline, enroll CTA, progress meter
13. **Primary Actions:** Enroll / continue enrolled resource; Create/submit the primary resource or state transition; Mint attribution token and continue to external CTA only after policy gate.
14. **Secondary Actions:** Open declared modal/confirmation path; Navigate to declared child/destination screens only.
15. **Empty States:** Show "no data yet" with the next permitted learning/practice/admin setup action.
16. **Loading States:** Skeleton for header/nav and page body after membership/entitlement/permission checks; action buttons disabled until resource loaders complete.
17. **Error States:** Use standard error envelope handling: validation errors inline; 401 to login; 403 permission/ownership/relationship denial as disabled action or role home; 404 without cross-tenant existence leakage; 409 idempotency/conflict where applicable; 429/503 as safe retry/tenant-state messaging.
18. **Membership Gate States:** ACTIVE membership in resolved tenant is required. INVITED routes only to A9; SUSPENDED/REMOVED/no row routes to branded blocked/public state; stale tokens are never trusted.
19. **Entitlement Failure States:** Not applicable; screen has no declared route-level entitlement. Still hide/disable sub-actions if their API entitlement fails.
20. **Mobile Behavior:** Responsive learner web: sidebar collapses to bottom/accordion nav; cards stack; primary CTA sticky only when it does not hide content.
21. **Accessibility Notes:** Keyboard navigable; focus order follows header/nav/main/actions; visible labels for forms/actions; server errors announced in an accessible region. Modals trap focus, provide escape/close semantics where safe, and return focus to the opener.
22. **Audit-Relevant Actions:** Mutating/sensitive actions must emit declared audit/outbox events in the same transaction; destructive or irreversible actions require confirmation and reason/comment where specified.
23. **Notes for Engineering:** Screen must use only declared APIs and route metadata; no client-supplied `tenant_id`; host resolution is authoritative. Server resource loader must declare permission, entitlement if any, and ownership/relationship loader before render. Require idempotency/confirmation where route/table requires it; optimistic UI must roll back on server denial.

### L4 — Lesson Player

1. **Screen ID:** L4
2. **Screen Name:** Lesson Player
3. **Route:** `/courses/:id/lessons/:lessonId`
4. **Actor:** Learner (Learner app shell)
5. **Entry Sources:** within course; post-login routing from A6 when learner permissions resolve; authorized deep link.
6. **Exit Destinations:** → L7 (if quiz lesson)
7. **Required Permission:** `course.read`, `progress.read` (write own)
8. **Required Entitlement:** None declared for this screen in Phase 0/1.
9. **Data Sources / APIs:** Declared APIs: `GET /lessons/:id`, `GET /lessons/:id/assets`, `POST /lessons/:id/progress`. Data projection is limited to entities reachable through those APIs and the resolved tenant context; UI must not query tables directly.
10. **Layout Structure:** Learner app shell with header, learner navigation, main content column, and contextual action area. Core regions: Content viewer, asset list, mark-complete, next/prev, resume position.
11. **Navigation Areas:** Learner sidebar or mobile bottom nav; topbar search/notifications when available. Inventory nav: within course.
12. **Page Sections:** Content viewer, asset list, mark-complete, next/prev, resume position
13. **Primary Actions:** Create/submit the primary resource or state transition.
14. **Secondary Actions:** Navigate to declared child/destination screens only.
15. **Empty States:** Show an empty list/table/feed with a single permitted CTA when create/join/invite is allowed; otherwise show read-only explanatory copy.
16. **Loading States:** Skeleton for header/nav and page body after membership/entitlement/permission checks; action buttons disabled until resource loaders complete.
17. **Error States:** Use standard error envelope handling: validation errors inline; 401 to login; 403 permission/ownership/relationship denial as disabled action or role home; 404 without cross-tenant existence leakage; 409 idempotency/conflict where applicable; 429/503 as safe retry/tenant-state messaging.
18. **Membership Gate States:** ACTIVE membership in resolved tenant is required. INVITED routes only to A9; SUSPENDED/REMOVED/no row routes to branded blocked/public state; stale tokens are never trusted.
19. **Entitlement Failure States:** Not applicable; screen has no declared route-level entitlement. Still hide/disable sub-actions if their API entitlement fails.
20. **Mobile Behavior:** Responsive learner web: sidebar collapses to bottom/accordion nav; cards stack; primary CTA sticky only when it does not hide content.
21. **Accessibility Notes:** Keyboard navigable; focus order follows header/nav/main/actions; visible labels for forms/actions; server errors announced in an accessible region.
22. **Audit-Relevant Actions:** Mutating/sensitive actions must emit declared audit/outbox events in the same transaction; destructive or irreversible actions require confirmation and reason/comment where specified.
23. **Notes for Engineering:** Screen must use only declared APIs and route metadata; no client-supplied `tenant_id`; host resolution is authoritative. Server resource loader must declare permission, entitlement if any, and ownership/relationship loader before render. Require idempotency/confirmation where route/table requires it; optimistic UI must roll back on server denial.

### L5 — Trader Career Roadmap

1. **Screen ID:** L5
2. **Screen Name:** Trader Career Roadmap
3. **Route:** `/roadmap`
4. **Actor:** Learner (Learner app shell)
5. **Entry Sources:** Sidebar (Roadmap); post-login routing from A6 when learner permissions resolve; authorized deep link.
6. **Exit Destinations:** → L6
7. **Required Permission:** `learning_path.read`, `progress.read` (self)
8. **Required Entitlement:** None declared for this screen in Phase 0/1.
9. **Data Sources / APIs:** Declared APIs: `GET /learning-paths`, `GET /learning-paths/:id`, `GET /learning-paths/:id/progress`. Data projection is limited to entities reachable through those APIs and the resolved tenant context; UI must not query tables directly.
10. **Layout Structure:** Learner app shell with header, learner navigation, main content column, and contextual action area. Core regions: Stage timeline, lock/unlock states, competency-band gate badges, current-stage CTA.
11. **Navigation Areas:** Learner sidebar or mobile bottom nav; topbar search/notifications when available. Inventory nav: Sidebar (Roadmap).
12. **Page Sections:** Stage timeline, lock/unlock states, competency-band gate badges, current-stage CTA
13. **Primary Actions:** Mint attribution token and continue to external CTA only after policy gate.
14. **Secondary Actions:** Navigate to declared child/destination screens only.
15. **Empty States:** Show neutral empty state with role-appropriate next action or back navigation.
16. **Loading States:** Skeleton for header/nav and page body after membership/entitlement/permission checks; action buttons disabled until resource loaders complete.
17. **Error States:** Use standard error envelope handling: validation errors inline; 401 to login; 403 permission/ownership/relationship denial as disabled action or role home; 404 without cross-tenant existence leakage; 409 idempotency/conflict where applicable; 429/503 as safe retry/tenant-state messaging.
18. **Membership Gate States:** ACTIVE membership in resolved tenant is required. INVITED routes only to A9; SUSPENDED/REMOVED/no row routes to branded blocked/public state; stale tokens are never trusted.
19. **Entitlement Failure States:** Not applicable; screen has no declared route-level entitlement. Still hide/disable sub-actions if their API entitlement fails.
20. **Mobile Behavior:** Responsive learner web: sidebar collapses to bottom/accordion nav; cards stack; primary CTA sticky only when it does not hide content.
21. **Accessibility Notes:** Keyboard navigable; focus order follows header/nav/main/actions; visible labels for forms/actions; server errors announced in an accessible region.
22. **Audit-Relevant Actions:** Routine read screen; no per-action audit beyond access telemetry/rate limiting unless API declares it.
23. **Notes for Engineering:** Screen must use only declared APIs and route metadata; no client-supplied `tenant_id`; host resolution is authoritative. Server resource loader must declare permission, entitlement if any, and ownership/relationship loader before render.

### L6 — Learning Path / Program Detail

1. **Screen ID:** L6
2. **Screen Name:** Learning Path / Program Detail
3. **Route:** `/paths/:id`
4. **Actor:** Learner (Learner app shell)
5. **Entry Sources:** from L5; post-login routing from A6 when learner permissions resolve; authorized deep link.
6. **Exit Destinations:** → L3/L4/L7
7. **Required Permission:** `learning_path.read`, `enrollment.create` (self), `progress.read` (self)
8. **Required Entitlement:** None declared for this screen in Phase 0/1.
9. **Data Sources / APIs:** Declared APIs: `GET /learning-paths/:id`, `POST /learning-paths/:id/enroll`, `GET /learning-paths/:id/progress`. Data projection is limited to entities reachable through those APIs and the resolved tenant context; UI must not query tables directly.
10. **Layout Structure:** Learner app shell with header, learner navigation, main content column, and contextual action area. Core regions: Step list, gate conditions, enroll CTA, progress rollup.
11. **Navigation Areas:** Learner sidebar or mobile bottom nav; topbar search/notifications when available. Inventory nav: from L5.
12. **Page Sections:** Step list, gate conditions, enroll CTA, progress rollup
13. **Primary Actions:** Enroll / continue enrolled resource; Create/submit the primary resource or state transition; Mint attribution token and continue to external CTA only after policy gate.
14. **Secondary Actions:** Navigate to declared child/destination screens only.
15. **Empty States:** Show an empty list/table/feed with a single permitted CTA when create/join/invite is allowed; otherwise show read-only explanatory copy.
16. **Loading States:** Skeleton for header/nav and page body after membership/entitlement/permission checks; action buttons disabled until resource loaders complete.
17. **Error States:** Use standard error envelope handling: validation errors inline; 401 to login; 403 permission/ownership/relationship denial as disabled action or role home; 404 without cross-tenant existence leakage; 409 idempotency/conflict where applicable; 429/503 as safe retry/tenant-state messaging.
18. **Membership Gate States:** ACTIVE membership in resolved tenant is required. INVITED routes only to A9; SUSPENDED/REMOVED/no row routes to branded blocked/public state; stale tokens are never trusted.
19. **Entitlement Failure States:** Not applicable; screen has no declared route-level entitlement. Still hide/disable sub-actions if their API entitlement fails.
20. **Mobile Behavior:** Responsive learner web: sidebar collapses to bottom/accordion nav; cards stack; primary CTA sticky only when it does not hide content.
21. **Accessibility Notes:** Keyboard navigable; focus order follows header/nav/main/actions; visible labels for forms/actions; server errors announced in an accessible region.
22. **Audit-Relevant Actions:** Mutating/sensitive actions must emit declared audit/outbox events in the same transaction; destructive or irreversible actions require confirmation and reason/comment where specified.
23. **Notes for Engineering:** Screen must use only declared APIs and route metadata; no client-supplied `tenant_id`; host resolution is authoritative. Server resource loader must declare permission, entitlement if any, and ownership/relationship loader before render. Require idempotency/confirmation where route/table requires it; optimistic UI must roll back on server denial.

### L7 — Assessment Overview (pre-start)

1. **Screen ID:** L7
2. **Screen Name:** Assessment Overview (pre-start)
3. **Route:** `/assessments/:id`
4. **Actor:** Learner (Learner app shell)
5. **Entry Sources:** from L4/L6; post-login routing from A6 when learner permissions resolve; authorized deep link.
6. **Exit Destinations:** Proctoring Consent modal
7. **Required Permission:** `assessment.read`, `attempt.start` (self)
8. **Required Entitlement:** None declared for this screen in Phase 0/1.
9. **Data Sources / APIs:** Declared APIs: `GET /assessments/:id`, `POST /assessments/:id/attempts`. Data projection is limited to entities reachable through those APIs and the resolved tenant context; UI must not query tables directly.
10. **Layout Structure:** Learner app shell with header, learner navigation, main content column, and contextual action area. Core regions: Rules panel, attempts/time info, L1-proctoring consent (if configured), start CTA.
11. **Navigation Areas:** Learner sidebar or mobile bottom nav; topbar search/notifications when available. Inventory nav: from L4/L6.
12. **Page Sections:** Rules panel, attempts/time info, L1-proctoring consent (if configured), start CTA
13. **Primary Actions:** Start or continue the declared run/attempt when allowed; Create/submit the primary resource or state transition; Mint attribution token and continue to external CTA only after policy gate.
14. **Secondary Actions:** Open declared modal/confirmation path; Navigate to declared child/destination screens only.
15. **Empty States:** Show neutral empty state with role-appropriate next action or back navigation.
16. **Loading States:** Skeleton for header/nav and page body after membership/entitlement/permission checks; action buttons disabled until resource loaders complete.
17. **Error States:** Use standard error envelope handling: validation errors inline; 401 to login; 403 permission/ownership/relationship denial as disabled action or role home; 404 without cross-tenant existence leakage; 409 idempotency/conflict where applicable; 429/503 as safe retry/tenant-state messaging.
18. **Membership Gate States:** ACTIVE membership in resolved tenant is required. INVITED routes only to A9; SUSPENDED/REMOVED/no row routes to branded blocked/public state; stale tokens are never trusted.
19. **Entitlement Failure States:** Not applicable; screen has no declared route-level entitlement. Still hide/disable sub-actions if their API entitlement fails.
20. **Mobile Behavior:** Responsive learner web: sidebar collapses to bottom/accordion nav; cards stack; primary CTA sticky only when it does not hide content.
21. **Accessibility Notes:** Keyboard navigable; focus order follows header/nav/main/actions; visible labels for forms/actions; server errors announced in an accessible region. Timer must be screen-reader announced without constant interruption; warnings use aria-live politely except submit-critical alerts. Modals trap focus, provide escape/close semantics where safe, and return focus to the opener.
22. **Audit-Relevant Actions:** Mutating/sensitive actions must emit declared audit/outbox events in the same transaction; destructive or irreversible actions require confirmation and reason/comment where specified.
23. **Notes for Engineering:** Screen must use only declared APIs and route metadata; no client-supplied `tenant_id`; host resolution is authoritative. Server resource loader must declare permission, entitlement if any, and ownership/relationship loader before render. Require idempotency/confirmation where route/table requires it; optimistic UI must roll back on server denial.

### L8 — Assessment Attempt Runner

1. **Screen ID:** L8
2. **Screen Name:** Assessment Attempt Runner
3. **Route:** `/attempts/:id`
4. **Actor:** Learner (Learner app shell)
5. **Entry Sources:** full-screen; post-login routing from A6 when learner permissions resolve; authorized deep link.
6. **Exit Destinations:** Submit-confirm modal; "lost focus" warning
7. **Required Permission:** `attempt.submit` (own)
8. **Required Entitlement:** None declared for this screen in Phase 0/1.
9. **Data Sources / APIs:** Declared APIs: `GET /attempts/:id`, `POST /attempts/:id/answers`, `POST /attempts/:id/submit`. Data projection is limited to entities reachable through those APIs and the resolved tenant context; UI must not query tables directly.
10. **Layout Structure:** Learner app shell with header, learner navigation, main content column, and contextual action area. Core regions: Question canvas, timer, autosave indicator, secure-mode (if set), L1 proctoring signal capture (tab/blur/fullscreen/copy-paste).
11. **Navigation Areas:** Learner sidebar or mobile bottom nav; topbar search/notifications when available. Inventory nav: full-screen.
12. **Page Sections:** Question canvas, timer, autosave indicator, secure-mode (if set), L1 proctoring signal capture (tab/blur/fullscreen/copy-paste)
13. **Primary Actions:** Start or continue the declared run/attempt when allowed; Create/submit the primary resource or state transition.
14. **Secondary Actions:** Open declared modal/confirmation path; Navigate to declared child/destination screens only.
15. **Empty States:** Show neutral empty state with role-appropriate next action or back navigation.
16. **Loading States:** Skeleton for header/nav and page body after membership/entitlement/permission checks; action buttons disabled until resource loaders complete.
17. **Error States:** Use standard error envelope handling: validation errors inline; 401 to login; 403 permission/ownership/relationship denial as disabled action or role home; 404 without cross-tenant existence leakage; 409 idempotency/conflict where applicable; 429/503 as safe retry/tenant-state messaging.
18. **Membership Gate States:** ACTIVE membership in resolved tenant is required. INVITED routes only to A9; SUSPENDED/REMOVED/no row routes to branded blocked/public state; stale tokens are never trusted.
19. **Entitlement Failure States:** Not applicable; screen has no declared route-level entitlement. Still hide/disable sub-actions if their API entitlement fails.
20. **Mobile Behavior:** Full-screen attempt mode; sticky timer/submit; question navigator collapses; autosave status remains visible; prevent accidental back navigation.
21. **Accessibility Notes:** Keyboard navigable; focus order follows header/nav/main/actions; visible labels for forms/actions; server errors announced in an accessible region. Timer must be screen-reader announced without constant interruption; warnings use aria-live politely except submit-critical alerts. Modals trap focus, provide escape/close semantics where safe, and return focus to the opener.
22. **Audit-Relevant Actions:** Mutating/sensitive actions must emit declared audit/outbox events in the same transaction; destructive or irreversible actions require confirmation and reason/comment where specified.
23. **Notes for Engineering:** Screen must use only declared APIs and route metadata; no client-supplied `tenant_id`; host resolution is authoritative. Server resource loader must declare permission, entitlement if any, and ownership/relationship loader before render. Require idempotency/confirmation where route/table requires it; optimistic UI must roll back on server denial.

### L9 — Attempt Result / Review

1. **Screen ID:** L9
2. **Screen Name:** Attempt Result / Review
3. **Route:** `/attempts/:id/result`
4. **Actor:** Learner (Learner app shell)
5. **Entry Sources:** from L8; post-login routing from A6 when learner permissions resolve; authorized deep link.
6. **Exit Destinations:** Learner dashboard, prior learner route, notification/search branch, or logout/settings as applicable.
7. **Required Permission:** `attempt.read` (own)
8. **Required Entitlement:** None declared for this screen in Phase 0/1.
9. **Data Sources / APIs:** Declared APIs: `GET /attempts/:id`. Data projection is limited to entities reachable through those APIs and the resolved tenant context; UI must not query tables directly.
10. **Layout Structure:** Learner app shell with header, learner navigation, main content column, and contextual action area. Core regions: Score summary, dimension contribution, per-item review (policy-bound).
11. **Navigation Areas:** Learner sidebar or mobile bottom nav; topbar search/notifications when available. Inventory nav: from L8.
12. **Page Sections:** Score summary, dimension contribution, per-item review (policy-bound)
13. **Primary Actions:** Start or continue the declared run/attempt when allowed.
14. **Secondary Actions:** Navigate to declared child/destination screens only.
15. **Empty States:** Show "no data yet" with the next permitted learning/practice/admin setup action.
16. **Loading States:** Skeleton for header/nav and page body after membership/entitlement/permission checks; action buttons disabled until resource loaders complete.
17. **Error States:** Use standard error envelope handling: validation errors inline; 401 to login; 403 permission/ownership/relationship denial as disabled action or role home; 404 without cross-tenant existence leakage; 409 idempotency/conflict where applicable; 429/503 as safe retry/tenant-state messaging.
18. **Membership Gate States:** ACTIVE membership in resolved tenant is required. INVITED routes only to A9; SUSPENDED/REMOVED/no row routes to branded blocked/public state; stale tokens are never trusted.
19. **Entitlement Failure States:** Not applicable; screen has no declared route-level entitlement. Still hide/disable sub-actions if their API entitlement fails.
20. **Mobile Behavior:** Responsive learner web: sidebar collapses to bottom/accordion nav; cards stack; primary CTA sticky only when it does not hide content.
21. **Accessibility Notes:** Keyboard navigable; focus order follows header/nav/main/actions; visible labels for forms/actions; server errors announced in an accessible region. Charts/scores require text alternatives, tabular fallback, and non-color-only status indicators. Timer must be screen-reader announced without constant interruption; warnings use aria-live politely except submit-critical alerts.
22. **Audit-Relevant Actions:** Routine read screen; no per-action audit beyond access telemetry/rate limiting unless API declares it.
23. **Notes for Engineering:** Screen must use only declared APIs and route metadata; no client-supplied `tenant_id`; host resolution is authoritative. Server resource loader must declare permission, entitlement if any, and ownership/relationship loader before render.

### L10 — Swipe Learning

1. **Screen ID:** L10
2. **Screen Name:** Swipe Learning
3. **Route:** `/swipe`
4. **Actor:** Learner (Learner app shell)
5. **Entry Sources:** Sidebar (Practice); post-login routing from A6 when learner permissions resolve; authorized deep link.
6. **Exit Destinations:** Session-complete modal
7. **Required Permission:** `practice.start` (self)
8. **Required Entitlement:** None declared for this screen in Phase 0/1.
9. **Data Sources / APIs:** Declared APIs: `POST /practice-sessions`, `POST /practice-sessions/:id/responses`, `POST /practice-sessions/:id/complete`, `GET /me/srs/due`. Data projection is limited to entities reachable through those APIs and the resolved tenant context; UI must not query tables directly.
10. **Layout Structure:** Learner app shell with header, learner navigation, main content column, and contextual action area. Core regions: Deck picker (by weakest dimension / SRS due), swipe card, instant-feedback, session summary, streak nudge.
11. **Navigation Areas:** Learner sidebar or mobile bottom nav; topbar search/notifications when available. Inventory nav: Sidebar (Practice).
12. **Page Sections:** Deck picker (by weakest dimension / SRS due), swipe card, instant-feedback, session summary, streak nudge
13. **Primary Actions:** Create/submit the primary resource or state transition.
14. **Secondary Actions:** Open declared modal/confirmation path; Navigate to declared child/destination screens only.
15. **Empty States:** Show an empty list/table/feed with a single permitted CTA when create/join/invite is allowed; otherwise show read-only explanatory copy.
16. **Loading States:** Skeleton for header/nav and page body after membership/entitlement/permission checks; action buttons disabled until resource loaders complete.
17. **Error States:** Use standard error envelope handling: validation errors inline; 401 to login; 403 permission/ownership/relationship denial as disabled action or role home; 404 without cross-tenant existence leakage; 409 idempotency/conflict where applicable; 429/503 as safe retry/tenant-state messaging.
18. **Membership Gate States:** ACTIVE membership in resolved tenant is required. INVITED routes only to A9; SUSPENDED/REMOVED/no row routes to branded blocked/public state; stale tokens are never trusted.
19. **Entitlement Failure States:** Not applicable; screen has no declared route-level entitlement. Still hide/disable sub-actions if their API entitlement fails.
20. **Mobile Behavior:** Single-card swipe deck; large touch targets; offline-batched answers must be server re-validated before scoring.
21. **Accessibility Notes:** Keyboard navigable; focus order follows header/nav/main/actions; visible labels for forms/actions; server errors announced in an accessible region. Modals trap focus, provide escape/close semantics where safe, and return focus to the opener.
22. **Audit-Relevant Actions:** Mutating/sensitive actions must emit declared audit/outbox events in the same transaction; destructive or irreversible actions require confirmation and reason/comment where specified.
23. **Notes for Engineering:** Screen must use only declared APIs and route metadata; no client-supplied `tenant_id`; host resolution is authoritative. Server resource loader must declare permission, entitlement if any, and ownership/relationship loader before render. Require idempotency/confirmation where route/table requires it; optimistic UI must roll back on server denial. Offline swipe responses cannot update readiness until server-side re-validation passes.

### L11 — Diagnostic (authenticated)

1. **Screen ID:** L11
2. **Screen Name:** Diagnostic (authenticated)
3. **Route:** `/diagnostic/me`
4. **Actor:** Learner (Learner app shell)
5. **Entry Sources:** from L1 / L12; post-login routing from A6 when learner permissions resolve; authorized deep link.
6. **Exit Destinations:** → L6
7. **Required Permission:** `diagnostic.start` (self), `competency.score.read` (self)
8. **Required Entitlement:** None declared for this screen in Phase 0/1.
9. **Data Sources / APIs:** Declared APIs: `POST /diagnostic/start`, `GET /diagnostic/:id/result`. Data projection is limited to entities reachable through those APIs and the resolved tenant context; UI must not query tables directly.
10. **Layout Structure:** Learner app shell with header, learner navigation, main content column, and contextual action area. Core regions: Question runner, 5-dimension scorecard, prescribed path routing.
11. **Navigation Areas:** Learner sidebar or mobile bottom nav; topbar search/notifications when available. Inventory nav: from L1 / L12.
12. **Page Sections:** Question runner, 5-dimension scorecard, prescribed path routing
13. **Primary Actions:** Start or continue the declared run/attempt when allowed; Create/submit the primary resource or state transition.
14. **Secondary Actions:** Navigate to declared child/destination screens only.
15. **Empty States:** Show "no data yet" with the next permitted learning/practice/admin setup action.
16. **Loading States:** Skeleton for header/nav and page body after membership/entitlement/permission checks; action buttons disabled until resource loaders complete.
17. **Error States:** Use standard error envelope handling: validation errors inline; 401 to login; 403 permission/ownership/relationship denial as disabled action or role home; 404 without cross-tenant existence leakage; 409 idempotency/conflict where applicable; 429/503 as safe retry/tenant-state messaging.
18. **Membership Gate States:** ACTIVE membership in resolved tenant is required. INVITED routes only to A9; SUSPENDED/REMOVED/no row routes to branded blocked/public state; stale tokens are never trusted.
19. **Entitlement Failure States:** Not applicable; screen has no declared route-level entitlement. Still hide/disable sub-actions if their API entitlement fails.
20. **Mobile Behavior:** Responsive learner web: sidebar collapses to bottom/accordion nav; cards stack; primary CTA sticky only when it does not hide content.
21. **Accessibility Notes:** Keyboard navigable; focus order follows header/nav/main/actions; visible labels for forms/actions; server errors announced in an accessible region. Charts/scores require text alternatives, tabular fallback, and non-color-only status indicators.
22. **Audit-Relevant Actions:** Mutating/sensitive actions must emit declared audit/outbox events in the same transaction; destructive or irreversible actions require confirmation and reason/comment where specified.
23. **Notes for Engineering:** Screen must use only declared APIs and route metadata; no client-supplied `tenant_id`; host resolution is authoritative. Server resource loader must declare permission, entitlement if any, and ownership/relationship loader before render. Require idempotency/confirmation where route/table requires it; optimistic UI must roll back on server denial.

### L12 — Competency & Readiness

1. **Screen ID:** L12
2. **Screen Name:** Competency & Readiness
3. **Route:** `/readiness`
4. **Actor:** Learner (Learner app shell)
5. **Entry Sources:** Sidebar (Readiness); post-login routing from A6 when learner permissions resolve; authorized deep link.
6. **Exit Destinations:** CTA redirect confirm
7. **Required Permission:** `competency.score.read` (self), `readiness_policy.read`
8. **Required Entitlement:** None declared for this screen in Phase 0/1.
9. **Data Sources / APIs:** Declared APIs: `GET /me/competency`, `GET /me/competency/history`, `GET /readiness-policy`, `POST /cta/attribution-token`. Data projection is limited to entities reachable through those APIs and the resolved tenant context; UI must not query tables directly.
10. **Layout Structure:** Complex split layout. See ASCII wireframe below. Core regions: Band header, radar scorecard, readiness checklist (gaps → one-tap actions), **outbound attributed CTA** (prominence gated by band).
11. **Navigation Areas:** Learner sidebar or mobile bottom nav; topbar search/notifications when available. Inventory nav: Sidebar (Readiness).
12. **Page Sections:** Band header, radar scorecard, readiness checklist (gaps → one-tap actions), **outbound attributed CTA** (prominence gated by band)
13. **Primary Actions:** Create/submit the primary resource or state transition; Mint attribution token and continue to external CTA only after policy gate.
14. **Secondary Actions:** Open declared modal/confirmation path; Navigate to declared child/destination screens only.
15. **Empty States:** Show an empty list/table/feed with a single permitted CTA when create/join/invite is allowed; otherwise show read-only explanatory copy.
16. **Loading States:** Skeleton for header/nav and page body after membership/entitlement/permission checks; action buttons disabled until resource loaders complete.
17. **Error States:** Use standard error envelope handling: validation errors inline; 401 to login; 403 permission/ownership/relationship denial as disabled action or role home; 404 without cross-tenant existence leakage; 409 idempotency/conflict where applicable; 429/503 as safe retry/tenant-state messaging.
18. **Membership Gate States:** ACTIVE membership in resolved tenant is required. INVITED routes only to A9; SUSPENDED/REMOVED/no row routes to branded blocked/public state; stale tokens are never trusted.
19. **Entitlement Failure States:** Not applicable; screen has no declared route-level entitlement. Still hide/disable sub-actions if their API entitlement fails.
20. **Mobile Behavior:** Responsive learner web: sidebar collapses to bottom/accordion nav; cards stack; primary CTA sticky only when it does not hide content.
21. **Accessibility Notes:** Keyboard navigable; focus order follows header/nav/main/actions; visible labels for forms/actions; server errors announced in an accessible region. Charts/scores require text alternatives, tabular fallback, and non-color-only status indicators. Modals trap focus, provide escape/close semantics where safe, and return focus to the opener.
22. **Audit-Relevant Actions:** Mutating/sensitive actions must emit declared audit/outbox events in the same transaction; destructive or irreversible actions require confirmation and reason/comment where specified.
23. **Notes for Engineering:** Screen must use only declared APIs and route metadata; no client-supplied `tenant_id`; host resolution is authoritative. Server resource loader must declare permission, entitlement if any, and ownership/relationship loader before render. Require idempotency/confirmation where route/table requires it; optimistic UI must roll back on server denial. Readiness CTA is outbound token only; no checkout, challenge purchase, or inbound challenge status in P1.

**ASCII wireframe:**
```text
+--------------------------------------------------------------------------------+
| Header: Competency & Readiness                                                   |
+-------------------+------------------------------------------------------------+
| Learner nav       | Readiness band header                                      |
|                   | [Band] [legal note] [last updated]                         |
|                   +----------------------------+-------------------------------+
|                   | 5-dimension scorecard      | Readiness checklist           |
|                   | TA / PSY / RISK / DISC / CR | gaps -> lessons/swipe/assess  |
|                   +----------------------------+-------------------------------+
|                   | Score history / evidence trail                             |
|                   +------------------------------------------------------------+
|                   | Outbound CTA: create attribution token -> external redirect |
+-------------------+------------------------------------------------------------+
```

### L13 — Progress Dashboard

1. **Screen ID:** L13
2. **Screen Name:** Progress Dashboard
3. **Route:** `/progress`
4. **Actor:** Learner (Learner app shell)
5. **Entry Sources:** Sidebar (Progress); post-login routing from A6 when learner permissions resolve; authorized deep link.
6. **Exit Destinations:** drill-in to history
7. **Required Permission:** `competency.score.read` (self), `gamification.profile.read` (self), `attempt.read` (own), `certificate.read` (own)
8. **Required Entitlement:** None declared for this screen in Phase 0/1.
9. **Data Sources / APIs:** Declared APIs: `GET /me/competency/history`, `/me/gamification`, `/attempts/:id`, `/certificates`. Data projection is limited to entities reachable through those APIs and the resolved tenant context; UI must not query tables directly.
10. **Layout Structure:** Learner app shell with header, learner navigation, main content column, and contextual action area. Core regions: Per-dimension trend charts, assessment history, swipe-accuracy trend, streak history, stage timeline, certs earned.
11. **Navigation Areas:** Learner sidebar or mobile bottom nav; topbar search/notifications when available. Inventory nav: Sidebar (Progress).
12. **Page Sections:** Per-dimension trend charts, assessment history, swipe-accuracy trend, streak history, stage timeline, certs earned
13. **Primary Actions:** Start or continue the declared run/attempt when allowed.
14. **Secondary Actions:** Navigate to declared child/destination screens only.
15. **Empty States:** Show "no data yet" with the next permitted learning/practice/admin setup action.
16. **Loading States:** Skeleton for header/nav and page body after membership/entitlement/permission checks; action buttons disabled until resource loaders complete.
17. **Error States:** Use standard error envelope handling: validation errors inline; 401 to login; 403 permission/ownership/relationship denial as disabled action or role home; 404 without cross-tenant existence leakage; 409 idempotency/conflict where applicable; 429/503 as safe retry/tenant-state messaging.
18. **Membership Gate States:** ACTIVE membership in resolved tenant is required. INVITED routes only to A9; SUSPENDED/REMOVED/no row routes to branded blocked/public state; stale tokens are never trusted.
19. **Entitlement Failure States:** Not applicable; screen has no declared route-level entitlement. Still hide/disable sub-actions if their API entitlement fails.
20. **Mobile Behavior:** Responsive learner web: sidebar collapses to bottom/accordion nav; cards stack; primary CTA sticky only when it does not hide content.
21. **Accessibility Notes:** Keyboard navigable; focus order follows header/nav/main/actions; visible labels for forms/actions; server errors announced in an accessible region. Charts/scores require text alternatives, tabular fallback, and non-color-only status indicators.
22. **Audit-Relevant Actions:** Routine read screen; no per-action audit beyond access telemetry/rate limiting unless API declares it.
23. **Notes for Engineering:** Screen must use only declared APIs and route metadata; no client-supplied `tenant_id`; host resolution is authoritative. Server resource loader must declare permission, entitlement if any, and ownership/relationship loader before render.

### L14 — Certificates

1. **Screen ID:** L14
2. **Screen Name:** Certificates
3. **Route:** `/certificates`
4. **Actor:** Learner (Learner app shell)
5. **Entry Sources:** Sidebar (Achievements); post-login routing from A6 when learner permissions resolve; authorized deep link.
6. **Exit Destinations:** Share modal
7. **Required Permission:** `certificate.read` (own)
8. **Required Entitlement:** certification.enable
9. **Data Sources / APIs:** Declared APIs: `GET /certificates`; share → `GET /public/verify/:credentialId`. Data projection is limited to entities reachable through those APIs and the resolved tenant context; UI must not query tables directly.
10. **Layout Structure:** Learner app shell with header, learner navigation, main content column, and contextual action area. Core regions: Credential cards, share link, public-verify link.
11. **Navigation Areas:** Learner sidebar or mobile bottom nav; topbar search/notifications when available. Inventory nav: Sidebar (Achievements).
12. **Page Sections:** Credential cards, share link, public-verify link
13. **Primary Actions:** View/read the declared resource projection.
14. **Secondary Actions:** Copy/share public verification link; Open declared modal/confirmation path; Navigate to declared child/destination screens only.
15. **Empty States:** Show an empty list/table/feed with a single permitted CTA when create/join/invite is allowed; otherwise show read-only explanatory copy.
16. **Loading States:** Skeleton for header/nav and page body after membership/entitlement/permission checks; action buttons disabled until resource loaders complete.
17. **Error States:** Use standard error envelope handling: validation errors inline; 401 to login; 403 permission/ownership/relationship denial as disabled action or role home; 404 without cross-tenant existence leakage; 409 idempotency/conflict where applicable; 429/503 as safe retry/tenant-state messaging.
18. **Membership Gate States:** ACTIVE membership in resolved tenant is required. INVITED routes only to A9; SUSPENDED/REMOVED/no row routes to branded blocked/public state; stale tokens are never trusted.
19. **Entitlement Failure States:** If `certification.enable` is absent, hide from nav and return/display `ENTITLEMENT_REQUIRED` upgrade prompt; never delete existing tenant data.
20. **Mobile Behavior:** Responsive learner web: sidebar collapses to bottom/accordion nav; cards stack; primary CTA sticky only when it does not hide content.
21. **Accessibility Notes:** Keyboard navigable; focus order follows header/nav/main/actions; visible labels for forms/actions; server errors announced in an accessible region. Modals trap focus, provide escape/close semantics where safe, and return focus to the opener.
22. **Audit-Relevant Actions:** Routine read screen; no per-action audit beyond access telemetry/rate limiting unless API declares it.
23. **Notes for Engineering:** Screen must use only declared APIs and route metadata; no client-supplied `tenant_id`; host resolution is authoritative. Server resource loader must declare permission, entitlement if any, and ownership/relationship loader before render.

### L15 — Achievements & Badges

1. **Screen ID:** L15
2. **Screen Name:** Achievements & Badges
3. **Route:** `/achievements`
4. **Actor:** Learner (Learner app shell)
5. **Entry Sources:** Sidebar (Achievements); post-login routing from A6 when learner permissions resolve; authorized deep link.
6. **Exit Destinations:** Freeze-confirm modal
7. **Required Permission:** `gamification.profile.read` (self), `badge.read`
8. **Required Entitlement:** gamification.enable
9. **Data Sources / APIs:** Declared APIs: `GET /me/gamification`, `GET /badges`, `GET /me/streaks`, `POST /me/streaks/:key/freeze`. Data projection is limited to entities reachable through those APIs and the resolved tenant context; UI must not query tables directly.
10. **Layout Structure:** Learner app shell with header, learner navigation, main content column, and contextual action area. Core regions: XP/level header, badge grid, streak panel, freeze action.
11. **Navigation Areas:** Learner sidebar or mobile bottom nav; topbar search/notifications when available. Inventory nav: Sidebar (Achievements).
12. **Page Sections:** XP/level header, badge grid, streak panel, freeze action
13. **Primary Actions:** Create/submit the primary resource or state transition.
14. **Secondary Actions:** Open declared modal/confirmation path; Navigate to declared child/destination screens only.
15. **Empty States:** Show an empty list/table/feed with a single permitted CTA when create/join/invite is allowed; otherwise show read-only explanatory copy.
16. **Loading States:** Skeleton for header/nav and page body after membership/entitlement/permission checks; action buttons disabled until resource loaders complete.
17. **Error States:** Use standard error envelope handling: validation errors inline; 401 to login; 403 permission/ownership/relationship denial as disabled action or role home; 404 without cross-tenant existence leakage; 409 idempotency/conflict where applicable; 429/503 as safe retry/tenant-state messaging.
18. **Membership Gate States:** ACTIVE membership in resolved tenant is required. INVITED routes only to A9; SUSPENDED/REMOVED/no row routes to branded blocked/public state; stale tokens are never trusted.
19. **Entitlement Failure States:** If `gamification.enable` is absent, hide from nav and return/display `ENTITLEMENT_REQUIRED` upgrade prompt; never delete existing tenant data.
20. **Mobile Behavior:** Responsive learner web: sidebar collapses to bottom/accordion nav; cards stack; primary CTA sticky only when it does not hide content.
21. **Accessibility Notes:** Keyboard navigable; focus order follows header/nav/main/actions; visible labels for forms/actions; server errors announced in an accessible region. Modals trap focus, provide escape/close semantics where safe, and return focus to the opener.
22. **Audit-Relevant Actions:** Mutating/sensitive actions must emit declared audit/outbox events in the same transaction; destructive or irreversible actions require confirmation and reason/comment where specified.
23. **Notes for Engineering:** Screen must use only declared APIs and route metadata; no client-supplied `tenant_id`; host resolution is authoritative. Server resource loader must declare permission, entitlement if any, and ownership/relationship loader before render. Require idempotency/confirmation where route/table requires it; optimistic UI must roll back on server denial.

### L16 — Leaderboards

1. **Screen ID:** L16
2. **Screen Name:** Leaderboards
3. **Route:** `/leaderboards`
4. **Actor:** Learner (Learner app shell)
5. **Entry Sources:** Sidebar (Community); post-login routing from A6 when learner permissions resolve; authorized deep link.
6. **Exit Destinations:** Learner dashboard, prior learner route, notification/search branch, or logout/settings as applicable.
7. **Required Permission:** `leaderboard.read`
8. **Required Entitlement:** gamification.enable
9. **Data Sources / APIs:** Declared APIs: `GET /leaderboards`, `GET /leaderboards/:id`. Data projection is limited to entities reachable through those APIs and the resolved tenant context; UI must not query tables directly.
10. **Layout Structure:** Learner app shell with header, learner navigation, main content column, and contextual action area. Core regions: Leaderboard table, time-window filter.
11. **Navigation Areas:** Learner sidebar or mobile bottom nav; topbar search/notifications when available. Inventory nav: Sidebar (Community).
12. **Page Sections:** Leaderboard table, time-window filter
13. **Primary Actions:** View/read the declared resource projection.
14. **Secondary Actions:** Search/filter/sort within allowed indexed fields; Navigate to declared child/destination screens only.
15. **Empty States:** Show an empty list/table/feed with a single permitted CTA when create/join/invite is allowed; otherwise show read-only explanatory copy.
16. **Loading States:** Skeleton for header/nav and page body after membership/entitlement/permission checks; action buttons disabled until resource loaders complete.
17. **Error States:** Use standard error envelope handling: validation errors inline; 401 to login; 403 permission/ownership/relationship denial as disabled action or role home; 404 without cross-tenant existence leakage; 409 idempotency/conflict where applicable; 429/503 as safe retry/tenant-state messaging.
18. **Membership Gate States:** ACTIVE membership in resolved tenant is required. INVITED routes only to A9; SUSPENDED/REMOVED/no row routes to branded blocked/public state; stale tokens are never trusted.
19. **Entitlement Failure States:** If `gamification.enable` is absent, hide from nav and return/display `ENTITLEMENT_REQUIRED` upgrade prompt; never delete existing tenant data.
20. **Mobile Behavior:** Responsive learner web: sidebar collapses to bottom/accordion nav; cards stack; primary CTA sticky only when it does not hide content.
21. **Accessibility Notes:** Keyboard navigable; focus order follows header/nav/main/actions; visible labels for forms/actions; server errors announced in an accessible region. Charts/scores require text alternatives, tabular fallback, and non-color-only status indicators.
22. **Audit-Relevant Actions:** Routine read screen; no per-action audit beyond access telemetry/rate limiting unless API declares it.
23. **Notes for Engineering:** Screen must use only declared APIs and route metadata; no client-supplied `tenant_id`; host resolution is authoritative. Server resource loader must declare permission, entitlement if any, and ownership/relationship loader before render.

### L17 — Community Hub

1. **Screen ID:** L17
2. **Screen Name:** Community Hub
3. **Route:** `/community`
4. **Actor:** Learner (Learner app shell)
5. **Entry Sources:** Sidebar (Community); post-login routing from A6 when learner permissions resolve; authorized deep link.
6. **Exit Destinations:** → L18
7. **Required Permission:** `community.space.read`, `community.space.join`
8. **Required Entitlement:** community.enable
9. **Data Sources / APIs:** Declared APIs: `GET /spaces`, `POST /spaces/:id/join`. Data projection is limited to entities reachable through those APIs and the resolved tenant context; UI must not query tables directly.
10. **Layout Structure:** Complex split layout. See ASCII wireframe below. Core regions: Space cards (public/private/study), join CTA, recommendations.
11. **Navigation Areas:** Learner sidebar or mobile bottom nav; topbar search/notifications when available. Inventory nav: Sidebar (Community).
12. **Page Sections:** Space cards (public/private/study), join CTA, recommendations
13. **Primary Actions:** Create/submit the primary resource or state transition; Join space when visibility and entitlement allow; Mint attribution token and continue to external CTA only after policy gate.
14. **Secondary Actions:** Navigate to declared child/destination screens only.
15. **Empty States:** Show an empty list/table/feed with a single permitted CTA when create/join/invite is allowed; otherwise show read-only explanatory copy.
16. **Loading States:** Skeleton for header/nav and page body after membership/entitlement/permission checks; action buttons disabled until resource loaders complete.
17. **Error States:** Use standard error envelope handling: validation errors inline; 401 to login; 403 permission/ownership/relationship denial as disabled action or role home; 404 without cross-tenant existence leakage; 409 idempotency/conflict where applicable; 429/503 as safe retry/tenant-state messaging.
18. **Membership Gate States:** ACTIVE membership in resolved tenant is required. INVITED routes only to A9; SUSPENDED/REMOVED/no row routes to branded blocked/public state; stale tokens are never trusted.
19. **Entitlement Failure States:** If `community.enable` is absent, hide from nav and return/display `ENTITLEMENT_REQUIRED` upgrade prompt; never delete existing tenant data.
20. **Mobile Behavior:** Responsive learner web: sidebar collapses to bottom/accordion nav; cards stack; primary CTA sticky only when it does not hide content.
21. **Accessibility Notes:** Keyboard navigable; focus order follows header/nav/main/actions; visible labels for forms/actions; server errors announced in an accessible region.
22. **Audit-Relevant Actions:** Mutating/sensitive actions must emit declared audit/outbox events in the same transaction; destructive or irreversible actions require confirmation and reason/comment where specified.
23. **Notes for Engineering:** Screen must use only declared APIs and route metadata; no client-supplied `tenant_id`; host resolution is authoritative. Server resource loader must declare permission, entitlement if any, and ownership/relationship loader before render. Require idempotency/confirmation where route/table requires it; optimistic UI must roll back on server denial.

**ASCII wireframe:**
```text
+--------------------------------------------------------------------------------+
| Community header / search / notifications                                        |
+-------------------+------------------------------------------------------------+
| Learner nav       | Recommended spaces by stage/band                           |
|                   | [Space card] [Space card] [Private lock state]             |
|                   +------------------------------------------------------------+
|                   | My spaces                                                   |
|                   | [Joined] [Joined] [Join CTA when allowed]                  |
|                   +------------------------------------------------------------+
|                   | Community rules / report guidance                           |
+-------------------+------------------------------------------------------------+
```

### L18 — Community Space / Feed

1. **Screen ID:** L18
2. **Screen Name:** Community Space / Feed
3. **Route:** `/community/spaces/:id`
4. **Actor:** Learner (Learner app shell)
5. **Entry Sources:** from L17; post-login routing from A6 when learner permissions resolve; authorized deep link.
6. **Exit Destinations:** → L19; Report modal
7. **Required Permission:** `post.read`, `post.create`, `reaction.create`, `comment.create`
8. **Required Entitlement:** community.enable
9. **Data Sources / APIs:** Declared APIs: `GET/POST /spaces/:id/posts`, `POST /reactions`. Data projection is limited to entities reachable through those APIs and the resolved tenant context; UI must not query tables directly.
10. **Layout Structure:** Learner app shell with header, learner navigation, main content column, and contextual action area. Core regions: Post feed, composer, reactions, pinned posts.
11. **Navigation Areas:** Learner sidebar or mobile bottom nav; topbar search/notifications when available. Inventory nav: from L17.
12. **Page Sections:** Post feed, composer, reactions, pinned posts
13. **Primary Actions:** Create/submit the primary resource or state transition.
14. **Secondary Actions:** Open declared modal/confirmation path; Navigate to declared child/destination screens only.
15. **Empty States:** Show an empty list/table/feed with a single permitted CTA when create/join/invite is allowed; otherwise show read-only explanatory copy.
16. **Loading States:** Skeleton for header/nav and page body after membership/entitlement/permission checks; action buttons disabled until resource loaders complete.
17. **Error States:** Use standard error envelope handling: validation errors inline; 401 to login; 403 permission/ownership/relationship denial as disabled action or role home; 404 without cross-tenant existence leakage; 409 idempotency/conflict where applicable; 429/503 as safe retry/tenant-state messaging.
18. **Membership Gate States:** ACTIVE membership in resolved tenant is required. INVITED routes only to A9; SUSPENDED/REMOVED/no row routes to branded blocked/public state; stale tokens are never trusted.
19. **Entitlement Failure States:** If `community.enable` is absent, hide from nav and return/display `ENTITLEMENT_REQUIRED` upgrade prompt; never delete existing tenant data.
20. **Mobile Behavior:** Responsive learner web: sidebar collapses to bottom/accordion nav; cards stack; primary CTA sticky only when it does not hide content.
21. **Accessibility Notes:** Keyboard navigable; focus order follows header/nav/main/actions; visible labels for forms/actions; server errors announced in an accessible region. Modals trap focus, provide escape/close semantics where safe, and return focus to the opener.
22. **Audit-Relevant Actions:** Mutating/sensitive actions must emit declared audit/outbox events in the same transaction; destructive or irreversible actions require confirmation and reason/comment where specified.
23. **Notes for Engineering:** Screen must use only declared APIs and route metadata; no client-supplied `tenant_id`; host resolution is authoritative. Server resource loader must declare permission, entitlement if any, and ownership/relationship loader before render. Require idempotency/confirmation where route/table requires it; optimistic UI must roll back on server denial.

### L19 — Post Detail / Thread

1. **Screen ID:** L19
2. **Screen Name:** Post Detail / Thread
3. **Route:** `/community/posts/:id`
4. **Actor:** Learner (Learner app shell)
5. **Entry Sources:** from L18; post-login routing from A6 when learner permissions resolve; authorized deep link.
6. **Exit Destinations:** Report modal; Edit/Delete confirm
7. **Required Permission:** `post.read`, `comment.create`, `comment.update/delete` (own)
8. **Required Entitlement:** community.enable
9. **Data Sources / APIs:** Declared APIs: `GET /posts/:id/comments`, `POST /posts/:id/comments`, `PUT/DELETE /comments/:id`. Data projection is limited to entities reachable through those APIs and the resolved tenant context; UI must not query tables directly.
10. **Layout Structure:** Learner app shell with header, learner navigation, main content column, and contextual action area. Core regions: Post body, comment thread, composer.
11. **Navigation Areas:** Learner sidebar or mobile bottom nav; topbar search/notifications when available. Inventory nav: from L18.
12. **Page Sections:** Post body, comment thread, composer
13. **Primary Actions:** Create/submit the primary resource or state transition; Execute guarded lifecycle/destructive action with confirmation.
14. **Secondary Actions:** Open declared modal/confirmation path; Navigate to declared child/destination screens only.
15. **Empty States:** Show neutral empty state with role-appropriate next action or back navigation.
16. **Loading States:** Skeleton for header/nav and page body after membership/entitlement/permission checks; action buttons disabled until resource loaders complete.
17. **Error States:** Use standard error envelope handling: validation errors inline; 401 to login; 403 permission/ownership/relationship denial as disabled action or role home; 404 without cross-tenant existence leakage; 409 idempotency/conflict where applicable; 429/503 as safe retry/tenant-state messaging.
18. **Membership Gate States:** ACTIVE membership in resolved tenant is required. INVITED routes only to A9; SUSPENDED/REMOVED/no row routes to branded blocked/public state; stale tokens are never trusted.
19. **Entitlement Failure States:** If `community.enable` is absent, hide from nav and return/display `ENTITLEMENT_REQUIRED` upgrade prompt; never delete existing tenant data.
20. **Mobile Behavior:** Responsive learner web: sidebar collapses to bottom/accordion nav; cards stack; primary CTA sticky only when it does not hide content.
21. **Accessibility Notes:** Keyboard navigable; focus order follows header/nav/main/actions; visible labels for forms/actions; server errors announced in an accessible region. Modals trap focus, provide escape/close semantics where safe, and return focus to the opener.
22. **Audit-Relevant Actions:** Mutating/sensitive actions must emit declared audit/outbox events in the same transaction; destructive or irreversible actions require confirmation and reason/comment where specified.
23. **Notes for Engineering:** Screen must use only declared APIs and route metadata; no client-supplied `tenant_id`; host resolution is authoritative. Server resource loader must declare permission, entitlement if any, and ownership/relationship loader before render. Require idempotency/confirmation where route/table requires it; optimistic UI must roll back on server denial.

### L20 — Hall of Fame

1. **Screen ID:** L20
2. **Screen Name:** Hall of Fame
3. **Route:** `/hall-of-fame`
4. **Actor:** Learner (Learner app shell)
5. **Entry Sources:** Sidebar (Community); post-login routing from A6 when learner permissions resolve; authorized deep link.
6. **Exit Destinations:** Learner dashboard, prior learner route, notification/search branch, or logout/settings as applicable.
7. **Required Permission:** `post.read`, `leaderboard.read`
8. **Required Entitlement:** community.enable; gamification.enable gates leaderboard segment if shown
9. **Data Sources / APIs:** Declared APIs: `GET /spaces/:id/posts` (HoF space), `GET /leaderboards/:id`, `GET /public/verify/:credentialId`. Data projection is limited to entities reachable through those APIs and the resolved tenant context; UI must not query tables directly.
10. **Layout Structure:** Learner app shell with header, learner navigation, main content column, and contextual action area. Core regions: Recognition feed, top-performers board, verifiable-cert links.
11. **Navigation Areas:** Learner sidebar or mobile bottom nav; topbar search/notifications when available. Inventory nav: Sidebar (Community).
12. **Page Sections:** Recognition feed, top-performers board, verifiable-cert links
13. **Primary Actions:** View/read the declared resource projection.
14. **Secondary Actions:** Navigate to declared child/destination screens only.
15. **Empty States:** Show an empty list/table/feed with a single permitted CTA when create/join/invite is allowed; otherwise show read-only explanatory copy.
16. **Loading States:** Skeleton for header/nav and page body after membership/entitlement/permission checks; action buttons disabled until resource loaders complete.
17. **Error States:** Use standard error envelope handling: validation errors inline; 401 to login; 403 permission/ownership/relationship denial as disabled action or role home; 404 without cross-tenant existence leakage; 409 idempotency/conflict where applicable; 429/503 as safe retry/tenant-state messaging.
18. **Membership Gate States:** ACTIVE membership in resolved tenant is required. INVITED routes only to A9; SUSPENDED/REMOVED/no row routes to branded blocked/public state; stale tokens are never trusted.
19. **Entitlement Failure States:** Partial entitlement handling: community.enable; gamification.enable gates leaderboard segment if shown. Disabled sections show upgrade/explanation and preserve existing data read-only where applicable.
20. **Mobile Behavior:** Responsive learner web: sidebar collapses to bottom/accordion nav; cards stack; primary CTA sticky only when it does not hide content.
21. **Accessibility Notes:** Keyboard navigable; focus order follows header/nav/main/actions; visible labels for forms/actions; server errors announced in an accessible region.
22. **Audit-Relevant Actions:** Routine read screen; no per-action audit beyond access telemetry/rate limiting unless API declares it.
23. **Notes for Engineering:** Screen must use only declared APIs and route metadata; no client-supplied `tenant_id`; host resolution is authoritative. Server resource loader must declare permission, entitlement if any, and ownership/relationship loader before render. Hall of Fame must not assert funded-status verification in P1; only consented community, leaderboard, and cert verification are allowed.

### L21 — Resource Library

1. **Screen ID:** L21
2. **Screen Name:** Resource Library
3. **Route:** `/resources`
4. **Actor:** Learner (Learner app shell)
5. **Entry Sources:** Sidebar (Learn); post-login routing from A6 when learner permissions resolve; authorized deep link.
6. **Exit Destinations:** Learner dashboard, prior learner route, notification/search branch, or logout/settings as applicable.
7. **Required Permission:** `course.read`, `search.query`
8. **Required Entitlement:** None declared for this screen in Phase 0/1.
9. **Data Sources / APIs:** Declared APIs: `GET /courses` (resource-tagged), `GET /search`. Data projection is limited to entities reachable through those APIs and the resolved tenant context; UI must not query tables directly.
10. **Layout Structure:** Learner app shell with header, learner navigation, main content column, and contextual action area. Core regions: Filter/search, resource cards, download/open.
11. **Navigation Areas:** Learner sidebar or mobile bottom nav; topbar search/notifications when available. Inventory nav: Sidebar (Learn).
12. **Page Sections:** Filter/search, resource cards, download/open
13. **Primary Actions:** View/read the declared resource projection.
14. **Secondary Actions:** Search/filter/sort within allowed indexed fields; Download/export only through signed/authorized flow; Navigate to declared child/destination screens only.
15. **Empty States:** Show an empty list/table/feed with a single permitted CTA when create/join/invite is allowed; otherwise show read-only explanatory copy.
16. **Loading States:** Skeleton for header/nav and page body after membership/entitlement/permission checks; action buttons disabled until resource loaders complete.
17. **Error States:** Use standard error envelope handling: validation errors inline; 401 to login; 403 permission/ownership/relationship denial as disabled action or role home; 404 without cross-tenant existence leakage; 409 idempotency/conflict where applicable; 429/503 as safe retry/tenant-state messaging.
18. **Membership Gate States:** ACTIVE membership in resolved tenant is required. INVITED routes only to A9; SUSPENDED/REMOVED/no row routes to branded blocked/public state; stale tokens are never trusted.
19. **Entitlement Failure States:** Not applicable; screen has no declared route-level entitlement. Still hide/disable sub-actions if their API entitlement fails.
20. **Mobile Behavior:** Responsive learner web: sidebar collapses to bottom/accordion nav; cards stack; primary CTA sticky only when it does not hide content.
21. **Accessibility Notes:** Keyboard navigable; focus order follows header/nav/main/actions; visible labels for forms/actions; server errors announced in an accessible region.
22. **Audit-Relevant Actions:** Routine read screen; no per-action audit beyond access telemetry/rate limiting unless API declares it.
23. **Notes for Engineering:** Screen must use only declared APIs and route metadata; no client-supplied `tenant_id`; host resolution is authoritative. Server resource loader must declare permission, entitlement if any, and ownership/relationship loader before render.

### L22 — Search Results

1. **Screen ID:** L22
2. **Screen Name:** Search Results
3. **Route:** `/search`
4. **Actor:** Learner (Learner app shell)
5. **Entry Sources:** Topbar search; post-login routing from A6 when learner permissions resolve; authorized deep link.
6. **Exit Destinations:** Learner dashboard, prior learner route, notification/search branch, or logout/settings as applicable.
7. **Required Permission:** `search.query`
8. **Required Entitlement:** None declared for this screen in Phase 0/1.
9. **Data Sources / APIs:** Declared APIs: `GET /search`. Data projection is limited to entities reachable through those APIs and the resolved tenant context; UI must not query tables directly.
10. **Layout Structure:** Learner app shell with header, learner navigation, main content column, and contextual action area. Core regions: Query box, type filters, result list.
11. **Navigation Areas:** Learner sidebar or mobile bottom nav; topbar search/notifications when available. Inventory nav: Topbar search.
12. **Page Sections:** Query box, type filters, result list
13. **Primary Actions:** View/read the declared resource projection.
14. **Secondary Actions:** Search/filter/sort within allowed indexed fields; Navigate to declared child/destination screens only.
15. **Empty States:** Show an empty list/table/feed with a single permitted CTA when create/join/invite is allowed; otherwise show read-only explanatory copy.
16. **Loading States:** Skeleton for header/nav and page body after membership/entitlement/permission checks; action buttons disabled until resource loaders complete.
17. **Error States:** Use standard error envelope handling: validation errors inline; 401 to login; 403 permission/ownership/relationship denial as disabled action or role home; 404 without cross-tenant existence leakage; 409 idempotency/conflict where applicable; 429/503 as safe retry/tenant-state messaging.
18. **Membership Gate States:** ACTIVE membership in resolved tenant is required. INVITED routes only to A9; SUSPENDED/REMOVED/no row routes to branded blocked/public state; stale tokens are never trusted.
19. **Entitlement Failure States:** Not applicable; screen has no declared route-level entitlement. Still hide/disable sub-actions if their API entitlement fails.
20. **Mobile Behavior:** Responsive learner web: sidebar collapses to bottom/accordion nav; cards stack; primary CTA sticky only when it does not hide content.
21. **Accessibility Notes:** Keyboard navigable; focus order follows header/nav/main/actions; visible labels for forms/actions; server errors announced in an accessible region.
22. **Audit-Relevant Actions:** Routine read screen; no per-action audit beyond access telemetry/rate limiting unless API declares it.
23. **Notes for Engineering:** Screen must use only declared APIs and route metadata; no client-supplied `tenant_id`; host resolution is authoritative. Server resource loader must declare permission, entitlement if any, and ownership/relationship loader before render.

### L23 — Notifications Inbox

1. **Screen ID:** L23
2. **Screen Name:** Notifications Inbox
3. **Route:** `/notifications`
4. **Actor:** Learner (Learner app shell)
5. **Entry Sources:** Topbar bell; post-login routing from A6 when learner permissions resolve; authorized deep link.
6. **Exit Destinations:** Learner dashboard, prior learner route, notification/search branch, or logout/settings as applicable.
7. **Required Permission:** `notification.read.self` (self)
8. **Required Entitlement:** None declared for this screen in Phase 0/1.
9. **Data Sources / APIs:** Declared APIs: `GET /me/notifications`, `POST /me/notifications/:id/read`. Data projection is limited to entities reachable through those APIs and the resolved tenant context; UI must not query tables directly.
10. **Layout Structure:** Learner app shell with header, learner navigation, main content column, and contextual action area. Core regions: Notification list, mark-read, unread badge.
11. **Navigation Areas:** Learner sidebar or mobile bottom nav; topbar search/notifications when available. Inventory nav: Topbar bell.
12. **Page Sections:** Notification list, mark-read, unread badge
13. **Primary Actions:** Create/submit the primary resource or state transition.
14. **Secondary Actions:** Navigate to declared child/destination screens only.
15. **Empty States:** Show an empty list/table/feed with a single permitted CTA when create/join/invite is allowed; otherwise show read-only explanatory copy.
16. **Loading States:** Skeleton for header/nav and page body after membership/entitlement/permission checks; action buttons disabled until resource loaders complete.
17. **Error States:** Use standard error envelope handling: validation errors inline; 401 to login; 403 permission/ownership/relationship denial as disabled action or role home; 404 without cross-tenant existence leakage; 409 idempotency/conflict where applicable; 429/503 as safe retry/tenant-state messaging.
18. **Membership Gate States:** ACTIVE membership in resolved tenant is required. INVITED routes only to A9; SUSPENDED/REMOVED/no row routes to branded blocked/public state; stale tokens are never trusted.
19. **Entitlement Failure States:** Not applicable; screen has no declared route-level entitlement. Still hide/disable sub-actions if their API entitlement fails.
20. **Mobile Behavior:** Responsive learner web: sidebar collapses to bottom/accordion nav; cards stack; primary CTA sticky only when it does not hide content.
21. **Accessibility Notes:** Keyboard navigable; focus order follows header/nav/main/actions; visible labels for forms/actions; server errors announced in an accessible region.
22. **Audit-Relevant Actions:** Mutating/sensitive actions must emit declared audit/outbox events in the same transaction; destructive or irreversible actions require confirmation and reason/comment where specified.
23. **Notes for Engineering:** Screen must use only declared APIs and route metadata; no client-supplied `tenant_id`; host resolution is authoritative. Server resource loader must declare permission, entitlement if any, and ownership/relationship loader before render. Require idempotency/confirmation where route/table requires it; optimistic UI must roll back on server denial.

### L24 — Profile

1. **Screen ID:** L24
2. **Screen Name:** Profile
3. **Route:** `/profile`
4. **Actor:** Learner (Learner app shell)
5. **Entry Sources:** User menu; post-login routing from A6 when learner permissions resolve; authorized deep link.
6. **Exit Destinations:** Learner dashboard, prior learner route, notification/search branch, or logout/settings as applicable.
7. **Required Permission:** `profile.read` (self), `profile.update` (self)
8. **Required Entitlement:** None declared for this screen in Phase 0/1.
9. **Data Sources / APIs:** Declared APIs: `GET/PUT /me/profile`. Data projection is limited to entities reachable through those APIs and the resolved tenant context; UI must not query tables directly.
10. **Layout Structure:** Learner app shell with header, learner navigation, main content column, and contextual action area. Core regions: Display name/avatar/bio form, public preview.
11. **Navigation Areas:** Learner sidebar or mobile bottom nav; topbar search/notifications when available. Inventory nav: User menu.
12. **Page Sections:** Display name/avatar/bio form, public preview
13. **Primary Actions:** View/read the declared resource projection.
14. **Secondary Actions:** Navigate to declared child/destination screens only.
15. **Empty States:** Show unsaved draft scaffold with required fields and validation hints; no auto-publish.
16. **Loading States:** Skeleton for header/nav and page body after membership/entitlement/permission checks; action buttons disabled until resource loaders complete.
17. **Error States:** Use standard error envelope handling: validation errors inline; 401 to login; 403 permission/ownership/relationship denial as disabled action or role home; 404 without cross-tenant existence leakage; 409 idempotency/conflict where applicable; 429/503 as safe retry/tenant-state messaging.
18. **Membership Gate States:** ACTIVE membership in resolved tenant is required. INVITED routes only to A9; SUSPENDED/REMOVED/no row routes to branded blocked/public state; stale tokens are never trusted.
19. **Entitlement Failure States:** Not applicable; screen has no declared route-level entitlement. Still hide/disable sub-actions if their API entitlement fails.
20. **Mobile Behavior:** Responsive learner web: sidebar collapses to bottom/accordion nav; cards stack; primary CTA sticky only when it does not hide content.
21. **Accessibility Notes:** Keyboard navigable; focus order follows header/nav/main/actions; visible labels for forms/actions; server errors announced in an accessible region.
22. **Audit-Relevant Actions:** Mutating/sensitive actions must emit declared audit/outbox events in the same transaction; destructive or irreversible actions require confirmation and reason/comment where specified.
23. **Notes for Engineering:** Screen must use only declared APIs and route metadata; no client-supplied `tenant_id`; host resolution is authoritative. Server resource loader must declare permission, entitlement if any, and ownership/relationship loader before render. Require idempotency/confirmation where route/table requires it; optimistic UI must roll back on server denial.

### L25 — Settings

1. **Screen ID:** L25
2. **Screen Name:** Settings
3. **Route:** `/settings`
4. **Actor:** Learner (Learner app shell)
5. **Entry Sources:** User menu; post-login routing from A6 when learner permissions resolve; authorized deep link.
6. **Exit Destinations:** Deletion-request confirm modal; logout confirm
7. **Required Permission:** `profile.update` (self), `locale.read`, `data.deletion.request` (own)
8. **Required Entitlement:** None declared for this screen in Phase 0/1.
9. **Data Sources / APIs:** Declared APIs: `GET/PUT /me/profile`, `GET /locales`, `POST /deletion-requests` (own). Data projection is limited to entities reachable through those APIs and the resolved tenant context; UI must not query tables directly.
10. **Layout Structure:** Learner app shell with header, learner navigation, main content column, and contextual action area. Core regions: Account section, locale picker, **Request Account Deletion**, logout.
11. **Navigation Areas:** Learner sidebar or mobile bottom nav; topbar search/notifications when available. Inventory nav: User menu.
12. **Page Sections:** Account section, locale picker, **Request Account Deletion**, logout
13. **Primary Actions:** Create/submit the primary resource or state transition.
14. **Secondary Actions:** Open declared modal/confirmation path; Navigate to declared child/destination screens only.
15. **Empty States:** Show neutral empty state with role-appropriate next action or back navigation.
16. **Loading States:** Skeleton for header/nav and page body after membership/entitlement/permission checks; action buttons disabled until resource loaders complete.
17. **Error States:** Use standard error envelope handling: validation errors inline; 401 to login; 403 permission/ownership/relationship denial as disabled action or role home; 404 without cross-tenant existence leakage; 409 idempotency/conflict where applicable; 429/503 as safe retry/tenant-state messaging.
18. **Membership Gate States:** ACTIVE membership in resolved tenant is required. INVITED routes only to A9; SUSPENDED/REMOVED/no row routes to branded blocked/public state; stale tokens are never trusted.
19. **Entitlement Failure States:** Not applicable; screen has no declared route-level entitlement. Still hide/disable sub-actions if their API entitlement fails.
20. **Mobile Behavior:** Responsive learner web: sidebar collapses to bottom/accordion nav; cards stack; primary CTA sticky only when it does not hide content.
21. **Accessibility Notes:** Keyboard navigable; focus order follows header/nav/main/actions; visible labels for forms/actions; server errors announced in an accessible region. Modals trap focus, provide escape/close semantics where safe, and return focus to the opener.
22. **Audit-Relevant Actions:** Mutating/sensitive actions must emit declared audit/outbox events in the same transaction; destructive or irreversible actions require confirmation and reason/comment where specified.
23. **Notes for Engineering:** Screen must use only declared APIs and route metadata; no client-supplied `tenant_id`; host resolution is authoritative. Server resource loader must declare permission, entitlement if any, and ownership/relationship loader before render. Require idempotency/confirmation where route/table requires it; optimistic UI must roll back on server denial.

### I1 — Studio Dashboard

1. **Screen ID:** I1
2. **Screen Name:** Studio Dashboard
3. **Route:** `/studio`
4. **Actor:** Instructor (Studio shell)
5. **Entry Sources:** Studio sidebar; instructor deep link; handoff from S1 or related authoring list.
6. **Exit Destinations:** Studio dashboard, related builder/detail, or S1 Review & Approvals for publish gates.
7. **Required Permission:** `course.read`, `assessment.grade`, `workflow.definition.read`
8. **Required Entitlement:** None declared for this screen in Phase 0/1.
9. **Data Sources / APIs:** Declared APIs: `GET /courses` (own), `GET /grading-tasks`, `GET /workflows`. Data projection is limited to entities reachable through those APIs and the resolved tenant context; UI must not query tables directly.
10. **Layout Structure:** Studio shell with left studio navigation, resource header/status row, editor/list main area, and validation/action rail where applicable. Core regions: My-courses cards, grading-queue count, review/approval status, drafts.
11. **Navigation Areas:** Studio sidebar plus shared Review link when relationship-scoped. Inventory nav: Studio sidebar.
12. **Page Sections:** My-courses cards, grading-queue count, review/approval status, drafts
13. **Primary Actions:** View/read the declared resource projection.
14. **Secondary Actions:** Navigate to declared child/destination screens only.
15. **Empty States:** Show an empty list/table/feed with a single permitted CTA when create/join/invite is allowed; otherwise show read-only explanatory copy.
16. **Loading States:** Skeleton for header/nav and page body after membership/entitlement/permission checks; action buttons disabled until resource loaders complete.
17. **Error States:** Use standard error envelope handling: validation errors inline; 401 to login; 403 permission/ownership/relationship denial as disabled action or role home; 404 without cross-tenant existence leakage; 409 idempotency/conflict where applicable; 429/503 as safe retry/tenant-state messaging.
18. **Membership Gate States:** ACTIVE membership in resolved tenant is required. INVITED routes only to A9; SUSPENDED/REMOVED/no row routes to branded blocked/public state; stale tokens are never trusted.
19. **Entitlement Failure States:** Not applicable; screen has no declared route-level entitlement. Still hide/disable sub-actions if their API entitlement fails.
20. **Mobile Behavior:** Desktop-first control plane; on mobile, tables become stacked cards with preserved filters and guarded row actions.
21. **Accessibility Notes:** Keyboard navigable; focus order follows header/nav/main/actions; visible labels for forms/actions; server errors announced in an accessible region.
22. **Audit-Relevant Actions:** Routine read screen; no per-action audit beyond access telemetry/rate limiting unless API declares it.
23. **Notes for Engineering:** Screen must use only declared APIs and route metadata; no client-supplied `tenant_id`; host resolution is authoritative. Server resource loader must declare permission, entitlement if any, and ownership/relationship loader before render.

### I2 — Course Manager

1. **Screen ID:** I2
2. **Screen Name:** Course Manager
3. **Route:** `/studio/courses`
4. **Actor:** Instructor (Studio shell)
5. **Entry Sources:** Studio sidebar; instructor deep link; handoff from S1 or related authoring list.
6. **Exit Destinations:** → I3
7. **Required Permission:** `course.read`, `course.create`
8. **Required Entitlement:** None declared for this screen in Phase 0/1.
9. **Data Sources / APIs:** Declared APIs: `GET /courses` (own), `POST /courses`. Data projection is limited to entities reachable through those APIs and the resolved tenant context; UI must not query tables directly.
10. **Layout Structure:** Studio shell with left studio navigation, resource header/status row, editor/list main area, and validation/action rail where applicable. Core regions: Course table (status: draft/review/published), create CTA.
11. **Navigation Areas:** Studio sidebar plus shared Review link when relationship-scoped. Inventory nav: Studio sidebar.
12. **Page Sections:** Course table (status: draft/review/published), create CTA
13. **Primary Actions:** Publish or submit for review through the declared workflow boundary; Create/submit the primary resource or state transition; Mint attribution token and continue to external CTA only after policy gate.
14. **Secondary Actions:** Navigate to declared child/destination screens only.
15. **Empty States:** Show an empty list/table/feed with a single permitted CTA when create/join/invite is allowed; otherwise show read-only explanatory copy.
16. **Loading States:** Skeleton for header/nav and page body after membership/entitlement/permission checks; action buttons disabled until resource loaders complete.
17. **Error States:** Use standard error envelope handling: validation errors inline; 401 to login; 403 permission/ownership/relationship denial as disabled action or role home; 404 without cross-tenant existence leakage; 409 idempotency/conflict where applicable; 429/503 as safe retry/tenant-state messaging.
18. **Membership Gate States:** ACTIVE membership in resolved tenant is required. INVITED routes only to A9; SUSPENDED/REMOVED/no row routes to branded blocked/public state; stale tokens are never trusted.
19. **Entitlement Failure States:** Not applicable; screen has no declared route-level entitlement. Still hide/disable sub-actions if their API entitlement fails.
20. **Mobile Behavior:** Desktop-first control plane; on mobile, tables become stacked cards with preserved filters and guarded row actions.
21. **Accessibility Notes:** Keyboard navigable; focus order follows header/nav/main/actions; visible labels for forms/actions; server errors announced in an accessible region.
22. **Audit-Relevant Actions:** Mutating/sensitive actions must emit declared audit/outbox events in the same transaction; destructive or irreversible actions require confirmation and reason/comment where specified.
23. **Notes for Engineering:** Screen must use only declared APIs and route metadata; no client-supplied `tenant_id`; host resolution is authoritative. Server resource loader must declare permission, entitlement if any, and ownership/relationship loader before render. Require idempotency/confirmation where route/table requires it; optimistic UI must roll back on server denial.

### I3 — Course Builder

1. **Screen ID:** I3
2. **Screen Name:** Course Builder
3. **Route:** `/studio/courses/:id`
4. **Actor:** Instructor (Studio shell)
5. **Entry Sources:** from I2; instructor deep link; handoff from S1 or related authoring list.
6. **Exit Destinations:** → I4; Publish/Submit-for-review modal; Delete confirm
7. **Required Permission:** `course.update` (own), `course.publish` (own + workflow)
8. **Required Entitlement:** None declared for this screen in Phase 0/1.
9. **Data Sources / APIs:** Declared APIs: `PUT /courses/:id`, `GET/POST /courses/:id/modules`, `PUT/DELETE /modules/:id`, `POST /courses/:id/publish`. Data projection is limited to entities reachable through those APIs and the resolved tenant context; UI must not query tables directly.
10. **Layout Structure:** Complex split layout. See ASCII wireframe below. Core regions: Module tree (reorder), course settings, access rules, publish-to-review button.
11. **Navigation Areas:** Studio sidebar plus shared Review link when relationship-scoped. Inventory nav: from I2.
12. **Page Sections:** Module tree (reorder), course settings, access rules, publish-to-review button
13. **Primary Actions:** Publish or submit for review through the declared workflow boundary; Create/submit the primary resource or state transition; Execute guarded lifecycle/destructive action with confirmation.
14. **Secondary Actions:** Open declared modal/confirmation path; Navigate to declared child/destination screens only.
15. **Empty States:** Show unsaved draft scaffold with required fields and validation hints; no auto-publish.
16. **Loading States:** Skeleton for header/nav and page body after membership/entitlement/permission checks; action buttons disabled until resource loaders complete.
17. **Error States:** Use standard error envelope handling: validation errors inline; 401 to login; 403 permission/ownership/relationship denial as disabled action or role home; 404 without cross-tenant existence leakage; 409 idempotency/conflict where applicable; 429/503 as safe retry/tenant-state messaging.
18. **Membership Gate States:** ACTIVE membership in resolved tenant is required. INVITED routes only to A9; SUSPENDED/REMOVED/no row routes to branded blocked/public state; stale tokens are never trusted.
19. **Entitlement Failure States:** Not applicable; screen has no declared route-level entitlement. Still hide/disable sub-actions if their API entitlement fails.
20. **Mobile Behavior:** Desktop-first control plane; on mobile, editor/detail columns stack and destructive actions remain behind confirmations.
21. **Accessibility Notes:** Keyboard navigable; focus order follows header/nav/main/actions; visible labels for forms/actions; server errors announced in an accessible region. Modals trap focus, provide escape/close semantics where safe, and return focus to the opener.
22. **Audit-Relevant Actions:** Mutating/sensitive actions must emit declared audit/outbox events in the same transaction; destructive or irreversible actions require confirmation and reason/comment where specified.
23. **Notes for Engineering:** Screen must use only declared APIs and route metadata; no client-supplied `tenant_id`; host resolution is authoritative. Server resource loader must declare permission, entitlement if any, and ownership/relationship loader before render. Require idempotency/confirmation where route/table requires it; optimistic UI must roll back on server denial.

**ASCII wireframe:**
```text
+--------------------------------------------------------------------------------+
| Studio header: Course Builder / status / submit-for-review                       |
+-------------------+------------------------------------------------------------+
| Studio nav        | Course metadata / publish status / owner relationship       |
| Courses           +------------------------------------------------------------+
| Items             | Module tree                 | Selected module / lesson list  |
| Assessments       | [Module] [Module]           | [Lesson row] [Quiz link]       |
| Paths             +-----------------------------+------------------------------+
| Grading           | Course settings / enrollment rules / certificate link       |
| Analytics         +------------------------------------------------------------+
| Review            | Validation issues / workflow history / audit-relevant CTA   |
+-------------------+------------------------------------------------------------+
```

### I4 — Lesson Editor

1. **Screen ID:** I4
2. **Screen Name:** Lesson Editor
3. **Route:** `/studio/courses/:id/lessons/:lessonId`
4. **Actor:** Instructor (Studio shell)
5. **Entry Sources:** within I3; instructor deep link; handoff from S1 or related authoring list.
6. **Exit Destinations:** Asset-delete confirm
7. **Required Permission:** `course.update` (own)
8. **Required Entitlement:** None declared for this screen in Phase 0/1.
9. **Data Sources / APIs:** Declared APIs: `GET/PUT/DELETE /lessons/:id`, `GET/POST/DELETE /lessons/:id/assets`. Data projection is limited to entities reachable through those APIs and the resolved tenant context; UI must not query tables directly.
10. **Layout Structure:** Studio shell with left studio navigation, resource header/status row, editor/list main area, and validation/action rail where applicable. Core regions: Rich editor, content-type picker, asset uploader (R2 signed), video-provider+url fields.
11. **Navigation Areas:** Studio sidebar plus shared Review link when relationship-scoped. Inventory nav: within I3.
12. **Page Sections:** Rich editor, content-type picker, asset uploader (R2 signed), video-provider+url fields
13. **Primary Actions:** Create/submit the primary resource or state transition; Execute guarded lifecycle/destructive action with confirmation.
14. **Secondary Actions:** Open declared modal/confirmation path; Navigate to declared child/destination screens only.
15. **Empty States:** Show unsaved draft scaffold with required fields and validation hints; no auto-publish.
16. **Loading States:** Skeleton for header/nav and page body after membership/entitlement/permission checks; action buttons disabled until resource loaders complete.
17. **Error States:** Use standard error envelope handling: validation errors inline; 401 to login; 403 permission/ownership/relationship denial as disabled action or role home; 404 without cross-tenant existence leakage; 409 idempotency/conflict where applicable; 429/503 as safe retry/tenant-state messaging.
18. **Membership Gate States:** ACTIVE membership in resolved tenant is required. INVITED routes only to A9; SUSPENDED/REMOVED/no row routes to branded blocked/public state; stale tokens are never trusted.
19. **Entitlement Failure States:** Not applicable; screen has no declared route-level entitlement. Still hide/disable sub-actions if their API entitlement fails.
20. **Mobile Behavior:** Desktop-first control plane; on mobile, editor/detail columns stack and destructive actions remain behind confirmations.
21. **Accessibility Notes:** Keyboard navigable; focus order follows header/nav/main/actions; visible labels for forms/actions; server errors announced in an accessible region. Modals trap focus, provide escape/close semantics where safe, and return focus to the opener.
22. **Audit-Relevant Actions:** Mutating/sensitive actions must emit declared audit/outbox events in the same transaction; destructive or irreversible actions require confirmation and reason/comment where specified.
23. **Notes for Engineering:** Screen must use only declared APIs and route metadata; no client-supplied `tenant_id`; host resolution is authoritative. Server resource loader must declare permission, entitlement if any, and ownership/relationship loader before render. Require idempotency/confirmation where route/table requires it; optimistic UI must roll back on server denial.

### I5 — Item Bank

1. **Screen ID:** I5
2. **Screen Name:** Item Bank
3. **Route:** `/studio/items`
4. **Actor:** Instructor (Studio shell)
5. **Entry Sources:** Studio sidebar; instructor deep link; handoff from S1 or related authoring list.
6. **Exit Destinations:** → I6
7. **Required Permission:** `item.read`, `item.create`
8. **Required Entitlement:** None declared for this screen in Phase 0/1.
9. **Data Sources / APIs:** Declared APIs: `GET /item-types`, `GET/POST /items`. Data projection is limited to entities reachable through those APIs and the resolved tenant context; UI must not query tables directly.
10. **Layout Structure:** Studio shell with left studio navigation, resource header/status row, editor/list main area, and validation/action rail where applicable. Core regions: Item table, type filter, create (any registered item_type).
11. **Navigation Areas:** Studio sidebar plus shared Review link when relationship-scoped. Inventory nav: Studio sidebar.
12. **Page Sections:** Item table, type filter, create (any registered item_type)
13. **Primary Actions:** Create/submit the primary resource or state transition.
14. **Secondary Actions:** Search/filter/sort within allowed indexed fields; Navigate to declared child/destination screens only.
15. **Empty States:** Show an empty list/table/feed with a single permitted CTA when create/join/invite is allowed; otherwise show read-only explanatory copy.
16. **Loading States:** Skeleton for header/nav and page body after membership/entitlement/permission checks; action buttons disabled until resource loaders complete.
17. **Error States:** Use standard error envelope handling: validation errors inline; 401 to login; 403 permission/ownership/relationship denial as disabled action or role home; 404 without cross-tenant existence leakage; 409 idempotency/conflict where applicable; 429/503 as safe retry/tenant-state messaging.
18. **Membership Gate States:** ACTIVE membership in resolved tenant is required. INVITED routes only to A9; SUSPENDED/REMOVED/no row routes to branded blocked/public state; stale tokens are never trusted.
19. **Entitlement Failure States:** Not applicable; screen has no declared route-level entitlement. Still hide/disable sub-actions if their API entitlement fails.
20. **Mobile Behavior:** Desktop-first control plane; on mobile, tables become stacked cards with preserved filters and guarded row actions.
21. **Accessibility Notes:** Keyboard navigable; focus order follows header/nav/main/actions; visible labels for forms/actions; server errors announced in an accessible region.
22. **Audit-Relevant Actions:** Mutating/sensitive actions must emit declared audit/outbox events in the same transaction; destructive or irreversible actions require confirmation and reason/comment where specified.
23. **Notes for Engineering:** Screen must use only declared APIs and route metadata; no client-supplied `tenant_id`; host resolution is authoritative. Server resource loader must declare permission, entitlement if any, and ownership/relationship loader before render. Require idempotency/confirmation where route/table requires it; optimistic UI must roll back on server denial.

### I6 — Item Editor

1. **Screen ID:** I6
2. **Screen Name:** Item Editor
3. **Route:** `/studio/items/:id`
4. **Actor:** Instructor (Studio shell)
5. **Entry Sources:** from I5; instructor deep link; handoff from S1 or related authoring list.
6. **Exit Destinations:** Delete confirm
7. **Required Permission:** `item.update` (own)
8. **Required Entitlement:** None declared for this screen in Phase 0/1.
9. **Data Sources / APIs:** Declared APIs: `PUT /items/:id`, `GET/PUT /items/:id/dimension-weights`. Data projection is limited to entities reachable through those APIs and the resolved tenant context; UI must not query tables directly.
10. **Layout Structure:** Studio shell with left studio navigation, resource header/status row, editor/list main area, and validation/action rail where applicable. Core regions: Stem/options editor, answer key, **dimension-weights matrix** (TA/PSY/RISK/DISC/CR).
11. **Navigation Areas:** Studio sidebar plus shared Review link when relationship-scoped. Inventory nav: from I5.
12. **Page Sections:** Stem/options editor, answer key, **dimension-weights matrix** (TA/PSY/RISK/DISC/CR)
13. **Primary Actions:** Execute guarded lifecycle/destructive action with confirmation.
14. **Secondary Actions:** Open declared modal/confirmation path; Navigate to declared child/destination screens only.
15. **Empty States:** Show unsaved draft scaffold with required fields and validation hints; no auto-publish.
16. **Loading States:** Skeleton for header/nav and page body after membership/entitlement/permission checks; action buttons disabled until resource loaders complete.
17. **Error States:** Use standard error envelope handling: validation errors inline; 401 to login; 403 permission/ownership/relationship denial as disabled action or role home; 404 without cross-tenant existence leakage; 409 idempotency/conflict where applicable; 429/503 as safe retry/tenant-state messaging.
18. **Membership Gate States:** ACTIVE membership in resolved tenant is required. INVITED routes only to A9; SUSPENDED/REMOVED/no row routes to branded blocked/public state; stale tokens are never trusted.
19. **Entitlement Failure States:** Not applicable; screen has no declared route-level entitlement. Still hide/disable sub-actions if their API entitlement fails.
20. **Mobile Behavior:** Desktop-first control plane; on mobile, editor/detail columns stack and destructive actions remain behind confirmations.
21. **Accessibility Notes:** Keyboard navigable; focus order follows header/nav/main/actions; visible labels for forms/actions; server errors announced in an accessible region. Modals trap focus, provide escape/close semantics where safe, and return focus to the opener.
22. **Audit-Relevant Actions:** Mutating/sensitive actions must emit declared audit/outbox events in the same transaction; destructive or irreversible actions require confirmation and reason/comment where specified.
23. **Notes for Engineering:** Screen must use only declared APIs and route metadata; no client-supplied `tenant_id`; host resolution is authoritative. Server resource loader must declare permission, entitlement if any, and ownership/relationship loader before render. Require idempotency/confirmation where route/table requires it; optimistic UI must roll back on server denial.

### I7 — Item Collections / Decks

1. **Screen ID:** I7
2. **Screen Name:** Item Collections / Decks
3. **Route:** `/studio/item-collections`
4. **Actor:** Instructor (Studio shell)
5. **Entry Sources:** Studio sidebar; instructor deep link; handoff from S1 or related authoring list.
6. **Exit Destinations:** Delete confirm
7. **Required Permission:** `item.read`, `item_collection.manage`
8. **Required Entitlement:** None declared for this screen in Phase 0/1.
9. **Data Sources / APIs:** Declared APIs: `GET/POST /item-collections`, `PUT/DELETE /item-collections/:id`, `POST/DELETE /item-collections/:id/items`. Data projection is limited to entities reachable through those APIs and the resolved tenant context; UI must not query tables directly.
10. **Layout Structure:** Studio shell with left studio navigation, resource header/status row, editor/list main area, and validation/action rail where applicable. Core regions: Collection list, composer (add/remove items), deck-type.
11. **Navigation Areas:** Studio sidebar plus shared Review link when relationship-scoped. Inventory nav: Studio sidebar.
12. **Page Sections:** Collection list, composer (add/remove items), deck-type
13. **Primary Actions:** Create/submit the primary resource or state transition; Execute guarded lifecycle/destructive action with confirmation.
14. **Secondary Actions:** Open declared modal/confirmation path; Navigate to declared child/destination screens only.
15. **Empty States:** Show an empty list/table/feed with a single permitted CTA when create/join/invite is allowed; otherwise show read-only explanatory copy.
16. **Loading States:** Skeleton for header/nav and page body after membership/entitlement/permission checks; action buttons disabled until resource loaders complete.
17. **Error States:** Use standard error envelope handling: validation errors inline; 401 to login; 403 permission/ownership/relationship denial as disabled action or role home; 404 without cross-tenant existence leakage; 409 idempotency/conflict where applicable; 429/503 as safe retry/tenant-state messaging.
18. **Membership Gate States:** ACTIVE membership in resolved tenant is required. INVITED routes only to A9; SUSPENDED/REMOVED/no row routes to branded blocked/public state; stale tokens are never trusted.
19. **Entitlement Failure States:** Not applicable; screen has no declared route-level entitlement. Still hide/disable sub-actions if their API entitlement fails.
20. **Mobile Behavior:** Desktop-first control plane; on mobile, tables become stacked cards with preserved filters and guarded row actions.
21. **Accessibility Notes:** Keyboard navigable; focus order follows header/nav/main/actions; visible labels for forms/actions; server errors announced in an accessible region. Modals trap focus, provide escape/close semantics where safe, and return focus to the opener.
22. **Audit-Relevant Actions:** Mutating/sensitive actions must emit declared audit/outbox events in the same transaction; destructive or irreversible actions require confirmation and reason/comment where specified.
23. **Notes for Engineering:** Screen must use only declared APIs and route metadata; no client-supplied `tenant_id`; host resolution is authoritative. Server resource loader must declare permission, entitlement if any, and ownership/relationship loader before render. Require idempotency/confirmation where route/table requires it; optimistic UI must roll back on server denial.

### I8 — Assessment Builder

1. **Screen ID:** I8
2. **Screen Name:** Assessment Builder
3. **Route:** `/studio/assessments`, `/studio/assessments/:id`
4. **Actor:** Instructor (Studio shell)
5. **Entry Sources:** Studio sidebar; instructor deep link; handoff from S1 or related authoring list.
6. **Exit Destinations:** Publish/Submit modal; Delete confirm
7. **Required Permission:** `assessment.create`, `assessment.update` (author), `assessment.publish` (author + workflow)
8. **Required Entitlement:** None declared for this screen in Phase 0/1.
9. **Data Sources / APIs:** Declared APIs: `GET/POST /assessments`, `PUT/DELETE /assessments/:id`, `POST /assessments/:id/publish`. Data projection is limited to entities reachable through those APIs and the resolved tenant context; UI must not query tables directly.
10. **Layout Structure:** Complex split layout. See ASCII wireframe below. Core regions: Item picker, config (time/attempts/pass mark/shuffle/secure-mode/**L1 proctoring level**), publish-to-review.
11. **Navigation Areas:** Studio sidebar plus shared Review link when relationship-scoped. Inventory nav: Studio sidebar.
12. **Page Sections:** Item picker, config (time/attempts/pass mark/shuffle/secure-mode/**L1 proctoring level**), publish-to-review
13. **Primary Actions:** Start or continue the declared run/attempt when allowed; Publish or submit for review through the declared workflow boundary; Create/submit the primary resource or state transition; Execute guarded lifecycle/destructive action with confirmation.
14. **Secondary Actions:** Open declared modal/confirmation path; Navigate to declared child/destination screens only.
15. **Empty States:** Show unsaved draft scaffold with required fields and validation hints; no auto-publish.
16. **Loading States:** Skeleton for header/nav and page body after membership/entitlement/permission checks; action buttons disabled until resource loaders complete.
17. **Error States:** Use standard error envelope handling: validation errors inline; 401 to login; 403 permission/ownership/relationship denial as disabled action or role home; 404 without cross-tenant existence leakage; 409 idempotency/conflict where applicable; 429/503 as safe retry/tenant-state messaging.
18. **Membership Gate States:** ACTIVE membership in resolved tenant is required. INVITED routes only to A9; SUSPENDED/REMOVED/no row routes to branded blocked/public state; stale tokens are never trusted.
19. **Entitlement Failure States:** Not applicable; screen has no declared route-level entitlement. Still hide/disable sub-actions if their API entitlement fails.
20. **Mobile Behavior:** Desktop-first control plane; on mobile, editor/detail columns stack and destructive actions remain behind confirmations.
21. **Accessibility Notes:** Keyboard navigable; focus order follows header/nav/main/actions; visible labels for forms/actions; server errors announced in an accessible region. Timer must be screen-reader announced without constant interruption; warnings use aria-live politely except submit-critical alerts. Modals trap focus, provide escape/close semantics where safe, and return focus to the opener.
22. **Audit-Relevant Actions:** Mutating/sensitive actions must emit declared audit/outbox events in the same transaction; destructive or irreversible actions require confirmation and reason/comment where specified.
23. **Notes for Engineering:** Screen must use only declared APIs and route metadata; no client-supplied `tenant_id`; host resolution is authoritative. Server resource loader must declare permission, entitlement if any, and ownership/relationship loader before render. Require idempotency/confirmation where route/table requires it; optimistic UI must roll back on server denial.

**ASCII wireframe:**
```text
+--------------------------------------------------------------------------------+
| Studio header: Assessment Builder / status / submit-for-review                   |
+-------------------+------------------------------------------------------------+
| Studio nav        | Assessment metadata / rules / attempt limits / timer         |
|                   +-----------------------------+------------------------------+
|                   | Item picker / bank filters  | Assessment item sequence       |
|                   | type / dimension / status   | reorder / weight / points      |
|                   +-----------------------------+------------------------------+
|                   | Scoring / review policy / L1 integrity settings             |
|                   +------------------------------------------------------------+
|                   | Validation panel / preview / workflow submission             |
+-------------------+------------------------------------------------------------+
```

### I9 — Learning Path Builder

1. **Screen ID:** I9
2. **Screen Name:** Learning Path Builder
3. **Route:** `/studio/learning-paths`, `:id`
4. **Actor:** Instructor (Studio shell)
5. **Entry Sources:** Studio sidebar; instructor deep link; handoff from S1 or related authoring list.
6. **Exit Destinations:** Publish modal
7. **Required Permission:** `learning_path.create`, `learning_path.update` (author), `learning_path.publish` (author + workflow)
8. **Required Entitlement:** None declared for this screen in Phase 0/1.
9. **Data Sources / APIs:** Declared APIs: `GET/POST /learning-paths`, `PUT/DELETE /learning-paths/:id`, `POST /learning-paths/:id/publish`. Data projection is limited to entities reachable through those APIs and the resolved tenant context; UI must not query tables directly.
10. **Layout Structure:** Studio shell with left studio navigation, resource header/status row, editor/list main area, and validation/action rail where applicable. Core regions: Step sequencer, gate editor (assessment/band), publish.
11. **Navigation Areas:** Studio sidebar plus shared Review link when relationship-scoped. Inventory nav: Studio sidebar.
12. **Page Sections:** Step sequencer, gate editor (assessment/band), publish
13. **Primary Actions:** Publish or submit for review through the declared workflow boundary; Create/submit the primary resource or state transition; Execute guarded lifecycle/destructive action with confirmation.
14. **Secondary Actions:** Open declared modal/confirmation path; Navigate to declared child/destination screens only.
15. **Empty States:** Show unsaved draft scaffold with required fields and validation hints; no auto-publish.
16. **Loading States:** Skeleton for header/nav and page body after membership/entitlement/permission checks; action buttons disabled until resource loaders complete.
17. **Error States:** Use standard error envelope handling: validation errors inline; 401 to login; 403 permission/ownership/relationship denial as disabled action or role home; 404 without cross-tenant existence leakage; 409 idempotency/conflict where applicable; 429/503 as safe retry/tenant-state messaging.
18. **Membership Gate States:** ACTIVE membership in resolved tenant is required. INVITED routes only to A9; SUSPENDED/REMOVED/no row routes to branded blocked/public state; stale tokens are never trusted.
19. **Entitlement Failure States:** Not applicable; screen has no declared route-level entitlement. Still hide/disable sub-actions if their API entitlement fails.
20. **Mobile Behavior:** Desktop-first control plane; on mobile, editor/detail columns stack and destructive actions remain behind confirmations.
21. **Accessibility Notes:** Keyboard navigable; focus order follows header/nav/main/actions; visible labels for forms/actions; server errors announced in an accessible region. Modals trap focus, provide escape/close semantics where safe, and return focus to the opener.
22. **Audit-Relevant Actions:** Mutating/sensitive actions must emit declared audit/outbox events in the same transaction; destructive or irreversible actions require confirmation and reason/comment where specified.
23. **Notes for Engineering:** Screen must use only declared APIs and route metadata; no client-supplied `tenant_id`; host resolution is authoritative. Server resource loader must declare permission, entitlement if any, and ownership/relationship loader before render. Require idempotency/confirmation where route/table requires it; optimistic UI must roll back on server denial.

### I10 — Grading Queue

1. **Screen ID:** I10
2. **Screen Name:** Grading Queue
3. **Route:** `/studio/grading`
4. **Actor:** Instructor (Studio shell)
5. **Entry Sources:** Studio sidebar; instructor deep link; handoff from S1 or related authoring list.
6. **Exit Destinations:** → I11
7. **Required Permission:** `assessment.grade` (assignee/relationship)
8. **Required Entitlement:** None declared for this screen in Phase 0/1.
9. **Data Sources / APIs:** Declared APIs: `GET /grading-tasks`. Data projection is limited to entities reachable through those APIs and the resolved tenant context; UI must not query tables directly.
10. **Layout Structure:** Studio shell with left studio navigation, resource header/status row, editor/list main area, and validation/action rail where applicable. Core regions: Task table (filter by assessment/learner), assigned-only.
11. **Navigation Areas:** Studio sidebar plus shared Review link when relationship-scoped. Inventory nav: Studio sidebar.
12. **Page Sections:** Task table (filter by assessment/learner), assigned-only
13. **Primary Actions:** View/read the declared resource projection.
14. **Secondary Actions:** Search/filter/sort within allowed indexed fields; Navigate to declared child/destination screens only.
15. **Empty States:** Show an empty list/table/feed with a single permitted CTA when create/join/invite is allowed; otherwise show read-only explanatory copy.
16. **Loading States:** Skeleton for header/nav and page body after membership/entitlement/permission checks; action buttons disabled until resource loaders complete.
17. **Error States:** Use standard error envelope handling: validation errors inline; 401 to login; 403 permission/ownership/relationship denial as disabled action or role home; 404 without cross-tenant existence leakage; 409 idempotency/conflict where applicable; 429/503 as safe retry/tenant-state messaging.
18. **Membership Gate States:** ACTIVE membership in resolved tenant is required. INVITED routes only to A9; SUSPENDED/REMOVED/no row routes to branded blocked/public state; stale tokens are never trusted.
19. **Entitlement Failure States:** Not applicable; screen has no declared route-level entitlement. Still hide/disable sub-actions if their API entitlement fails.
20. **Mobile Behavior:** Desktop-first control plane; on mobile, tables become stacked cards with preserved filters and guarded row actions.
21. **Accessibility Notes:** Keyboard navigable; focus order follows header/nav/main/actions; visible labels for forms/actions; server errors announced in an accessible region.
22. **Audit-Relevant Actions:** Routine read screen; no per-action audit beyond access telemetry/rate limiting unless API declares it.
23. **Notes for Engineering:** Screen must use only declared APIs and route metadata; no client-supplied `tenant_id`; host resolution is authoritative. Server resource loader must declare permission, entitlement if any, and ownership/relationship loader before render.

### I11 — Grading Detail

1. **Screen ID:** I11
2. **Screen Name:** Grading Detail
3. **Route:** `/studio/grading/:taskId`
4. **Actor:** Instructor (Studio shell)
5. **Entry Sources:** from I10; instructor deep link; handoff from S1 or related authoring list.
6. **Exit Destinations:** Finalize-grade confirm
7. **Required Permission:** `assessment.grade` (assignee)
8. **Required Entitlement:** None declared for this screen in Phase 0/1.
9. **Data Sources / APIs:** Declared APIs: `GET /grading-tasks/:id` (read), `POST /grading-tasks/:id/grade`. Data projection is limited to entities reachable through those APIs and the resolved tenant context; UI must not query tables directly.
10. **Layout Structure:** Studio shell with left studio navigation, resource header/status row, editor/list main area, and validation/action rail where applicable. Core regions: Answer panel, rubric/score, feedback, **L1 proctoring timeline (read-only, attached to attempt)**.
11. **Navigation Areas:** Studio sidebar plus shared Review link when relationship-scoped. Inventory nav: from I10.
12. **Page Sections:** Answer panel, rubric/score, feedback, **L1 proctoring timeline (read-only, attached to attempt)**
13. **Primary Actions:** Start or continue the declared run/attempt when allowed; Create/submit the primary resource or state transition.
14. **Secondary Actions:** Open declared modal/confirmation path; Navigate to declared child/destination screens only.
15. **Empty States:** Show an empty list/table/feed with a single permitted CTA when create/join/invite is allowed; otherwise show read-only explanatory copy.
16. **Loading States:** Skeleton for header/nav and page body after membership/entitlement/permission checks; action buttons disabled until resource loaders complete.
17. **Error States:** Use standard error envelope handling: validation errors inline; 401 to login; 403 permission/ownership/relationship denial as disabled action or role home; 404 without cross-tenant existence leakage; 409 idempotency/conflict where applicable; 429/503 as safe retry/tenant-state messaging.
18. **Membership Gate States:** ACTIVE membership in resolved tenant is required. INVITED routes only to A9; SUSPENDED/REMOVED/no row routes to branded blocked/public state; stale tokens are never trusted.
19. **Entitlement Failure States:** Not applicable; screen has no declared route-level entitlement. Still hide/disable sub-actions if their API entitlement fails.
20. **Mobile Behavior:** Desktop-first control plane; on mobile, editor/detail columns stack and destructive actions remain behind confirmations.
21. **Accessibility Notes:** Keyboard navigable; focus order follows header/nav/main/actions; visible labels for forms/actions; server errors announced in an accessible region. Charts/scores require text alternatives, tabular fallback, and non-color-only status indicators. Timer must be screen-reader announced without constant interruption; warnings use aria-live politely except submit-critical alerts. Modals trap focus, provide escape/close semantics where safe, and return focus to the opener.
22. **Audit-Relevant Actions:** Mutating/sensitive actions must emit declared audit/outbox events in the same transaction; destructive or irreversible actions require confirmation and reason/comment where specified.
23. **Notes for Engineering:** Screen must use only declared APIs and route metadata; no client-supplied `tenant_id`; host resolution is authoritative. Server resource loader must declare permission, entitlement if any, and ownership/relationship loader before render. Require idempotency/confirmation where route/table requires it; optimistic UI must roll back on server denial.

### I12 — Learner Roster & Progress

1. **Screen ID:** I12
2. **Screen Name:** Learner Roster & Progress
3. **Route:** `/studio/courses/:id/learners`
4. **Actor:** Instructor (Studio shell)
5. **Entry Sources:** from I3; instructor deep link; handoff from S1 or related authoring list.
6. **Exit Destinations:** Enrollment-manage modal
7. **Required Permission:** `enrollment.read` (rel), `progress.read` (rel), `competency.score.read` (rel), `attempt.read` (rel)
8. **Required Entitlement:** None declared for this screen in Phase 0/1.
9. **Data Sources / APIs:** Declared APIs: `GET /enrollments`, `GET /courses/:id/progress`, `GET /members/:id/competency`, `GET /attempts/:id`. Data projection is limited to entities reachable through those APIs and the resolved tenant context; UI must not query tables directly.
10. **Layout Structure:** Studio shell with left studio navigation, resource header/status row, editor/list main area, and validation/action rail where applicable. Core regions: Roster table, progress %, per-dimension competency, attempt drill-in, manage enrollment.
11. **Navigation Areas:** Studio sidebar plus shared Review link when relationship-scoped. Inventory nav: from I3.
12. **Page Sections:** Roster table, progress %, per-dimension competency, attempt drill-in, manage enrollment
13. **Primary Actions:** Start or continue the declared run/attempt when allowed; Enroll / continue enrolled resource.
14. **Secondary Actions:** Open declared modal/confirmation path; Navigate to declared child/destination screens only.
15. **Empty States:** Show an empty list/table/feed with a single permitted CTA when create/join/invite is allowed; otherwise show read-only explanatory copy.
16. **Loading States:** Skeleton for header/nav and page body after membership/entitlement/permission checks; action buttons disabled until resource loaders complete.
17. **Error States:** Use standard error envelope handling: validation errors inline; 401 to login; 403 permission/ownership/relationship denial as disabled action or role home; 404 without cross-tenant existence leakage; 409 idempotency/conflict where applicable; 429/503 as safe retry/tenant-state messaging.
18. **Membership Gate States:** ACTIVE membership in resolved tenant is required. INVITED routes only to A9; SUSPENDED/REMOVED/no row routes to branded blocked/public state; stale tokens are never trusted.
19. **Entitlement Failure States:** Not applicable; screen has no declared route-level entitlement. Still hide/disable sub-actions if their API entitlement fails.
20. **Mobile Behavior:** Desktop-first control plane; on mobile, tables become stacked cards with preserved filters and guarded row actions.
21. **Accessibility Notes:** Keyboard navigable; focus order follows header/nav/main/actions; visible labels for forms/actions; server errors announced in an accessible region. Timer must be screen-reader announced without constant interruption; warnings use aria-live politely except submit-critical alerts. Modals trap focus, provide escape/close semantics where safe, and return focus to the opener.
22. **Audit-Relevant Actions:** Routine read screen; no per-action audit beyond access telemetry/rate limiting unless API declares it.
23. **Notes for Engineering:** Screen must use only declared APIs and route metadata; no client-supplied `tenant_id`; host resolution is authoritative. Server resource loader must declare permission, entitlement if any, and ownership/relationship loader before render.

### I13 — Studio Analytics

1. **Screen ID:** I13
2. **Screen Name:** Studio Analytics
3. **Route:** `/studio/analytics`
4. **Actor:** Instructor (Studio shell)
5. **Entry Sources:** Studio sidebar; instructor deep link; handoff from S1 or related authoring list.
6. **Exit Destinations:** Studio dashboard, related builder/detail, or S1 Review & Approvals for publish gates.
7. **Required Permission:** `analytics.dashboard.view` (rel) [entitlement]
8. **Required Entitlement:** analytics.dashboard.view
9. **Data Sources / APIs:** Declared APIs: `GET /analytics/dashboards`, `GET /analytics/item-statistics`. Data projection is limited to entities reachable through those APIs and the resolved tenant context; UI must not query tables directly.
10. **Layout Structure:** Studio shell with left studio navigation, resource header/status row, editor/list main area, and validation/action rail where applicable. Core regions: Completion/drop-off charts, item difficulty/discrimination.
11. **Navigation Areas:** Studio sidebar plus shared Review link when relationship-scoped. Inventory nav: Studio sidebar.
12. **Page Sections:** Completion/drop-off charts, item difficulty/discrimination
13. **Primary Actions:** View/read the declared resource projection.
14. **Secondary Actions:** Navigate to declared child/destination screens only.
15. **Empty States:** Show "no data yet" with the next permitted learning/practice/admin setup action.
16. **Loading States:** Skeleton for header/nav and page body after membership/entitlement/permission checks; action buttons disabled until resource loaders complete.
17. **Error States:** Use standard error envelope handling: validation errors inline; 401 to login; 403 permission/ownership/relationship denial as disabled action or role home; 404 without cross-tenant existence leakage; 409 idempotency/conflict where applicable; 429/503 as safe retry/tenant-state messaging.
18. **Membership Gate States:** ACTIVE membership in resolved tenant is required. INVITED routes only to A9; SUSPENDED/REMOVED/no row routes to branded blocked/public state; stale tokens are never trusted.
19. **Entitlement Failure States:** If `analytics.dashboard.view` is absent, hide from nav and return/display `ENTITLEMENT_REQUIRED` upgrade prompt; never delete existing tenant data.
20. **Mobile Behavior:** Desktop-first control plane; on mobile, editor/detail columns stack and destructive actions remain behind confirmations.
21. **Accessibility Notes:** Keyboard navigable; focus order follows header/nav/main/actions; visible labels for forms/actions; server errors announced in an accessible region. Charts/scores require text alternatives, tabular fallback, and non-color-only status indicators.
22. **Audit-Relevant Actions:** Routine read screen; no per-action audit beyond access telemetry/rate limiting unless API declares it.
23. **Notes for Engineering:** Screen must use only declared APIs and route metadata; no client-supplied `tenant_id`; host resolution is authoritative. Server resource loader must declare permission, entitlement if any, and ownership/relationship loader before render.

### M1 — Moderation Queue

1. **Screen ID:** M1
2. **Screen Name:** Moderation Queue
3. **Route:** `/moderate/cases`
4. **Actor:** Moderator (Moderation shell)
5. **Entry Sources:** Moderate sidebar; moderation notification/case queue; admin/moderator deep link.
6. **Exit Destinations:** → M2
7. **Required Permission:** `community.moderate`
8. **Required Entitlement:** community.enable
9. **Data Sources / APIs:** Declared APIs: `GET/POST /moderation/cases`. Data projection is limited to entities reachable through those APIs and the resolved tenant context; UI must not query tables directly.
10. **Layout Structure:** Moderation shell with moderation navigation, queue/detail region, decision/action controls, and case history region. Core regions: Case table (reason/severity), open-case action.
11. **Navigation Areas:** Moderation sidebar; admin/owner may reach the same surface only if granted. Inventory nav: Moderate sidebar.
12. **Page Sections:** Case table (reason/severity), open-case action
13. **Primary Actions:** Create/submit the primary resource or state transition.
14. **Secondary Actions:** Navigate to declared child/destination screens only.
15. **Empty States:** Show an empty list/table/feed with a single permitted CTA when create/join/invite is allowed; otherwise show read-only explanatory copy.
16. **Loading States:** Skeleton for header/nav and page body after membership/entitlement/permission checks; action buttons disabled until resource loaders complete.
17. **Error States:** Use standard error envelope handling: validation errors inline; 401 to login; 403 permission/ownership/relationship denial as disabled action or role home; 404 without cross-tenant existence leakage; 409 idempotency/conflict where applicable; 429/503 as safe retry/tenant-state messaging.
18. **Membership Gate States:** ACTIVE membership in resolved tenant is required. INVITED routes only to A9; SUSPENDED/REMOVED/no row routes to branded blocked/public state; stale tokens are never trusted.
19. **Entitlement Failure States:** If `community.enable` is absent, hide from nav and return/display `ENTITLEMENT_REQUIRED` upgrade prompt; never delete existing tenant data.
20. **Mobile Behavior:** Desktop-first control plane; on mobile, tables become stacked cards with preserved filters and guarded row actions.
21. **Accessibility Notes:** Keyboard navigable; focus order follows header/nav/main/actions; visible labels for forms/actions; server errors announced in an accessible region.
22. **Audit-Relevant Actions:** Mutating/sensitive actions must emit declared audit/outbox events in the same transaction; destructive or irreversible actions require confirmation and reason/comment where specified.
23. **Notes for Engineering:** Screen must use only declared APIs and route metadata; no client-supplied `tenant_id`; host resolution is authoritative. Server resource loader must declare permission, entitlement if any, and ownership/relationship loader before render. Require idempotency/confirmation where route/table requires it; optimistic UI must roll back on server denial.

### M2 — Moderation Case Detail

1. **Screen ID:** M2
2. **Screen Name:** Moderation Case Detail
3. **Route:** `/moderate/cases/:id`
4. **Actor:** Moderator (Moderation shell)
5. **Entry Sources:** from M1; moderation notification/case queue; admin/moderator deep link.
6. **Exit Destinations:** Decision confirm modal
7. **Required Permission:** `community.moderate`
8. **Required Entitlement:** community.enable
9. **Data Sources / APIs:** Declared APIs: `POST /moderation/cases/:id/decide`; `DELETE /posts/:id`, `PUT/DELETE /comments/:id` (moderate path). Data projection is limited to entities reachable through those APIs and the resolved tenant context; UI must not query tables directly.
10. **Layout Structure:** Moderation shell with moderation navigation, queue/detail region, decision/action controls, and case history region. Core regions: Reported content, decision controls, action history.
11. **Navigation Areas:** Moderation sidebar; admin/owner may reach the same surface only if granted. Inventory nav: from M1.
12. **Page Sections:** Reported content, decision controls, action history
13. **Primary Actions:** Create/submit the primary resource or state transition; Execute guarded lifecycle/destructive action with confirmation.
14. **Secondary Actions:** Open declared modal/confirmation path; Navigate to declared child/destination screens only.
15. **Empty States:** Show neutral empty state with role-appropriate next action or back navigation.
16. **Loading States:** Skeleton for header/nav and page body after membership/entitlement/permission checks; action buttons disabled until resource loaders complete.
17. **Error States:** Use standard error envelope handling: validation errors inline; 401 to login; 403 permission/ownership/relationship denial as disabled action or role home; 404 without cross-tenant existence leakage; 409 idempotency/conflict where applicable; 429/503 as safe retry/tenant-state messaging.
18. **Membership Gate States:** ACTIVE membership in resolved tenant is required. INVITED routes only to A9; SUSPENDED/REMOVED/no row routes to branded blocked/public state; stale tokens are never trusted.
19. **Entitlement Failure States:** If `community.enable` is absent, hide from nav and return/display `ENTITLEMENT_REQUIRED` upgrade prompt; never delete existing tenant data.
20. **Mobile Behavior:** Desktop-first control plane; on mobile, editor/detail columns stack and destructive actions remain behind confirmations.
21. **Accessibility Notes:** Keyboard navigable; focus order follows header/nav/main/actions; visible labels for forms/actions; server errors announced in an accessible region. Modals trap focus, provide escape/close semantics where safe, and return focus to the opener.
22. **Audit-Relevant Actions:** Mutating/sensitive actions must emit declared audit/outbox events in the same transaction; destructive or irreversible actions require confirmation and reason/comment where specified.
23. **Notes for Engineering:** Screen must use only declared APIs and route metadata; no client-supplied `tenant_id`; host resolution is authoritative. Server resource loader must declare permission, entitlement if any, and ownership/relationship loader before render. Require idempotency/confirmation where route/table requires it; optimistic UI must roll back on server denial.

### M3 — Appeals Review

1. **Screen ID:** M3
2. **Screen Name:** Appeals Review
3. **Route:** `/moderate/appeals`
4. **Actor:** Moderator (Moderation shell)
5. **Entry Sources:** Moderate sidebar; moderation notification/case queue; admin/moderator deep link.
6. **Exit Destinations:** Decision confirm modal
7. **Required Permission:** `appeal.review`
8. **Required Entitlement:** community.enable
9. **Data Sources / APIs:** Declared APIs: `POST /appeals/:id/review`. Data projection is limited to entities reachable through those APIs and the resolved tenant context; UI must not query tables directly.
10. **Layout Structure:** Moderation shell with moderation navigation, queue/detail region, decision/action controls, and case history region. Core regions: Appeal list, case context, decide.
11. **Navigation Areas:** Moderation sidebar; admin/owner may reach the same surface only if granted. Inventory nav: Moderate sidebar.
12. **Page Sections:** Appeal list, case context, decide
13. **Primary Actions:** Create/submit the primary resource or state transition.
14. **Secondary Actions:** Open declared modal/confirmation path; Navigate to declared child/destination screens only.
15. **Empty States:** Show an empty list/table/feed with a single permitted CTA when create/join/invite is allowed; otherwise show read-only explanatory copy.
16. **Loading States:** Skeleton for header/nav and page body after membership/entitlement/permission checks; action buttons disabled until resource loaders complete.
17. **Error States:** Use standard error envelope handling: validation errors inline; 401 to login; 403 permission/ownership/relationship denial as disabled action or role home; 404 without cross-tenant existence leakage; 409 idempotency/conflict where applicable; 429/503 as safe retry/tenant-state messaging.
18. **Membership Gate States:** ACTIVE membership in resolved tenant is required. INVITED routes only to A9; SUSPENDED/REMOVED/no row routes to branded blocked/public state; stale tokens are never trusted.
19. **Entitlement Failure States:** If `community.enable` is absent, hide from nav and return/display `ENTITLEMENT_REQUIRED` upgrade prompt; never delete existing tenant data.
20. **Mobile Behavior:** Desktop-first control plane; on mobile, tables become stacked cards with preserved filters and guarded row actions.
21. **Accessibility Notes:** Keyboard navigable; focus order follows header/nav/main/actions; visible labels for forms/actions; server errors announced in an accessible region. Modals trap focus, provide escape/close semantics where safe, and return focus to the opener.
22. **Audit-Relevant Actions:** Mutating/sensitive actions must emit declared audit/outbox events in the same transaction; destructive or irreversible actions require confirmation and reason/comment where specified.
23. **Notes for Engineering:** Screen must use only declared APIs and route metadata; no client-supplied `tenant_id`; host resolution is authoritative. Server resource loader must declare permission, entitlement if any, and ownership/relationship loader before render. Require idempotency/confirmation where route/table requires it; optimistic UI must roll back on server denial.

### M4 — Community Spaces Admin

1. **Screen ID:** M4
2. **Screen Name:** Community Spaces Admin
3. **Route:** `/moderate/spaces`
4. **Actor:** Moderator (Moderation shell)
5. **Entry Sources:** Moderate sidebar; moderation notification/case queue; admin/moderator deep link.
6. **Exit Destinations:** Delete confirm
7. **Required Permission:** `community.space.manage`
8. **Required Entitlement:** community.enable
9. **Data Sources / APIs:** Declared APIs: `GET/POST/PUT/DELETE /spaces`. Data projection is limited to entities reachable through those APIs and the resolved tenant context; UI must not query tables directly.
10. **Layout Structure:** Moderation shell with moderation navigation, queue/detail region, decision/action controls, and case history region. Core regions: Space table, space editor (visibility/membership).
11. **Navigation Areas:** Moderation sidebar; admin/owner may reach the same surface only if granted. Inventory nav: Moderate sidebar.
12. **Page Sections:** Space table, space editor (visibility/membership)
13. **Primary Actions:** Create/submit the primary resource or state transition; Execute guarded lifecycle/destructive action with confirmation.
14. **Secondary Actions:** Copy/share public verification link; Open declared modal/confirmation path; Navigate to declared child/destination screens only.
15. **Empty States:** Show an empty list/table/feed with a single permitted CTA when create/join/invite is allowed; otherwise show read-only explanatory copy.
16. **Loading States:** Skeleton for header/nav and page body after membership/entitlement/permission checks; action buttons disabled until resource loaders complete.
17. **Error States:** Use standard error envelope handling: validation errors inline; 401 to login; 403 permission/ownership/relationship denial as disabled action or role home; 404 without cross-tenant existence leakage; 409 idempotency/conflict where applicable; 429/503 as safe retry/tenant-state messaging.
18. **Membership Gate States:** ACTIVE membership in resolved tenant is required. INVITED routes only to A9; SUSPENDED/REMOVED/no row routes to branded blocked/public state; stale tokens are never trusted.
19. **Entitlement Failure States:** If `community.enable` is absent, hide from nav and return/display `ENTITLEMENT_REQUIRED` upgrade prompt; never delete existing tenant data.
20. **Mobile Behavior:** Desktop-first control plane; on mobile, tables become stacked cards with preserved filters and guarded row actions.
21. **Accessibility Notes:** Keyboard navigable; focus order follows header/nav/main/actions; visible labels for forms/actions; server errors announced in an accessible region. Modals trap focus, provide escape/close semantics where safe, and return focus to the opener.
22. **Audit-Relevant Actions:** Mutating/sensitive actions must emit declared audit/outbox events in the same transaction; destructive or irreversible actions require confirmation and reason/comment where specified.
23. **Notes for Engineering:** Screen must use only declared APIs and route metadata; no client-supplied `tenant_id`; host resolution is authoritative. Server resource loader must declare permission, entitlement if any, and ownership/relationship loader before render. Require idempotency/confirmation where route/table requires it; optimistic UI must roll back on server denial.

### T1 — Admin Dashboard

1. **Screen ID:** T1
2. **Screen Name:** Admin Dashboard
3. **Route:** `/admin`
4. **Actor:** Tenant Admin (Admin console shell)
5. **Entry Sources:** Admin sidebar (Home); admin dashboard branch; authorized admin deep link.
6. **Exit Destinations:** Admin dashboard, related admin detail screen, S1 review, or same-screen confirmation result.
7. **Required Permission:** `membership.read`, `audit.read`
8. **Required Entitlement:** None declared for this screen in Phase 0/1.
9. **Data Sources / APIs:** Declared APIs: `GET /members`, `GET /audit`, `GET /provisioning/jobs`. Data projection is limited to entities reachable through those APIs and the resolved tenant context; UI must not query tables directly.
10. **Layout Structure:** Admin console shell with admin navigation, page header, configuration/table/editor main region, and confirmation/drawer area. Core regions: Member/active-learner counts, content-status, pending reviews, moderation depth, entitlement summary.
11. **Navigation Areas:** Admin sidebar; owner-only actions remain inline, not separate routes. Inventory nav: Admin sidebar (Home).
12. **Page Sections:** Member/active-learner counts, content-status, pending reviews, moderation depth, entitlement summary
13. **Primary Actions:** View/read the declared resource projection.
14. **Secondary Actions:** Navigate to declared child/destination screens only.
15. **Empty States:** Show neutral empty state with role-appropriate next action or back navigation.
16. **Loading States:** Skeleton for header/nav and page body after membership/entitlement/permission checks; action buttons disabled until resource loaders complete.
17. **Error States:** Use standard error envelope handling: validation errors inline; 401 to login; 403 permission/ownership/relationship denial as disabled action or role home; 404 without cross-tenant existence leakage; 409 idempotency/conflict where applicable; 429/503 as safe retry/tenant-state messaging.
18. **Membership Gate States:** ACTIVE membership in resolved tenant is required. INVITED routes only to A9; SUSPENDED/REMOVED/no row routes to branded blocked/public state; stale tokens are never trusted.
19. **Entitlement Failure States:** Not applicable; screen has no declared route-level entitlement. Still hide/disable sub-actions if their API entitlement fails.
20. **Mobile Behavior:** Desktop-first control plane; on mobile, editor/detail columns stack and destructive actions remain behind confirmations.
21. **Accessibility Notes:** Keyboard navigable; focus order follows header/nav/main/actions; visible labels for forms/actions; server errors announced in an accessible region.
22. **Audit-Relevant Actions:** Mutating/sensitive actions must emit declared audit/outbox events in the same transaction; destructive or irreversible actions require confirmation and reason/comment where specified.
23. **Notes for Engineering:** Screen must use only declared APIs and route metadata; no client-supplied `tenant_id`; host resolution is authoritative. Server resource loader must declare permission, entitlement if any, and ownership/relationship loader before render.

### T2 — Members

1. **Screen ID:** T2
2. **Screen Name:** Members
3. **Route:** `/admin/members`
4. **Actor:** Tenant Admin (Admin console shell)
5. **Entry Sources:** Admin sidebar; admin dashboard branch; authorized admin deep link.
6. **Exit Destinations:** Invite modal; Suspend/Remove confirm
7. **Required Permission:** `membership.read/invite/suspend/remove`, `profile.read`
8. **Required Entitlement:** None declared for this screen in Phase 0/1.
9. **Data Sources / APIs:** Declared APIs: `GET /members`, `POST /members/invite`, `POST /members/:id/suspend`, `DELETE /members/:id`. Data projection is limited to entities reachable through those APIs and the resolved tenant context; UI must not query tables directly.
10. **Layout Structure:** Complex split layout. See ASCII wireframe below. Core regions: Member table, invite, suspend, remove (owner-guard).
11. **Navigation Areas:** Admin sidebar; owner-only actions remain inline, not separate routes. Inventory nav: Admin sidebar.
12. **Page Sections:** Member table, invite, suspend, remove (owner-guard)
13. **Primary Actions:** Create/submit the primary resource or state transition; Execute guarded lifecycle/destructive action with confirmation.
14. **Secondary Actions:** Open declared modal/confirmation path; Navigate to declared child/destination screens only.
15. **Empty States:** Show an empty list/table/feed with a single permitted CTA when create/join/invite is allowed; otherwise show read-only explanatory copy.
16. **Loading States:** Skeleton for header/nav and page body after membership/entitlement/permission checks; action buttons disabled until resource loaders complete.
17. **Error States:** Use standard error envelope handling: validation errors inline; 401 to login; 403 permission/ownership/relationship denial as disabled action or role home; 404 without cross-tenant existence leakage; 409 idempotency/conflict where applicable; 429/503 as safe retry/tenant-state messaging.
18. **Membership Gate States:** ACTIVE membership in resolved tenant is required. INVITED routes only to A9; SUSPENDED/REMOVED/no row routes to branded blocked/public state; stale tokens are never trusted.
19. **Entitlement Failure States:** Not applicable; screen has no declared route-level entitlement. Still hide/disable sub-actions if their API entitlement fails.
20. **Mobile Behavior:** Desktop-first control plane; on mobile, tables become stacked cards with preserved filters and guarded row actions.
21. **Accessibility Notes:** Keyboard navigable; focus order follows header/nav/main/actions; visible labels for forms/actions; server errors announced in an accessible region. Modals trap focus, provide escape/close semantics where safe, and return focus to the opener.
22. **Audit-Relevant Actions:** Mutating/sensitive actions must emit declared audit/outbox events in the same transaction; destructive or irreversible actions require confirmation and reason/comment where specified.
23. **Notes for Engineering:** Screen must use only declared APIs and route metadata; no client-supplied `tenant_id`; host resolution is authoritative. Server resource loader must declare permission, entitlement if any, and ownership/relationship loader before render. Require idempotency/confirmation where route/table requires it; optimistic UI must roll back on server denial.

**ASCII wireframe:**
```text
+--------------------------------------------------------------------------------+
| Admin header: Members / invite CTA / filters                                     |
+-------------------+------------------------------------------------------------+
| Admin nav         | Member table: name, email, roles, status, last active        |
|                   | [Filter: role/status] [Search] [Invite]                    |
|                   +------------------------------------------------------------+
|                   | Row actions: open detail / suspend / remove (owner-guard)   |
|                   +------------------------------------------------------------+
|                   | Invite modal / suspend confirm / remove confirm             |
+-------------------+------------------------------------------------------------+
```

### T3 — Member Detail

1. **Screen ID:** T3
2. **Screen Name:** Member Detail
3. **Route:** `/admin/members/:id`
4. **Actor:** Tenant Admin (Admin console shell)
5. **Entry Sources:** from T2; admin dashboard branch; authorized admin deep link.
6. **Exit Destinations:** Role-assign modal; Override modal
7. **Required Permission:** `membership.read`, `profile.read/update`, `role.assign/revoke`, `permission_override.manage`
8. **Required Entitlement:** None declared for this screen in Phase 0/1.
9. **Data Sources / APIs:** Declared APIs: `GET /members/:id`, `GET/PUT /members/:id/profile`, `POST /members/:id/roles`, `DELETE /members/:id/roles/:roleId`, `GET/POST/DELETE /permission-overrides`. Data projection is limited to entities reachable through those APIs and the resolved tenant context; UI must not query tables directly.
10. **Layout Structure:** Admin console shell with admin navigation, page header, configuration/table/editor main region, and confirmation/drawer area. Core regions: Profile editor, role assignment (cannot-assign-owner, rank-guard), override list.
11. **Navigation Areas:** Admin sidebar; owner-only actions remain inline, not separate routes. Inventory nav: from T2.
12. **Page Sections:** Profile editor, role assignment (cannot-assign-owner, rank-guard), override list
13. **Primary Actions:** Create/submit the primary resource or state transition; Execute guarded lifecycle/destructive action with confirmation.
14. **Secondary Actions:** Open declared modal/confirmation path; Navigate to declared child/destination screens only.
15. **Empty States:** Show an empty list/table/feed with a single permitted CTA when create/join/invite is allowed; otherwise show read-only explanatory copy.
16. **Loading States:** Skeleton for header/nav and page body after membership/entitlement/permission checks; action buttons disabled until resource loaders complete.
17. **Error States:** Use standard error envelope handling: validation errors inline; 401 to login; 403 permission/ownership/relationship denial as disabled action or role home; 404 without cross-tenant existence leakage; 409 idempotency/conflict where applicable; 429/503 as safe retry/tenant-state messaging.
18. **Membership Gate States:** ACTIVE membership in resolved tenant is required. INVITED routes only to A9; SUSPENDED/REMOVED/no row routes to branded blocked/public state; stale tokens are never trusted.
19. **Entitlement Failure States:** Not applicable; screen has no declared route-level entitlement. Still hide/disable sub-actions if their API entitlement fails.
20. **Mobile Behavior:** Desktop-first control plane; on mobile, tables become stacked cards with preserved filters and guarded row actions.
21. **Accessibility Notes:** Keyboard navigable; focus order follows header/nav/main/actions; visible labels for forms/actions; server errors announced in an accessible region. Modals trap focus, provide escape/close semantics where safe, and return focus to the opener.
22. **Audit-Relevant Actions:** Mutating/sensitive actions must emit declared audit/outbox events in the same transaction; destructive or irreversible actions require confirmation and reason/comment where specified.
23. **Notes for Engineering:** Screen must use only declared APIs and route metadata; no client-supplied `tenant_id`; host resolution is authoritative. Server resource loader must declare permission, entitlement if any, and ownership/relationship loader before render. Require idempotency/confirmation where route/table requires it; optimistic UI must roll back on server denial.

### T4 — Roles & Permissions

1. **Screen ID:** T4
2. **Screen Name:** Roles & Permissions
3. **Route:** `/admin/roles`
4. **Actor:** Tenant Admin (Admin console shell)
5. **Entry Sources:** Admin sidebar; admin dashboard branch; authorized admin deep link.
6. **Exit Destinations:** → T5; Delete confirm
7. **Required Permission:** `role.read/create`
8. **Required Entitlement:** None declared for this screen in Phase 0/1.
9. **Data Sources / APIs:** Declared APIs: `GET/POST /roles`. Data projection is limited to entities reachable through those APIs and the resolved tenant context; UI must not query tables directly.
10. **Layout Structure:** Admin console shell with admin navigation, page header, configuration/table/editor main region, and confirmation/drawer area. Core regions: Role table (system vs custom), create CTA.
11. **Navigation Areas:** Admin sidebar; owner-only actions remain inline, not separate routes. Inventory nav: Admin sidebar.
12. **Page Sections:** Role table (system vs custom), create CTA
13. **Primary Actions:** Create/submit the primary resource or state transition; Execute guarded lifecycle/destructive action with confirmation; Mint attribution token and continue to external CTA only after policy gate.
14. **Secondary Actions:** Open declared modal/confirmation path; Navigate to declared child/destination screens only.
15. **Empty States:** Show an empty list/table/feed with a single permitted CTA when create/join/invite is allowed; otherwise show read-only explanatory copy.
16. **Loading States:** Skeleton for header/nav and page body after membership/entitlement/permission checks; action buttons disabled until resource loaders complete.
17. **Error States:** Use standard error envelope handling: validation errors inline; 401 to login; 403 permission/ownership/relationship denial as disabled action or role home; 404 without cross-tenant existence leakage; 409 idempotency/conflict where applicable; 429/503 as safe retry/tenant-state messaging.
18. **Membership Gate States:** ACTIVE membership in resolved tenant is required. INVITED routes only to A9; SUSPENDED/REMOVED/no row routes to branded blocked/public state; stale tokens are never trusted.
19. **Entitlement Failure States:** Not applicable; screen has no declared route-level entitlement. Still hide/disable sub-actions if their API entitlement fails.
20. **Mobile Behavior:** Desktop-first control plane; on mobile, tables become stacked cards with preserved filters and guarded row actions.
21. **Accessibility Notes:** Keyboard navigable; focus order follows header/nav/main/actions; visible labels for forms/actions; server errors announced in an accessible region. Modals trap focus, provide escape/close semantics where safe, and return focus to the opener.
22. **Audit-Relevant Actions:** Mutating/sensitive actions must emit declared audit/outbox events in the same transaction; destructive or irreversible actions require confirmation and reason/comment where specified.
23. **Notes for Engineering:** Screen must use only declared APIs and route metadata; no client-supplied `tenant_id`; host resolution is authoritative. Server resource loader must declare permission, entitlement if any, and ownership/relationship loader before render. Require idempotency/confirmation where route/table requires it; optimistic UI must roll back on server denial.

### T5 — Role Editor

1. **Screen ID:** T5
2. **Screen Name:** Role Editor
3. **Route:** `/admin/roles/:id`
4. **Actor:** Tenant Admin (Admin console shell)
5. **Entry Sources:** from T4; admin dashboard branch; authorized admin deep link.
6. **Exit Destinations:** Save/Delete confirm
7. **Required Permission:** `role.update/delete` (no-grant-up, not-owner-role)
8. **Required Entitlement:** None declared for this screen in Phase 0/1.
9. **Data Sources / APIs:** Declared APIs: `PUT/DELETE /roles/:id`. Data projection is limited to entities reachable through those APIs and the resolved tenant context; UI must not query tables directly.
10. **Layout Structure:** Admin console shell with admin navigation, page header, configuration/table/editor main region, and confirmation/drawer area. Core regions: Permission-catalogue picker (grouped), grant-up guard warnings.
11. **Navigation Areas:** Admin sidebar; owner-only actions remain inline, not separate routes. Inventory nav: from T4.
12. **Page Sections:** Permission-catalogue picker (grouped), grant-up guard warnings
13. **Primary Actions:** Execute guarded lifecycle/destructive action with confirmation.
14. **Secondary Actions:** Open declared modal/confirmation path; Navigate to declared child/destination screens only.
15. **Empty States:** Show unsaved draft scaffold with required fields and validation hints; no auto-publish.
16. **Loading States:** Skeleton for header/nav and page body after membership/entitlement/permission checks; action buttons disabled until resource loaders complete.
17. **Error States:** Use standard error envelope handling: validation errors inline; 401 to login; 403 permission/ownership/relationship denial as disabled action or role home; 404 without cross-tenant existence leakage; 409 idempotency/conflict where applicable; 429/503 as safe retry/tenant-state messaging.
18. **Membership Gate States:** ACTIVE membership in resolved tenant is required. INVITED routes only to A9; SUSPENDED/REMOVED/no row routes to branded blocked/public state; stale tokens are never trusted.
19. **Entitlement Failure States:** Not applicable; screen has no declared route-level entitlement. Still hide/disable sub-actions if their API entitlement fails.
20. **Mobile Behavior:** Desktop-first control plane; on mobile, editor/detail columns stack and destructive actions remain behind confirmations.
21. **Accessibility Notes:** Keyboard navigable; focus order follows header/nav/main/actions; visible labels for forms/actions; server errors announced in an accessible region. Modals trap focus, provide escape/close semantics where safe, and return focus to the opener.
22. **Audit-Relevant Actions:** Mutating/sensitive actions must emit declared audit/outbox events in the same transaction; destructive or irreversible actions require confirmation and reason/comment where specified.
23. **Notes for Engineering:** Screen must use only declared APIs and route metadata; no client-supplied `tenant_id`; host resolution is authoritative. Server resource loader must declare permission, entitlement if any, and ownership/relationship loader before render. Require idempotency/confirmation where route/table requires it; optimistic UI must roll back on server denial.

### T6 — Branding & Theme

1. **Screen ID:** T6
2. **Screen Name:** Branding & Theme
3. **Route:** `/admin/branding`
4. **Actor:** Tenant Admin (Admin console shell)
5. **Entry Sources:** Admin sidebar; admin dashboard branch; authorized admin deep link.
6. **Exit Destinations:** Publish confirm; Restore-version modal
7. **Required Permission:** `branding.read/update/publish`
8. **Required Entitlement:** None declared for this screen in Phase 0/1.
9. **Data Sources / APIs:** Declared APIs: `GET/PUT /branding`, `PUT /theme`, `POST /branding/publish`, `GET /branding/versions`. Data projection is limited to entities reachable through those APIs and the resolved tenant context; UI must not query tables directly.
10. **Layout Structure:** Complex split layout. See ASCII wireframe below. Core regions: Logo/colour/copy editor, theme-token editor, live preview, version history.
11. **Navigation Areas:** Admin sidebar; owner-only actions remain inline, not separate routes. Inventory nav: Admin sidebar.
12. **Page Sections:** Logo/colour/copy editor, theme-token editor, live preview, version history
13. **Primary Actions:** Publish or submit for review through the declared workflow boundary; Create/submit the primary resource or state transition.
14. **Secondary Actions:** View version history / restore where declared; Open declared modal/confirmation path; Navigate to declared child/destination screens only.
15. **Empty States:** Show unsaved draft scaffold with required fields and validation hints; no auto-publish.
16. **Loading States:** Skeleton for header/nav and page body after membership/entitlement/permission checks; action buttons disabled until resource loaders complete.
17. **Error States:** Use standard error envelope handling: validation errors inline; 401 to login; 403 permission/ownership/relationship denial as disabled action or role home; 404 without cross-tenant existence leakage; 409 idempotency/conflict where applicable; 429/503 as safe retry/tenant-state messaging.
18. **Membership Gate States:** ACTIVE membership in resolved tenant is required. INVITED routes only to A9; SUSPENDED/REMOVED/no row routes to branded blocked/public state; stale tokens are never trusted.
19. **Entitlement Failure States:** Not applicable; screen has no declared route-level entitlement. Still hide/disable sub-actions if their API entitlement fails.
20. **Mobile Behavior:** Desktop-first control plane; on mobile, editor/detail columns stack and destructive actions remain behind confirmations.
21. **Accessibility Notes:** Keyboard navigable; focus order follows header/nav/main/actions; visible labels for forms/actions; server errors announced in an accessible region. Modals trap focus, provide escape/close semantics where safe, and return focus to the opener.
22. **Audit-Relevant Actions:** Mutating/sensitive actions must emit declared audit/outbox events in the same transaction; destructive or irreversible actions require confirmation and reason/comment where specified.
23. **Notes for Engineering:** Screen must use only declared APIs and route metadata; no client-supplied `tenant_id`; host resolution is authoritative. Server resource loader must declare permission, entitlement if any, and ownership/relationship loader before render. Require idempotency/confirmation where route/table requires it; optimistic UI must roll back on server denial.

**ASCII wireframe:**
```text
+--------------------------------------------------------------------------------+
| Admin header: Branding & Theme / draft status / publish                          |
+-------------------+------------------------------------------------------------+
| Admin nav         | Branding form                 | Live preview                  |
|                   | logo/name/copy                | public/app shell preview      |
|                   +-------------------------------+-----------------------------+
|                   | Theme token form              | Version history               |
|                   +------------------------------------------------------------+
|                   | Publish / restore confirmation                               |
+-------------------+------------------------------------------------------------+
```

### T7 — Domains

1. **Screen ID:** T7
2. **Screen Name:** Domains
3. **Route:** `/admin/domains`
4. **Actor:** Tenant Admin (Admin console shell)
5. **Entry Sources:** Admin sidebar; admin dashboard branch; authorized admin deep link.
6. **Exit Destinations:** Add-domain modal; Delete confirm
7. **Required Permission:** `tenancy.domain.read/manage`
8. **Required Entitlement:** branding.custom_domain.enable gates custom-domain add/verify; base subdomain remains available
9. **Data Sources / APIs:** Declared APIs: `GET/POST /domains`, `DELETE /domains/:id`. Data projection is limited to entities reachable through those APIs and the resolved tenant context; UI must not query tables directly.
10. **Layout Structure:** Admin console shell with admin navigation, page header, configuration/table/editor main region, and confirmation/drawer area. Core regions: Domain list, DNS-record helper, verification state, set-primary.
11. **Navigation Areas:** Admin sidebar; owner-only actions remain inline, not separate routes. Inventory nav: Admin sidebar.
12. **Page Sections:** Domain list, DNS-record helper, verification state, set-primary
13. **Primary Actions:** Create/submit the primary resource or state transition; Execute guarded lifecycle/destructive action with confirmation.
14. **Secondary Actions:** Open declared modal/confirmation path; Navigate to declared child/destination screens only.
15. **Empty States:** Show an empty list/table/feed with a single permitted CTA when create/join/invite is allowed; otherwise show read-only explanatory copy.
16. **Loading States:** Skeleton for header/nav and page body after membership/entitlement/permission checks; action buttons disabled until resource loaders complete.
17. **Error States:** Use standard error envelope handling: validation errors inline; 401 to login; 403 permission/ownership/relationship denial as disabled action or role home; 404 without cross-tenant existence leakage; 409 idempotency/conflict where applicable; 429/503 as safe retry/tenant-state messaging.
18. **Membership Gate States:** ACTIVE membership in resolved tenant is required. INVITED routes only to A9; SUSPENDED/REMOVED/no row routes to branded blocked/public state; stale tokens are never trusted.
19. **Entitlement Failure States:** Partial entitlement handling: branding.custom_domain.enable gates custom-domain add/verify; base subdomain remains available. Disabled sections show upgrade/explanation and preserve existing data read-only where applicable.
20. **Mobile Behavior:** Desktop-first control plane; on mobile, tables become stacked cards with preserved filters and guarded row actions.
21. **Accessibility Notes:** Keyboard navigable; focus order follows header/nav/main/actions; visible labels for forms/actions; server errors announced in an accessible region. Modals trap focus, provide escape/close semantics where safe, and return focus to the opener.
22. **Audit-Relevant Actions:** Mutating/sensitive actions must emit declared audit/outbox events in the same transaction; destructive or irreversible actions require confirmation and reason/comment where specified.
23. **Notes for Engineering:** Screen must use only declared APIs and route metadata; no client-supplied `tenant_id`; host resolution is authoritative. Server resource loader must declare permission, entitlement if any, and ownership/relationship loader before render. Require idempotency/confirmation where route/table requires it; optimistic UI must roll back on server denial.

### T8 — Configuration

1. **Screen ID:** T8
2. **Screen Name:** Configuration
3. **Route:** `/admin/config`
4. **Actor:** Tenant Admin (Admin console shell)
5. **Entry Sources:** Admin sidebar; admin dashboard branch; authorized admin deep link.
6. **Exit Destinations:** Publish confirm
7. **Required Permission:** `config.read/update/publish`
8. **Required Entitlement:** None declared for this screen in Phase 0/1.
9. **Data Sources / APIs:** Declared APIs: `GET/PUT /config`, `POST /config/publish`. Data projection is limited to entities reachable through those APIs and the resolved tenant context; UI must not query tables directly.
10. **Layout Structure:** Admin console shell with admin navigation, page header, configuration/table/editor main region, and confirmation/drawer area. Core regions: Section tabs, Zod-validated forms, version history, publish.
11. **Navigation Areas:** Admin sidebar; owner-only actions remain inline, not separate routes. Inventory nav: Admin sidebar.
12. **Page Sections:** Section tabs, Zod-validated forms, version history, publish
13. **Primary Actions:** Publish or submit for review through the declared workflow boundary; Create/submit the primary resource or state transition.
14. **Secondary Actions:** View version history / restore where declared; Open declared modal/confirmation path; Navigate to declared child/destination screens only.
15. **Empty States:** Show unsaved draft scaffold with required fields and validation hints; no auto-publish.
16. **Loading States:** Skeleton for header/nav and page body after membership/entitlement/permission checks; action buttons disabled until resource loaders complete.
17. **Error States:** Use standard error envelope handling: validation errors inline; 401 to login; 403 permission/ownership/relationship denial as disabled action or role home; 404 without cross-tenant existence leakage; 409 idempotency/conflict where applicable; 429/503 as safe retry/tenant-state messaging.
18. **Membership Gate States:** ACTIVE membership in resolved tenant is required. INVITED routes only to A9; SUSPENDED/REMOVED/no row routes to branded blocked/public state; stale tokens are never trusted.
19. **Entitlement Failure States:** Not applicable; screen has no declared route-level entitlement. Still hide/disable sub-actions if their API entitlement fails.
20. **Mobile Behavior:** Desktop-first control plane; on mobile, editor/detail columns stack and destructive actions remain behind confirmations.
21. **Accessibility Notes:** Keyboard navigable; focus order follows header/nav/main/actions; visible labels for forms/actions; server errors announced in an accessible region. Modals trap focus, provide escape/close semantics where safe, and return focus to the opener.
22. **Audit-Relevant Actions:** Mutating/sensitive actions must emit declared audit/outbox events in the same transaction; destructive or irreversible actions require confirmation and reason/comment where specified.
23. **Notes for Engineering:** Screen must use only declared APIs and route metadata; no client-supplied `tenant_id`; host resolution is authoritative. Server resource loader must declare permission, entitlement if any, and ownership/relationship loader before render. Require idempotency/confirmation where route/table requires it; optimistic UI must roll back on server denial.

### T9 — Feature Flags

1. **Screen ID:** T9
2. **Screen Name:** Feature Flags
3. **Route:** `/admin/feature-flags`
4. **Actor:** Tenant Admin (Admin console shell)
5. **Entry Sources:** Admin sidebar; admin dashboard branch; authorized admin deep link.
6. **Exit Destinations:** Override confirm
7. **Required Permission:** `feature_flag.read/override`
8. **Required Entitlement:** None declared for this screen in Phase 0/1.
9. **Data Sources / APIs:** Declared APIs: `GET /feature-flags`, `PUT /feature-flags/:key`. Data projection is limited to entities reachable through those APIs and the resolved tenant context; UI must not query tables directly.
10. **Layout Structure:** Admin console shell with admin navigation, page header, configuration/table/editor main region, and confirmation/drawer area. Core regions: Flag table (effective value + source), override toggles.
11. **Navigation Areas:** Admin sidebar; owner-only actions remain inline, not separate routes. Inventory nav: Admin sidebar.
12. **Page Sections:** Flag table (effective value + source), override toggles
13. **Primary Actions:** View/read the declared resource projection.
14. **Secondary Actions:** Open declared modal/confirmation path; Navigate to declared child/destination screens only.
15. **Empty States:** Show an empty list/table/feed with a single permitted CTA when create/join/invite is allowed; otherwise show read-only explanatory copy.
16. **Loading States:** Skeleton for header/nav and page body after membership/entitlement/permission checks; action buttons disabled until resource loaders complete.
17. **Error States:** Use standard error envelope handling: validation errors inline; 401 to login; 403 permission/ownership/relationship denial as disabled action or role home; 404 without cross-tenant existence leakage; 409 idempotency/conflict where applicable; 429/503 as safe retry/tenant-state messaging.
18. **Membership Gate States:** ACTIVE membership in resolved tenant is required. INVITED routes only to A9; SUSPENDED/REMOVED/no row routes to branded blocked/public state; stale tokens are never trusted.
19. **Entitlement Failure States:** Not applicable; screen has no declared route-level entitlement. Still hide/disable sub-actions if their API entitlement fails.
20. **Mobile Behavior:** Desktop-first control plane; on mobile, tables become stacked cards with preserved filters and guarded row actions.
21. **Accessibility Notes:** Keyboard navigable; focus order follows header/nav/main/actions; visible labels for forms/actions; server errors announced in an accessible region. Modals trap focus, provide escape/close semantics where safe, and return focus to the opener.
22. **Audit-Relevant Actions:** Mutating/sensitive actions must emit declared audit/outbox events in the same transaction; destructive or irreversible actions require confirmation and reason/comment where specified.
23. **Notes for Engineering:** Screen must use only declared APIs and route metadata; no client-supplied `tenant_id`; host resolution is authoritative. Server resource loader must declare permission, entitlement if any, and ownership/relationship loader before render. Require idempotency/confirmation where route/table requires it; optimistic UI must roll back on server denial.

### T10 — Entitlements (read-only)

1. **Screen ID:** T10
2. **Screen Name:** Entitlements (read-only)
3. **Route:** `/admin/entitlements`
4. **Actor:** Tenant Admin (Admin console shell)
5. **Entry Sources:** Admin sidebar; admin dashboard branch; authorized admin deep link.
6. **Exit Destinations:** Admin dashboard, related admin detail screen, S1 review, or same-screen confirmation result.
7. **Required Permission:** `entitlement.read`
8. **Required Entitlement:** None declared for this screen in Phase 0/1.
9. **Data Sources / APIs:** Declared APIs: `GET /entitlements`. Data projection is limited to entities reachable through those APIs and the resolved tenant context; UI must not query tables directly.
10. **Layout Structure:** Admin console shell with admin navigation, page header, configuration/table/editor main region, and confirmation/drawer area. Core regions: Entitlement list (key/value/expiry), upgrade-prompt copy.
11. **Navigation Areas:** Admin sidebar; owner-only actions remain inline, not separate routes. Inventory nav: Admin sidebar.
12. **Page Sections:** Entitlement list (key/value/expiry), upgrade-prompt copy
13. **Primary Actions:** View/read the declared resource projection.
14. **Secondary Actions:** Navigate to declared child/destination screens only.
15. **Empty States:** Show an empty list/table/feed with a single permitted CTA when create/join/invite is allowed; otherwise show read-only explanatory copy.
16. **Loading States:** Skeleton for header/nav and page body after membership/entitlement/permission checks; action buttons disabled until resource loaders complete.
17. **Error States:** Use standard error envelope handling: validation errors inline; 401 to login; 403 permission/ownership/relationship denial as disabled action or role home; 404 without cross-tenant existence leakage; 409 idempotency/conflict where applicable; 429/503 as safe retry/tenant-state messaging.
18. **Membership Gate States:** ACTIVE membership in resolved tenant is required. INVITED routes only to A9; SUSPENDED/REMOVED/no row routes to branded blocked/public state; stale tokens are never trusted.
19. **Entitlement Failure States:** Not applicable; screen has no declared route-level entitlement. Still hide/disable sub-actions if their API entitlement fails.
20. **Mobile Behavior:** Desktop-first control plane; on mobile, tables become stacked cards with preserved filters and guarded row actions.
21. **Accessibility Notes:** Keyboard navigable; focus order follows header/nav/main/actions; visible labels for forms/actions; server errors announced in an accessible region.
22. **Audit-Relevant Actions:** Mutating/sensitive actions must emit declared audit/outbox events in the same transaction; destructive or irreversible actions require confirmation and reason/comment where specified.
23. **Notes for Engineering:** Screen must use only declared APIs and route metadata; no client-supplied `tenant_id`; host resolution is authoritative. Server resource loader must declare permission, entitlement if any, and ownership/relationship loader before render.

### T11 — Competency & Scoring

1. **Screen ID:** T11
2. **Screen Name:** Competency & Scoring
3. **Route:** `/admin/competency`
4. **Actor:** Tenant Admin (Admin console shell)
5. **Entry Sources:** Admin sidebar; admin dashboard branch; authorized admin deep link.
6. **Exit Destinations:** Publish-config confirm; Delete-dimension confirm
7. **Required Permission:** `competency.dimension.manage`, `scoring_profile.create/update`, `competency.band.manage`, `scoring_config.publish`, `competency.signal.read`
8. **Required Entitlement:** None declared for this screen in Phase 0/1.
9. **Data Sources / APIs:** Declared APIs: `GET/POST/PUT/DELETE /competency-dimensions`, `GET/POST/PUT /scoring-profiles`, `GET/PUT /scoring-profiles/:id/bands`, `POST /scoring-config/:id/publish`, `GET /competency-signals`. Data projection is limited to entities reachable through those APIs and the resolved tenant context; UI must not query tables directly.
10. **Layout Structure:** Admin console shell with admin navigation, page header, configuration/table/editor main region, and confirmation/drawer area. Core regions: Dimension editor, scoring-profile editor, band-threshold editor, versioned-config publish, signal inspector.
11. **Navigation Areas:** Admin sidebar; owner-only actions remain inline, not separate routes. Inventory nav: Admin sidebar.
12. **Page Sections:** Dimension editor, scoring-profile editor, band-threshold editor, versioned-config publish, signal inspector
13. **Primary Actions:** Publish or submit for review through the declared workflow boundary; Create/submit the primary resource or state transition; Execute guarded lifecycle/destructive action with confirmation.
14. **Secondary Actions:** View version history / restore where declared; Open declared modal/confirmation path; Navigate to declared child/destination screens only.
15. **Empty States:** Show unsaved draft scaffold with required fields and validation hints; no auto-publish.
16. **Loading States:** Skeleton for header/nav and page body after membership/entitlement/permission checks; action buttons disabled until resource loaders complete.
17. **Error States:** Use standard error envelope handling: validation errors inline; 401 to login; 403 permission/ownership/relationship denial as disabled action or role home; 404 without cross-tenant existence leakage; 409 idempotency/conflict where applicable; 429/503 as safe retry/tenant-state messaging.
18. **Membership Gate States:** ACTIVE membership in resolved tenant is required. INVITED routes only to A9; SUSPENDED/REMOVED/no row routes to branded blocked/public state; stale tokens are never trusted.
19. **Entitlement Failure States:** Not applicable; screen has no declared route-level entitlement. Still hide/disable sub-actions if their API entitlement fails.
20. **Mobile Behavior:** Desktop-first control plane; on mobile, editor/detail columns stack and destructive actions remain behind confirmations.
21. **Accessibility Notes:** Keyboard navigable; focus order follows header/nav/main/actions; visible labels for forms/actions; server errors announced in an accessible region. Modals trap focus, provide escape/close semantics where safe, and return focus to the opener.
22. **Audit-Relevant Actions:** Mutating/sensitive actions must emit declared audit/outbox events in the same transaction; destructive or irreversible actions require confirmation and reason/comment where specified.
23. **Notes for Engineering:** Screen must use only declared APIs and route metadata; no client-supplied `tenant_id`; host resolution is authoritative. Server resource loader must declare permission, entitlement if any, and ownership/relationship loader before render. Require idempotency/confirmation where route/table requires it; optimistic UI must roll back on server denial.

### T12 — Certificate Templates

1. **Screen ID:** T12
2. **Screen Name:** Certificate Templates
3. **Route:** `/admin/certificates/templates`
4. **Actor:** Tenant Admin (Admin console shell)
5. **Entry Sources:** Admin sidebar; admin dashboard branch; authorized admin deep link.
6. **Exit Destinations:** Publish/Delete confirm
7. **Required Permission:** `certificate_template.read/manage/publish`
8. **Required Entitlement:** certification.enable
9. **Data Sources / APIs:** Declared APIs: `GET/POST/PUT/DELETE /certificate-templates`, `POST /certificate-templates/:id/publish`. Data projection is limited to entities reachable through those APIs and the resolved tenant context; UI must not query tables directly.
10. **Layout Structure:** Admin console shell with admin navigation, page header, configuration/table/editor main region, and confirmation/drawer area. Core regions: Template editor (dynamic fields), preview, publish, version.
11. **Navigation Areas:** Admin sidebar; owner-only actions remain inline, not separate routes. Inventory nav: Admin sidebar.
12. **Page Sections:** Template editor (dynamic fields), preview, publish, version
13. **Primary Actions:** Publish or submit for review through the declared workflow boundary; Create/submit the primary resource or state transition; Execute guarded lifecycle/destructive action with confirmation.
14. **Secondary Actions:** View version history / restore where declared; Open declared modal/confirmation path; Navigate to declared child/destination screens only.
15. **Empty States:** Show unsaved draft scaffold with required fields and validation hints; no auto-publish.
16. **Loading States:** Skeleton for header/nav and page body after membership/entitlement/permission checks; action buttons disabled until resource loaders complete.
17. **Error States:** Use standard error envelope handling: validation errors inline; 401 to login; 403 permission/ownership/relationship denial as disabled action or role home; 404 without cross-tenant existence leakage; 409 idempotency/conflict where applicable; 429/503 as safe retry/tenant-state messaging.
18. **Membership Gate States:** ACTIVE membership in resolved tenant is required. INVITED routes only to A9; SUSPENDED/REMOVED/no row routes to branded blocked/public state; stale tokens are never trusted.
19. **Entitlement Failure States:** If `certification.enable` is absent, hide from nav and return/display `ENTITLEMENT_REQUIRED` upgrade prompt; never delete existing tenant data.
20. **Mobile Behavior:** Desktop-first control plane; on mobile, editor/detail columns stack and destructive actions remain behind confirmations.
21. **Accessibility Notes:** Keyboard navigable; focus order follows header/nav/main/actions; visible labels for forms/actions; server errors announced in an accessible region. Modals trap focus, provide escape/close semantics where safe, and return focus to the opener.
22. **Audit-Relevant Actions:** Mutating/sensitive actions must emit declared audit/outbox events in the same transaction; destructive or irreversible actions require confirmation and reason/comment where specified.
23. **Notes for Engineering:** Screen must use only declared APIs and route metadata; no client-supplied `tenant_id`; host resolution is authoritative. Server resource loader must declare permission, entitlement if any, and ownership/relationship loader before render. Require idempotency/confirmation where route/table requires it; optimistic UI must roll back on server denial.

### T13 — Issued Certificates

1. **Screen ID:** T13
2. **Screen Name:** Issued Certificates
3. **Route:** `/admin/certificates`
4. **Actor:** Tenant Admin (Admin console shell)
5. **Entry Sources:** Admin sidebar; admin dashboard branch; authorized admin deep link.
6. **Exit Destinations:** Issue modal; Revoke confirm
7. **Required Permission:** `certificate.read` (all), `certificate.issue`, `certificate.revoke`
8. **Required Entitlement:** certification.enable
9. **Data Sources / APIs:** Declared APIs: `GET /certificates`, `POST /certificates/issue`, `POST /certificates/:id/revoke`. Data projection is limited to entities reachable through those APIs and the resolved tenant context; UI must not query tables directly.
10. **Layout Structure:** Admin console shell with admin navigation, page header, configuration/table/editor main region, and confirmation/drawer area. Core regions: Cert table, issue (gated), revoke (with reason).
11. **Navigation Areas:** Admin sidebar; owner-only actions remain inline, not separate routes. Inventory nav: Admin sidebar.
12. **Page Sections:** Cert table, issue (gated), revoke (with reason)
13. **Primary Actions:** Create/submit the primary resource or state transition; Issue credential when workflow/permission allows; Revoke with reason.
14. **Secondary Actions:** Open declared modal/confirmation path; Navigate to declared child/destination screens only.
15. **Empty States:** Show an empty list/table/feed with a single permitted CTA when create/join/invite is allowed; otherwise show read-only explanatory copy.
16. **Loading States:** Skeleton for header/nav and page body after membership/entitlement/permission checks; action buttons disabled until resource loaders complete.
17. **Error States:** Use standard error envelope handling: validation errors inline; 401 to login; 403 permission/ownership/relationship denial as disabled action or role home; 404 without cross-tenant existence leakage; 409 idempotency/conflict where applicable; 429/503 as safe retry/tenant-state messaging.
18. **Membership Gate States:** ACTIVE membership in resolved tenant is required. INVITED routes only to A9; SUSPENDED/REMOVED/no row routes to branded blocked/public state; stale tokens are never trusted.
19. **Entitlement Failure States:** If `certification.enable` is absent, hide from nav and return/display `ENTITLEMENT_REQUIRED` upgrade prompt; never delete existing tenant data.
20. **Mobile Behavior:** Desktop-first control plane; on mobile, tables become stacked cards with preserved filters and guarded row actions.
21. **Accessibility Notes:** Keyboard navigable; focus order follows header/nav/main/actions; visible labels for forms/actions; server errors announced in an accessible region. Modals trap focus, provide escape/close semantics where safe, and return focus to the opener.
22. **Audit-Relevant Actions:** Mutating/sensitive actions must emit declared audit/outbox events in the same transaction; destructive or irreversible actions require confirmation and reason/comment where specified.
23. **Notes for Engineering:** Screen must use only declared APIs and route metadata; no client-supplied `tenant_id`; host resolution is authoritative. Server resource loader must declare permission, entitlement if any, and ownership/relationship loader before render. Require idempotency/confirmation where route/table requires it; optimistic UI must roll back on server denial.

### T14 — Gamification Config

1. **Screen ID:** T14
2. **Screen Name:** Gamification Config
3. **Route:** `/admin/gamification`
4. **Actor:** Tenant Admin (Admin console shell)
5. **Entry Sources:** Admin sidebar; admin dashboard branch; authorized admin deep link.
6. **Exit Destinations:** Manual-award confirm (audited)
7. **Required Permission:** `badge.manage`, `leaderboard.manage`
8. **Required Entitlement:** gamification.enable
9. **Data Sources / APIs:** Declared APIs: `GET/POST/PUT /badges`, `GET/POST/PUT /leaderboards`. Data projection is limited to entities reachable through those APIs and the resolved tenant context; UI must not query tables directly.
10. **Layout Structure:** Admin console shell with admin navigation, page header, configuration/table/editor main region, and confirmation/drawer area. Core regions: Badge-rule editor, leaderboard config.
11. **Navigation Areas:** Admin sidebar; owner-only actions remain inline, not separate routes. Inventory nav: Admin sidebar.
12. **Page Sections:** Badge-rule editor, leaderboard config
13. **Primary Actions:** Create/submit the primary resource or state transition.
14. **Secondary Actions:** Open declared modal/confirmation path; Navigate to declared child/destination screens only.
15. **Empty States:** Show unsaved draft scaffold with required fields and validation hints; no auto-publish.
16. **Loading States:** Skeleton for header/nav and page body after membership/entitlement/permission checks; action buttons disabled until resource loaders complete.
17. **Error States:** Use standard error envelope handling: validation errors inline; 401 to login; 403 permission/ownership/relationship denial as disabled action or role home; 404 without cross-tenant existence leakage; 409 idempotency/conflict where applicable; 429/503 as safe retry/tenant-state messaging.
18. **Membership Gate States:** ACTIVE membership in resolved tenant is required. INVITED routes only to A9; SUSPENDED/REMOVED/no row routes to branded blocked/public state; stale tokens are never trusted.
19. **Entitlement Failure States:** If `gamification.enable` is absent, hide from nav and return/display `ENTITLEMENT_REQUIRED` upgrade prompt; never delete existing tenant data.
20. **Mobile Behavior:** Desktop-first control plane; on mobile, editor/detail columns stack and destructive actions remain behind confirmations.
21. **Accessibility Notes:** Keyboard navigable; focus order follows header/nav/main/actions; visible labels for forms/actions; server errors announced in an accessible region. Charts/scores require text alternatives, tabular fallback, and non-color-only status indicators. Modals trap focus, provide escape/close semantics where safe, and return focus to the opener.
22. **Audit-Relevant Actions:** Mutating/sensitive actions must emit declared audit/outbox events in the same transaction; destructive or irreversible actions require confirmation and reason/comment where specified.
23. **Notes for Engineering:** Screen must use only declared APIs and route metadata; no client-supplied `tenant_id`; host resolution is authoritative. Server resource loader must declare permission, entitlement if any, and ownership/relationship loader before render. Require idempotency/confirmation where route/table requires it; optimistic UI must roll back on server denial.

### T15 — Notification Templates

1. **Screen ID:** T15
2. **Screen Name:** Notification Templates
3. **Route:** `/admin/notifications/templates`
4. **Actor:** Tenant Admin (Admin console shell)
5. **Entry Sources:** Admin sidebar; admin dashboard branch; authorized admin deep link.
6. **Exit Destinations:** Delete confirm
7. **Required Permission:** `notification.template.read/manage`
8. **Required Entitlement:** None declared for this screen in Phase 0/1.
9. **Data Sources / APIs:** Declared APIs: `GET/POST/PUT/DELETE /notification-templates`. Data projection is limited to entities reachable through those APIs and the resolved tenant context; UI must not query tables directly.
10. **Layout Structure:** Admin console shell with admin navigation, page header, configuration/table/editor main region, and confirmation/drawer area. Core regions: Template list, per-event/channel/locale editor.
11. **Navigation Areas:** Admin sidebar; owner-only actions remain inline, not separate routes. Inventory nav: Admin sidebar.
12. **Page Sections:** Template list, per-event/channel/locale editor
13. **Primary Actions:** Create/submit the primary resource or state transition; Execute guarded lifecycle/destructive action with confirmation.
14. **Secondary Actions:** Open declared modal/confirmation path; Navigate to declared child/destination screens only.
15. **Empty States:** Show an empty list/table/feed with a single permitted CTA when create/join/invite is allowed; otherwise show read-only explanatory copy.
16. **Loading States:** Skeleton for header/nav and page body after membership/entitlement/permission checks; action buttons disabled until resource loaders complete.
17. **Error States:** Use standard error envelope handling: validation errors inline; 401 to login; 403 permission/ownership/relationship denial as disabled action or role home; 404 without cross-tenant existence leakage; 409 idempotency/conflict where applicable; 429/503 as safe retry/tenant-state messaging.
18. **Membership Gate States:** ACTIVE membership in resolved tenant is required. INVITED routes only to A9; SUSPENDED/REMOVED/no row routes to branded blocked/public state; stale tokens are never trusted.
19. **Entitlement Failure States:** Not applicable; screen has no declared route-level entitlement. Still hide/disable sub-actions if their API entitlement fails.
20. **Mobile Behavior:** Desktop-first control plane; on mobile, tables become stacked cards with preserved filters and guarded row actions.
21. **Accessibility Notes:** Keyboard navigable; focus order follows header/nav/main/actions; visible labels for forms/actions; server errors announced in an accessible region. Modals trap focus, provide escape/close semantics where safe, and return focus to the opener.
22. **Audit-Relevant Actions:** Mutating/sensitive actions must emit declared audit/outbox events in the same transaction; destructive or irreversible actions require confirmation and reason/comment where specified.
23. **Notes for Engineering:** Screen must use only declared APIs and route metadata; no client-supplied `tenant_id`; host resolution is authoritative. Server resource loader must declare permission, entitlement if any, and ownership/relationship loader before render. Require idempotency/confirmation where route/table requires it; optimistic UI must roll back on server denial.

### T16 — Automation Rules

1. **Screen ID:** T16
2. **Screen Name:** Automation Rules
3. **Route:** `/admin/automation`
4. **Actor:** Tenant Admin (Admin console shell)
5. **Entry Sources:** Admin sidebar; admin dashboard branch; authorized admin deep link.
6. **Exit Destinations:** Disable/Delete confirm
7. **Required Permission:** `automation.rule.read/manage`
8. **Required Entitlement:** None declared for this screen in Phase 0/1.
9. **Data Sources / APIs:** Declared APIs: `GET/POST/PUT/DELETE /automation-rules`. Data projection is limited to entities reachable through those APIs and the resolved tenant context; UI must not query tables directly.
10. **Layout Structure:** Admin console shell with admin navigation, page header, configuration/table/editor main region, and confirmation/drawer area. Core regions: Rule builder (trigger/condition/action), runs log.
11. **Navigation Areas:** Admin sidebar; owner-only actions remain inline, not separate routes. Inventory nav: Admin sidebar.
12. **Page Sections:** Rule builder (trigger/condition/action), runs log
13. **Primary Actions:** Create/submit the primary resource or state transition; Execute guarded lifecycle/destructive action with confirmation.
14. **Secondary Actions:** Open declared modal/confirmation path; Navigate to declared child/destination screens only.
15. **Empty States:** Show unsaved draft scaffold with required fields and validation hints; no auto-publish.
16. **Loading States:** Skeleton for header/nav and page body after membership/entitlement/permission checks; action buttons disabled until resource loaders complete.
17. **Error States:** Use standard error envelope handling: validation errors inline; 401 to login; 403 permission/ownership/relationship denial as disabled action or role home; 404 without cross-tenant existence leakage; 409 idempotency/conflict where applicable; 429/503 as safe retry/tenant-state messaging.
18. **Membership Gate States:** ACTIVE membership in resolved tenant is required. INVITED routes only to A9; SUSPENDED/REMOVED/no row routes to branded blocked/public state; stale tokens are never trusted.
19. **Entitlement Failure States:** Not applicable; screen has no declared route-level entitlement. Still hide/disable sub-actions if their API entitlement fails.
20. **Mobile Behavior:** Desktop-first control plane; on mobile, editor/detail columns stack and destructive actions remain behind confirmations.
21. **Accessibility Notes:** Keyboard navigable; focus order follows header/nav/main/actions; visible labels for forms/actions; server errors announced in an accessible region. Modals trap focus, provide escape/close semantics where safe, and return focus to the opener.
22. **Audit-Relevant Actions:** Mutating/sensitive actions must emit declared audit/outbox events in the same transaction; destructive or irreversible actions require confirmation and reason/comment where specified.
23. **Notes for Engineering:** Screen must use only declared APIs and route metadata; no client-supplied `tenant_id`; host resolution is authoritative. Server resource loader must declare permission, entitlement if any, and ownership/relationship loader before render. Require idempotency/confirmation where route/table requires it; optimistic UI must roll back on server denial.

### T17 — Workflows

1. **Screen ID:** T17
2. **Screen Name:** Workflows
3. **Route:** `/admin/workflows`
4. **Actor:** Tenant Admin (Admin console shell)
5. **Entry Sources:** Admin sidebar; admin dashboard branch; authorized admin deep link.
6. **Exit Destinations:** Save confirm
7. **Required Permission:** `workflow.definition.read/manage`
8. **Required Entitlement:** None declared for this screen in Phase 0/1.
9. **Data Sources / APIs:** Declared APIs: `GET/POST/PUT /workflows`. Data projection is limited to entities reachable through those APIs and the resolved tenant context; UI must not query tables directly.
10. **Layout Structure:** Admin console shell with admin navigation, page header, configuration/table/editor main region, and confirmation/drawer area. Core regions: Stage/assignee editor, transitions.
11. **Navigation Areas:** Admin sidebar; owner-only actions remain inline, not separate routes. Inventory nav: Admin sidebar.
12. **Page Sections:** Stage/assignee editor, transitions
13. **Primary Actions:** Publish or submit for review through the declared workflow boundary; Create/submit the primary resource or state transition.
14. **Secondary Actions:** Open declared modal/confirmation path; Navigate to declared child/destination screens only.
15. **Empty States:** Show unsaved draft scaffold with required fields and validation hints; no auto-publish.
16. **Loading States:** Skeleton for header/nav and page body after membership/entitlement/permission checks; action buttons disabled until resource loaders complete.
17. **Error States:** Use standard error envelope handling: validation errors inline; 401 to login; 403 permission/ownership/relationship denial as disabled action or role home; 404 without cross-tenant existence leakage; 409 idempotency/conflict where applicable; 429/503 as safe retry/tenant-state messaging.
18. **Membership Gate States:** ACTIVE membership in resolved tenant is required. INVITED routes only to A9; SUSPENDED/REMOVED/no row routes to branded blocked/public state; stale tokens are never trusted.
19. **Entitlement Failure States:** Not applicable; screen has no declared route-level entitlement. Still hide/disable sub-actions if their API entitlement fails.
20. **Mobile Behavior:** Desktop-first control plane; on mobile, editor/detail columns stack and destructive actions remain behind confirmations.
21. **Accessibility Notes:** Keyboard navigable; focus order follows header/nav/main/actions; visible labels for forms/actions; server errors announced in an accessible region. Modals trap focus, provide escape/close semantics where safe, and return focus to the opener.
22. **Audit-Relevant Actions:** Mutating/sensitive actions must emit declared audit/outbox events in the same transaction; destructive or irreversible actions require confirmation and reason/comment where specified.
23. **Notes for Engineering:** Screen must use only declared APIs and route metadata; no client-supplied `tenant_id`; host resolution is authoritative. Server resource loader must declare permission, entitlement if any, and ownership/relationship loader before render. Require idempotency/confirmation where route/table requires it; optimistic UI must roll back on server denial.

### T18 — Locales

1. **Screen ID:** T18
2. **Screen Name:** Locales
3. **Route:** `/admin/locales`
4. **Actor:** Tenant Admin (Admin console shell)
5. **Entry Sources:** Admin sidebar; admin dashboard branch; authorized admin deep link.
6. **Exit Destinations:** Admin dashboard, related admin detail screen, S1 review, or same-screen confirmation result.
7. **Required Permission:** `locale.read/manage`
8. **Required Entitlement:** None declared for this screen in Phase 0/1.
9. **Data Sources / APIs:** Declared APIs: `GET /locales`, `PUT /locales/:locale`. Data projection is limited to entities reachable through those APIs and the resolved tenant context; UI must not query tables directly.
10. **Layout Structure:** Admin console shell with admin navigation, page header, configuration/table/editor main region, and confirmation/drawer area. Core regions: Locale list, string editor (sanitized).
11. **Navigation Areas:** Admin sidebar; owner-only actions remain inline, not separate routes. Inventory nav: Admin sidebar.
12. **Page Sections:** Locale list, string editor (sanitized)
13. **Primary Actions:** View/read the declared resource projection.
14. **Secondary Actions:** Navigate to declared child/destination screens only.
15. **Empty States:** Show an empty list/table/feed with a single permitted CTA when create/join/invite is allowed; otherwise show read-only explanatory copy.
16. **Loading States:** Skeleton for header/nav and page body after membership/entitlement/permission checks; action buttons disabled until resource loaders complete.
17. **Error States:** Use standard error envelope handling: validation errors inline; 401 to login; 403 permission/ownership/relationship denial as disabled action or role home; 404 without cross-tenant existence leakage; 409 idempotency/conflict where applicable; 429/503 as safe retry/tenant-state messaging.
18. **Membership Gate States:** ACTIVE membership in resolved tenant is required. INVITED routes only to A9; SUSPENDED/REMOVED/no row routes to branded blocked/public state; stale tokens are never trusted.
19. **Entitlement Failure States:** Not applicable; screen has no declared route-level entitlement. Still hide/disable sub-actions if their API entitlement fails.
20. **Mobile Behavior:** Desktop-first control plane; on mobile, tables become stacked cards with preserved filters and guarded row actions.
21. **Accessibility Notes:** Keyboard navigable; focus order follows header/nav/main/actions; visible labels for forms/actions; server errors announced in an accessible region.
22. **Audit-Relevant Actions:** Mutating/sensitive actions must emit declared audit/outbox events in the same transaction; destructive or irreversible actions require confirmation and reason/comment where specified.
23. **Notes for Engineering:** Screen must use only declared APIs and route metadata; no client-supplied `tenant_id`; host resolution is authoritative. Server resource loader must declare permission, entitlement if any, and ownership/relationship loader before render. Require idempotency/confirmation where route/table requires it; optimistic UI must roll back on server denial.

### T19 — Extensions

1. **Screen ID:** T19
2. **Screen Name:** Extensions
3. **Route:** `/admin/extensions`
4. **Actor:** Tenant Admin (Admin console shell)
5. **Entry Sources:** Admin sidebar; admin dashboard branch; authorized admin deep link.
6. **Exit Destinations:** Delete confirm
7. **Required Permission:** `extension.point.read`, `extension.registration.read/manage`
8. **Required Entitlement:** None declared for this screen in Phase 0/1.
9. **Data Sources / APIs:** Declared APIs: `GET /extension-points`, `GET/POST/PUT/DELETE /extensions/registrations`. Data projection is limited to entities reachable through those APIs and the resolved tenant context; UI must not query tables directly.
10. **Layout Structure:** Admin console shell with admin navigation, page header, configuration/table/editor main region, and confirmation/drawer area. Core regions: Extension-point catalogue (read), registration editor.
11. **Navigation Areas:** Admin sidebar; owner-only actions remain inline, not separate routes. Inventory nav: Admin sidebar.
12. **Page Sections:** Extension-point catalogue (read), registration editor
13. **Primary Actions:** Create/submit the primary resource or state transition; Execute guarded lifecycle/destructive action with confirmation.
14. **Secondary Actions:** Open declared modal/confirmation path; Navigate to declared child/destination screens only.
15. **Empty States:** Show unsaved draft scaffold with required fields and validation hints; no auto-publish.
16. **Loading States:** Skeleton for header/nav and page body after membership/entitlement/permission checks; action buttons disabled until resource loaders complete.
17. **Error States:** Use standard error envelope handling: validation errors inline; 401 to login; 403 permission/ownership/relationship denial as disabled action or role home; 404 without cross-tenant existence leakage; 409 idempotency/conflict where applicable; 429/503 as safe retry/tenant-state messaging.
18. **Membership Gate States:** ACTIVE membership in resolved tenant is required. INVITED routes only to A9; SUSPENDED/REMOVED/no row routes to branded blocked/public state; stale tokens are never trusted.
19. **Entitlement Failure States:** Not applicable; screen has no declared route-level entitlement. Still hide/disable sub-actions if their API entitlement fails.
20. **Mobile Behavior:** Desktop-first control plane; on mobile, editor/detail columns stack and destructive actions remain behind confirmations.
21. **Accessibility Notes:** Keyboard navigable; focus order follows header/nav/main/actions; visible labels for forms/actions; server errors announced in an accessible region. Modals trap focus, provide escape/close semantics where safe, and return focus to the opener.
22. **Audit-Relevant Actions:** Mutating/sensitive actions must emit declared audit/outbox events in the same transaction; destructive or irreversible actions require confirmation and reason/comment where specified.
23. **Notes for Engineering:** Screen must use only declared APIs and route metadata; no client-supplied `tenant_id`; host resolution is authoritative. Server resource loader must declare permission, entitlement if any, and ownership/relationship loader before render. Require idempotency/confirmation where route/table requires it; optimistic UI must roll back on server denial.

### T20 — Readiness Policy

1. **Screen ID:** T20
2. **Screen Name:** Readiness Policy
3. **Route:** `/admin/readiness-policy`
4. **Actor:** Tenant Admin (Admin console shell)
5. **Entry Sources:** Admin sidebar; admin dashboard branch; authorized admin deep link.
6. **Exit Destinations:** Publish confirm
7. **Required Permission:** `readiness_policy.read/manage`
8. **Required Entitlement:** None declared for this screen in Phase 0/1.
9. **Data Sources / APIs:** Declared APIs: `GET/PUT /readiness-policy`. Data projection is limited to entities reachable through those APIs and the resolved tenant context; UI must not query tables directly.
10. **Layout Structure:** Admin console shell with admin navigation, page header, configuration/table/editor main region, and confirmation/drawer area. Core regions: Band→prominence rules, legal-copy editor, outbound-redirect target.
11. **Navigation Areas:** Admin sidebar; owner-only actions remain inline, not separate routes. Inventory nav: Admin sidebar.
12. **Page Sections:** Band→prominence rules, legal-copy editor, outbound-redirect target
13. **Primary Actions:** Publish or submit for review through the declared workflow boundary; Mint attribution token and continue to external CTA only after policy gate.
14. **Secondary Actions:** Open declared modal/confirmation path; Navigate to declared child/destination screens only.
15. **Empty States:** Show unsaved draft scaffold with required fields and validation hints; no auto-publish.
16. **Loading States:** Skeleton for header/nav and page body after membership/entitlement/permission checks; action buttons disabled until resource loaders complete.
17. **Error States:** Use standard error envelope handling: validation errors inline; 401 to login; 403 permission/ownership/relationship denial as disabled action or role home; 404 without cross-tenant existence leakage; 409 idempotency/conflict where applicable; 429/503 as safe retry/tenant-state messaging.
18. **Membership Gate States:** ACTIVE membership in resolved tenant is required. INVITED routes only to A9; SUSPENDED/REMOVED/no row routes to branded blocked/public state; stale tokens are never trusted.
19. **Entitlement Failure States:** Not applicable; screen has no declared route-level entitlement. Still hide/disable sub-actions if their API entitlement fails.
20. **Mobile Behavior:** Desktop-first control plane; on mobile, editor/detail columns stack and destructive actions remain behind confirmations.
21. **Accessibility Notes:** Keyboard navigable; focus order follows header/nav/main/actions; visible labels for forms/actions; server errors announced in an accessible region. Modals trap focus, provide escape/close semantics where safe, and return focus to the opener.
22. **Audit-Relevant Actions:** Mutating/sensitive actions must emit declared audit/outbox events in the same transaction; destructive or irreversible actions require confirmation and reason/comment where specified.
23. **Notes for Engineering:** Screen must use only declared APIs and route metadata; no client-supplied `tenant_id`; host resolution is authoritative. Server resource loader must declare permission, entitlement if any, and ownership/relationship loader before render. Require idempotency/confirmation where route/table requires it; optimistic UI must roll back on server denial. Legal copy controls L12 framing; publish only after legal-review checklist is satisfied outside the UI.

### T21 — Analytics

1. **Screen ID:** T21
2. **Screen Name:** Analytics
3. **Route:** `/admin/analytics`
4. **Actor:** Tenant Admin (Admin console shell)
5. **Entry Sources:** Admin sidebar; admin dashboard branch; authorized admin deep link.
6. **Exit Destinations:** Admin dashboard, related admin detail screen, S1 review, or same-screen confirmation result.
7. **Required Permission:** `analytics.dashboard.view`, `analytics.funnel.view` [entitlement]
8. **Required Entitlement:** analytics.dashboard.view
9. **Data Sources / APIs:** Declared APIs: `GET /analytics/dashboards`, `GET /analytics/funnel`, `GET /analytics/item-statistics`. Data projection is limited to entities reachable through those APIs and the resolved tenant context; UI must not query tables directly.
10. **Layout Structure:** Complex split layout. See ASCII wireframe below. Core regions: Dashboard tabs, charts, date-range/segment, CSV export.
11. **Navigation Areas:** Admin sidebar; owner-only actions remain inline, not separate routes. Inventory nav: Admin sidebar.
12. **Page Sections:** Dashboard tabs, charts, date-range/segment, CSV export
13. **Primary Actions:** View/read the declared resource projection.
14. **Secondary Actions:** Download/export only through signed/authorized flow; Navigate to declared child/destination screens only.
15. **Empty States:** Show "no data yet" with the next permitted learning/practice/admin setup action.
16. **Loading States:** Skeleton for header/nav and page body after membership/entitlement/permission checks; action buttons disabled until resource loaders complete.
17. **Error States:** Use standard error envelope handling: validation errors inline; 401 to login; 403 permission/ownership/relationship denial as disabled action or role home; 404 without cross-tenant existence leakage; 409 idempotency/conflict where applicable; 429/503 as safe retry/tenant-state messaging.
18. **Membership Gate States:** ACTIVE membership in resolved tenant is required. INVITED routes only to A9; SUSPENDED/REMOVED/no row routes to branded blocked/public state; stale tokens are never trusted.
19. **Entitlement Failure States:** If `analytics.dashboard.view` is absent, hide from nav and return/display `ENTITLEMENT_REQUIRED` upgrade prompt; never delete existing tenant data.
20. **Mobile Behavior:** Desktop-first control plane; on mobile, editor/detail columns stack and destructive actions remain behind confirmations.
21. **Accessibility Notes:** Keyboard navigable; focus order follows header/nav/main/actions; visible labels for forms/actions; server errors announced in an accessible region. Charts/scores require text alternatives, tabular fallback, and non-color-only status indicators.
22. **Audit-Relevant Actions:** Mutating/sensitive actions must emit declared audit/outbox events in the same transaction; destructive or irreversible actions require confirmation and reason/comment where specified.
23. **Notes for Engineering:** Screen must use only declared APIs and route metadata; no client-supplied `tenant_id`; host resolution is authoritative. Server resource loader must declare permission, entitlement if any, and ownership/relationship loader before render.

**ASCII wireframe:**
```text
+--------------------------------------------------------------------------------+
| Admin header: Analytics / date range / segment                                   |
+-------------------+------------------------------------------------------------+
| Admin nav         | Tabs: Learning | Assessment | Funnel | Community             |
|                   +------------------------------------------------------------+
|                   | KPI cards / trend summaries                                  |
|                   +-----------------------------+------------------------------+
|                   | Chart/list region            | Item/funnel breakdown         |
|                   +------------------------------------------------------------+
|                   | CSV export action (audit/rate limited if export path used)   |
+-------------------+------------------------------------------------------------+
```

### T22 — Audit Log

1. **Screen ID:** T22
2. **Screen Name:** Audit Log
3. **Route:** `/admin/audit`
4. **Actor:** Tenant Admin (Admin console shell)
5. **Entry Sources:** Admin sidebar; admin dashboard branch; authorized admin deep link.
6. **Exit Destinations:** Entry detail drawer
7. **Required Permission:** `audit.read`
8. **Required Entitlement:** None declared for this screen in Phase 0/1.
9. **Data Sources / APIs:** Declared APIs: `GET /audit`. Data projection is limited to entities reachable through those APIs and the resolved tenant context; UI must not query tables directly.
10. **Layout Structure:** Admin console shell with admin navigation, page header, configuration/table/editor main region, and confirmation/drawer area. Core regions: Audit table (actor/action/target/time), action filter.
11. **Navigation Areas:** Admin sidebar; owner-only actions remain inline, not separate routes. Inventory nav: Admin sidebar.
12. **Page Sections:** Audit table (actor/action/target/time), action filter
13. **Primary Actions:** View/read the declared resource projection.
14. **Secondary Actions:** Search/filter/sort within allowed indexed fields; Navigate to declared child/destination screens only.
15. **Empty States:** Show an empty list/table/feed with a single permitted CTA when create/join/invite is allowed; otherwise show read-only explanatory copy.
16. **Loading States:** Skeleton for header/nav and page body after membership/entitlement/permission checks; action buttons disabled until resource loaders complete.
17. **Error States:** Use standard error envelope handling: validation errors inline; 401 to login; 403 permission/ownership/relationship denial as disabled action or role home; 404 without cross-tenant existence leakage; 409 idempotency/conflict where applicable; 429/503 as safe retry/tenant-state messaging.
18. **Membership Gate States:** ACTIVE membership in resolved tenant is required. INVITED routes only to A9; SUSPENDED/REMOVED/no row routes to branded blocked/public state; stale tokens are never trusted.
19. **Entitlement Failure States:** Not applicable; screen has no declared route-level entitlement. Still hide/disable sub-actions if their API entitlement fails.
20. **Mobile Behavior:** Desktop-first control plane; on mobile, tables become stacked cards with preserved filters and guarded row actions.
21. **Accessibility Notes:** Keyboard navigable; focus order follows header/nav/main/actions; visible labels for forms/actions; server errors announced in an accessible region.
22. **Audit-Relevant Actions:** Routine read screen; no per-action audit beyond access telemetry/rate limiting unless API declares it.
23. **Notes for Engineering:** Screen must use only declared APIs and route metadata; no client-supplied `tenant_id`; host resolution is authoritative. Server resource loader must declare permission, entitlement if any, and ownership/relationship loader before render.

### T23 — Data Exports

1. **Screen ID:** T23
2. **Screen Name:** Data Exports
3. **Route:** `/admin/exports`
4. **Actor:** Tenant Admin (Admin console shell)
5. **Entry Sources:** Admin sidebar; admin dashboard branch; authorized admin deep link.
6. **Exit Destinations:** Run-export confirm
7. **Required Permission:** `data.export.run`
8. **Required Entitlement:** data.export.enable (always-on by policy)
9. **Data Sources / APIs:** Declared APIs: `GET/POST /exports`, `GET /exports/:id`. Data projection is limited to entities reachable through those APIs and the resolved tenant context; UI must not query tables directly.
10. **Layout Structure:** Admin console shell with admin navigation, page header, configuration/table/editor main region, and confirmation/drawer area. Core regions: Export-job list, run-export, signed download.
11. **Navigation Areas:** Admin sidebar; owner-only actions remain inline, not separate routes. Inventory nav: Admin sidebar.
12. **Page Sections:** Export-job list, run-export, signed download
13. **Primary Actions:** Create/submit the primary resource or state transition.
14. **Secondary Actions:** Open declared modal/confirmation path; Download/export only through signed/authorized flow; Navigate to declared child/destination screens only.
15. **Empty States:** Show an empty list/table/feed with a single permitted CTA when create/join/invite is allowed; otherwise show read-only explanatory copy.
16. **Loading States:** Skeleton for header/nav and page body after membership/entitlement/permission checks; action buttons disabled until resource loaders complete.
17. **Error States:** Use standard error envelope handling: validation errors inline; 401 to login; 403 permission/ownership/relationship denial as disabled action or role home; 404 without cross-tenant existence leakage; 409 idempotency/conflict where applicable; 429/503 as safe retry/tenant-state messaging.
18. **Membership Gate States:** ACTIVE membership in resolved tenant is required. INVITED routes only to A9; SUSPENDED/REMOVED/no row routes to branded blocked/public state; stale tokens are never trusted.
19. **Entitlement Failure States:** If `data.export.enable (always-on by policy)` is absent, hide from nav and return/display `ENTITLEMENT_REQUIRED` upgrade prompt; never delete existing tenant data.
20. **Mobile Behavior:** Desktop-first control plane; on mobile, tables become stacked cards with preserved filters and guarded row actions.
21. **Accessibility Notes:** Keyboard navigable; focus order follows header/nav/main/actions; visible labels for forms/actions; server errors announced in an accessible region. Modals trap focus, provide escape/close semantics where safe, and return focus to the opener.
22. **Audit-Relevant Actions:** Mutating/sensitive actions must emit declared audit/outbox events in the same transaction; destructive or irreversible actions require confirmation and reason/comment where specified.
23. **Notes for Engineering:** Screen must use only declared APIs and route metadata; no client-supplied `tenant_id`; host resolution is authoritative. Server resource loader must declare permission, entitlement if any, and ownership/relationship loader before render. Require idempotency/confirmation where route/table requires it; optimistic UI must roll back on server denial.

### T24 — Deletion Requests

1. **Screen ID:** T24
2. **Screen Name:** Deletion Requests
3. **Route:** `/admin/deletion-requests`
4. **Actor:** Tenant Admin (Admin console shell)
5. **Entry Sources:** Admin sidebar; admin dashboard branch; authorized admin deep link.
6. **Exit Destinations:** Process confirm (irreversible)
7. **Required Permission:** `data.deletion.request`, `data.deletion.manage`
8. **Required Entitlement:** None declared for this screen in Phase 0/1.
9. **Data Sources / APIs:** Declared APIs: `GET/POST /deletion-requests`, `POST /deletion-requests/:id/process`. Data projection is limited to entities reachable through those APIs and the resolved tenant context; UI must not query tables directly.
10. **Layout Structure:** Admin console shell with admin navigation, page header, configuration/table/editor main region, and confirmation/drawer area. Core regions: Request list, file-request, process/approve.
11. **Navigation Areas:** Admin sidebar; owner-only actions remain inline, not separate routes. Inventory nav: Admin sidebar.
12. **Page Sections:** Request list, file-request, process/approve
13. **Primary Actions:** Create/submit the primary resource or state transition.
14. **Secondary Actions:** Open declared modal/confirmation path; Navigate to declared child/destination screens only.
15. **Empty States:** Show an empty list/table/feed with a single permitted CTA when create/join/invite is allowed; otherwise show read-only explanatory copy.
16. **Loading States:** Skeleton for header/nav and page body after membership/entitlement/permission checks; action buttons disabled until resource loaders complete.
17. **Error States:** Use standard error envelope handling: validation errors inline; 401 to login; 403 permission/ownership/relationship denial as disabled action or role home; 404 without cross-tenant existence leakage; 409 idempotency/conflict where applicable; 429/503 as safe retry/tenant-state messaging.
18. **Membership Gate States:** ACTIVE membership in resolved tenant is required. INVITED routes only to A9; SUSPENDED/REMOVED/no row routes to branded blocked/public state; stale tokens are never trusted.
19. **Entitlement Failure States:** Not applicable; screen has no declared route-level entitlement. Still hide/disable sub-actions if their API entitlement fails.
20. **Mobile Behavior:** Desktop-first control plane; on mobile, tables become stacked cards with preserved filters and guarded row actions.
21. **Accessibility Notes:** Keyboard navigable; focus order follows header/nav/main/actions; visible labels for forms/actions; server errors announced in an accessible region. Modals trap focus, provide escape/close semantics where safe, and return focus to the opener.
22. **Audit-Relevant Actions:** Mutating/sensitive actions must emit declared audit/outbox events in the same transaction; destructive or irreversible actions require confirmation and reason/comment where specified.
23. **Notes for Engineering:** Screen must use only declared APIs and route metadata; no client-supplied `tenant_id`; host resolution is authoritative. Server resource loader must declare permission, entitlement if any, and ownership/relationship loader before render. Require idempotency/confirmation where route/table requires it; optimistic UI must roll back on server denial.

### S1 — Review & Approvals (Human Gate)

1. **Screen ID:** S1
2. **Screen Name:** Review & Approvals (Human Gate)
3. **Route:** `/review`
4. **Actor:** Shared Workflow Actor (Shared review shell)
5. **Entry Sources:** Studio/Admin review nav; workflow notifications; publish/issue/moderation escalation handoff.
6. **Exit Destinations:** Originating artifact screen, review queue, or dashboard after transition.
7. **Required Permission:** `workflow.transition.act` (relationship/role-scoped)
8. **Required Entitlement:** None declared for this screen in Phase 0/1.
9. **Data Sources / APIs:** Declared APIs: `GET /workflows`, `POST /workflows/:id/transition`. Data projection is limited to entities reachable through those APIs and the resolved tenant context; UI must not query tables directly.
10. **Layout Structure:** Shared review shell with queue column, artifact preview region, decision controls, and workflow comment/history region. Core regions: Pending-transition queue, artifact preview, approve/reject/return with comment.
11. **Navigation Areas:** Shared Review nav visible in Studio/Admin only when `workflow.transition.act` can pass. Inventory nav: Admin sidebar + Studio sidebar (relationship-scoped).
12. **Page Sections:** Pending-transition queue, artifact preview, approve/reject/return with comment
13. **Primary Actions:** Publish or submit for review through the declared workflow boundary; Create/submit the primary resource or state transition.
14. **Secondary Actions:** Navigate to declared child/destination screens only.
15. **Empty States:** Show an empty list/table/feed with a single permitted CTA when create/join/invite is allowed; otherwise show read-only explanatory copy.
16. **Loading States:** Skeleton for header/nav and page body after membership/entitlement/permission checks; action buttons disabled until resource loaders complete.
17. **Error States:** Use standard error envelope handling: validation errors inline; 401 to login; 403 permission/ownership/relationship denial as disabled action or role home; 404 without cross-tenant existence leakage; 409 idempotency/conflict where applicable; 429/503 as safe retry/tenant-state messaging.
18. **Membership Gate States:** ACTIVE membership in resolved tenant is required. INVITED routes only to A9; SUSPENDED/REMOVED/no row routes to branded blocked/public state; stale tokens are never trusted.
19. **Entitlement Failure States:** Not applicable; screen has no declared route-level entitlement. Still hide/disable sub-actions if their API entitlement fails.
20. **Mobile Behavior:** Queue and preview stack; decision buttons remain visible after artifact preview; comments are required before reject/return.
21. **Accessibility Notes:** Keyboard navigable; focus order follows header/nav/main/actions; visible labels for forms/actions; server errors announced in an accessible region.
22. **Audit-Relevant Actions:** Mutating/sensitive actions must emit declared audit/outbox events in the same transaction; destructive or irreversible actions require confirmation and reason/comment where specified.
23. **Notes for Engineering:** Screen must use only declared APIs and route metadata; no client-supplied `tenant_id`; host resolution is authoritative. Server resource loader must declare permission, entitlement if any, and ownership/relationship loader before render. Require idempotency/confirmation where route/table requires it; optimistic UI must roll back on server denial.

### P1 — Platform Tenant List

1. **Screen ID:** P1
2. **Screen Name:** Platform Tenant List
3. **Route:** `/platform`
4. **Actor:** Platform Super Admin (Platform console shell)
5. **Entry Sources:** Platform sidebar; platform console navigation; authorized platform deep link with MFA/reason where required.
6. **Exit Destinations:** → P2, P3
7. **Required Permission:** `platform.tenant.read`
8. **Required Entitlement:** None declared for this screen in Phase 0/1.
9. **Data Sources / APIs:** Declared APIs: `GET /platform/tenants`. Data projection is limited to entities reachable through those APIs and the resolved tenant context; UI must not query tables directly.
10. **Layout Structure:** Isolated platform console shell with platform navigation, reason-bound action region, table/detail tabs, and audit/status feedback. Core regions: Tenant table (state, plan, provisioning), search.
11. **Navigation Areas:** Platform sidebar only; never linked from tenant shells. Inventory nav: Platform sidebar.
12. **Page Sections:** Tenant table (state, plan, provisioning), search
13. **Primary Actions:** View/read the declared resource projection.
14. **Secondary Actions:** Search/filter/sort within allowed indexed fields; Navigate to declared child/destination screens only.
15. **Empty States:** Show an empty list/table/feed with a single permitted CTA when create/join/invite is allowed; otherwise show read-only explanatory copy.
16. **Loading States:** Show platform skeleton after MFA/platform role check; reason-bound actions stay disabled until data and reason context load.
17. **Error States:** Use standard error envelope handling: validation errors inline; 401 to login; 403 permission/ownership/relationship denial as disabled action or role home; 404 without cross-tenant existence leakage; 409 idempotency/conflict where applicable; 429/503 as safe retry/tenant-state messaging.
18. **Membership Gate States:** Tenant membership is not used; platform role + `withPlatformScope` + reason gate is required.
19. **Entitlement Failure States:** Not applicable; screen has no declared route-level entitlement. Still hide/disable sub-actions if their API entitlement fails.
20. **Mobile Behavior:** Desktop-first control plane; on mobile, tables become stacked cards with preserved filters and guarded row actions.
21. **Accessibility Notes:** Keyboard navigable; focus order follows header/nav/main/actions; visible labels for forms/actions; server errors announced in an accessible region.
22. **Audit-Relevant Actions:** All platform actions require reason-bound audit (`platform.scope.enter/exit` plus action-specific entries); reads of audit/support are scoped.
23. **Notes for Engineering:** Screen must use only declared APIs and route metadata; no client-supplied `tenant_id`; host resolution is authoritative. Use isolated platform client/DB role; never mount tenant shell components or tenant-side privilege escalation links.

### P2 — Provision Tenant

1. **Screen ID:** P2
2. **Screen Name:** Provision Tenant
3. **Route:** `/platform/tenants/new`
4. **Actor:** Platform Super Admin (Platform console shell)
5. **Entry Sources:** from P1; platform console navigation; authorized platform deep link with MFA/reason where required.
6. **Exit Destinations:** **Reason modal (≥10 chars)**
7. **Required Permission:** `platform.tenant.manage`
8. **Required Entitlement:** None declared for this screen in Phase 0/1.
9. **Data Sources / APIs:** Declared APIs: `POST /platform/tenants` (idempotent). Data projection is limited to entities reachable through those APIs and the resolved tenant context; UI must not query tables directly.
10. **Layout Structure:** Isolated platform console shell with platform navigation, reason-bound action region, table/detail tabs, and audit/status feedback. Core regions: Tenant-create wizard (slug/owner/plan/seed), idempotency-key.
11. **Navigation Areas:** Platform sidebar only; never linked from tenant shells. Inventory nav: from P1.
12. **Page Sections:** Tenant-create wizard (slug/owner/plan/seed), idempotency-key
13. **Primary Actions:** Create/submit the primary resource or state transition.
14. **Secondary Actions:** Open declared modal/confirmation path; Navigate to declared child/destination screens only.
15. **Empty States:** Show neutral empty state with role-appropriate next action or back navigation.
16. **Loading States:** Show platform skeleton after MFA/platform role check; reason-bound actions stay disabled until data and reason context load.
17. **Error States:** Use standard error envelope handling: validation errors inline; 401 to login; 403 permission/ownership/relationship denial as disabled action or role home; 404 without cross-tenant existence leakage; 409 idempotency/conflict where applicable; 429/503 as safe retry/tenant-state messaging.
18. **Membership Gate States:** Tenant membership is not used; platform role + `withPlatformScope` + reason gate is required.
19. **Entitlement Failure States:** Not applicable; screen has no declared route-level entitlement. Still hide/disable sub-actions if their API entitlement fails.
20. **Mobile Behavior:** Desktop-first control plane; on mobile, editor/detail columns stack and destructive actions remain behind confirmations.
21. **Accessibility Notes:** Keyboard navigable; focus order follows header/nav/main/actions; visible labels for forms/actions; server errors announced in an accessible region. Modals trap focus, provide escape/close semantics where safe, and return focus to the opener.
22. **Audit-Relevant Actions:** All platform actions require reason-bound audit (`platform.scope.enter/exit` plus action-specific entries); reads of audit/support are scoped.
23. **Notes for Engineering:** Screen must use only declared APIs and route metadata; no client-supplied `tenant_id`; host resolution is authoritative. Use isolated platform client/DB role; never mount tenant shell components or tenant-side privilege escalation links. Require idempotency/confirmation where route/table requires it; optimistic UI must roll back on server denial.

### P3 — Tenant Detail

1. **Screen ID:** P3
2. **Screen Name:** Tenant Detail
3. **Route:** `/platform/tenants/:id`
4. **Actor:** Platform Super Admin (Platform console shell)
5. **Entry Sources:** from P1; platform console navigation; authorized platform deep link with MFA/reason where required.
6. **Exit Destinations:** Reason modal; Lifecycle confirm; Entitlement-grant modal
7. **Required Permission:** `platform.tenant.read/manage`, `platform.entitlement.manage`
8. **Required Entitlement:** None declared for this screen in Phase 0/1.
9. **Data Sources / APIs:** Declared APIs: `GET /platform/tenants/:id`, `*/suspend|resume|archive`, `GET .../provisioning`, `GET/PUT .../entitlements`. Data projection is limited to entities reachable through those APIs and the resolved tenant context; UI must not query tables directly.
10. **Layout Structure:** Complex split layout. See ASCII wireframe below. Core regions: Tabs: Overview, Lifecycle (suspend/resume/archive), Provisioning saga, **Entitlements** (grant/modify).
11. **Navigation Areas:** Platform sidebar only; never linked from tenant shells. Inventory nav: from P1.
12. **Page Sections:** Tabs: Overview, Lifecycle (suspend/resume/archive), Provisioning saga, **Entitlements** (grant/modify)
13. **Primary Actions:** Execute guarded lifecycle/destructive action with confirmation.
14. **Secondary Actions:** Open declared modal/confirmation path; Navigate to declared child/destination screens only.
15. **Empty States:** Show neutral empty state with role-appropriate next action or back navigation.
16. **Loading States:** Show platform skeleton after MFA/platform role check; reason-bound actions stay disabled until data and reason context load.
17. **Error States:** Use standard error envelope handling: validation errors inline; 401 to login; 403 permission/ownership/relationship denial as disabled action or role home; 404 without cross-tenant existence leakage; 409 idempotency/conflict where applicable; 429/503 as safe retry/tenant-state messaging.
18. **Membership Gate States:** Tenant membership is not used; platform role + `withPlatformScope` + reason gate is required.
19. **Entitlement Failure States:** Not applicable; screen has no declared route-level entitlement. Still hide/disable sub-actions if their API entitlement fails.
20. **Mobile Behavior:** Desktop-first control plane; on mobile, editor/detail columns stack and destructive actions remain behind confirmations.
21. **Accessibility Notes:** Keyboard navigable; focus order follows header/nav/main/actions; visible labels for forms/actions; server errors announced in an accessible region. Modals trap focus, provide escape/close semantics where safe, and return focus to the opener.
22. **Audit-Relevant Actions:** All platform actions require reason-bound audit (`platform.scope.enter/exit` plus action-specific entries); reads of audit/support are scoped.
23. **Notes for Engineering:** Screen must use only declared APIs and route metadata; no client-supplied `tenant_id`; host resolution is authoritative. Use isolated platform client/DB role; never mount tenant shell components or tenant-side privilege escalation links. Require idempotency/confirmation where route/table requires it; optimistic UI must roll back on server denial.

**ASCII wireframe:**
```text
+--------------------------------------------------------------------------------+
| Platform header: Tenant Detail / mandatory reason context                        |
+-------------------+------------------------------------------------------------+
| Platform nav      | Overview: tenant state / domains / owner / plan              |
|                   +------------------------------------------------------------+
|                   | Tabs: Overview | Lifecycle | Provisioning | Entitlements     |
|                   +-----------------------------+------------------------------+
|                   | Lifecycle controls          | Provisioning job timeline      |
|                   | suspend/resume/archive      | queued/running/succeeded/etc.  |
|                   +-----------------------------+------------------------------+
|                   | Entitlement grants / expiry / history                        |
+-------------------+------------------------------------------------------------+
```

### P4 — Global Feature Flags

1. **Screen ID:** P4
2. **Screen Name:** Global Feature Flags
3. **Route:** `/platform/feature-flags`
4. **Actor:** Platform Super Admin (Platform console shell)
5. **Entry Sources:** Platform sidebar; platform console navigation; authorized platform deep link with MFA/reason where required.
6. **Exit Destinations:** Reason modal
7. **Required Permission:** `platform.feature_flag.manage`
8. **Required Entitlement:** None declared for this screen in Phase 0/1.
9. **Data Sources / APIs:** Declared APIs: `GET/POST/PUT /platform/feature-flags`. Data projection is limited to entities reachable through those APIs and the resolved tenant context; UI must not query tables directly.
10. **Layout Structure:** Isolated platform console shell with platform navigation, reason-bound action region, table/detail tabs, and audit/status feedback. Core regions: Flag catalogue editor, default values, rollout type.
11. **Navigation Areas:** Platform sidebar only; never linked from tenant shells. Inventory nav: Platform sidebar.
12. **Page Sections:** Flag catalogue editor, default values, rollout type
13. **Primary Actions:** Create/submit the primary resource or state transition.
14. **Secondary Actions:** Open declared modal/confirmation path; Navigate to declared child/destination screens only.
15. **Empty States:** Show unsaved draft scaffold with required fields and validation hints; no auto-publish.
16. **Loading States:** Show platform skeleton after MFA/platform role check; reason-bound actions stay disabled until data and reason context load.
17. **Error States:** Use standard error envelope handling: validation errors inline; 401 to login; 403 permission/ownership/relationship denial as disabled action or role home; 404 without cross-tenant existence leakage; 409 idempotency/conflict where applicable; 429/503 as safe retry/tenant-state messaging.
18. **Membership Gate States:** Tenant membership is not used; platform role + `withPlatformScope` + reason gate is required.
19. **Entitlement Failure States:** Not applicable; screen has no declared route-level entitlement. Still hide/disable sub-actions if their API entitlement fails.
20. **Mobile Behavior:** Desktop-first control plane; on mobile, editor/detail columns stack and destructive actions remain behind confirmations.
21. **Accessibility Notes:** Keyboard navigable; focus order follows header/nav/main/actions; visible labels for forms/actions; server errors announced in an accessible region. Modals trap focus, provide escape/close semantics where safe, and return focus to the opener.
22. **Audit-Relevant Actions:** All platform actions require reason-bound audit (`platform.scope.enter/exit` plus action-specific entries); reads of audit/support are scoped.
23. **Notes for Engineering:** Screen must use only declared APIs and route metadata; no client-supplied `tenant_id`; host resolution is authoritative. Use isolated platform client/DB role; never mount tenant shell components or tenant-side privilege escalation links. Require idempotency/confirmation where route/table requires it; optimistic UI must roll back on server denial.

### P5 — Global Catalog

1. **Screen ID:** P5
2. **Screen Name:** Global Catalog
3. **Route:** `/platform/catalog`
4. **Actor:** Platform Super Admin (Platform console shell)
5. **Entry Sources:** Platform sidebar; platform console navigation; authorized platform deep link with MFA/reason where required.
6. **Exit Destinations:** Reason modal
7. **Required Permission:** `platform.catalog.manage` (super_admin only)
8. **Required Entitlement:** None declared for this screen in Phase 0/1.
9. **Data Sources / APIs:** Declared APIs: `GET/POST /platform/catalog/{permissions,item-types,extension-points}`. Data projection is limited to entities reachable through those APIs and the resolved tenant context; UI must not query tables directly.
10. **Layout Structure:** Isolated platform console shell with platform navigation, reason-bound action region, table/detail tabs, and audit/status feedback. Core regions: Tabs: Permissions, Item Types, Extension Points.
11. **Navigation Areas:** Platform sidebar only; never linked from tenant shells. Inventory nav: Platform sidebar.
12. **Page Sections:** Tabs: Permissions, Item Types, Extension Points
13. **Primary Actions:** Create/submit the primary resource or state transition.
14. **Secondary Actions:** Open declared modal/confirmation path; Navigate to declared child/destination screens only.
15. **Empty States:** Show neutral empty state with role-appropriate next action or back navigation.
16. **Loading States:** Show platform skeleton after MFA/platform role check; reason-bound actions stay disabled until data and reason context load.
17. **Error States:** Use standard error envelope handling: validation errors inline; 401 to login; 403 permission/ownership/relationship denial as disabled action or role home; 404 without cross-tenant existence leakage; 409 idempotency/conflict where applicable; 429/503 as safe retry/tenant-state messaging.
18. **Membership Gate States:** Tenant membership is not used; platform role + `withPlatformScope` + reason gate is required.
19. **Entitlement Failure States:** Not applicable; screen has no declared route-level entitlement. Still hide/disable sub-actions if their API entitlement fails.
20. **Mobile Behavior:** Desktop-first control plane; on mobile, editor/detail columns stack and destructive actions remain behind confirmations.
21. **Accessibility Notes:** Keyboard navigable; focus order follows header/nav/main/actions; visible labels for forms/actions; server errors announced in an accessible region. Modals trap focus, provide escape/close semantics where safe, and return focus to the opener.
22. **Audit-Relevant Actions:** All platform actions require reason-bound audit (`platform.scope.enter/exit` plus action-specific entries); reads of audit/support are scoped.
23. **Notes for Engineering:** Screen must use only declared APIs and route metadata; no client-supplied `tenant_id`; host resolution is authoritative. Use isolated platform client/DB role; never mount tenant shell components or tenant-side privilege escalation links. Require idempotency/confirmation where route/table requires it; optimistic UI must roll back on server denial.

### P6 — Platform Audit

1. **Screen ID:** P6
2. **Screen Name:** Platform Audit
3. **Route:** `/platform/audit`
4. **Actor:** Platform Super Admin (Platform console shell)
5. **Entry Sources:** Platform sidebar; platform console navigation; authorized platform deep link with MFA/reason where required.
6. **Exit Destinations:** Reason modal
7. **Required Permission:** `platform.audit.read`
8. **Required Entitlement:** None declared for this screen in Phase 0/1.
9. **Data Sources / APIs:** Declared APIs: `GET /platform/audit`. Data projection is limited to entities reachable through those APIs and the resolved tenant context; UI must not query tables directly.
10. **Layout Structure:** Isolated platform console shell with platform navigation, reason-bound action region, table/detail tabs, and audit/status feedback. Core regions: Audit table (cross-tenant), filters, scope-enter/exit entries.
11. **Navigation Areas:** Platform sidebar only; never linked from tenant shells. Inventory nav: Platform sidebar.
12. **Page Sections:** Audit table (cross-tenant), filters, scope-enter/exit entries
13. **Primary Actions:** View/read the declared resource projection.
14. **Secondary Actions:** Search/filter/sort within allowed indexed fields; Open declared modal/confirmation path; Navigate to declared child/destination screens only.
15. **Empty States:** Show an empty list/table/feed with a single permitted CTA when create/join/invite is allowed; otherwise show read-only explanatory copy.
16. **Loading States:** Show platform skeleton after MFA/platform role check; reason-bound actions stay disabled until data and reason context load.
17. **Error States:** Use standard error envelope handling: validation errors inline; 401 to login; 403 permission/ownership/relationship denial as disabled action or role home; 404 without cross-tenant existence leakage; 409 idempotency/conflict where applicable; 429/503 as safe retry/tenant-state messaging.
18. **Membership Gate States:** Tenant membership is not used; platform role + `withPlatformScope` + reason gate is required.
19. **Entitlement Failure States:** Not applicable; screen has no declared route-level entitlement. Still hide/disable sub-actions if their API entitlement fails.
20. **Mobile Behavior:** Desktop-first control plane; on mobile, tables become stacked cards with preserved filters and guarded row actions.
21. **Accessibility Notes:** Keyboard navigable; focus order follows header/nav/main/actions; visible labels for forms/actions; server errors announced in an accessible region. Modals trap focus, provide escape/close semantics where safe, and return focus to the opener.
22. **Audit-Relevant Actions:** All platform actions require reason-bound audit (`platform.scope.enter/exit` plus action-specific entries); reads of audit/support are scoped.
23. **Notes for Engineering:** Screen must use only declared APIs and route metadata; no client-supplied `tenant_id`; host resolution is authoritative. Use isolated platform client/DB role; never mount tenant shell components or tenant-side privilege escalation links.

### P7 — Support Sessions

1. **Screen ID:** P7
2. **Screen Name:** Support Sessions
3. **Route:** `/platform/support`
4. **Actor:** Platform Super Admin (Platform console shell)
5. **Entry Sources:** Platform sidebar; platform console navigation; authorized platform deep link with MFA/reason where required.
6. **Exit Destinations:** Reason modal (per incident)
7. **Required Permission:** `platform.support.access`
8. **Required Entitlement:** None declared for this screen in Phase 0/1.
9. **Data Sources / APIs:** Declared APIs: `POST /platform/support/sessions`. Data projection is limited to entities reachable through those APIs and the resolved tenant context; UI must not query tables directly.
10. **Layout Structure:** Isolated platform console shell with platform navigation, reason-bound action region, table/detail tabs, and audit/status feedback. Core regions: Open-session form (tenant + reason), active-session list.
11. **Navigation Areas:** Platform sidebar only; never linked from tenant shells. Inventory nav: Platform sidebar.
12. **Page Sections:** Open-session form (tenant + reason), active-session list
13. **Primary Actions:** Create/submit the primary resource or state transition.
14. **Secondary Actions:** Open declared modal/confirmation path; Navigate to declared child/destination screens only.
15. **Empty States:** Show an empty list/table/feed with a single permitted CTA when create/join/invite is allowed; otherwise show read-only explanatory copy.
16. **Loading States:** Show platform skeleton after MFA/platform role check; reason-bound actions stay disabled until data and reason context load.
17. **Error States:** Use standard error envelope handling: validation errors inline; 401 to login; 403 permission/ownership/relationship denial as disabled action or role home; 404 without cross-tenant existence leakage; 409 idempotency/conflict where applicable; 429/503 as safe retry/tenant-state messaging.
18. **Membership Gate States:** Tenant membership is not used; platform role + `withPlatformScope` + reason gate is required.
19. **Entitlement Failure States:** Not applicable; screen has no declared route-level entitlement. Still hide/disable sub-actions if their API entitlement fails.
20. **Mobile Behavior:** Desktop-first control plane; on mobile, tables become stacked cards with preserved filters and guarded row actions.
21. **Accessibility Notes:** Keyboard navigable; focus order follows header/nav/main/actions; visible labels for forms/actions; server errors announced in an accessible region. Modals trap focus, provide escape/close semantics where safe, and return focus to the opener.
22. **Audit-Relevant Actions:** All platform actions require reason-bound audit (`platform.scope.enter/exit` plus action-specific entries); reads of audit/support are scoped.
23. **Notes for Engineering:** Screen must use only declared APIs and route metadata; no client-supplied `tenant_id`; host resolution is authoritative. Use isolated platform client/DB role; never mount tenant shell components or tenant-side privilege escalation links. Require idempotency/confirmation where route/table requires it; optimistic UI must roll back on server denial.

### P8 — Eventing / Dead-Letter Ops

1. **Screen ID:** P8
2. **Screen Name:** Eventing / Dead-Letter Ops
3. **Route:** `/platform/eventing`
4. **Actor:** Platform Super Admin (Platform console shell)
5. **Entry Sources:** Platform sidebar; platform console navigation; authorized platform deep link with MFA/reason where required.
6. **Exit Destinations:** Replay confirm; Reason modal
7. **Required Permission:** `platform.tenant.manage`
8. **Required Entitlement:** None declared for this screen in Phase 0/1.
9. **Data Sources / APIs:** Declared APIs: `POST /internal/outbox/dead-letter/:id/replay`. Data projection is limited to entities reachable through those APIs and the resolved tenant context; UI must not query tables directly.
10. **Layout Structure:** Isolated platform console shell with platform navigation, reason-bound action region, table/detail tabs, and audit/status feedback. Core regions: Dead-letter list, replay action.
11. **Navigation Areas:** Platform sidebar only; never linked from tenant shells. Inventory nav: Platform sidebar.
12. **Page Sections:** Dead-letter list, replay action
13. **Primary Actions:** Create/submit the primary resource or state transition.
14. **Secondary Actions:** Open declared modal/confirmation path; Navigate to declared child/destination screens only.
15. **Empty States:** Show an empty list/table/feed with a single permitted CTA when create/join/invite is allowed; otherwise show read-only explanatory copy.
16. **Loading States:** Show platform skeleton after MFA/platform role check; reason-bound actions stay disabled until data and reason context load.
17. **Error States:** Use standard error envelope handling: validation errors inline; 401 to login; 403 permission/ownership/relationship denial as disabled action or role home; 404 without cross-tenant existence leakage; 409 idempotency/conflict where applicable; 429/503 as safe retry/tenant-state messaging.
18. **Membership Gate States:** Tenant membership is not used; platform role + `withPlatformScope` + reason gate is required.
19. **Entitlement Failure States:** Not applicable; screen has no declared route-level entitlement. Still hide/disable sub-actions if their API entitlement fails.
20. **Mobile Behavior:** Desktop-first control plane; on mobile, tables become stacked cards with preserved filters and guarded row actions.
21. **Accessibility Notes:** Keyboard navigable; focus order follows header/nav/main/actions; visible labels for forms/actions; server errors announced in an accessible region. Modals trap focus, provide escape/close semantics where safe, and return focus to the opener.
22. **Audit-Relevant Actions:** All platform actions require reason-bound audit (`platform.scope.enter/exit` plus action-specific entries); reads of audit/support are scoped.
23. **Notes for Engineering:** Screen must use only declared APIs and route metadata; no client-supplied `tenant_id`; host resolution is authoritative. Use isolated platform client/DB role; never mount tenant shell components or tenant-side privilege escalation links. Require idempotency/confirmation where route/table requires it; optimistic UI must roll back on server denial.

# 4. Wireframe Coverage Matrix

| Actor Plane | Screen IDs Covered | Count | Verdict |
|---|---:|---:|---|
| Anonymous Visitor | A1, A2, A3, A4, A5, A6, A7, A8, A9, A10 | 10 | Covered |
| Learner | L1, L2, L3, L4, L5, L6, L7, L8, L9, L10, L11, L12, L13, L14, L15, L16, L17, L18, L19, L20, L21, L22, L23, L24, L25 | 25 | Covered |
| Instructor | I1, I2, I3, I4, I5, I6, I7, I8, I9, I10, I11, I12, I13 | 13 | Covered |
| Moderator | M1, M2, M3, M4 | 4 | Covered |
| Shared Workflow | S1 | 1 | Covered |
| Tenant Admin | T1, T2, T3, T4, T5, T6, T7, T8, T9, T10, T11, T12, T13, T14, T15, T16, T17, T18, T19, T20, T21, T22, T23, T24 | 24 | Covered |
| Platform Super Admin | P1, P2, P3, P4, P5, P6, P7, P8 | 8 | Covered |
| **Total row-level entries** | A1–A10, L1–L25, I1–I13, M1–M4, S1, T1–T24, P1–P8 | **85** | Covered |

**Count note:** Screen Inventory §8 states 84 distinct screens, while §1 enumerates 85 row-level entries when A3 Diagnostic Identity Gate is included as a modal screen entry. This Wireframes v1 covers every enumerated row ID; no approved row is omitted.

## 4.1 Entitlement Coverage Matrix

| Screen | Entitlement Handling |
|---|---|
| L14 — Certificates | certification.enable |
| L15 — Achievements & Badges | gamification.enable |
| L16 — Leaderboards | gamification.enable |
| L17 — Community Hub | community.enable |
| L18 — Community Space / Feed | community.enable |
| L19 — Post Detail / Thread | community.enable |
| L20 — Hall of Fame | community.enable; gamification.enable gates leaderboard segment if shown |
| I13 — Studio Analytics | analytics.dashboard.view |
| M1 — Moderation Queue | community.enable |
| M2 — Moderation Case Detail | community.enable |
| M3 — Appeals Review | community.enable |
| M4 — Community Spaces Admin | community.enable |
| T7 — Domains | branding.custom_domain.enable gates custom-domain add/verify; base subdomain remains available |
| T12 — Certificate Templates | certification.enable |
| T13 — Issued Certificates | certification.enable |
| T14 — Gamification Config | gamification.enable |
| T21 — Analytics | analytics.dashboard.view |
| T23 — Data Exports | data.export.enable (always-on by policy) |

# 5. Screen-to-Journey Mapping

| Screen | Journey Mapping |
|---|---|
| A1 — Public Academy Home / Landing | Visitor landing → diagnostic / login / signup |
| A2 — Public Diagnostic (anonymous) | Free Trading Diagnostic, anonymous run |
| A3 — Diagnostic Identity Gate | Diagnostic identity gate / anonymous-to-account bridge |
| A4 — Anonymous Diagnostic Scorecard | Anonymous scorecard → signup/app handoff |
| A5 — Certificate Verification | Certificate verification public flow |
| A6 — Login | Authentication flow |
| A7 — Signup | Signup flow |
| A8 — Password Reset | Password recovery flow |
| A9 — Invitation Acceptance | Invitation acceptance flow |
| A10 — Tenant Unavailable / Suspended Notice | Tenant-state failure flow |
| L1 — Trader Dashboard (Home) | Learner home / next-best-action hub |
| L2 — Course Catalog | Discovery branch: course catalog/search |
| L3 — Course Detail | Enrollment branch: course detail |
| L4 — Lesson Player | Learning consumption branch: lesson player |
| L5 — Trader Career Roadmap | Trader Career Roadmap progression |
| L6 — Learning Path / Program Detail | Learning path enrollment/progress |
| L7 — Assessment Overview (pre-start) | Assessment pre-start |
| L8 — Assessment Attempt Runner | Assessment attempt/submit |
| L9 — Attempt Result / Review | Assessment result/review |
| L10 — Swipe Learning | Swipe → competency → readiness journey |
| L11 — Diagnostic (authenticated) | Authenticated diagnostic retake |
| L12 — Competency & Readiness | Challenge readiness → attributed CTA |
| L13 — Progress Dashboard | Progress / improvement review |
| L14 — Certificates | Certificate ownership and sharing |
| L15 — Achievements & Badges | Gamification achievements |
| L16 — Leaderboards | Leaderboard discovery |
| L17 — Community Hub | Community engagement entry |
| L18 — Community Space / Feed | Community feed participation |
| L19 — Post Detail / Thread | Threaded discussion and report branch |
| L20 — Hall of Fame | Hall of Fame discovery |
| L21 — Resource Library | Resource discovery branch |
| L22 — Search Results | Global search branch |
| L23 — Notifications Inbox | Notification consumption |
| L24 — Profile | Profile management |
| L25 — Settings | Account/settings/data rights |
| I1 — Studio Dashboard | Instructor studio overview |
| I2 — Course Manager | Course authoring list |
| I3 — Course Builder | Course build → review → publish |
| I4 — Lesson Editor | Lesson authoring |
| I5 — Item Bank | Item bank management |
| I6 — Item Editor | Item authoring including swipe item type |
| I7 — Item Collections / Decks | Item collection/deck authoring |
| I8 — Assessment Builder | Assessment authoring → review → publish |
| I9 — Learning Path Builder | Learning-path authoring → review → publish |
| I10 — Grading Queue | Grading queue |
| I11 — Grading Detail | Grading decision |
| I12 — Learner Roster & Progress | Learner progress review for taught course |
| I13 — Studio Analytics | Studio analytics review |
| M1 — Moderation Queue | Moderation case queue |
| M2 — Moderation Case Detail | Moderation decision flow |
| M3 — Appeals Review | Appeal review flow |
| M4 — Community Spaces Admin | Community space management |
| T1 — Admin Dashboard | Tenant setup / admin overview |
| T2 — Members | User management |
| T3 — Member Detail | Member detail / roles / overrides |
| T4 — Roles & Permissions | Role catalogue management |
| T5 — Role Editor | Role editing |
| T6 — Branding & Theme | Branding configuration and publish |
| T7 — Domains | Domain configuration |
| T8 — Configuration | Tenant configuration |
| T9 — Feature Flags | Feature-flag override review |
| T10 — Entitlements (read-only) | Entitlement visibility |
| T11 — Competency & Scoring | Competency/scoring configuration |
| T12 — Certificate Templates | Certificate template management |
| T13 — Issued Certificates | Issued certificate oversight |
| T14 — Gamification Config | Gamification configuration |
| T15 — Notification Templates | Notification template management |
| T16 — Automation Rules | Automation rule management |
| T17 — Workflows | Workflow definition management |
| T18 — Locales | Locale management |
| T19 — Extensions | First-party extension registration |
| T20 — Readiness Policy | Readiness policy / legal-copy configuration |
| T21 — Analytics | Tenant analytics/funnel review |
| T22 — Audit Log | Tenant audit review |
| T23 — Data Exports | Tenant data export |
| T24 — Deletion Requests | Deletion request workflow |
| S1 — Review & Approvals (Human Gate) | Human review/approval gate for publish/issue/moderation escalations |
| P1 — Platform Tenant List | Platform tenant list |
| P2 — Provision Tenant | Tenant provisioning |
| P3 — Tenant Detail | Tenant lifecycle/provisioning/entitlements |
| P4 — Global Feature Flags | Global feature flags |
| P5 — Global Catalog | Global catalogues |
| P6 — Platform Audit | Platform audit |
| P7 — Support Sessions | Support session access |
| P8 — Eventing / Dead-Letter Ops | Dead-letter event replay |

# 6. Missing-State Validation

| Required State Class | Coverage Verdict | Validation Detail |
|---|---|---|
| Empty states | PASS | Every screen entry defines an empty/no-data state appropriate to public, learner, studio, moderation, admin, shared workflow, or platform context. |
| Loading states | PASS | Every screen entry blocks meaningful content until the relevant public/tenant/platform gates and resource loaders complete. |
| Error states | PASS | Every screen uses the approved error envelope behavior: 401, membership-state 403s, permission/ownership/relationship denial, entitlement denial, 404 non-leakage, 409 conflict/idempotency, 429, and 503 tenant-state handling. |
| Membership gate states | PASS | Public A-series screens explicitly bypass ACTIVE membership only where approved; protected tenant screens require ACTIVE membership; P-series screens use platform role scope instead of tenant membership. |
| Entitlement failure states | PASS | Every entitlement-gated route or section has a nav-hide/upgrade/read-only fallback. Screens without route-level entitlements still disable sub-actions when an API-level entitlement fails. |
| Mobile behavior | PASS | Every screen has responsive-web behavior. Native app build behavior is intentionally not introduced in P0/P1. |
| Accessibility | PASS | Every screen has keyboard, focus, forms/errors, modal, chart/table, and runner-specific guidance where applicable. |
| Audit-relevant actions | PASS | Every mutating, sensitive, platform, destructive, publish, issue, revoke, export, deletion, role, entitlement, moderation, and support action is marked audit-relevant. |

# 7. Security-State Validation

| Security Rule | Verdict | Wireframe Enforcement |
|---|---|---|
| Host-resolved tenancy | PASS | All tenant screens state host resolution is authoritative and no UI may send client-supplied tenant IDs. |
| Public allow-list | PASS | Only A1–A10 are public/system/invite/auth flows. Public community, catalog, checkout, and admin/platform routes are not created. |
| Membership gate | PASS | All L/I/M/T/S screens require ACTIVE membership; denied membership states route to the approved public/invite/suspended handling. |
| Entitlement before permission | PASS | Entitlement-gated screens and sections define consistent `ENTITLEMENT_REQUIRED` handling before actor permission is considered. |
| `can()` with ownership/relationship | PASS | Instructor, learner self-service, moderation, workflow, and admin-bypass notes require server-side resource loaders and no client-only checks. |
| Platform isolation | PASS | P1–P8 remain in the platform shell only, require platform permission, MFA/session hardening, and reason-bound audit. |
| Human approval gate | PASS | Publish/issue/escalation transitions surface S1 or workflow APIs; authoring screens do not create a new direct publish workflow. |
| FundedBeyond no-fork rule | PASS | Diagnostic, swipe, readiness, roadmap, CTA, community, and Hall of Fame screens use generic Atlas APIs and only the approved FundedBeyond app-layer edges. |
| Out-of-scope prevention | PASS | No checkout, live/webinar, AI coach, marketplace, L2/L3 proctoring, native mobile app build, inbound challenge status, or platform billing/analytics screen is introduced. |

# 8. Final CTO Approval Verdict

**Verdict: APPROVED FOR IMPLEMENTATION HANDOFF — CONDITIONAL ON PHASE 0 SECURITY GATES.**

Wireframes v1 covers every approved Screen Inventory row ID for Phase 0, Phase 1A, and Phase 1B. It maps each screen to the locked route, actor, permission, entitlement behavior, declared APIs, navigation area, state handling, mobile behavior, accessibility requirements, audit implications, and engineering constraints. It creates no new product surface and does not smuggle in unsupported Phase 2–4 capability.

Implementation may proceed only if the Phase 0 transaction-local RLS/IDOR, membership-gate, `can()`/`enforceEntitlement`, platform-scope, audit, MFA, and idempotency harnesses are green before protected Phase 1 surfaces ship. Any screen implementation that consumes an undeclared API, adds a permission/entity/workflow, bypasses S1 where required, or renders protected tenant data before authorization is defective and must be rejected.