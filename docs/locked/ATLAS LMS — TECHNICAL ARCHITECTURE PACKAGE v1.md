## **ATLAS LMS — TECHNICAL ARCHITECTURE PACKAGE v1** 

## **Phase 0 + Phase 1A + Phase 1B Engineering Blueprint** 

**Status:** Implementation-ready technical architecture package **Scope:** Repository, frontend, backend, database, infrastructure, testing, CI/CD, and engineering standards only 

**Binding Rule:** This document creates no new product scope, screens, APIs, permissions, workflows, entities, database architecture, tenant strategy, or FundedBeyond-specific platform fork. **Source of Truth:** Locked Atlas LMS artifacts only. 

## **1. Executive Summary** 

Atlas LMS Technical Architecture Package v1 defines how the approved Phase 0 + Phase 1A + Phase 1B system must be implemented in code. 

The architecture is designed around five goals: 

## **Correctness before features** 

## 1. 

2. Phase 0 is an isolation and security correctness phase. 

3. No learner, instructor, admin, community, diagnostic, readiness, swipe, or analytics feature may ship until tenant isolation, RLS, transaction-local tenant context, membership gating, authorization, audit, and platform isolation are proven. 

4. **Single multi-tenant platform** 

- Atlas uses one shared codebase and one shared PostgreSQL database. 

5. 

6. Every tenant-facing business row remains tenant-scoped. 

- FundedBeyond Academy is Tenant #1 configuration only. 

7. 

8. No FundedBeyond branch, module fork, hardcoded copy, hardcoded domain, hardcoded theme, or tenant-specific platform logic is allowed. 

## **API-first implementation** 

## 9. 

10. Every UI surface consumes approved APIs only. 

11. Every route handler declares authorization metadata. 

12. Every boundary validates with Zod. 

13. Every error returns the standard envelope. 

1 

14. Server Actions may exist only as UI orchestration wrappers around the same service and authorization rules; they must not become hidden APIs. 

## **Security-first architecture** 

## 15. 

16. Default deny everywhere. 

17. Host-resolved tenant context is authoritative. 

18. ACTIVE membership is required for protected tenant access. 

19. Entitlement is checked before permission. 

20. Ownership and relationship checks live inside `can()` . 

21. RLS is the database backstop. 

22. Sensitive mutations write same-transaction audit entries. 

23. Outbox handles side effects. 

## **Enterprise-ready delivery discipline** 

## 24. 

   - Repository boundaries enforce bounded contexts. 

25. 

26. CI fails unsafe imports, missing route metadata, Prisma access outside `withTenantTx` , missing audit, missing IDOR tests, missing Zod validation, and platform-scope leakage. 

27. Observability is built in through Sentry, PostHog, Better Stack, request IDs, structured logs, and audit visibility. 

## **2. Architecture Principles** 

## **2.1 Separation of concerns** 

Atlas code must be separated by responsibility: 

- **App routes** handle routing, layout, and page composition. 

- **API routes** handle HTTP transport only. 

- **Server Actions** handle form orchestration only. 

- **Services** contain business use-case logic. 

- **Repositories** contain authorized data-access helpers. 

- **Authorization** is centralized in `can()` . 

- **Entitlements** are centralized in `enforceEntitlement()` . 

- **Validation** is centralized in Zod schemas. 

- **Events** are emitted through outbox, not direct side effects. 

- 

- **UI components** compose from design-system layers, not ad hoc styling. 

No screen, route handler, Server Action, component, or repository may mix all concerns. 

2 

## **2.2 API-first design** 

Rules: 

- UI never reads Prisma directly. 

- UI never imports repositories. 

- UI never constructs `tenant_id` . 

- UI never trusts client-side permission checks. 

- API routes and Server Actions both call the same service layer. 

- Every service assumes authorization has already been established. 

- Every handler must declare: 

- `permission` 

- 

- optional `entitlement` 

- 

- optional but required-when-needed `resourceLoader` 

- `audit` requirement 

- 

- `rateLimit` bucket 

- `idempotency` requirement 

- Zod request schema 

- Zod response schema 

## **2.3 Default deny** 

Default behavior: 

```
allowed=false
```

A request becomes allowed only after: 

1. Tenant is resolved from host. 

2. Tenant is ACTIVE. 

3. User is authenticated where required. 

4. User has ACTIVE membership where protected. 

5. Transaction tenant context is set. 

6. Entitlement passes where applicable. 

7. `can()` allows the permission for the resource. 

8. Ownership or relationship predicate passes inside `can()` . 

9. Database RLS agrees with the same tenant context. 

Missing metadata is not “public.” It is a defect. 

## **2.4 Tenant isolation** 

Tenant isolation exists at multiple layers: 

1. **Host resolution** 

3 

2. Host maps to tenant through `tenant_domains` . 

3. Host wins over JWT tenant claims. 

4. APIs do not accept client-supplied `tenant_id` . 

## 5. **Application context** 

6. Request carries `tenantId` , `requestId` , `actorMembershipId` , and tenant state. 

7. Protected routes require ACTIVE membership. 

8. **Transaction context** 

9. All tenant DB work runs inside `withTenantTx` . 

10. Transaction-local GUCs are set with `set_config(..., true)` . 

## **Database RLS** 

11. 

12. Tenant tables enforce `tenant_id = app.current_tenant_id()` . 

## 13. **Authorization** 

14. `can()` evaluates permission, override, ownership, relationship, and tenant context. 

15. **Testing** 

16. Every tenant-facing endpoint gets membership-gate and IDOR tests. 

## **2.5 Domain-driven boundaries** 

Atlas is organized by approved bounded contexts, not by UI screens. 

Primary implementation contexts: 

- Tenancy & Provisioning 

- Identity & Membership 

- Access Control 

- Branding & Configuration 

- Entitlements 

- Learning 

- Lessons 

- Learning Paths 

- Assessment 

- Item Registry 

- Practice / Swipe 

- Competency & Scoring 

4 

- Readiness • Workflow • Certification 

- Gamification 

- Community 

- Moderation 

- Notifications 

- Search 

- Analytics 

- Automation 

- Locales 

- Extensions, first-party registration only 

- Audit 

- Eventing / Outbox 

- Data Rights 

- Platform Operations 

Rule: a context owns its tables and writes. Cross-context interaction happens through service interfaces or outbox events, not direct foreign-context writes. 

## **2.6 Event-driven side effects** 

Side effects must not run inline after a mutation unless they are part of the same transaction’s required persistence. 

Examples: 

- Certificate issued → write credential + audit + outbox event. • Attempt submitted → write attempt state + answers + audit if required + outbox event. • Course published → workflow transition + audit + outbox event. 

- Notification needed → outbox event → worker → `notification_dispatches` . • Search index update → outbox event → worker → `search_index_entries` . 

No route handler directly sends email, updates search, updates analytics projections, or runs long jobs after committing state. 

## **2.7 Configuration over customization** 

FundedBeyond-specific behavior must be expressed through: 

- tenant branding 

- tenant theme 

- tenant config 

- entitlements 

- feature flags 

- learning paths 

- item types 

- scoring dimensions 

5 

- readiness policy config 

- content 

- community configuration 

- certification templates 

- workflow configuration 

- public landing content 

Forbidden: 

- `if tenant.slug === 'fundedbeyond'` 

- hardcoded FundedBeyond colors 

- hardcoded FundedBeyond copy 

- FundedBeyond-only React components 

- FundedBeyond-only API routes 

- FundedBeyond-only database tables 

- FundedBeyond-only permissions 

## **3. Repository Architecture** 

## **3.1 Top-level monorepo structure** 

```
atlas-lms/
├── apps/
│   └── web/
├── packages/
│   ├── api/
│   ├── auth/
│   ├── authorization/
│   ├── config/
│   ├── db/
│   ├── design-system/
│   ├── domain/
│   ├── events/
│   ├── observability/
│   ├── security/
│   ├── storage/
│   ├── testing/
│   ├── utils/
│   └── validation/
├── prisma/
│   ├── schema.prisma
│   ├── migrations/
│   ├── sql/
│   ├── seeds/
│   └── generated/
├── infrastructure/
│   ├── cloudflare/
```

6 

```
│   ├── vercel/
│   ├── supabase/
│   ├── r2/
│   ├── monitoring/
│   └── environments/
├── scripts/
│   ├── ci/
│   ├── db/
│   ├── seeds/
│   ├── codegen/
│   └── validation/
├── tests/
│   ├── unit/
│   ├── integration/
│   ├── authorization/
│   ├── tenant-isolation/
│   ├── e2e/
│   └── fixtures/
├── docs/
│   ├── locked/
│   ├── engineering/
│   ├── runbooks/
│   └── decisions/
├── .github/
│   └── workflows/
├── package.json
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── eslint.config.mjs
├── prettier.config.js
└── README.md
```

## **3.2 Folder purposes** 

## **`apps/web`** 

The Next.js 15+ application. 

Contains: 

- App Router routes 

- layouts 

- pages 

- API route handlers 

- route groups 

- middleware 

- frontend module composition 

- screen implementations from Screen Inventory only 

7 

It must not contain reusable business logic that belongs in packages. 

## **`packages/api`** 

Shared API transport utilities. 

Contains: 

- route metadata types 

- route wrapper 

- request context builder 

- error envelope helpers 

- pagination helpers 

- filtering helpers 

- sorting helpers 

- idempotency helpers 

- response helpers 

Does not contain domain business logic. 

## **`packages/auth`** 

Supabase Auth integration. 

Contains: 

- session extraction 

- JWT validation bridge 

- auth principal loader 

- invitation token helpers 

- session revocation helper interfaces 

- admin MFA enforcement helpers 

Does not decide tenant permissions. 

## **`packages/authorization`** 

Authorization and entitlement layer. 

Contains: 

- `can()` 

- permission catalogue access 

- ownership predicate registry 

- relationship predicate registry 

- permission override resolver • effective permission builder 

8 

- `enforceEntitlement()` 

- platform role assertion 

- route metadata enforcement types 

Only this package makes authorization decisions. 

## **`packages/config`** 

Tenant runtime configuration. 

Contains: 

- tenant config loader 

- feature flag loader 

- branding loader 

- theme loader 

- cache keys 

- config version helpers 

Does not hardcode FundedBeyond. 

## **`packages/db`** 

Database access boundary. 

Contains: 

- Prisma client factories 

- `withTenantTx()` 

- `withPlatformScope()` 

- transaction context types 

- RLS helpers 

- repository base utilities 

- query guard utilities 

No tenant-facing Prisma access is allowed outside this package and approved repositories. 

## **`packages/design-system`** 

Atlas design-system implementation. 

Contains: 

- Tailwind tokens 

- shadcn base wrappers 

- primitives 

- patterns 

- shell components 

9 

- form components 

- table components 

- empty/loading/error/denied states 

- accessibility helpers 

Does not contain domain API calls. 

## **`packages/domain`** 

Approved bounded-context modules. 

Contains: 

```
packages/domain/
├── tenancy/
├── identity/
├── access/
├── branding/
├── learning/
├── lessons/
├── paths/
├── assessment/
├── item-registry/
├── practice/
├── competency/
├── readiness/
├── workflow/
├── certification/
├── gamification/
├── community/
├── moderation/
├── notifications/
├── search/
├── analytics/
├── automation/
├── locales/
├── extensions/
├── audit/
├── eventing/
├── data-rights/
└── platform/
```

Each module contains: 

```
<context>/
├── schemas/
├── services/
```

10 

```
├── repositories/
```

- `├── events/ ├── policies/` 

- `├── mappers/` 

- `├── tests/ └── index.ts` 

## **`packages/events`** 

Outbox event contracts and worker utilities. 

Contains: 

- event names 

- event payload schemas 

- schema versions 

- outbox publisher 

- event processors 

- delivery tracking 

- retry policy 

- dead-letter helpers 

## **`packages/observability`** 

Monitoring and telemetry. 

Contains: 

- Sentry setup 

- PostHog setup 

- Better Stack logger setup 

- request ID propagation 

- structured log helpers 

- audit visibility adapters 

- performance trace helpers 

## **`packages/security`** 

Security utilities. 

Contains: 

- CSRF helpers 

- rate limit helpers 

- headers 

- input sanitization helpers 

11 

- signed token helpers 

- IP hashing 

- user-agent hashing 

- secure compare helpers 

## **`packages/storage`** 

Cloudflare R2 integration. 

Contains: 

- bucket key builder 

- signed upload URL generator 

- signed download URL generator 

- asset reference helpers 

- MIME/type validation 

- size policy validation 

No video hosting implementation lives here beyond provider references. 

## **`packages/testing`** 

Shared test helpers. 

## Contains: 

- tenant fixtures 

- auth fixtures 

- membership fixtures 

- role fixtures 

- permission fixtures 

- RLS helpers 

- IDOR matrix helpers 

- request factory 

- route metadata assertions 

- outbox assertions 

- audit assertions 

## **`packages/validation`** 

Shared Zod primitives. 

Contains: 

- UUIDv7 schema 

- cursor schema 

- pagination schema 

12 

- sorting schema 

- filtering schema 

- idempotency key schema 

- common API envelope schemas 

- safe string schemas 

- enum schemas generated from approved DB enums 

## **4. Frontend Architecture** 

## **4.1 App Router strategy** 

Atlas uses Next.js App Router with route groups aligned to actor planes. 

```
apps/web/src/app/
├── (public)/
├── (auth)/
├── (learner)/
├── (studio)/
├── (moderation)/
├── (admin)/
├── (platform)/
├── api/
├── globals.css
├── layout.tsx
├── not-found.tsx
└── error.tsx
```

Rules: 

- Route groups represent approved shells. 

- Route groups do not create new screens. 

- Every page must map to an approved Screen Inventory ID. 

- Every protected route uses gate-before-render. 

- Platform routes are physically separated under `(platform)` . 

- Public routes are limited to the approved public allow-list. 

- Tenant member navigation is never rendered on public routes. 

## **4.2 Route groups** 

```
(public)/
```

```
├── layout.tsx
```

- `├── page.tsx                         # A1` 

- `├── p/[slug]/page.tsx                # A1 variant` 

```
├── diagnostic/page.tsx              # A2
```

13 

```
├── verify/[credentialId]/page.tsx   # A5
└── tenant-unavailable/page.tsx      # A10
(auth)/
├── login/page.tsx                   # A6
├── signup/page.tsx                  # A7
├── reset-password/page.tsx          # A8
└── invite/accept/page.tsx           # A9
```

```
(learner)/
├── layout.tsx
├── page.tsx
├── courses/
├── lessons/
├── paths/
├── assessments/
├── practice/
├── readiness/
├── certificates/
├── community/
├── notifications/
└── profile/
(studio)/
├── layout.tsx
├── courses/
├── lessons/
├── paths/
├── assessments/
├── items/
├── grading/
├── workflow/
└── analytics/
(moderation)/
├── layout.tsx
├── queue/
├── reports/
├── appeals/
└── history/
```

```
(admin)/
├── layout.tsx
├── dashboard/
├── members/
├── roles/
├── permissions/
├── branding/
├── domains/
├── entitlements/
```

14 

```
├── certificates/
├── community/
├── analytics/
├── automation/
├── locales/
├── audit/
└── data/
(platform)/
├── layout.tsx
├── tenants/
├── provisioning/
├── entitlements/
├── catalogues/
├── audit/
├── support/
└── health/
```

The directory names above are implementation containers for already-approved screens only. A folder must not contain a page unless the page corresponds to an approved screen ID. 

## **4.3 Protected routes** 

All protected route groups must follow this rendering sequence: 

```
layout.tsx
→ resolve host tenant
→ load tenant branding only if safe
→ check tenant state
→ authenticate session
→ load ACTIVE membership
→ load permission/entitlement-safe navigation
→ render shell
→ render page
```

Forbidden: 

- Rendering protected nav before membership gate 

- Fetching resource data before authorization completes 

- Showing cross-tenant 404 details 

- Rendering tenant-member UI on public-only hosts 

- Hydrating hidden actions and merely hiding them with CSS 

## **4.4 Public routes** 

Public routes may run without ACTIVE membership only if they are in the approved allow-list. 

15 

Public route rules: 

- Host resolution still runs. 

- Tenant state gate still runs. 

- Public branding may load. 

- No member nav renders. 

- No tenant private data loads. 

- Anonymous diagnostic stores only approved anonymous identifiers. 

- Certificate verification exposes minimal public projection only. 

## **4.5 Layout hierarchy** 

```
RootLayout
└── TenantBootstrap
    ├── PublicSiteShell
    ├── AuthShell
    ├── LearnerAppShell
    ├── StudioShell
    ├── ModerationShell
    ├── TenantAdminShell
    └── PlatformConsoleShell
```

## **RootLayout** 

Responsibilities: 

- global HTML 

- global providers 

- Sentry boundary 

- PostHog provider 

- theme base 

- request ID propagation 

- no tenant-specific data rendering 

## **TenantBootstrap** 

Responsibilities: 

- host lookup 

- tenant state evaluation 

- safe branding preload 

- public vs protected gate selection 

## **Shells** 

Each shell owns: 

- navigation shape 

16 

- header 

- responsive behavior 

- loading state 

- permission-safe nav filtering 

- shell-level error boundary 

## **4.6 Tenant-aware layouts** 

Tenant-aware layout input: 

```
interfaceTenantLayoutContext{
tenantId:string;
tenantSlug:string;
tenantState:'ACTIVE';
host:string;
branding:TenantBrandingView;
theme:TenantThemeView;
requestId:string;
}
```

Protected tenant layout extends it: 

```
interfaceProtectedTenantLayoutContextextendsTenantLayoutContext{
actorMembershipId:string;
profile:MemberProfileView;
navPermissions:string[];
entitlementSnapshot:Record<string,boolean>;
}
```

Rules: 

- Branding is loaded by host, not by client-selected tenant. 

- Tenant theme tokens are applied only to tenant shells. 

- Platform shell never inherits tenant theme. 

- Shell navigation is permission and entitlement filtered, but server authorization remains final. 

## **4.7 Data fetching strategy** 

Default hierarchy: 

1. **Server Components** 

2. initial page data 

3. SEO-safe public data 

17 

4. protected screen bootstrap data 

5. stable read-only detail data 

## 6. **Server Actions** 

7. form submissions 

8. mutations initiated from React forms 

9. must call same service layer 

10. must use same validation and authorization rules 

## 11. **Client Components** 

12. interactive runners 

13. swipe practice 

14. assessment runner 

15. rich forms 

16. modals 

17. optimistic UI where safe 

18. local UI state 

## **React Query / TanStack Query** 

## 19. 

20. use only for Client Component server state that must refetch, paginate, mutate, or recover from network loss 

21. do not use for initial protected authorization 

22. do not use to bypass Server Component loaders 

23. do not store permissions as trusted client state 

## **4.8 Server Components** 

Use Server Components for: 

- page shells 

- initial table reads 

- detail pages 

- read-only profile data 

- learner dashboard bootstraps 

- admin dashboards 

- public landing data 

- certificate verification projection 

Do not use Server Components for: 

- swipe gestures 

18 

- assessment timers 

- rich editors 

- file upload progress 

- client-side filters requiring instant interaction 

- optimistic mutations 

## **4.9 Client Components** 

Client Components must be isolated under `_components` . 

Example: 

```
courses/
├── page.tsx
├── [courseId]/
│   ├── page.tsx
│   └── _components/
│       ├── course-action-bar.tsx
│       ├── course-progress-card.tsx
│       └── enrollment-button.tsx
└── _components/
    ├── course-card.tsx
    └── course-filter-bar.tsx
```

Rules: 

- Client Components receive safe view models. 

- Client Components do not receive raw Prisma models. 

- Client Components do not receive global auth principal IDs. 

- Client Components do not construct tenant IDs. 

- Client Components call approved API clients or Server Actions only. 

## **4.10 Server Actions** 

Server Actions may be used for: 

- form submit 

- profile update 

- admin create/update forms 

- workflow transition buttons 

- member invitation forms 

- branding/theme forms 

- moderation actions 

19 

Server Actions must: 

- validate input with Zod 

- use request context 

- call approved service 

- preserve error envelope semantics 

- write audit through service where required 

- trigger outbox through service where required 

- never call Prisma directly from UI route folders 

Example pattern: 

```
'use server';
```

```
exportasyncfunctionsubmitCourseForReviewAction(input:unknown){
constparsed=SubmitCourseForReviewSchema.parse(input);
constctx=awaitbuildActionContext();
```

```
returnexecuteAuthorizedAction({
ctx,
metadata:courseSubmitForReviewMetadata,
input:parsed,
handler:({tx,actor,resource})=>
courseWorkflowService.submitForReview(tx,actor,resource,parsed),
});
}
```

## **4.11 Form architecture** 

All forms use: 

- React Hook Form or equivalent shadcn-compatible form composition 

- Zod schema 

- server-side validation 

- visible labels 

- field-level errors 

- form-level error summary 

- safe disabled state 

- optimistic UI only where rollback is simple and no irreversible mutation occurs 

Folder convention: 

```
_forms/
```

- `├── schema.ts` 

> `├── default-values.ts` 

> `├── form.tsx` 

20 

```
├── fields.tsx
└── actions.ts
```

## **4.12 Error boundaries** 

Each route group must define: 

```
error.tsx
not-found.tsx
loading.tsx
```

Error boundaries must distinguish: 

- validation error 

- auth required 

- no membership 

- membership suspended 

- permission denied 

- ownership denied 

- relationship denied 

- entitlement required 

- tenant unavailable 

- not found without existence leakage 

- conflict/idempotency replay 

- rate limited 

- service unavailable 

## **4.13 Loading boundaries** 

Loading boundaries must not flash protected content. 

Rules: 

- Shell skeleton may show. 

- Tenant private data must not show. 

- Protected navigation must not show until gate completes. 

- Platform shell must not show tenant theme. 

- Tables may show skeleton rows. 

- Forms may show disabled skeleton fields. 

- Learner pages may show motivational placeholders only after membership passes. 

21 

## **5. UI Architecture** 

## **5.1 UI package structure** 

```
packages/design-system/src/
├── tokens/
│   ├── colors.ts
│   ├── typography.ts
│   ├── spacing.ts
│   ├── radius.ts
│   ├── shadows.ts
│   └── density.ts
├── shadcn/
│   ├── button.tsx
│   ├── input.tsx
│   ├── dialog.tsx
│   ├── table.tsx
│   ├── card.tsx
│   ├── dropdown-menu.tsx
│   └── index.ts
├── primitives/
│   ├── text.tsx
│   ├── icon.tsx
│   ├── badge.tsx
│   ├── spinner.tsx
│   ├── skeleton.tsx
│   └── focus-ring.tsx
├── patterns/
│   ├── page-header.tsx
│   ├── data-table.tsx
│   ├── empty-state.tsx
│   ├── error-state.tsx
│   ├── denied-state.tsx
│   ├── entitlement-state.tsx
│   ├── confirmation-dialog.tsx
│   ├── form-section.tsx
│   ├── audit-panel.tsx
│   └── status-badge.tsx
├── shells/
│   ├── public-site-shell.tsx
│   ├── learner-shell.tsx
│   ├── studio-shell.tsx
│   ├── moderation-shell.tsx
│   ├── tenant-admin-shell.tsx
│   └── platform-console-shell.tsx
├── domains/
│   ├── learning/
│   ├── assessment/
```

22 

```
│   ├── community/
```

- `│   ├── certificates/` 

```
│   ├── analytics/
│   └── admin/
└── index.ts
```

## **5.2 shadcn usage rules** 

shadcn components are base primitives, not product components. 

Rules: 

- Do not edit generated shadcn files directly unless the design-system process requires it. 

- Wrap shadcn components in Atlas primitives/patterns. 

- Domain components use Atlas patterns, not raw shadcn where possible. 

- Styling must use Tailwind tokens. 

- No hardcoded tenant colors. 

- No platform shell theming from tenant tokens. 

- Destructive actions use confirmation pattern. 

- Permission denied and entitlement required states are visually distinct. 

## **5.3 Component hierarchy** 

```
shadcn base
```

```
→ primitives
```

- `→ patterns` 

- `→ domain components` 

- `→ screen composition` 

## **shadcn base** 

Examples: 

- Button 

- Input 

- Dialog 

- Dropdown 

- Table 

- Card 

Purpose: accessible base components. 

23 

## **primitives** 

Examples: 

- Badge 

- Text 

- Spinner 

- Skeleton 

- Icon 

- FocusRing 

Purpose: reusable atom-level behavior. 

## **patterns** 

Examples: 

- DataTable 

- EmptyState 

- DeniedState 

- EntitlementRequiredState 

- ConfirmationDialog 

- PageHeader 

- FormSection 

- AuditPanel 

Purpose: cross-domain UI patterns. 

## **domain components** 

Examples: 

- CourseCard 

- LessonPlayerFrame 

- AssessmentRunnerShell 

- SwipeCard 

- CertificateVerificationCard 

- CommunityPostCard 

- ModerationEvidencePanel 

Purpose: approved engine-specific UI composition. 

## **screens** 

Pages assemble domain components according to Wireframes v1 only. 

24 

## **6. State Management Strategy** 

## **6.1 Server state** 

Server state is data owned by the backend. 

Examples: 

- courses 

- lessons 

- attempts 

- memberships 

- roles 

- permissions 

- certificates 

- community posts 

- audit entries 

- analytics snapshots 

Default handling: 

- Server Components for initial load 

- API route + React Query only for Client Component interactions 

- no duplicated global store 

- cache invalidation after mutation 

- server remains source of truth 

## **6.2 Client state** 

Client state is temporary UI-only state. 

Examples: 

- open/closed modal 

- active tab 

- unsaved form visibility 

- swipe drag position 

- selected table rows 

- local filter input before submit 

- toast visibility 

Use: 

- `useState` 

- `useReducer` 

- URL state where shareable 

- 

- component-local context only inside bounded interactive components 

25 

Do not use client state for: 

- permissions 

- tenant identity 

- entitlements 

- membership status 

- audit state 

- source-of-truth progress 

- source-of-truth scoring 

## **6.3 React Query strategy** 

React Query is used only for client-side server state that needs: 

- refetch 

- pagination 

- mutation status 

- optimistic update with rollback 

- background refresh 

- interactive runner state 

- infinite scroll where approved 

Examples: 

- community feed pagination 

- notification dropdown refresh 

- swipe practice response submission 

- assessment runner autosave where approved 

- admin tables with filters 

- moderation queue refresh 

Rules: 

- Query keys must include resource scope, never tenant ID from client input. 

- Query functions call approved API clients. 

- Authorization failures clear sensitive cached data. 

- Permission and entitlement state are display hints only. 

- Server remains final authority. 

- Mutations must handle error envelopes. 

- Idempotent mutations must include `Idempotency-Key` . 

Query key pattern: 

```
['courses','list',{cursor,filters,sort}]
['course',courseId]
['attempt',attemptId]
['community-posts',spaceId,{cursor}]
['moderation-queue',{status,cursor}]
```

26 

## **6.4 URL state** 

Use URL state for: 

- table filters 

- search query 

- cursor 

- sort 

- tab where deep-linking is useful 

- admin console views 

Do not use URL state for: 

- tenant ID 

- actor ID 

- hidden permission data 

- entitlement override 

- sensitive tokens after exchange 

## **6.5 Form state** 

Forms use local form state plus server validation. 

Rules: 

- Zod schema is shared between client and server where safe. 

- Server revalidates every submission. 

- Validation errors map to fields. 

- Mutation success invalidates relevant queries or revalidates route data. 

- Irreversible actions require confirmation and audit context. 

## **7. Backend Architecture** 

## **7.1 Backend layers** 

```
Route Handler / Server Action
```

- `→ Route Metadata` 

- `→ Context Builder` 

- `→ Tenant Resolution` 

- `→ Tenant State Gate` 

- `→ Authentication` 

- `→ Membership Gate` 

- `→ withTenantTx` 

- `→ Entitlement Gate` 

27 

```
→ Resource Loader
```

- `→ can() → Service → Repository → Prisma → Audit → Outbox → Response Envelope` 

## **7.2 Route handlers** 

Route handlers live in: 

```
apps/web/src/app/api/v1/
```

Responsibilities: 

- parse request 

- attach request ID 

- apply rate limit 

- validate body/query/path 

- declare route metadata 

- call route wrapper 

- return response envelope 

Route handlers must not: 

- directly call Prisma 

- bypass route metadata 

- implement authorization ad hoc 

- send email directly 

- update search directly 

- write audit outside service transaction 

- trust `tenant_id` from body/query/header 

## **7.3 Service layer** 

Services live in: 

```
packages/domain/<context>/services/
```

Responsibilities: 

- implement approved use cases 

- receive authorized context 

28 

- call repositories • enforce state transitions supported by locked workflows 

- write audit where required 

- publish outbox events where required • return safe view models 

Services do not: 

- authenticate users 

- resolve tenants from host 

- parse HTTP requests 

- format HTTP errors 

- bypass `can()` 

- query foreign context tables directly 

## **7.4 Authorization layer** 

Lives in: 

```
packages/authorization/
```

Exports: 

```
can()
enforceEntitlement()
createResourceLoader()
assertRouteMetadata()
assertPlatformRole()
```

Rules: 

- `can()` is the only actor permission decision point. 

- `enforceEntitlement()` is the only entitlement decision point. 

- Ownership and relationship checks are resolved inside `can()` . 

- Route handlers cannot implement role checks directly. 

- UI permission checks are only display hints. 

## **7.5 Entitlement layer** 

Entitlements are tenant capability checks. 

Flow: 

- `route metadata has entitlement key → enforceEntitlement(tenantId, key)` 

29 

- `→ read active entitlements row` 

- `→ cache result with invalidation` 

- `→ pass or throw ENTITLEMENT_REQUIRED` 

- `→ only then call can()` 

Rules: 

- Never check plan names. 

- Never hardcode tenant packages. 

- Missing entitlement returns `ENTITLEMENT_REQUIRED` 

. 

- Existing data is preserved; route behavior follows approved entitlement rules. 

## **7.6 Validation layer** 

Validation lives in: 

```
packages/domain/<context>/schemas/
packages/validation/
```

Rules: 

- Request path params validate. 

- Query params validate. 

- Body validates. 

- Response validates in tests and optionally in development. 

- Event payloads validate. 

- Worker payloads validate. 

- Environment variables validate at boot. 

## **7.7 Repository layer** 

Repositories live in: 

```
packages/domain/<context>/repositories/
```

Rules: 

- Accept `tx: Prisma.TransactionClient` . 

- Never create their own Prisma client. 

- 

- Never open independent transactions. 

- 

- Never accept client-supplied tenant ID. 

- 

- Use tenant context already set by `withTenantTx` . 

- 

- Return domain records or persistence models, not HTTP responses. 

- Avoid cross-context writes. 

30 

Example: 

```
exportasyncfunctionfindCourseById(
tx:Prisma.TransactionClient,
id:string
){
returntx.course.findUnique({
where:{id},
});
}
```

RLS supplies tenant isolation; repositories may still include tenant-leading indexed filters where required for performance, but not from client-supplied tenant IDs. 

## **7.8 Exact request lifecycle** 

```
Request
  ↓
Generate / read requestId
  ↓
Resolve host → tenant
  ↓
Tenant state gate
  ↓
Rate limit bucket
  ↓
Authenticate via Supabase Auth
  ↓
Resolve auth_principal
  ↓
Membership gate: ACTIVE membership required
  ↓
Open withTenantTx(ctx)
  ↓
Set transaction-local:
  - app.tenant_id
  - app.actor_membership_id
  - app.request_id
  ↓
Validate entitlement if route declares one
  ↓
Load ResourceRef through route resourceLoader
  ↓
can(actor, permission, resourceRef, ctx)
  ↓
Service
  ↓
```

31 

```
Repository / Prisma
  ↓
Audit entry in same transaction where required
  ↓
Outbox event in same transaction where required
  ↓
Commit
  ↓
Return success envelope
```

## **8. API Architecture** 

## **8.1 API folder structure** 

```
apps/web/src/app/api/
├── health/
│   └── route.ts
└── v1/
    ├── public/
    │   ├── landing/
    │   ├── diagnostic/
    │   ├── auth/
    │   ├── invitations/
    │   └── verify/
    ├── me/
    ├── members/
    ├── roles/
    ├── permission-overrides/
    ├── entitlements/
    ├── branding/
    ├── domains/
    ├── courses/
    ├── lessons/
    ├── paths/
    ├── items/
    ├── assessments/
    ├── attempts/
    ├── practice-sessions/
    ├── competency/
    ├── readiness/
    ├── workflows/
    ├── certificates/
    ├── gamification/
    ├── community/
```

```
    ├── moderation/
```

```
    ├── notifications/
```

32 

```
    ├── search/
    ├── analytics/
    ├── automation/
    ├── locales/
    ├── extensions/
    ├── data/
    ├── internal/
    │   └── outbox/
    └── platform/
        ├── tenants/
        ├── provisioning/
        ├── entitlements/
        ├── catalogues/
        ├── audit/
        ├── support/
        └── health/
```

This is an implementation folder map for approved API groups only. If API Inventory v1 does not list a concrete route, no `route.ts` is created for it. 

## **8.2 Route metadata** 

Every route exports metadata: 

```
exportconstrouteMetadata={
permission:'course.read',
entitlement:undefined,
resourceLoader:loadCourseResourceRef,
audit:'none',
rateLimit:'authenticatedTenantRead',
idempotency:'none',
}satisfiesRouteMetadata;
```

Public route example: 

```
exportconstrouteMetadata={
public:true,
permission:'pub',
rateLimit:'publicRead',
idempotency:'none',
}satisfiesPublicRouteMetadata;
```

Mutation example: 

33 

```
exportconstrouteMetadata={
permission:'attempt.submit',
resourceLoader:loadAttemptResourceRef,
audit:'required',
rateLimit:'authenticatedTenantWrite',
idempotency:'required',
}satisfiesRouteMetadata;
```

## **8.3 Route wrapper** 

```
exportfunctioncreateTenantRoute<TInput,TOutput>(config:{
metadata:RouteMetadata;
input:z.ZodType<TInput>;
output:z.ZodType<TOutput>;
handler:(args:{
ctx:TenantRequestContext;
tx:Prisma.TransactionClient;
input:TInput;
resource:ResourceRef;
})=>Promise<TOutput>;
```

```
}){
returnasyncfunctionroute(req:NextRequest,params:unknown){
constrequestId=getOrCreateRequestId(req);
```

```
try{
```

```
constresolved=awaitresolveTenantFromRequest(req);
assertTenantActive(resolved.tenant);
```

```
awaitrateLimit(req,config.metadata.rateLimit,resolved.tenant);
```

```
constauth=awaitauthenticate(req);
constmembership=awaitrequireActiveMembership(resolved.tenant.id,
auth.principalId);
```

```
constctx=createTenantRequestContext({
requestId,
tenant:resolved.tenant,
auth,
membership,
});
```

```
constinput=config.input.parse(awaitreadInput(req,params));
```

```
returnawaitwithTenantTx(ctx,async(tx)=>{
if(config.metadata.entitlement){
awaitenforceEntitlement(ctx.tenantId,
config.metadata.entitlement);
```

34 

```
}
constresource=awaitconfig.metadata.resourceLoader(tx,ctx,
input);
constdecision=awaitcan(ctx,config.metadata.permission,
resource,ctx);
if(!decision.allowed)throwtoAuthorizationError(decision);
constresult=awaitconfig.handler({ctx,tx,input,resource});
constoutput=config.output.parse(result);
returnjsonOk(output,requestId);
});
}catch(error){
returnjsonError(toApiError(error,requestId));
}
};
}
```

## **8.4 Error envelopes** 

All non-2xx responses: 

```
{
"error":{
"code":"PERMISSION_DENIED",
"message":"You do not have access to perform this action.",
"requestId":"018f4d2e-..."
}
}
```

Rules: 

- Messages are safe. 

- No cross-tenant existence leakage. 

- Validation errors may include field paths. 

- Internal errors do not expose stack traces. 

- Request ID always appears. 

## **8.5 Pagination standard** 

Cursor pagination only. 

Request: 

35 

```
?cursor=<opaqueCursor>&limit=25
```

Response: 

```
interfaceCursorPage<T>{
items:T[];
pageInfo:{
nextCursor:string|null;
hasNextPage:boolean;
};
}
```

Rules: 

- default limit: 25 

- maximum limit: 100 unless route-specific lower limit 

- cursor is opaque 

- cursor must encode approved indexed sort fields only 

- offset pagination is not used for large tenant data 

## **8.6 Filtering standard** 

Filters are explicit per route. 

Example: 

```
?status=PUBLISHED&query=basics
```

Rules: 

- only indexed filters are accepted 

- unknown filters return `VALIDATION_ERROR` 

- filters must not include tenant ID 

- filters are validated with Zod 

- full-text search goes through approved search API, not ad hoc table scans 

## **8.7 Sorting standard** 

Format: 

```
?sort=updated_at:desc
```

36 

Rules: 

- sort fields are allow-listed per route 

- sort fields must be indexed 

- unindexed sort returns `VALIDATION_ERROR` 

- default sort is resource-specific natural order 

- no arbitrary SQL sort injection 

## **8.8 Idempotency strategy** 

Mutating routes backed by idempotency constraints require: 

```
Idempotency-Key: <stable-client-generated-key>
```

Rules: 

- required for approved idempotent mutations 

- key is scoped by tenant 

- replay returns original result 

- key is persisted inside `withTenantTx` 

- collisions across tenants are impossible by constraint design 

- missing key returns `VALIDATION_ERROR` • duplicate conflicting body returns `CONFLICT` 

Helper: 

```
awaitrequireIdempotencyKey(req,metadata);
awaitidempotencyService.execute(tx,{
key,
scope:ctx.tenantId,
operation:'attempt.submit',
handler:()=>submitAttempt(...),
});
```

## **9. Authorization Architecture** 

## **9.1** **`can()` contract** 

```
typeResourceRef=
|{type:string;id:string}
|{type:string;id:null};
```

```
interfaceTenantContext{
tenantId:string;
```

37 

```
actorMembershipId:string;
tenantState:'ACTIVE';
requestId:string;
}
interfaceDecision{
allowed:boolean;
reason:
|'OK'
|'PERMISSION_DENIED'
|'OWNERSHIP_DENIED'
|'RELATIONSHIP_DENIED'
|'NO_MEMBERSHIP'
|'TENANT_STATE';
audit?:boolean;
}
```

`can()` order: 

1. Confirm actor membership is ACTIVE. 

2. Build effective permissions: 

3. role permissions 

4. allow overrides 5. deny overrides 6. deny wins 7. Require permission key. 

8. Resolve ownership predicate where required. 

9. Resolve relationship predicate where required. 

10. Confirm tenant state. 11. Return audit flag for sensitive allow/deny. 

`can()` does not perform entitlement checks. 

## **9.2 Resource loaders** 

Resource loaders return `ResourceRef` . 

Example: 

```
exportasyncfunctionloadCourseResourceRef(
tx:Prisma.TransactionClient,
ctx:TenantContext,
input:{courseId:string}
):Promise<ResourceRef>{
constcourse=awaittx.course.findUnique({
```

38 

```
where:{id:input.courseId},
select:{id:true},
});
if(!course)thrownewNotFoundError();
return{type:'course',id:course.id};
}
```

Rules: 

• Resource loader runs inside `withTenantTx` . • RLS prevents cross-tenant loads. • Missing resource returns safe 404. • Owned/related resource types must have loaders. • Create actions use `{ type, id: null }` . 

## **9.3 Ownership checks** 

Ownership checks are registered per resource type. 

Example: 

```
constownershipPredicates={
item:async({tx,actor,resource})=>{
constitem=awaittx.assessmentItem.findUnique({
where:{id:resource.id},
select:{author_membership_id:true},
});
returnitem?.author_membership_id===actor.actorMembershipId;
},
};
```

Rules: 

- ownership is inside `can()` 

- route handler does not duplicate it 

- admin/owner bypass is tenant-scoped only 

- sensitive bypass writes audit 

## **9.4 Relationship checks** 

Relationship examples: 

- instructor assigned to course 

39 

- learner enrolled in course 

- moderator assigned to community space 

- grader assigned to attempt 

- member belongs to private space 

Rules: 

- relationship check lives inside `can()` 

- relationship is loaded through tenant-scoped tx 

- failure returns `RELATIONSHIP_DENIED` 

- no existence leakage 

## **9.5 Platform scope** 

Platform routes use separate flow: 

```
Request
```

- `→ authenticate principal` 

- `→ assert platform role` 

- `→ require reason where needed` 

- `→ withPlatformScope(ctx, reason)` 

- `→ set app.platform_scope transaction-locally` 

- `→ set app.tenant_id when touching tenant data` 

- `→ write platform.scope.enter audit` 

- `→ service` 

- `→ write platform.scope.exit audit` 

- `→ commit` 

Rules: 

- platform roles are never tenant roles 

- platform permissions never appear in tenant role seeds 

- tenant routes cannot import platform Prisma client 

- tenant routes cannot set platform scope 

- platform shell is physically isolated 

- every cross-tenant action requires reason and audit 

## **10. Database Architecture** 

## **10.1 Prisma folder structure** 

```
prisma/
```

- `├── schema.prisma` 

- `├── models/` 

- `│   ├── tenancy.prisma` 

40 

```
│   ├── identity.prisma
│   ├── access.prisma
│   ├── config.prisma
│   ├── learning.prisma
│   ├── assessment.prisma
│   ├── competency.prisma
│   ├── workflow.prisma
│   ├── certification.prisma
│   ├── community.prisma
│   ├── analytics.prisma
│   ├── eventing.prisma
│   └── audit.prisma
├── migrations/
├── sql/
│   ├── rls/
│   ├── grants/
│   ├── triggers/
│   ├── indexes/
│   ├── functions/
│   └── policies/
├── seeds/
│   ├── 00-permissions.ts
```

```
│   ├── 01-roles.ts
```

```
│   ├── 02-feature-flags.ts
```

```
│   ├── 03-entitlements.ts
```

```
│   ├── 04-item-types.ts
```

```
│   ├── 05-extension-points.ts
```

- `│   ├── 06-workflows.ts` 

- `│   ├── 07-demo-tenants.ts` 

- `│   └── index.ts └── generated/` 

If Prisma does not support split model files directly in the selected setup, `schema.prisma` remains the generated concatenation target. The logical model files still exist for maintainability. 

## **10.2 Migration strategy** 

Migration order: 

1. Global tables 

2. Tenant root tables 

3. Tenant-scoped tables 

4. Append-only tables 

5. Derived projection tables 

6. Indexes 

7. RLS helper functions 

8. RLS policies 

9. Grants 

41 

10. Append-only triggers 

11. Audit hash-chain triggers 

12. Idempotency constraints 

13. Seed catalogue data 

14. Tenant provisioning smoke seed 

15. RLS/IDOR test harness 

Rules: 

- Prisma migrations create supported schema. 

- Raw SQL migrations create RLS, grants, triggers, partial indexes, functions, hash-chain, and append-only enforcement. 

- No session-level tenant `SET` 

   - . 

- Migrations are tested locally and in staging before production. 

- Production migration includes backup and rollback plan. 

- Destructive migrations require explicit CTO approval. 

## **10.3 Seed strategy** 

Seeds are deterministic. 

Seed categories: 

- permission catalogue 

- permission bundles 

- system roles 

- role permissions 

- feature flags 

- entitlement keys 

- item-type registry 

- first-party extension points 

- workflow templates 

- FundedBeyond tenant config 

- second smoke-test tenant config 

Rules: 

- system seed IDs are stable 

- seeds are idempotent 

- no platform roles enter tenant role tables 

- no FundedBeyond-specific code is seeded 

- tenant-specific data is inserted through provisioning saga where required 

- smoke-test tenant verifies no fork 

## **10.4 RLS implementation** 

Tenant tables enforce: 

42 

```
tenant_id=app.current_tenant_id()
```

Required helper: 

```
createorreplacefunctionapp.current_tenant_id()
returnsuuid
languagesql
stable
as$$
selectnullif(current_setting('app.tenant_id',true),'')::uuid
$$;
```

Policy pattern: 

```
altertablecoursesenablerowlevelsecurity;
createpolicycourses_tenant_isolation
oncourses
using(tenant_id=app.current_tenant_id())
withcheck(tenant_id=app.current_tenant_id());
```

Rules: 

- RLS enabled on tenant tables. 

- Append-only tables also enforce tenant isolation where tenant-related. 

- Global catalogues use grants, not tenant RLS. 

- Platform scope uses separate policies and DB role. 

- RLS is tested under transaction-mode pooling. 

## **10.5** **`withTenantTx()`** 

```
exportasyncfunctionwithTenantTx<T>(
ctx:TenantRequestContext,
fn:(tx:Prisma.TransactionClient)=>Promise<T>
):Promise<T>{
if(!ctx.tenantId)thrownewError('Missing tenant context');
if(!ctx.actorMembershipId&&!ctx.allowAnonymousTenantRead){
thrownewError('Missing membership context');
}
returnprisma.$transaction(async(tx)=>{
awaittx.$executeRaw`
      select set_config('app.tenant_id', ${ctx.tenantId}, true)
    `;
```

43 

```
awaittx.$executeRaw`
      select set_config('app.actor_membership_id', $
{ctx.actorMembershipId??''}, true)
    `;
awaittx.$executeRaw`
      select set_config('app.request_id', ${ctx.requestId}, true)
    `;
returnfn(tx);
});
}
```

Forbidden: 

- Prisma outside `withTenantTx` for tenant data 

- session-level `SET app.tenant_id` 

- Supabase service role for tenant request data 

- client-supplied tenant ID in writes 

- raw SQL outside tenant tx or platform scope 

## **10.6** **`withPlatformScope()`** 

```
exportasyncfunctionwithPlatformScope<T>(
ctx:PlatformContext,
reason:string,
fn:(tx:Prisma.TransactionClient)=>Promise<T>
):Promise<T>{
assertPlatformOperator(ctx);
if(!reason||reason.trim().length<10){
thrownewError('Platform-scope reason required');
}
returnplatformPrisma.$transaction(async(tx)=>{
awaittx.$executeRaw`
      select set_config('app.platform_scope', 'true', true)
    `;
awaittx.$executeRaw`
      select set_config('app.platform_actor_id', ${ctx.principalId}, true)
    `;
awaittx.$executeRaw`
      select set_config('app.request_id', ${ctx.requestId}, true)
    `;
awaitauditPlatformScopeEnter(tx,ctx,reason);
```

44 

```
try{
constresult=awaitfn(tx);
awaitauditPlatformScopeExit(tx,ctx,reason,'success');
returnresult;
}catch(error){
awaitauditPlatformScopeExit(tx,ctx,reason,'failure');
throwerror;
}
});
}
```

Rules: 

- separate DB role 

- separate Prisma client 

- mandatory reason 

- enter/exit audit 

- no tenant route imports 

- no reusable platform tx in tenant code 

## **11. Eventing Architecture** 

## **11.1 Outbox pattern** 

All side effects use outbox. 

Mutation transaction: 

```
Service mutation
→ write domain state
→ write audit if required
→ write outbox_events row
→ commit
```

Worker: 

- `Poll outbox_events → claim event` 

- `→ validate payload schema_version` 

- `→ process → write event_deliveries` 

- `→ mark delivered or retry` 

- `→ dead-letter after threshold` 

45 

## **11.2 Event publishing** 

Publisher API: 

```
exportasyncfunctionpublishOutboxEvent<TPayload>(tx:
Prisma.TransactionClient,event:{
tenantId?:string;
name:string;
schemaVersion:number;
aggregateType:string;
aggregateId:string;
payload:TPayload;
idempotencyKey?:string;
}){
OutboxEventPayloadSchema.parse(event.payload);
returntx.outboxEvent.create({
data:{
tenant_id:event.tenantId,
name:event.name,
schema_version:event.schemaVersion,
aggregate_type:event.aggregateType,
aggregate_id:event.aggregateId,
payload_json:event.payload,
idempotency_key:event.idempotencyKey,
},
});
}
```

Rules: 

- only inside transaction 

- payload schema version required 

- no direct side effect instead of event 

- idempotency where required 

- tenant_id included where tenant-related 

## **11.3 Event processing** 

Worker package: 

```
packages/events/src/workers/
```

- `├── outbox-worker.ts` 

- `├── processors/` 

- `│   ├── notification.processor.ts` 

- `│   ├── search-index.processor.ts` 

- `│   ├── analytics-rollup.processor.ts` 

46 

```
│   ├── competency-rollup.processor.ts
```

- `│   └── audit-export.processor.ts ├── retry-policy.ts └── dead-letter.ts` 

Processing rules: 

- processor validates event name 

- processor validates payload schema version 

- processor runs idempotently 

- processor writes `event_deliveries` 

- processor never assumes tenant from payload without setting tx context 

- tenant processors use `withTenantTx` 

- platform processors use platform scope only if approved 

## **11.4 Dead-letter handling** 

Dead-letter after configured retry threshold. 

Dead-letter record includes: 

- event ID 

- tenant ID where applicable 

- event name 

- aggregate 

- payload hash 

- failure reason 

- retry count 

- last error 

- created timestamp 

Admin/platform visibility follows approved screens and permissions only. 

## **11.5 Replay strategy** 

Replay is controlled and audited. 

Rules: 

- replay does not mutate original outbox event 

- replay writes delivery attempt 

- replay requires platform scope or approved tenant admin operation where applicable 

- replay reason is required 

- replay is idempotent 

- replay does not bypass schema validation 

47 

## **11.6 Flow diagrams** 

## **Mutation with outbox** 

```
API / Server Action
  ↓
withTenantTx
  ↓
Service
  ├─ Domain table write
  ├─ Audit write
  └─ Outbox write
  ↓
Commit
  ↓
Worker later processes side effect
```

## **Worker flow** 

```
Worker tick
  ↓
Claim pending event
  ↓
Validate payload
  ↓
Set tenant/platform context
  ↓
Run processor
  ↓
Write delivery result
  ↓
Success or retry/dead-letter
```

## **12. Storage Architecture** 

## **12.1 Cloudflare R2 structure** 

Bucket structure: 

```
r2://atlas-assets/
├── tenants/
│   └── {tenantId}/
│       ├── branding/
│       │   ├── logos/
```

48 

```
│       │   └── favicons/
│       ├── courses/
│       │   └── {courseId}/
│       ├── lessons/
│       │   └── {lessonId}/
│       ├── community/
│       │   └── {spaceId}/
│       ├── certificates/
│       │   └── templates/
│       ├── exports/
│       │   └── {exportJobId}/
│       └── temp/
│           └── uploads/
└── platform/
    ├── seed-assets/
    └── diagnostics/
```

Rules: 

- R2 key includes tenant ID for tenant assets. 

- Asset metadata is stored in approved tables only. 

- R2 object existence is not authorization. 

- Signed URLs are short-lived. 

- No public bucket for protected tenant content. 

- Video is not self-hosted; store provider references only. 

## **12.2 Asset organization** 

Asset reference model: 

```
interfaceAssetRef{
tenantId:string;
bucket:string;
key:string;
contentType:string;
sizeBytes:number;
checksum:string;
visibility:'private'|'public-safe';
}
```

Rules: 

- store references, not binary in Postgres 

- validate MIME 

- validate size 

- virus/media scanning hooks where approved 

- public-safe assets are still resolved through tenant context 

49 

## **12.3 Upload flow** 

```
Client requests upload
```

- `→ API validates auth/membership/permission/entitlement` 

- `→ service creates pending asset reference` 

- `→ signed R2 upload URL returned` 

- `→ client uploads to R2` 

- `→ client confirms upload` 

- `→ API verifies object metadata/checksum` 

- `→ asset reference marked ready` 

- `→ audit/outbox where required` 

Rules: 

- client cannot choose arbitrary R2 key 

- key generated server-side 

- upload URL expires quickly 

- tenant prefix enforced 

- 

- confirmation verifies object before use 

- 

## **12.4 Download flow** 

```
Client requests asset
```

- `→ API resolves tenant from host` 

- `→ auth/membership where protected` 

- `→ can() for resource` 

- `→ service validates asset belongs to resource` 

- `→ signed R2 download URL returned` 

Rules: 

- signed URL expires quickly 

- protected files are never served by static public URL 

- export files require data export permission 

- certificate verification exposes only approved public projection 

## **12.5 Security rules** 

Forbidden: 

- storing secrets in R2 

- storing plaintext private keys 

- public bucket for protected content 

- user-controlled object keys 

50 

- video file hosting for lessons • bypassing permission checks for downloads 

## **13. Authentication Architecture** 

## **13.1 Supabase Auth integration** 

Supabase Auth is the authentication provider. 

Atlas stores: 

- global auth principal bridge 

- tenant memberships 

- tenant profiles 

Rules: 

- Supabase user ID maps to `auth_principals` . 

- Tenant code uses `memberships` and `member_profiles` . 

- Tenant APIs do not expose global principal ID. 

- Auth alone never grants tenant access. 

- ACTIVE membership is required for protected routes. 

## **13.2 Session handling** 

Session flow: 

```
Request cookie/JWT
```

- `→ Supabase session validation` 

- `→ auth_principal lookup` 

- `→ tenant membership lookup` 

- `→ ACTIVE membership required` 

- `→ actor context built from membership` 

Rules: 

- stale tokens are not trusted 

- membership rechecked per request 

- session revocation must affect admin/platform sessions 

- admin MFA required before production traffic 

- platform sessions are separately gated 

51 

## **13.3 User provisioning** 

Signup: 

```
Public signup
→ Supabase user
→ auth_principal
```

- `→ tenant membership according to approved signup/invite behavior → member_profile` 

- `→ audit/outbox where required` 

Invitation: 

```
Admin invites member
→ invitation created
→ notification event
```

```
→ invite accept
→ Supabase auth/session
→ membership ACTIVE
→ profile created/updated
```

Rules: 

- invitation acceptance does not bypass tenant host 

- invited state cannot access protected app before acceptance 

- removed users require re-invite 

- suspended users remain blocked 

## **13.4 Membership validation** 

Membership states: 

- ACTIVE → protected access may continue 

- INVITED → invite acceptance only 

- SUSPENDED → blocked 

- REMOVED → blocked 

- no row → public only 

Middleware must distinguish these states with safe error codes and UI states. 

52 

## **14. Multi-Tenant Architecture** 

## **14.1 Tenant resolution** 

Resolution order: 

```
Host
```

- `→ custom domain match → subdomain match` 

- `→ tenant_domains → tenant → tenant state` 

Rules: 

- host is authoritative 

- client-supplied tenant ID ignored 

- JWT tenant claim never overrides host 

- unknown host returns safe tenant-not-found behavior 

- inactive tenant routes to approved unavailable state 

## **14.2 Custom domains** 

Custom domain flow: 

```
Tenant admin submits domain
```

- `→ validate permission + entitlement` 

- `→ create domain record pending verification` 

- `→ DNS instructions shown` 

- `→ verification job checks DNS` 

- `→ domain ACTIVE when valid` 

- `→ audit + outbox` 

Rules: 

- custom domain requires entitlement where approved 

- DNS state is tenant scoped 

- domain collision blocked 

- platform support may inspect with reason-bound scope 

53 

## **14.3 Subdomains** 

Subdomain rules: 

- unique platform-wide 

- mapped through `tenant_domains` 

- no direct tenant ID in URL 

- reserved subdomains blocked by validation 

- tenant state gate applies the same way as custom domains 

## **14.4 Branding loading** 

Branding source: 

```
host → tenant → tenant_branding + tenant_theme + tenant_config
```

Rules: 

- branding is tokenized 

- no hardcoded FundedBeyond branding 

- public shell can load safe branding 

- protected branding loads only after safe tenant resolution 

- platform shell does not inherit tenant branding 

## **14.5 Runtime tenant context** 

```
interfaceRuntimeTenantContext{
```

```
tenantId:string;
host:string;
domainId:string;
tenantState:'ACTIVE';
branding:TenantBrandingView;
theme:TenantThemeView;
configVersion:string;
requestId:string;
```

```
}
```

Protected extension: 

- `interface RuntimeActorContext extends RuntimeTenantContext { actorMembershipId: string;` 

```
profileId:string;
```

54 

```
roles:string[];
}
```

## **14.6 Middleware flow** 

```
middleware.ts
  ↓
read host
  ↓
resolve tenant domain
  ↓
if unknown → A10 / safe 404
  ↓
if inactive → A10 / 503 / safe blocked state
  ↓
attach tenant headers internally
  ↓
continue to route group
```

Middleware must not authorize business actions alone. It only prepares safe routing context. 

## **15. Frontend Module Structure** 

All modules follow this pattern: 

```
_module/
├── page.tsx
├── loading.tsx
├── error.tsx
├── _components/
├── _forms/
├── _actions/
├── _queries/
├── _types/
└── _mappers/
```

Rules: 

- `_queries` call API clients or server loaders, not Prisma directly. 

- `_actions` call Server Actions wrapping services. 

- `_components` are screen-local. 

- 

- reusable components go to design-system. 

- 

- no module creates unapproved screens. 

55 

## **15.1 Courses** 

```
(learner)/courses/
├── page.tsx
├── [courseId]/
│   ├── page.tsx
│   └── _components/
└── _components/
(studio)/courses/
├── page.tsx
├── new/page.tsx
├── [courseId]/
│   ├── page.tsx
│   ├── edit/page.tsx
│   └── _components/
└── _forms/
```

Only approved course screens may be implemented. 

## **15.2 Lessons** 

```
(learner)/lessons/
└── [lessonId]/
    ├── page.tsx
    ├── loading.tsx
    └── _components/
        ├── lesson-player-shell.tsx
        ├── lesson-progress-panel.tsx
        └── lesson-next-action.tsx
(studio)/lessons/
├── page.tsx
├── [lessonId]/
│   ├── edit/page.tsx
│   └── _forms/
└── _components/
```

Rules: 

- lesson video stores provider references only 

- progress updates use approved APIs 

- no self-hosted video upload 

56 

## **15.3 Assessments** 

```
(learner)/assessments/
├── page.tsx
├── [assessmentId]/
│   ├── page.tsx
│   └── attempt/
│       └── [attemptId]/page.tsx
└── _components/
    ├── assessment-card.tsx
    ├── attempt-runner.tsx
    └── result-summary.tsx
(studio)/assessments/
├── page.tsx
├── [assessmentId]/
│   ├── page.tsx
│   ├── edit/page.tsx
│   └── items/page.tsx
└── _forms/
```

Rules: 

- item registry drives item rendering 

- swipe is item/practice type on generic engines 

- grading uses approved workflow and permissions 

## **15.4 Community** 

```
(learner)/community/
├── page.tsx
├── spaces/
│   └── [spaceId]/page.tsx
├── posts/
│   └── [postId]/page.tsx
└── _components/
    ├── community-feed.tsx
    ├── post-card.tsx
    └── comment-thread.tsx
```

```
(admin)/community/
├── page.tsx
└── _components/
```

```
(moderation)/
├── queue/page.tsx
```

57 

```
├── reports/page.tsx
├── appeals/page.tsx
└── history/page.tsx
```

Rules: 

- community entitlement gate applies where required 

- moderation actions are audited 

- financial-advice risk copy/policy remains controlled by content/config, not code fork 

## **15.5 Competency** 

```
(learner)/readiness/
├── page.tsx
└── _components/
    ├── competency-breakdown.tsx
    ├── readiness-summary.tsx
    └── next-best-action.tsx
(studio)/analytics/
└── competency/
    └── page.tsx
```

Rules: 

- competency dimensions are configuration 

- scoring writes signals through generic engine 

- no FundedBeyond-only scoring tables 

## **15.6 Readiness** 

```
(learner)/readiness/
├── page.tsx
├── history/page.tsx
└── _components/
    ├── readiness-score-card.tsx
    ├── readiness-dimension-card.tsx
    ├── readiness-disclaimer.tsx
    └── attributed-cta-button.tsx
```

Rules: 

- readiness is educational signal only 

- no financial advice framing 

- no guaranteed passing/profit language 

58 

- CTA is outbound attributed redirect only 

- no challenge checkout 

## **15.7 Swipe** 

```
(learner)/practice/
├── page.tsx
├── swipe/
│   └── [sessionId]/page.tsx
└── _components/
    ├── swipe-runner.tsx
    ├── swipe-card.tsx
    ├── swipe-feedback.tsx
    └── practice-summary.tsx
```

Rules: 

- swipe uses generic practice/item registry 

- responses are idempotent where required 

- signals flow to competency through approved event/scoring path 

## **15.8 Certificates** 

```
(learner)/certificates/
├── page.tsx
└── [credentialId]/page.tsx
(public)/verify/
└── [credentialId]/page.tsx
(admin)/certificates/
├── page.tsx
├── templates/
└── issued/
```

Rules: 

- public verification exposes minimal projection 

- 

- issue/revoke requires permission, entitlement, audit • certificate templates are tenant config/content 

59 

## **15.9 Analytics** 

```
(studio)/analytics/
├── page.tsx
├── learning/page.tsx
├── assessment/page.tsx
└── readiness/page.tsx
```

```
(admin)/analytics/
├── page.tsx
└── exports/page.tsx
```

Rules: 

- advanced analytics entitlement applies where approved 

- dashboards read projections 

- heavy rollups happen through event workers 

- no ad hoc cross-context SQL in UI 

## **15.10 Administration** 

```
(admin)/
├── dashboard/
├── members/
├── roles/
├── permissions/
├── branding/
├── domains/
├── entitlements/
├── automation/
├── locales/
├── audit/
└── data/
```

Rules: 

- owner-only controls live inside approved screens 

- no separate owner-only screens are created 

- every sensitive mutation audits 

- exports use approved data rights APIs 

60 

## **16. Infrastructure Architecture** 

## **16.1 Vercel projects** 

Recommended environment separation: 

```
atlas-lms-web-dev
atlas-lms-web-staging
atlas-lms-web-production
```

Rules: 

- production secrets isolated 

- preview deployments use non-production DB 

- branch deploys cannot touch production R2 or DB 

- production deploy requires migration validation 

- platform environment variables are separate from tenant runtime config 

## **16.2 Cloudflare setup** 

Cloudflare owns: 

- DNS 

- WAF 

- CDN 

- custom domain routing 

- R2 

- security headers 

- rate-limit edge assists where applicable 

DNS pattern: 

```
app.atlaslms.com          → Vercel
*.atlaslms.com            → Vercel
academy.fundedbeyond.com  → Vercel via Cloudflare
custom tenant domains     → CNAME to platform target
```

Rules: 

- Cloudflare host maps to Vercel app 

- app resolves tenant through DB, not Cloudflare worker-only state 

- WAF blocks obvious abuse 

- Cloudflare R2 bucket policies remain private by default 

61 

## **16.3 R2 setup** 

Buckets: 

```
atlas-assets-dev
atlas-assets-staging
atlas-assets-production
```

Rules: 

- environment-specific buckets 

- no shared production credentials in dev 

- signed URL only 

- lifecycle rules for temp uploads 

- export object expiry policy where approved 

## **16.4 Environment management** 

Environment variable groups: 

```
DATABASE_URL
DIRECT_DATABASE_URL
SUPABASE_URL
SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
R2_ACCOUNT_ID
R2_ACCESS_KEY_ID
R2_SECRET_ACCESS_KEY
R2_BUCKET_NAME
SENTRY_DSN
POSTHOG_KEY
BETTER_STACK_SOURCE_TOKEN
APP_ENV
APP_URL
PLATFORM_HOST
```

Rules: 

- validate env at boot with Zod 

- service role key never exposed to client 

- platform DB credentials only in server environment 

- secrets referenced, never stored in tenant config plaintext 

- separate dev/staging/prod values 

62 

## **16.5 Development** 

Development includes: 

- local Next.js 

- local or hosted dev Postgres 

- Prisma migrate dev 

- local seed 

- test tenant A 

- test tenant B 

- mocked R2 or dev R2 bucket 

- mocked email provider where needed 

## **16.6 Staging** 

Staging includes: 

- production-like Vercel deployment 

- transaction-mode pooling 

- RLS test harness 

- second tenant smoke test 

- Sentry/PostHog/Better Stack staging projects 

- real R2 staging bucket 

- no production data unless sanitized and approved 

## **16.7 Production** 

Production requires: 

- Phase 0 isolation gates green 

- migration validation 

- admin/platform MFA 

- audit hash-chain operational 

- Sentry active 

- Better Stack uptime checks active 

- PostHog event capture active 

- second-tenant provisioning smoke test 

- readiness CTA legal copy approved before public launch 

63 

## **17. Monitoring Architecture** 

## **17.1 Sentry** 

Capture: 

- unhandled exceptions 

- route handler failures 

- Server Action failures 

- worker failures 

- frontend rendering errors 

- performance traces for critical routes 

Tags: 

```
{
requestId,
tenantId:safeTenantId,
route,
actorPlane,
environment,
release
}
```

Rules: 

- no PII in error messages 

- no secrets 

- no raw tokens 

- no raw IP addresses 

## **17.2 PostHog** 

Track product events: 

- public diagnostic started/completed 

- signup completed 

- lesson completed 

- assessment attempted/submitted 

- swipe session completed 

- readiness viewed 

- outbound CTA clicked 

- certificate verified 

- community engagement 

- admin workflow events 

64 

Rules: 

- analytics events do not replace audit 

- tenant ID is scoped safely 

- no raw financial claims 

- no sensitive answer payload unless explicitly approved and safe 

- user identity follows tenant membership model where possible 

## **17.3 Better Stack** 

Use for: 

- uptime monitoring 

- structured logs 

- worker heartbeat 

- API latency alerting 

- deployment health checks 

- cron/worker failure alerts 

Log fields: 

```
{
level,
message,
requestId,
tenantId,
actorMembershipId,
route,
statusCode,
durationMs,
errorCode
}
```

Rules: 

- no secrets 

- no raw request bodies for sensitive endpoints 

- log request IDs consistently 

- correlate with audit entries for sensitive actions 

## **17.4 Events, errors, performance** 

Monitoring matrix: 

65 

|Area|Tool|Required Signal|
|---|---|---|
|API errors|Sentry|exception + requestId|
|API latency|Better Stack / Sentry|p95 route latency|
|Product usage|PostHog|event funnel|
|Outbox worker|Better Stack|heartbeat + failures|
|Audit|DB + admin/platform screens|append-only trace|
|Tenant isolation|CI + tests|IDOR matrix|
|Frontend errors|Sentry|route group + shell|



## **17.5 Audit visibility** 

Audit is not general logging. 

Audit records: 

- permission changes 

- role assignment/revocation 

- membership removal/suspension 

- platform-scope enter/exit 

- entitlement changes 

- publish/revoke/issue/moderate/export/delete actions • sensitive authorization denials where required 

Rules: 

- append-only • hash-chained 

- same transaction as mutation • searchable only through approved screens/APIs • platform access requires reason 

## **18. Testing Architecture** 

## **18.1 Testing layers** 

```
Unit tests
```

- `→ Integration tests` 

- `→ Authorization tests` 

- `→ Tenant isolation tests` 

66 

```
→ E2E tests
```

```
→ Release validation
```

## **18.2 Unit tests** 

Location: 

```
tests/unit/
packages/**/__tests__/
```

Cover: 

- Zod schemas 

- pagination helpers 

- idempotency helpers 

- route metadata helpers 

- permission resolver 

- entitlement resolver 

- ownership predicate helpers 

- UI primitive states 

- utility functions 

## **18.3 Integration tests** 

Location: 

```
tests/integration/
```

Cover: 

- route handlers 

- service + repository behavior 

- transaction behavior 

- outbox writes 

- audit writes 

- idempotency replay 

- validation errors 

- rate limit behavior 

- worker processors 

## **18.4 Authorization tests** 

Location: 

67 

## `tests/authorization/` 

Matrix: 

```
actor role
```

- `× permission` 

- `× resource type` 

- `× ownership state` 

- `× relationship state` 

- `× entitlement state` 

- `× membership state` 

Must test: 

- default deny 

- deny override wins 

- owner/admin scoped powers 

- learner denial paths 

- instructor relationship paths 

- moderator relationship paths 

- entitlement before permission 

- platform permissions never tenant roles 

## **18.5 Tenant isolation tests** 

Location: 

```
tests/tenant-isolation/
```

Required tests: 

- Tenant A cannot read Tenant B resource by ID. 

- Tenant A cannot update Tenant B resource by ID. 

- Tenant A cannot infer existence of Tenant B resource. 

- Host wins over JWT tenant claim. 

- No client-supplied tenant ID accepted. 

- RLS blocks direct cross-tenant query. 

- Transaction-mode pooling does not leak tenant GUC. 

- Prisma outside `withTenantTx` fails CI/static guard. 

- Platform scope cannot be entered from tenant route. 

## **18.6 E2E tests** 

Location: 

68 

```
tests/e2e/
```

Critical E2E flows: 

- public landing → diagnostic → signup 

- login → learner dashboard 

- learner course → lesson → progress 

- assessment attempt → submit → result 

- readiness view → attributed CTA 

- swipe practice session 

- certificate verification 

- admin invite member → accept invite 

- instructor course workflow 

- moderator queue action 

- tenant branding/domain setup where approved 

- platform tenant provisioning 

- second tenant smoke test 

## **18.7 Testing folder structure** 

```
tests/
├── unit/
├── integration/
├── authorization/
│   ├── can.spec.ts
```

- `│   ├── entitlements.spec.ts` 

- `│   ├── ownership.spec.ts` 

```
│   └── relationships.spec.ts
├── tenant-isolation/
│   ├── rls.spec.ts
```

- `│   ├── idor.spec.ts` 

```
│   ├── host-vs-jwt.spec.ts
```

```
│   └── platform-scope.spec.ts
├── e2e/
│   ├── public-diagnostic.spec.ts
```

```
│   ├── learner-loop.spec.ts
```

```
│   ├── admin-members.spec.ts
```

```
│   ├── instructor-workflow.spec.ts
```

```
│   ├── moderation.spec.ts
│   └── platform-provisioning.spec.ts
└── fixtures/
    ├── tenants.ts
    ├── users.ts
    ├── memberships.ts
    ├── roles.ts
```

69 

```
    ├── permissions.ts
    └── resources.ts
```

## **19. CI/CD Architecture** 

## **19.1 Pull request workflow** 

Every PR runs: 

1. install 2. typecheck 3. lint 4. format check 5. unit tests 6. integration tests 7. authorization tests 8. tenant isolation tests 9. route metadata check 10. Prisma access guard 11. permission catalogue drift check 12. entitlement gate check 13. audit requirement check 14. migration validation 15. build 16. preview deploy 

## **19.2 GitHub Actions example** 

```
name:CI
on:
pull_request:
push:
branches:
-main
jobs:
validate:
runs-on:ubuntu-latest
services:
postgres:
image:postgres:16
env:
POSTGRES_PASSWORD:postgres
```

70 

```
POSTGRES_DB:atlas_test
ports:
-5432:5432
steps:
-uses:actions/checkout@v4
-uses:pnpm/action-setup@v4
with:
version:9
-uses:actions/setup-node@v4
with:
node-version:22
cache:pnpm
```

```
-run:pnpm install --frozen-lockfile
```

```
-run:pnpm typecheck
```

```
-run:pnpm lint
```

```
-run:pnpm format:check
```

```
-run:pnpm db:migrate:test
```

```
-run:pnpm test:unit
```

```
-run:pnpm test:integration
```

```
-run:pnpm test:authorization
```

```
-run:pnpm test:tenant-isolation
```

```
-run:pnpm validate:route-metadata
```

```
-run:pnpm validate:tenant-db-access
```

```
-run:pnpm validate:permissions
```

```
-run:pnpm validate:entitlements
```

```
-run:pnpm validate:audit
```

```
-run:pnpm build
```

## **19.3 Type checks** 

Command: 

71 

```
pnpm typecheck
```

Rules: 

- strict TypeScript 

- no implicit any 

- no unchecked indexed access where avoidable 

- no untyped route input 

- no raw `unknown` crossing service boundary without schema parse 

## **19.4 Lint checks** 

Lint blocks: 

- restricted imports 

- direct Prisma import in route/page folders 

- platform Prisma import in tenant code 

- `tenant_id` accepted from request body 

- session-level `SET app.tenant_id` 

- missing route metadata 

- unapproved environment variable access 

- hardcoded FundedBeyond strings in platform packages 

- hardcoded tenant colors/domains in UI 

## **19.5 Test execution** 

Commands: 

```
pnpm test:unit
pnpm test:integration
pnpm test:authorization
pnpm test:tenant-isolation
pnpm test:e2e
```

Rules: 

- tenant isolation tests run before feature PR approval 

- E2E required for user-facing story completion 

- failing IDOR test blocks merge 

- missing audit assertion blocks sensitive mutation merge 

## **19.6 Migration validation** 

Commands: 

72 

```
pnpm db:migrate:check
pnpm db:rls:check
pnpm db:seed:check
```

Validation: 

- migration applies cleanly 

- migration rolls forward in staging 

- RLS policies enabled 

- required indexes exist 

- append-only triggers exist 

- audit hash-chain exists 

- grants match role model 

- no forbidden session-level tenant `SET` 

## **19.7 Deployment flow** 

```
PR opened
→ CI
```

- `→ preview deploy` 

- `→ review` 

- `→ merge to main` 

- `→ staging migration` 

- `→ staging deploy` 

- `→ smoke tests` 

- `→ tenant isolation tests` 

- `→ release approval` 

- `→ production migration` 

- `→ production deploy` 

- `→ post-deploy smoke` 

- `→ monitor` 

Production blocked unless: 

- Phase 0 isolation gates green 

- migration validation green 

- second tenant smoke test green 

- Sentry/PostHog/Better Stack active 

- audit operational 

- platform scope audit operational 

73 

## **20. Coding Standards** 

## **20.1 Naming conventions** 

Files: 

```
kebab-case.ts
kebab-case.tsx
```

React components: 

```
PascalCase export
kebab-case filename
```

Example: 

```
// course-card.tsx
exportfunctionCourseCard(){}
```

Functions: 

```
camelCase
```

Types: 

```
PascalCase
```

Constants: 

```
SCREAMING_SNAKE_CASEfortrueconstants
camelCaseforconfigobjects
```

Database columns: 

```
snake_case
```

Prisma models: 

```
PascalCase
```

74 

Permission keys: 

```
resource.action
```

Event names: 

```
context.entity.action
```

## **20.2 Folder conventions** 

- `_components` for screen-local components 

- `_forms` for screen-local forms 

- `_actions` for Server Actions 

- `_queries` for screen loaders/API callers 

- `services` for use cases 

- 

- 

- 

`repositories` for DB access 

- `schemas` for Zod 

- `events` for event contracts 

- `policies` for domain policy helpers 

## **20.3 TypeScript conventions** 

Rules: 

- strict mode 

- no `any` unless justified and lint-exempted 

- parse untrusted data with Zod 

- never trust route params without schema 

- prefer discriminated unions for states 

- use branded types for IDs where helpful 

- separate persistence types from view models 

Example: 

```
typeCourseId=Brand<string,'CourseId'>;
typeTenantId=Brand<string,'TenantId'>;
```

## **20.4 API conventions** 

- route metadata required 

- Zod input required 

- Zod output required in tests 

75 

- error envelope required 

- request ID required 

- cursor pagination for lists 

- indexed filters only 

- indexed sorting only 

- idempotency for approved mutating routes 

- no client tenant ID 

- no raw Prisma in handler 

## **20.5 Database conventions** 

- UUIDv7 IDs 

- 

- `tenant_id` on tenant tables 

- `created_at` , `updated_at` where mutable 

- append-only tables have no update/delete path 

- soft delete where approved 

- RLS enabled on tenant tables 

- indexes lead with tenant where applicable 

- foreign keys match approved design 

- no new tables without approved artifact update 

- 

## **20.6 Testing conventions** 

Each story must include: 

- unit tests 

- integration tests 

- authorization tests 

- tenant isolation tests where tenant-facing 

- E2E tests where user-facing 

- audit assertions for sensitive mutations 

- outbox assertions for event producers 

- error envelope assertions 

## **21. Security Architecture** 

## **21.1 OWASP controls** 

Required controls: 

- server-side authorization on every protected route 

- CSRF protection for cookie-auth mutations 

- XSS prevention through React escaping and sanitization 

- IDOR prevention through host tenant + RLS + `can()` 

- rate limiting 

76 

- secure headers 

- strict validation 

- secure file upload policy 

- no secrets in client bundle 

- no raw HTML rendering without sanitization 

- audit sensitive actions 

## **21.2 CSRF strategy** 

For cookie-authenticated mutations: 

- same-site cookies 

- CSRF token where required 

- origin check 

- method check 

- content-type check 

- Server Actions protected by framework + explicit validation 

- API mutations reject missing/invalid CSRF where applicable 

## **21.3 XSS prevention** 

Rules: 

- no unsanitized `dangerouslySetInnerHTML` 

- sanitize rich text content 

- use allow-listed markdown/rich text rendering 

- validate URLs 

- block javascript URLs 

- CSP configured 

- user-generated content escaped by default 

## **21.4 IDOR prevention** 

IDOR defense: 

```
host tenant
→ membership gate
```

```
→ withTenantTx
```

```
→ RLS
```

```
→ resourceLoader
```

```
→ can()
→ safe 404/403
```

77 

Tests: 

- cross-tenant ID read 

- cross-tenant update 

- cross-tenant delete 

- cross-tenant relationship action 

- guessed UUID 

- host/JWT mismatch 

## **21.5 Tenant isolation validation** 

Required gates: 

- Tenant A cannot access Tenant B records. 

- Tenant A cannot infer Tenant B existence. 

- Host wins over JWT. 

- RLS blocks raw cross-tenant query. 

- No Prisma outside `withTenantTx` . 

- No client tenant ID accepted. 

- Platform scope cannot leak into tenant code. 

• Second tenant smoke test passes without code changes. 

## **21.6 Audit requirements** 

Audit required for: 

- membership invite/suspend/remove 

- role assignment/revocation 

- permission override changes 

- entitlement changes 

- platform scope enter/exit 

- publish/review transitions 

- certificate issue/revoke 

- moderation actions 

- data export/deletion 

- sensitive authorization bypasses/denials where required 

Audit write must be in the same transaction as the mutation. 

## **22. Performance Architecture** 

## **22.1 Caching strategy** 

Cache only safe data. 

78 

Cache layers: 

- Next.js route/data cache for public safe content 

- Redis/Upstash for entitlements, feature flags, rate limits, session revocation 

- CDN for public assets 

- R2 signed URLs for protected assets 

- database indexes for tenant-scoped queries 

- derived projection tables for analytics/search/scoring 

Rules: 

- no cache key missing tenant scope 

- permission-sensitive data must be invalidated on role/permission/membership changes 

- entitlement cache invalidated on entitlement changes 

- platform data not cached in tenant context 

## **22.2 Query optimization** 

Rules: 

- tenant-leading indexes where appropriate 

- indexed filters only 

- indexed sorting only 

- cursor pagination 

- avoid N+1 queries 

- avoid direct cross-context joins 

- use projections/read models for analytics 

- statement timeouts per tenant budget 

- explain analyze critical queries before release 

## **22.3 Pagination** 

Use cursor pagination for: 

- course lists 

- members 

- audit entries 

- community posts 

- moderation queues 

- analytics event lists 

- notifications 

- search results 

- platform tenant lists 

Avoid unbounded list responses. 

79 

## **22.4 Image optimization** 

Rules: 

- store originals in R2 

- serve signed URLs where protected 

- public-safe assets via CDN 

- use Next.js image optimization where compatible 

- validate content type 

- enforce size limits 

- avoid layout shift with dimensions 

## **22.5 CDN strategy** 

Cloudflare CDN handles: 

- public tenant assets 

- static app assets 

- public landing assets 

- public-safe certificate visuals where approved 

Protected assets require signed access. 

## **23. Local Development Setup** 

## **23.1 Installation** 

```
gitclone<repo>
cdatlas-lms
pnpminstall
cp.env.example.env.local
pnpmdb:setup
pnpmdb:seed
pnpmdev
```

## **23.2 Environment variables** 

`.env.example` must include placeholder keys only. 

Required categories: 

```
APP_ENV=
APP_URL=
```

80 

```
PLATFORM_HOST=
DATABASE_URL=
DIRECT_DATABASE_URL=
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=
SENTRY_DSN=
POSTHOG_KEY=
BETTER_STACK_SOURCE_TOKEN=
```

## **23.3 Local services** 

Required: 

- Node.js 

- pnpm 

- PostgreSQL 

- Supabase local or hosted dev project 

- R2 dev bucket or local mock 

- optional Redis/Upstash-compatible local service for tests 

## **23.4 Seed process** 

```
pnpmdb:migrate
pnpmdb:seed:catalogues
pnpmdb:seed:tenants
pnpmdb:seed:fundedbeyond
pnpmdb:seed:smoke-tenant
pnpmtest:tenant-isolation
```

Seeds must create: 

- platform catalogues 

- tenant roles 

- permission mappings 

- feature flags 

- entitlements 

- item types 

- workflow templates 

- FundedBeyond tenant config 

- second smoke tenant 

81 

## **23.5 Development workflow** 

```
Pull latest
→ install
→ migrate
→ seed
→ run tests
→ create branch
→ implement story
→ run local validation
→ open PR
→ CI
→ preview
→ review
→ merge
```

Rules: 

- do not start feature work before Phase 0 gates 

- keep PRs bounded to one story/context 

- update tests with code 

- no schema change without migration and RLS review 

- no API route without metadata and tests 

## **24. Engineering Onboarding Guide** 

## **24.1 How to understand Atlas** 

New engineers should understand Atlas in this order: 

1. Atlas is one shared multi-tenant LMS platform. 

2. FundedBeyond is Tenant #1 configuration only. 

3. Host resolution determines tenant. 

4. Authentication alone means nothing without ACTIVE membership. 

5. Every protected request enters `withTenantTx` . 

6. Entitlement is checked before permission. 

7. `can()` is the only authorization decision point. 

8. Ownership and relationship checks live inside `can()` . 

9. RLS must agree with application authorization. 

10. Audit and outbox are not optional. 

- UI must not render protected data before gates pass. 

11. 

12. Platform scope is physically isolated. 

82 

## **24.2 What to read first** 

Reading order: 

1. Atlas LMS Master PRD 

2. Architecture Review 

3. Dependency Analysis & Corrected Roadmap 

4. Database Design v2 

5. Permission Matrix v1 

6. API Inventory v1 7. Screen Inventory v1 8. User Flows & Journey Maps v1 

9. Wireframes v1 

10. Design System v1 11. Sprint Planning v1 12. Technical Architecture Package v1 

## **24.3 How to contribute safely** 

Before coding: 

- identify approved story • identify approved screen IDs • identify approved APIs • identify approved permissions • identify approved tables • identify entitlement requirements • identify audit requirements • identify outbox requirements • identify tests required 

During coding: 

- do not add screens • do not add APIs • do not add permissions • do not add tables • do not hardcode tenant logic • do not bypass route metadata • do not use Prisma outside `withTenantTx` • do not skip tests 

Before PR: 

- run typecheck • run lint 

- run tests 

- run tenant isolation tests 

- verify route metadata 

83 

• verify audit/outbox • verify no tenant fork • verify design-system compliance 

## **25. Technical Validation** 

## **25.1 Repository Validation** 

|Check|Required Result||||||
|---|---|---|---|---|---|---|
|Monorepo|`apps` ,<br>`packages` ,<br>`prisma` ,<br>`infrastructure`|,|<br>`scripts`|,|<br>`tests`|,|
|structure|`docs` present||||||
|Bounded contexts|Domain packages align to approved contexts||||||
|Import<br>boundaries|UI cannot import repositories directly||||||
|Platform isolation|Platform client unavailable to tenant code||||||
|Design system|shadcn wrapped through Atlas layers||||||
|No tenant fork|No FundedBeyond-specifc platform package||||||



**Verdict:** Approved only if CI import-boundary checks pass. 

## **25.2 Multi-Tenant Validation** 

|Check|Required Result|
|---|---|
|Host resolution|Host maps to tenant before auth/business logic|
|Host vs JWT|Host wins|
|Membership|ACTIVE required for protected routes|
|RLS|Enabled on tenant tables|
|withTenantTx|Transaction-local<br>`set_config(..., true)`|
|Client tenant ID|Ignored/rejected|
|Second tenant|Provisions without code changes|



**Verdict:** No Phase 1 feature work until green. 

84 

## **25.3 Security Validation** 

|Check|Required Result|
|---|---|
|Default deny|Missing permission denies|
|Route metadata|Required on all protected routes|
|Entitlement|Runs before<br>`can()`|
|Ownership|Inside<br>`can()`|
|Relationship|Inside<br>`can()`|
|Audit|Same transaction for sensitive mutations|
|Platform scope|Reason-bound + enter/exit audit|
|IDOR|Cross-tenant matrix green|
|CSRF/XSS|Controls active|



**Verdict:** Production blocked if any security gate fails. 

## **25.4 Performance Validation** 

|Check|Required Result|
|---|---|
|Pagination|Cursor-based lists|
|Filters|Indexed only|
|Sorting|Indexed allow-list only|
|Query plans|Critical paths reviewed|
|Caching|Tenant-scoped keys|
|Assets|CDN/signed URL strategy|
|Workers|Outbox processing monitored|
|Timeouts|Tenant query budgets enforced|



**Verdict:** Approved when shared Postgres safety controls are active. 

## **25.5 Sprint Alignment Validation** 

|Sprint Principle|Architecture Support|
|---|---|
|Phase 0 before<br>features|RLS, auth, membership, can(), audit, outbox front-loaded|
|Phase 1A core loop|learning, lesson, assessment, workfow, scoring modules defned|



85 

|Sprint Principle|Architecture Support|
|---|---|
|Phase 1B engagement|community, moderation, notifcations, analytics, automation modules<br>defned|
|FundedBeyond no fork|readiness/swipe/diagnostic via generic engines/confg|
|Release hardening|CI/CD, monitoring, testing, second tenant smoke test|



**Verdict:** Aligned with Sprint Planning v1. 

## **25.6 Architecture Compliance Validation** 

A PR fails if it: 

- adds unapproved screen 

- adds unapproved API 

- adds unapproved permission 

- adds unapproved table/entity 

- changes tenant strategy 

- changes database architecture 

- bypasses `withTenantTx` 

- bypasses `can()` 

- checks plan name instead of entitlement 

- hardcodes FundedBeyond 

- accesses platform scope from tenant code 

- skips audit on sensitive mutation 

- performs side effect without outbox 

- renders protected UI before gate completion 

- introduces Phase 2–4 deferred scope 

## **25.7 CTO Approval Verdict** 

## **Verdict: APPROVED FOR ENGINEERING BLUEPRINT USE — CONDITIONAL** 

This Technical Architecture Package v1 is approved as the engineering blueprint for Cursor, Claude Code, GitHub Copilot, and the engineering team to begin Phase 0 implementation. 

Approval is conditional on the following: 

1. Phase 0 tenant isolation harness passes under transaction-mode pooling. 

2. `withTenantTx()` is implemented before tenant feature routes. 

3. 

   - `withPlatformScope()` is isolated before platform routes. 

4. CI gates for route metadata, tenant-safe DB access, audit, entitlements, and permissions are active. 

5. No Phase 1 feature work starts until RLS, membership, authorization, audit, and platform isolation are green. 

6. FundedBeyond remains configuration only. 

86 

7. Second-tenant smoke test passes before FundedBeyond Phase 1 is declared complete. 

## **Final CTO Position:** 

Atlas LMS is ready to move from locked architecture into Phase 0 implementation only. Feature implementation begins after the isolation/security substrate proves itself in the real stack. 

87 

