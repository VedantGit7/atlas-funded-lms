## **ATLAS LMS — BACKEND ARCHITECTURE PACKAGE** 

## **v1** 

## **Phase 0 + Phase 1A + Phase 1B** 

**Status:** Implementation-ready backend architecture blueprint **Technology:** Next.js API Routes · Server Actions · PostgreSQL · Prisma · Supabase Auth · Cloudflare R2 · Zod · Sentry · PostHog · Better Stack 

**Scope:** Backend implementation architecture only **Binding Rule:** This package creates no new product scope, screens, APIs, permissions, workflows, entities, database architecture, tenant strategy, authorization model, frontend architecture, or FundedBeyond-specific fork. 

**Source of Truth:** Locked Atlas LMS artifacts only. 

## **1. Backend Executive Summary** 

Atlas LMS backend is the secure implementation layer for the approved multi-tenant, white-label LMS platform. 

Its job is to implement the locked product, API, permission, database, frontend, and technical architecture consistently across: 

- Public academy surfaces 

- 

- Learner learning flows 

- 

- Instructor studio flows 

- 

- Tenant admin operations 

- 

- Moderation operations 

- 

- Platform operations 

- 

- Event-driven side effects 

- 

- Audit, analytics, notifications, scoring, readiness, and certificates 

- 

The backend has five goals. 

## **1.1 Backend goals** 

1. Expose only approved API Inventory v1 routes. 

2. Execute all protected requests through the approved request lifecycle. 

3. Keep business logic inside service modules. 

4. Keep Prisma/database access inside repository modules and transaction wrappers. 

5. Support Cursor, Claude Code, GitHub Copilot, and engineers with predictable backend code patterns. 

## **1.2 Security goals** 

1. Default deny for every protected route. 

1 

2. No route without metadata. 

3. No Prisma access outside approved transaction helpers. 

4. No client-supplied `tenant_id` . 

5. No authorization logic inside UI, route handlers, or repositories. 

6. No cross-tenant resource leakage. 

7. Same-transaction audit for sensitive mutations. 

8. RLS as the database backstop. 

## **1.3 Multi-tenant goals** 

1. Host determines tenant. 2. Host wins over JWT claims. 

3. Tenant state is checked before protected logic. 

4. ACTIVE membership is required for protected tenant access. 

5. Entitlement is checked before permission. 

6. `can()` is the only authorization decision point. 

7. RLS enforces `tenant_id = app.current_tenant_id()` . 8. FundedBeyond Academy remains Tenant #1 configuration only. 

## **1.4 Scalability goals** 

1. Use cursor pagination, not offset pagination. 

2. Use read projections for dashboards and large lists. 

3. Use outbox and background workers for side effects. 

4. Partition high-volume append-only tables where defined. 

5. Avoid synchronous fan-out inside user requests. 

6. Keep routes stateless and serverless-safe. 

7. Use idempotency for retry-safe mutations. 

## **1.5 Event-driven goals** 

Events are used for side effects and derived state, not for bypassing core transaction rules. 

Examples: 

- Lesson completion records progress, then emits `lesson.completed` . • Assessment submission records attempt state, then emits `assessment.submitted` . • Grading records result, then emits `assessment.graded` . • Practice completion records responses, then emits competency signals. • Certificate issue records certificate, then emits notification event. • Moderation report opens case, then emits moderation event. 

All events are written through the outbox pattern in the same transaction as the source mutation. 

2 

## **2. Backend Architecture Principles** 

## **2.1 Service-oriented architecture** 

Atlas backend is organized by domain services, not by UI screens. 

A service represents a business use case: 

- Create course 

- Publish course 

- Complete lesson 

- Start attempt 

- Submit attempt 

- Record swipe response 

- Issue certificate 

- Open moderation case 

- Assign role 

- Update branding 

- Create export job 

Services do not expose HTTP. Routes call services. 

## **2.2 Domain boundaries** 

Each backend module owns its own: 

- Schemas 

- Services 

- Repositories 

- Resource loaders 

- Permission metadata helpers 

- Events 

- Tests 

Cross-domain access must happen through service interfaces, not direct repository imports, unless explicitly allowed for read-only projection composition. 

## **2.3 Default deny** 

Default state is denial. 

A route is allowed only after: 

```
Host resolved
Tenant active
Authentication valid where required
ACTIVE membership present where required
Entitlement passed where required
```

3 

```
Resource loaded safely
can() returned allow
RLS agreed with tenant context
```

Missing metadata is a build defect. 

## **2.4 Transaction safety** 

Tenant database work must run inside `withTenantTx()` . 

Platform database work must run inside `withPlatformScope()` . 

No service may open an unscoped Prisma client. 

No repository may open a transaction. 

No background worker may process tenant data without setting tenant context. 

## **2.5 Tenant isolation** 

Tenant isolation exists at five layers: 

```
Host resolution
  ↓
Request context
  ↓
withTenantTx transaction-local GUC
  ↓
PostgreSQL RLS
  ↓
can() ownership / relationship checks
```

The backend must never trust tenant identity from: 

- Request body 

- Query params 

- Path params 

- Headers supplied by the browser 

- Local storage 

- Hidden form inputs 

- JWT custom tenant claims when host disagrees 

## **2.6 Audit-first design** 

Sensitive actions are not valid unless audit is written. 

4 

Audit is required for: 

- Tenant lifecycle changes 

- Membership status changes 

- Role assignment/removal 

- Permission overrides 

- Entitlement changes 

- Branding/domain changes 

- Content publish/unpublish/delete 

- Assessment grading and grade changes 

- Certificate issue/revoke 

- Moderation decisions 

- Export/delete jobs 

- Platform scope access 

- Readiness policy changes 

- Outbound attribution CTA token creation 

## **2.7 Event-driven side effects** 

Side effects must use outbox events. 

Forbidden inside user request transaction: 

- Sending email directly 

- Dispatching push notifications directly 

- Updating large analytics aggregates inline 

- Recalculating full dashboards inline 

- Calling third-party services directly where outbox is appropriate 

Allowed inside transaction: 

- Source mutation 

- Audit row 

- Outbox row 

- Minimal projection update where declared safe 

## **2.8 Configuration over customization** 

Tenant-specific behavior must come from: 

- Tenant config 

- Tenant branding 

- Tenant theme 

- Entitlements 

- Feature flags 

- Item-type registry 

- Scoring config 

- Readiness policy 

- Workflow config 

- Content data 

5 

Forbidden: 

```
if(tenant.slug==='fundedbeyond'){
// forbidden
}
```

## **3. Backend Folder Structure** 

## **3.1 Exact implementation tree** 

```
src/
├── app/
│   ├── api/
│   │   ├── health/
│   │   │   └── route.ts
│   │   └── v1/
│   │       ├── public/
│   │       ├── me/
│   │       ├── members/
│   │       ├── roles/
│   │       ├── permission-overrides/
│   │       ├── entitlements/
```

```
│   │       ├── branding/
│   │       ├── domains/
```

```
│   │       ├── courses/
│   │       ├── lessons/
│   │       ├── paths/
```

```
│   │       ├── items/
│   │       ├── assessments/
```

```
│   │       ├── attempts/
```

```
│   │       ├── practice-sessions/
```

```
│   │       ├── competency/
```

```
│   │       ├── readiness/
```

```
│   │       ├── workflows/
│   │       ├── certificates/
│   │       ├── gamification/
│   │       ├── community/
│   │       ├── moderation/
│   │       ├── notifications/
```

```
│   │       ├── search/
│   │       ├── analytics/
```

```
│   │       ├── automation/
```

```
│   │       ├── locales/
```

```
│   │       ├── extensions/
```

```
│   │       ├── data/
```

6 

```
│   │       ├── internal/
│   │       │   └── outbox/
│   │       └── platform/
│   ├── actions/
│   │   ├── forms/
│   │   └── index.ts
│   └── middleware.ts
│
├── modules/
│   ├── courses/
│   ├── lessons/
│   ├── learning-paths/
│   ├── assessments/
│   ├── question-bank/
│   ├── competency/
│   ├── readiness/
│   ├── swipe-learning/
│   ├── certificates/
│   ├── community/
│   ├── moderation/
│   ├── notifications/
│   ├── memberships/
│   ├── roles/
│   ├── branding/
│   ├── analytics/
│   └── platform/
│
├── auth/
│   ├── supabase.ts
│   ├── session.ts
│   ├── principal.ts
│   ├── invitation.ts
│   └── tests/
│
├── tenancy/
│   ├── resolve-tenant.ts
│   ├── tenant-state.ts
│   ├── tenant-context.ts
│   ├── tenant-cache.ts
│   └── tests/
│
├── permissions/
│   ├── can.ts
│   ├── policy-engine.ts
│   ├── ownership.ts
│   ├── relationships.ts
│   ├── resource-ref.ts
│   ├── route-metadata.ts
│   └── tests/
│
```

7 

```
├── entitlements/
│   ├── enforce-entitlement.ts
│   ├── entitlement-cache.ts
│   └── tests/
│
├── db/
│   ├── prisma.ts
│   ├── with-tenant-tx.ts
│   ├── with-platform-scope.ts
│   ├── rls.ts
│   ├── idempotency.ts
│   └── tests/
│
├── events/
│   ├── outbox.ts
│   ├── event-types.ts
│   ├── event-envelope.ts
│   ├── dispatcher.ts
│   ├── dead-letter.ts
│   ├── replay.ts
│   └── tests/
│
├── audit/
│   ├── audit-entry.ts
│   ├── audit-actions.ts
│   ├── audit-writer.ts
│   ├── audit-search.ts
│   └── tests/
│
├── storage/
│   ├── r2-client.ts
│   ├── signed-upload.ts
│   ├── signed-download.ts
│   ├── asset-policy.ts
│   └── tests/
│
├── jobs/
│   ├── workers/
│   ├── schedules/
│   ├── consumers/
│   ├── retries/
│   └── tests/
│
├── observability/
│   ├── sentry.ts
│   ├── posthog.ts
│   ├── better-stack.ts
│   ├── logger.ts
│   ├── request-id.ts
│   └── tracing.ts
```

8 

```
│
├── validation/
│   ├── env.ts
│   ├── pagination.ts
│   ├── errors.ts
│   └── response-envelope.ts
│
└── lib/
    ├── crypto.ts
    ├── dates.ts
    ├── uuid.ts
    ├── pagination.ts
    ├── safe-json.ts
    └── assertions.ts
```

```
prisma/
├── schema.prisma
├── models/
├── migrations/
├── sql/
│   ├── rls/
│   ├── triggers/
│   ├── indexes/
│   ├── grants/
│   └── partitions/
└── seeds/
    ├── permissions.ts
    ├── roles.ts
    ├── feature-flags.ts
    ├── entitlements.ts
    ├── item-types.ts
    ├── workflows.ts
    ├── fundedbeyond-tenant.ts
    └── smoke-test-tenant.ts
```

```
tests/
├── unit/
├── integration/
├── authorization/
├── tenant-isolation/
├── api/
├── events/
├── workers/
└── fixtures/
```

9 

## **3.2 Folder explanations** 

|Folder|||||||||||Purpose|Purpose|
|---|---|---|---|---|---|---|---|---|---|---|---|---|
|`src/app/api`|||||||||||Next.js API route handlers only. No business logic.||
|`src/app/actions`|||||||||||Server Actions as UI orchestration wrappers only. No hidden APIs.||
|`src/modules`|||||||||||Domain-specifc backend code.||
|`src/auth`|||||||||||Supabase session verifcation, principal resolution, invitation acceptance.||
|`src/tenancy`|||||||||||Host resolution, tenant state gate, tenant context.||
|`src/permissions`|||||||||||`can()`|, resource refs, ownership and relationship predicates.|
|`src/entitlements`|||||||||||Tenant capability gates.||
|`src/db`|||||||||||Prisma client, transaction wrappers, RLS helpers.||
|`src/events`|||||||||||Outbox publishing, dispatch, replay, dead letter.||
|`src/audit`|||||||||||Audit writing and audit search helpers.||
|`src/storage`|||||||||||R2 integration and signed URL policies.||
|`src/jobs`|||||||||||Workers, scheduled jobs, event consumers.||
|`src/observability`|||||||||||Logging, tracing, request IDs, Sentry/PostHog/Better Stack.||
|`src/validation`|||||||||||Shared Zod schemas, envelopes, env validation.||
|`src/lib`|||||||||||Safe shared utilities with no domain logic.||
|`prisma`|||||||||||Prisma schema, migrations, raw SQL, seeds.||
|`tests`|||||||||||Backend test suites grouped by risk area.||



## **4. Domain Module Architecture** 

## **4.1 Standard module template** 

Every backend module follows this structure: 

```
modules/<domain>/
├── routes/
│   ├── metadata.ts
```

- `│   └── loaders.ts ├── service/ │   ├── <domain>.service.ts │   └── <use-case>.service.ts ├── repository/ │   ├── <domain>.repository.ts` 

10 

```
│   └── projections.repository.ts
├── schemas/
│   ├── input.ts
│   ├── output.ts
│   ├── params.ts
│   └── events.ts
├── permissions/
│   ├── resource-loaders.ts
│   ├── ownership.ts
│   └── relationships.ts
├── events/
│   ├── publish.ts
│   └── handlers.ts
├── tests/
│   ├── unit.test.ts
│   ├── service.test.ts
│   ├── repository.test.ts
│   ├── authorization.test.ts
│   └── api.test.ts
└── index.ts
```

## **4.2 Module responsibilities** 

|Module|Backend responsibility|
|---|---|
|Courses|Course CRUD, enrollment hooks, publish handof, course projections.|
|Lessons|Lesson CRUD, asset references, progress writes, completion events.|
|Learning Paths|Path sequencing, stage gates, step completion projections.|
|Assessments|Assessment lifecycle, attempts, answers, grading, submission.|
|Question Bank|Approved item registry, item collections, item ownership.|
|Competency|Signal intake, score snapshots, dimension aggregation.|
|Readiness|Readiness evaluation from competency/scoring projections and policy confg.|
|Swipe Learning|Practice session creation, response capture, scoring contribution.|
|Certifcates|Template handling, issue/revoke, verifcation projection.|
|Community|Spaces, posts, comments, reactions, feed projections.|
|Moderation|Reports, moderation cases, decisions, appeals.|
|Notifcations|Templates, dispatch queue, in-app inbox, read state.|
|Memberships|Member profle, invitation, ACTIVE/INVITED/SUSPENDED/REMOVED gates.|
|Roles|Role assignment, permission overrides, catalogue reads.|
|Branding|Branding/theme/domain confguration and publish workfow.|



11 

|Module|Backend responsibility|
|---|---|
|Analytics|Read models, rollups, dashboard projections, exports.|
|Platform|Platform-only tenant provisioning, tenant lifecycle, support, audit.|



## **4.3 Module import rules** 

Allowed: 

```
route → module service
service → same-module repository
service → shared auth/permission/entitlement/audit/events/storage/db
service → another module service where a locked workflow requires it
repository → Prisma transaction client only
```

Forbidden: 

```
route → repository
route → Prisma
repository → service
repository → can()
repository → HTTP response
service → NextRequest
service → React/frontend code
tenant module → platform database client
```

## **5. Request Lifecycle Architecture** 

## **5.1 Exact request flow** 

```
Request
  ↓
Request ID
  ↓
Tenant Resolution
  ↓
Tenant State Gate
  ↓
Rate Limit
  ↓
Auth
  ↓
Membership Gate
  ↓
```

12 

```
Entitlement Gate
  ↓
Resource Loader
  ↓
can()
  ↓
Validation
  ↓
Service
  ↓
Transaction
  ↓
Repository / Prisma
  ↓
Audit
  ↓
Outbox
  ↓
Response
```

## **5.2 Expanded lifecycle** 

```
HTTP Request
  ↓
getOrCreateRequestId(req)
  ↓
resolveTenantFromHost(req.headers.host)
  ↓
assertTenantState(ACTIVE or public-safe state)
  ↓
applyRateLimit(routeMetadata.rateLimit)
  ↓
verifySupabaseSession(req)
  ↓
resolveAuthPrincipal(session.user.id)
  ↓
requireActiveMembership(tenantId, principalId)
  ↓
withTenantTx(ctx)
  ↓
set_config('app.tenant_id', tenantId, true)
set_config('app.actor_membership_id', membershipId, true)
set_config('app.request_id', requestId, true)
  ↓
enforceEntitlement(metadata.entitlement)
  ↓
resource = metadata.resourceLoader(tx, params)
  ↓
can(actor, metadata.permission, resource, ctx)
```

13 

```
  ↓
input = zod.parse(req body/query/params)
  ↓
service.execute({ ctx, tx, input, resource })
  ↓
write audit entry where required
  ↓
write outbox event where required
  ↓
commit
  ↓
return success envelope
```

## **5.3 Public route lifecycle** 

Public routes are explicitly declared. 

```
Public Request
  ↓
Request ID
  ↓
Host → Tenant
  ↓
Tenant public state gate
  ↓
Rate limit
  ↓
Public route metadata check
  ↓
withTenantTx(public ctx where allowed)
  ↓
Zod validation
  ↓
Public service
  ↓
Minimal public projection
  ↓
Response
```

Public routes must not expose protected membership, admin, learner, instructor, moderation, platform, or cross-tenant resource data. 

## **5.4 Platform route lifecycle** 

```
Platform Request
```

```
  ↓
Request ID
```

14 

```
  ↓
Authenticate Supabase session
  ↓
Resolve platform principal
  ↓
Require platform role
  ↓
Require reason where tenant-support/platform action
  ↓
withPlatformScope(reason)
  ↓
canPlatform()
  ↓
Zod validation
  ↓
Platform service
  ↓
Same-transaction audit
  ↓
Outbox where required
  ↓
Response
```

Platform routes do not use tenant membership roles. 

## **6. API Route Architecture** 

## **6.1 Route organization** 

API routes live under: 

```
src/app/api/v1/**
```

Rules: 

1. Create only routes listed in API Inventory v1. 

2. Use `/api/v1/public/**` for public approved routes. 

3. Use `/api/v1/platform/**` for platform approved routes. 

- Do not add route files for future Phase 2–4 APIs. 

4. 

- Do not create private backend shortcuts for frontend convenience. 

5. 

6. Server Actions must call the same service path as API routes. 

## **6.2 Versioning** 

Canonical prefix: 

15 

```
/api/v1/**
```

Platform prefix: 

```
/api/v1/platform/**
```

Public prefix: 

```
/api/v1/public/**
```

Breaking changes require future major versioning. Additive fields may be added only if compatible with approved response envelopes and frontend contracts. 

## **6.3 Route metadata** 

Every route exports metadata. 

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

```
exportconstrouteMetadata={
permission:'attempt.submit',
resourceLoader:loadAttemptResourceRef,
audit:'required',
rateLimit:'authenticatedTenantWrite',
```

16 

- `idempotency: 'required',` 

- `} satisfies RouteMetadata;` 

## **6.4 Validation** 

Every route validates: 

- Path params 

- Query params 

- Body 

- Headers where required, including `Idempotency-Key` 

- Response schema in tests/development 

Example: 

```
constSubmitAttemptParamsSchema=z.object({
id:z.string().uuid(),
});
constSubmitAttemptBodySchema=z.object({
answers:z.array(
z.object({
itemId:z.string().uuid(),
response:z.unknown(),
})
),
});
constSubmitAttemptOutputSchema=z.object({
data:z.object({
attemptId:z.string().uuid(),
status:z.literal('SUBMITTED'),
}),
requestId:z.string(),
});
```

## **6.5 Error handling** 

All non-2xx responses use the standard error envelope. 

```
{
"error":{
"code":"PERMISSION_DENIED",
"message":"You do not have access to perform this action.",
"requestId":"req_..."
}
}
```

17 

Safe machine codes include: 

- `VALIDATION_ERROR` 

- `AUTH_REQUIRED` 

- `NO_MEMBERSHIP` 

- `MEMBERSHIP_PENDING` 

- `MEMBERSHIP_SUSPENDED` 

- `MEMBERSHIP_REMOVED` 

- `PERMISSION_DENIED` 

- • `OWNERSHIP_DENIED` • `RELATIONSHIP_DENIED` • `ENTITLEMENT_REQUIRED` • `TENANT_NOT_FOUND` • `TENANT_SUSPENDED` • `CONFLICT` • `IDEMPOTENCY_REPLAY` • `RATE_LIMITED` 

- `INTERNAL_ERROR` 

## **6.6 Response envelopes** 

Success response: 

```
{
"data":{},
"requestId":"req_..."
}
```

Paginated response: 

```
{
"data":[],
"page":{
"nextCursor":null,
"hasMore":false
},
"requestId":"req_..."
}
```

No route may return raw Prisma records directly. 

18 

## **7. Service Layer Architecture** 

## **7.1 Responsibilities** 

Services own business use cases. 

A service may: 

- Enforce business invariants 

- Call repositories 

- Coordinate same-transaction writes 

- Create audit entries 

- Create outbox events 

- Apply idempotency behavior 

- Build domain response DTOs 

- Call other services where the locked workflow requires it 

A service may not: 

- Read `NextRequest` 

- Return `NextResponse` 

- Verify Supabase session 

- Resolve tenant from host 

- Perform route-level authorization 

- Open Prisma client directly 

- Bypass `withTenantTx` 

- Accept client-supplied `tenant_id` 

- Hardcode tenant-specific behavior 

## **7.2 Service signature** 

```
typeServiceArgs<TInput,TResource>={
ctx:TenantRequestContext;
tx:Prisma.TransactionClient;
input:TInput;
resource?:TResource;
idempotencyKey?:string;
};
exportasyncfunctioncompleteLessonService(
args:ServiceArgs<CompleteLessonInput,LessonResourceRef>
){
const{ctx,tx,input,resource}=args;
constprogress=awaitlessonProgressRepository.markComplete(tx,{
lessonId:resource.lessonId,
membershipId:ctx.actorMembershipId,
completedAt:newDate(),
});
```

19 

```
awaitauditWriter.write(tx,{
ctx,
action:'lesson.completed',
target:{type:'lesson',id:resource.lessonId},
payload:{progressId:progress.id},
});
awaitoutbox.publish(tx,{
ctx,
eventType:'lesson.completed',
aggregateType:'lesson',
aggregateId:resource.lessonId,
payload:{progressId:progress.id},
});
return{progressId:progress.id,status:'COMPLETED'};
}
```

## **7.3 Transaction boundaries** 

Routes open the transaction wrapper. Services receive `tx` . 

Good: 

```
awaitwithTenantTx(ctx,async(tx)=>{
returncompleteLessonService({ctx,tx,input,resource});
});
```

Forbidden: 

```
// Forbidden inside service
awaitprisma.lessonProgress.create(...);
```

## **7.4 Dependency rules** 

Services may depend on: 

- Same-module repositories 

- Same-module schemas 

- Shared audit 

- Shared outbox 

- Shared storage helpers 

- Shared idempotency helpers 

- Other domain services only when approved workflow requires cross-domain coordination 

20 

Services must not depend on: 

- UI components • React Query • Route handlers 

- Browser APIs 

- Platform scope unless inside platform module 

## **8. Repository Layer Architecture** 

## **8.1 Repository pattern** 

Repositories own Prisma queries. 

They are thin data access functions. They must not contain business workflows. 

## **8.2 Repository signature** 

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

RLS supplies tenant isolation. Repositories may include tenant-leading filters for index performance only if the tenant ID comes from trusted server context, never from the client. 

## **8.3 Query ownership** 

Each table has an owning module. 

Examples: 

|Table group||||||||Owning module|
|---|---|---|---|---|---|---|---|---|
|`courses` ,<br>`course_modules`||,|<br>`enrollments`|||||Courses|
|`lessons` ,<br>`lesson_assets` ,||<br>`lesson_progress`||||||Lessons|
|`learning_paths` ,<br>`path_steps`||||||||Learning Paths|
|`assessments` ,<br>`attempts`|,|`attempt_answers`||||||Assessments|
|`items` ,<br>`item_collections`||,|<br>`item_types`|||||Question Bank / Item Registry|



21 

|Table group|||||||||Owning module|
|---|---|---|---|---|---|---|---|---|---|
|`competency_signals` , score snapshots|||||||||Competency|
|`readiness_*`|||||||||Readiness|
|`practice_sessions` ,<br>`practice_responses`|||||||||Swipe Learning|
|`certificates`||, verifcations|||||||Certifcates|
|`community_spaces` ,<br>`posts` ,<br>`comments`||||||,|<br>`reactions`||Community|
|`moderation_cases` , decisions, appeals|||||||||Moderation|
|`notification_templates` , dispatches|||||||||Notifcations|
|`roles` ,<br>`user_roles` , overrides|||||||||Roles|
|`tenant_branding`||||,<br>`tenant_theme`|, domains||||Branding|
|`audit_entries`|||||||||Audit|
|`outbox_events`|||, deliveries, dead letters||||||Events|



## **8.4 Projection ownership** 

Repositories may expose read projections for their domain. 

Example: 

```
exportasyncfunctionlistLearnerCoursesProjection(
tx:Prisma.TransactionClient,
args:{
membershipId:string;
cursor?:string;
limit:number;
}
){
returntx.course.findMany({
where:{
enrollments:{
some:{membershipId:args.membershipId},
},
},
take:args.limit+1,
cursor:args.cursor?{id:args.cursor}:undefined,
orderBy:{createdAt:'desc'},
select:{
id:true,
title:true,
slug:true,
status:true,
},
```

22 

```
});
```

```
}
```

## **8.5 Repositories must never do** 

Repositories must never: 

- Call `can()` 

- Check entitlements 

- Read request headers 

- Create `NextResponse` 

- Write audit directly unless audit repository itself 

- Publish events directly unless outbox repository itself 

- Create their own Prisma client 

- Open their own transaction 

- Accept client-supplied tenant ID 

- Join across unrelated bounded contexts casually 

- Return unsafe global identity fields to tenant APIs 

## **9. Authorization Architecture** 

## **9.1 Core rule** 

`can()` is the only permission decision point. 

Route handlers do not check roles directly. 

Forbidden: 

```
if(membership.role==='admin'){
// forbidden
}
```

Allowed: 

```
awaitcan(actor,'course.update',resourceRef,ctx);
```

## **9.2** **`can()` responsibilities** 

`can()` evaluates: 

1. Tenant context 

2. Actor membership 

3. Permission catalogue 

23 

4. Role permissions 

5. Permission overrides 

6. Ownership predicates 

7. Relationship predicates 

8. Platform-scope boundaries where applicable 

## **9.3 Resource refs** 

Resource loaders create safe references before authorization. 

```
typeResourceRef={
type:'course'|'lesson'|'attempt'|'post'|'certificate';
id:string;
ownerMembershipId?:string;
relationship?:Record<string,unknown>;
tenantScoped:true;
};
```

Example loader: 

```
exportasyncfunctionloadCourseResourceRef(
tx:Prisma.TransactionClient,
params:{id:string}
):Promise<ResourceRef>{
constcourse=awaitcourseRepository.findCourseAuthProjection(tx,
params.id);
```

```
if(!course){
thrownotFoundWithoutLeak();
}
return{
type:'course',
id:course.id,
ownerMembershipId:course.createdByMembershipId,
tenantScoped:true,
};
}
```

## **9.4 Ownership checks** 

Ownership checks live inside `can()` . 

Examples: 

- Instructor can update own draft course. • Member can update own profile. 

- Learner can read own attempt result. 

24 

- Post author can edit own post where status allows. 

## **9.5 Relationship checks** 

Relationship checks live inside `can()` . 

Examples: 

- Instructor-of-course can manage lessons. 

- Assignee can grade assigned submission. 

- Moderator-of-space can moderate posts. 

- Member-of-space can create posts. 

- Enrolled learner can access course lesson. 

## **9.6 Execution flow** 

```
Route metadata permission
  ↓
Load ResourceRef
  ↓
can(actor, permission, resourceRef, ctx)
  ↓
Read roles and permission grants
  ↓
Apply explicit deny overrides
  ↓
Apply explicit allow overrides
  ↓
Evaluate role permission
  ↓
Evaluate ownership predicate if permission requires owner
  ↓
Evaluate relationship predicate if permission requires relationship
  ↓
Allow or deny with safe reason
```

## **9.7 Platform scope** 

Platform roles are not tenant roles. 

Platform access requires: 

- Platform route prefix 

- 

- Platform principal 

- Platform permission 

- 

- `withPlatformScope()` 

- 

- Reason where accessing tenant/customer data 

- 

- Same-transaction audit 

25 

Tenant code cannot import platform database scope. 

## **10. Membership Architecture** 

## **10.1 Membership statuses** 

Membership state controls protected tenant access. 

|Status|||Meaning|Protected access|
|---|---|---|---|---|
|`ACTIVE`|||Member may access allowed tenant<br>routes.|Allowed after entitlement and<br>permission.|
|`INVITED`|||Invitation exists but not accepted.|Blocked except invitation acceptance.|
|`SUSPENDED`|||Member is blocked by tenant/admin.|Blocked.|
|`REMOVED`|||Member was removed.|Blocked; re-invite required.|
||||||



## **10.2 State transitions** 

```
INVITED
  ↓ accept invitation
ACTIVE
  ↓ suspend
SUSPENDED
  ↓ reactivate
ACTIVE
  ↓ remove
REMOVED
```

Rules: 

1. `REMOVED` is terminal for that membership row unless locked artifacts define reactivation. 2. Re-entry requires a new approved invitation flow. 

3. Membership status changes require audit. 

4. Role assignments must not imply membership activation. 

5. Authentication alone does not grant tenant access. 

## **10.3 Membership gate implementation** 

```
exportasyncfunctionrequireActiveMembership(
tx:Prisma.TransactionClient,
args:{
tenantId:string;
principalId:string;
}
```

26 

```
){
constmembership=awaittx.membership.findUnique({
where:{
tenantId_authPrincipalId:{
tenantId:args.tenantId,
authPrincipalId:args.principalId,
},
},
});
if(!membership)thrownewAppError('NO_MEMBERSHIP',403);
if(membership.status==='INVITED')thrownew
AppError('MEMBERSHIP_PENDING',403);
if(membership.status==='SUSPENDED')thrownew
AppError('MEMBERSHIP_SUSPENDED',403);
if(membership.status==='REMOVED')thrownew
AppError('MEMBERSHIP_REMOVED',403);
returnmembership;
}
```

## **10.4 Public allow-list** 

Only approved public routes bypass ACTIVE membership: 

- Landing • Public diagnostic • Certificate verification 

- Login/signup • Invitation acceptance 

All other tenant routes require ACTIVE membership. 

## **11. Entitlement Architecture** 

## **11.1 Core rule** 

Entitlements answer: 

```
Is this tenant allowed to use this capability?
```

Permissions answer: 

```
Is this actor allowed to perform this action?
```

Both must pass. 

27 

## **11.2 Evaluation order** 

```
Route metadata declares entitlement
```

```
  ↓
enforceEntitlement(tenantId, entitlementKey)
  ↓
Read active entitlement row
  ↓
Pass or throw ENTITLEMENT_REQUIRED
  ↓
Only then call can()
```

## **11.3 Rules** 

1. Never check plan names. 

2. Never hardcode tenant packages. 

3. Never allow permission to override missing entitlement. 

4. Entitlement failure returns `ENTITLEMENT_REQUIRED` . 

- UI may hide or show upgrade state, but backend remains final authority. 

5. 

6. Entitlement changes require audit and outbox event. 

## **11.4 Implementation example** 

```
exportasyncfunctionenforceEntitlement(
tx:Prisma.TransactionClient,
args:{
tenantId:string;
key:string;
}
){
constentitlement=awaittx.entitlement.findUnique({
where:{
tenantId_key:{
tenantId:args.tenantId,
key:args.key,
},
},
});
if(!entitlement||entitlement.status!=='ACTIVE'){
thrownewAppError('ENTITLEMENT_REQUIRED',403);
}
returnentitlement;
}
```

28 

## **11.5 Gate types** 

|Gate|Example|
|---|---|
|Route gate|Community module disabled for tenant.|
|Action gate|Certifcate issue feature disabled.|
|Limit gate|Export or analytics limit reached where approved.|
|Feature gate|Readiness, gamifcation, custom domain, analytics.|



## **12. Transaction Architecture** 

## **12.1** **`withTenantTx()`** 

All tenant database work must run inside `withTenantTx()` . 

```
exportasyncfunctionwithTenantTx<T>(
ctx:TenantRequestContext,
fn:(tx:Prisma.TransactionClient)=>Promise<T>
):Promise<T>{
if(!ctx.tenantId){
thrownewError('Missing tenant context');
}
if(!ctx.actorMembershipId&&!ctx.allowAnonymousTenantRead){
thrownewError('Missing actor membership context');
}
returnprisma.$transaction(async(tx)=>{
awaittx.$executeRaw`
      select set_config('app.tenant_id', ${ctx.tenantId}, true)
    `;
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

29 

## **12.2** **`withPlatformScope()`** 

Platform work must be physically separate from tenant work. 

```
exportasyncfunctionwithPlatformScope<T>(
args:{
principalId:string;
requestId:string;
reason:string;
},
fn:(tx:Prisma.TransactionClient)=>Promise<T>
):Promise<T>{
if(!args.reason){
thrownewAppError('PLATFORM_REASON_REQUIRED',403);
}
returnprisma.$transaction(async(tx)=>{
awaittx.$executeRaw`select set_config('app.request_id', $
{args.requestId}, true)`;
awaittx.$executeRaw`select set_config('app.platform_principal_id', $
{args.principalId}, true)`;
awaitwritePlatformScopeEnterAudit(tx,args);
constresult=awaitfn(tx);
awaitwritePlatformScopeExitAudit(tx,args);
returnresult;
});
}
```

## **12.3 Transaction boundaries** 

Single transaction should include: 

- Source mutation 

- Audit row 

- Outbox row 

- Idempotency write 

- Minimal declared projection update 

Separate transactions should be used for: 

- Worker event processing 

- Retry attempts 

- Analytics batch aggregation 

- Export jobs 

- Notification dispatches 

30 

## **12.4 Rollback strategy** 

If any required write fails, the transaction rolls back. 

Rollback examples: 

- Course publish mutation fails → no audit/outbox commit. 

- → 

- Certificate issue fails no notification event. 

- Assessment submit fails → no competency signal. 

- Moderation decision fails → no case status change. 

## **13. Prisma Architecture** 

## **13.1 Prisma folder structure** 

```
prisma/
├── schema.prisma
├── models/
│   ├── tenancy.prisma
│   ├── identity.prisma
│   ├── access.prisma
│   ├── branding.prisma
│   ├── learning.prisma
│   ├── assessment.prisma
│   ├── competency.prisma
│   ├── certificates.prisma
│   ├── community.prisma
│   ├── moderation.prisma
│   ├── notifications.prisma
│   ├── analytics.prisma
│   ├── audit.prisma
│   └── events.prisma
├── migrations/
├── sql/
│   ├── rls/
│   ├── triggers/
│   ├── indexes/
│   ├── grants/
│   └── partitions/
└── seeds/
```

If the selected Prisma setup cannot directly split model files, `schema.prisma` remains the generated concatenation target while logical model files are kept for maintainability. 

31 

## **13.2 Client management** 

```
import{PrismaClient}from'@prisma/client';
declareglobal{
varprisma:PrismaClient|undefined;
}
exportconstprisma=
global.prisma??
newPrismaClient({
log:['error','warn'],
});
if(process.env.NODE_ENV!=='production'){
global.prisma=prisma;
}
```

Rules: 

1. Only `src/db/prisma.ts` creates Prisma client. 

2. Repositories receive `Prisma.TransactionClient` . 

3. No route imports Prisma directly. 

4. No service imports global Prisma directly. 

5. No background worker bypasses tenant/platform wrappers. 

## **13.3 Query conventions** 

1. Use cursor pagination. 2. Select explicit fields. 

3. Avoid unbounded `findMany` . 

4. Avoid N+1 queries. 

5. Use indexed filters only. 

6. Never expose `auth_principals` globally through tenant APIs. 

7. Use raw SQL only inside approved SQL/repository helpers. 

8. Raw SQL must be tested for tenant isolation. 

## **13.4 Migration strategy** 

Migration order: 

```
Global tables
Tenant root tables
Tenant-scoped tables
Append-only tables
Derived projection tables
Indexes
RLS helper functions
```

32 

```
RLS policies
Grants
Append-only triggers
Audit hash-chain triggers
Idempotency constraints
Seed catalogue data
Tenant provisioning smoke seed
RLS / IDOR test harness
```

## **13.5 Seed strategy** 

Seeds are deterministic and idempotent. 

Seed categories: 

- Permission catalogue 

- Permission bundles 

- System tenant roles 

- Role permissions • Feature flags 

- Entitlement keys 

- Item-type registry 

- First-party extension points 

- Workflow templates 

- FundedBeyond Tenant #1 config 

- Second smoke-test tenant config 

Rules: 

1. Stable seed IDs. 

2. No platform roles in tenant role tables. 

3. No FundedBeyond-specific code. 

4. Tenant-specific data inserted through provisioning/configuration. 

5. Second tenant proves no fork. 

## **14. RLS Architecture** 

## **14.1 Tenant context injection** 

Tenant context is injected with transaction-local `set_config(..., true)` . 

Never use session-level `SET` . 

Required GUCs: 

33 

```
app.tenant_id
app.actor_membership_id
app.request_id
```

## **14.2 Helper function** 

```
createorreplacefunctionapp.current_tenant_id()
returnsuuid
languagesql
stable
as$$
selectnullif(current_setting('app.tenant_id',true),'')::uuid
$$;
```

## **14.3 Policy pattern** 

```
altertablecoursesenablerowlevelsecurity;
createpolicycourses_tenant_isolation
oncourses
using(tenant_id=app.current_tenant_id())
withcheck(tenant_id=app.current_tenant_id());
```

## **14.4 RLS enforcement** 

Rules: 

1. RLS enabled on every tenant-scoped table. 

2. RLS forced where required. 

3. Partitions must inherit or explicitly define RLS. 

4. Append-only tenant tables still enforce tenant isolation. 

5. Global catalogues use grants, not tenant RLS. 

6. Platform bypass uses platform role only. 

## **14.5 Platform bypass rules** 

Platform access: 

- Uses separate platform role/scope. 

- Requires platform permission. • Requires reason. 

- Audits enter and exit. 

- Cannot be invoked from tenant route. 

- 

- Cannot be inferred from tenant membership. 

34 

## **14.6 RLS tests** 

Required tests: 

```
Tenant A cannot read Tenant B course by ID.
Tenant A cannot update Tenant B lesson by ID.
Tenant A cannot list Tenant B attempts.
Tenant A cannot infer Tenant B resource existence.
Host tenant beats JWT tenant.
Anonymous diagnostic still writes tenant from host.
Public certificate verification returns minimal projection only.
Platform access requires reason and audit.
```

## **15. Eventing Architecture** 

## **15.1 Outbox pattern** 

All domain events are written to `outbox_events` inside the source transaction. 

```
Service mutation
  ↓
Audit write
  ↓
Outbox write
  ↓
Commit
  ↓
Worker polls outbox
  ↓
Handler processes event
  ↓
Delivery recorded
```

## **15.2 Event envelope** 

```
typeOutboxEvent={
eventId:string;
tenantId:string|null;
eventType:string;
aggregateType:string;
aggregateId:string;
actorMembershipId?:string;
occurredAt:string;
schemaVersion:number;
```

35 

```
payloadJson:unknown;
metadataJson:{
requestId:string;
idempotencyKey?:string;
};
idempotencyKey?:string;
};
```

## **15.3 Publishing example** 

```
awaitoutbox.publish(tx,{
ctx,
eventType:'assessment.submitted',
aggregateType:'attempt',
aggregateId:attempt.id,
payload:{
attemptId:attempt.id,
assessmentId:attempt.assessmentId,
},
idempotencyKey,
});
```

## **15.4 Event processing** 

Workers process events idempotently. 

```
Poll available outbox events
  ↓
Lock event batch
  ↓
Validate event schema
  ↓
Call registered handler
  ↓
Record event delivery
  ↓
Mark complete or schedule retry
```

## **15.5 Event replay** 

Replay is allowed only for: 

- Rebuilding projections 

- Recalculating analytics/read models • Recovering failed side effects 

- Debugging with platform authorization 

36 

Replay must not duplicate source mutations. 

## **15.6 Dead-letter handling** 

Events move to dead letter when: 

- Max retries exceeded 

- Schema invalid 

- Handler consistently fails 

- Target resource no longer processable 

Dead-letter records include: 

- Event ID 

- Error code 

- Safe error message 

- Retry count 

- Last attempted at 

- Request ID 

- Tenant ID where applicable 

## **16. Audit Architecture** 

## **16.1 Audit creation** 

Audit entries are written through `auditWriter` . 

```
awaitauditWriter.write(tx,{
ctx,
action:'certificate.issued',
target:{
type:'certificate',
id:certificate.id,
},
before:null,
after:{
status:'ISSUED',
},
reason:input.reason,
});
```

## **16.2 Audit storage** 

Audit entries are: 

- Append-only 

- Hash-chained 

37 

- Partitioned where required 

- Tenant-scoped when tenant-related 

- Global/platform-scoped when platform-related 

No update. No delete. Corrections are compensating entries. 

## **16.3 Audit correlation** 

Every audit entry includes: 

- Request ID 

- Tenant ID where applicable 

- Actor membership ID where applicable 

- Platform principal ID where applicable 

- Action 

- Target type 

- Target ID 

- Before/after where appropriate 

- IP/user-agent hash where appropriate 

- Reason for privileged actions 

## **16.4 Audit search** 

Audit search uses indexed allow-listed filters: 

- Action 

- Target type 

- Target ID 

- Actor membership 

- Occurred-at range 

- Severity/category where approved 

No free-form SQL filters. 

## **16.5 Audit rules** 

1. Sensitive mutation without audit is a failed implementation. 

2. Audit must be in the same transaction as mutation. 

3. Platform scope access audits enter and exit. 

4. Denials may be audited where sensitive. 

5. Audit logs must not expose hidden cross-tenant resource names. 

## **17. Storage Architecture** 

## **17.1 R2 integration** 

Cloudflare R2 stores approved file assets only. 

38 

Backend stores references, not public raw object access. 

R2 is used for: 

- Branding assets 

- Lesson assets 

- Certificate template assets where approved 

- Export job files 

- Archive files where approved 

Video is not self-hosted. Lessons store provider references for video. 

## **17.2 Upload flow** 

```
Client requests upload intent
  ↓
API route resolves tenant/auth/membership/can()
  ↓
Service validates asset type and size
  ↓
Create storage reference where needed
  ↓
Generate signed upload URL
  ↓
Client uploads to R2
  ↓
Client confirms upload
  ↓
Backend verifies object metadata
  ↓
Asset becomes usable
```

## **17.3 Download flow** 

```
Client requests asset
  ↓
Route resolves tenant/auth/membership/can()
  ↓
Service verifies resource relationship
  ↓
Generate short-lived signed URL
  ↓
Return signed URL
```

39 

## **17.4 Signed URLs** 

Rules: 

1. Short expiration. 

2. Resource-specific. 

3. Tenant-scoped path. 

4. Generated only after authorization. 

5. No permanent public protected asset URLs. 

6. Public assets use approved public projection only. 

## **17.5 Security controls** 

- MIME type allow-list 

- Size limits 

- Extension validation 

- Malware scan hook where available 

- Tenant-scoped object keys 

- No raw secret storage 

- R2 credentials stored as environment/secret references 

- Audit for sensitive asset mutations 

## **18. Authentication Architecture** 

## **18.1 Supabase Auth** 

Supabase Auth is the identity provider. 

Backend responsibilities: 

1. Verify session token. 

2. Resolve or provision `auth_principals` . 

3. Link principal to tenant membership. 

4. Enforce ACTIVE membership for protected routes. 

5. Prevent global auth identity from becoming tenant access automatically. 

## **18.2 Session verification** 

```
Request
  ↓
Extract Supabase session/JWT
  ↓
Verify token with Supabase
  ↓
Resolve auth_principals row
```

40 

```
  ↓
Continue to membership gate
```

## **18.3 User provisioning** 

First authentication creates or links global principal. 

```
Supabase user
  ↓
auth_principals
  ↓
Tenant-specific memberships
  ↓
member_profiles
```

Tenant APIs return member/profile projections, not raw global principal data. 

## **18.4 Invitation acceptance** 

```
User opens invite link
  ↓
Host resolves tenant
  ↓
Invite token validated
  ↓
Supabase auth completed if needed
  ↓
auth_principal resolved
  ↓
membership INVITED → ACTIVE
  ↓
member_profile created/updated
  ↓
audit membership activation
  ↓
outbox membership.created/status_changed
```

## **18.5 Membership linking** 

Membership is unique per: 

```
tenant_id + auth_principal_id
```

41 

Rules: 

1. Same Supabase user may have memberships in multiple tenants. 

2. Host determines which tenant membership is checked. 

3. Tenant A membership never grants Tenant B access. 

4. Removed/suspended membership blocks access even if session is valid. 

## **19. Notification Architecture** 

## **19.1 In-app notifications** 

In-app notifications are tenant-scoped and membership-scoped. 

Notification records are created from approved event triggers. 

## **19.2 Event triggers** 

Examples: 

- Course published 

- Lesson completed 

- Assessment graded 

- Certificate issued 

- Moderation case updated 

- Role assigned 

- Export ready 

- Invitation accepted 

- Readiness band changed 

## **19.3 Delivery pipeline** 

```
Outbox event
  ↓
Notification consumer
  ↓
Resolve template
  ↓
Resolve recipients
  ↓
Create notification_dispatches
  ↓
Create in-app notification projection
  ↓
Optional provider dispatch where approved
```

42 

## **19.4 Read state** 

Read state is per membership. 

```
GET /me/notifications
POST /me/notifications/:id/read
```

Rules: 

1. Learners can read own notifications only. 

2. Admin notification templates require notification template permissions. 

3. Notification dispatch is idempotent. 

4. Read state changes are safe, scoped, and audited only where required. 

## **20. Community & Moderation Architecture** 

## **20.1 Community entities** 

Community backend supports approved Phase 1 community surfaces: 

- Spaces 

- Posts 

- Comments 

- Reactions 

- Reports 

## **20.2 Post lifecycle** 

```
Draft/Created
  ↓
Visible
  ↓ report
Reported
  ↓ moderation review
Kept / Hidden / Locked / Deleted according to approved status model
```

Backend rules: 

1. Members must belong to allowed space where required. 

- Post author ownership checks live inside `can()` . 

2. 

- Moderator actions use moderation permissions. 

3. 

- Reports do not reveal reporter identity to regular learners. 

4. 

5. Deleted/hidden states do not leak protected moderation metadata. 

43 

## **20.3 Comment lifecycle** 

```
Create comment
  ↓
Edit own comment where allowed
  ↓
Report or moderate
  ↓
Hide/delete according to permission
```

## **20.4 Reaction lifecycle** 

```
Create reaction
  ↓
Update/remove own reaction
  ↓
Recalculate counts/projection
```

Reactions may use optimistic frontend UI, but server remains final authority. 

## **20.5 Report lifecycle** 

```
Member reports content
  ↓
moderation.case_opened event
  ↓
Moderation queue
  ↓
Moderator decision
  ↓
Audit decision
  ↓
Notify affected users where approved
```

## **20.6 Appeals** 

Appeals follow approved moderation case workflow only. No separate appeal entity or workflow is introduced beyond locked database/API scope. 

44 

## **21. Competency & Readiness Architecture** 

## **21.1 Signal collection** 

Competency signals are generated from approved learning events: 

- Lesson completion 

- Assessment performance 

- Practice/swipe responses 

- Path step completion 

- Diagnostic result where approved 

- Grading outcomes 

Signals are append-only. 

## **21.2 Signal write flow** 

```
Source event
  ↓
Competency consumer
  ↓
Validate signal schema
  ↓
Write competency_signal
  ↓
Recalculate affected dimension
  ↓
Write score snapshot
  ↓
Emit competency.score_changed if changed
```

## **21.3 Score calculation** 

Score calculation uses approved scoring config. 

Rules: 

1. No hardcoded FundedBeyond scoring logic. 

2. Dimension definitions come from configuration/data. 

3. Signals are append-only. 

4. Score snapshots are derived/rebuildable. 

5. Recalculation must be idempotent. 

## **21.4 Dimension aggregation** 

```
Signals
```

- `↓` 

45 

```
Dimension-level score
  ↓
Aggregate profile
  ↓
Readiness input
```

## **21.5 Readiness evaluation** 

Readiness reads competency projections and readiness policy config. 

```
Competency score changed
  ↓
Readiness evaluator
  ↓
Apply tenant readiness policy
  ↓
Calculate band
  ↓
Store readiness projection
  ↓
Emit readiness.band_changed where changed
```

Rules: 

1. Readiness is educational, not financial advice. 

2. No guaranteed passing/profit/funding language. 

3. CTA token generation is separate and audited where required. 

4. Readiness policy changes require audit. 

## **22. Swipe Learning Architecture** 

## **22.1 Purpose** 

Swipe Learning is implemented as approved Phase 1 practice/item-type behavior, not a platform fork. 

It uses: 

- Item registry • Practice sessions 

- Practice responses 

- Competency signals 

- Gamification events where approved 

- 

46 

## **22.2 Session creation** 

```
Learner starts swipe/practice
  ↓
Route validates access
  ↓
Service selects approved item set
  ↓
Create practice_session
  ↓
Return first response payload/projection
```

## **22.3 Response capture** 

```
Learner submits swipe response
  ↓
Idempotency-Key required
  ↓
Validate response
  ↓
Write practice_response
  ↓
Score response
  ↓
Emit competency.signal_recorded
  ↓
Emit streak/XP event where approved
  ↓
Return server-confirmed feedback
```

## **22.4 Scoring** 

Rules: 

1. Item type determines scoring handler. 

2. Scoring handler must be registered through approved item-type registry. 

3. No tenant-specific branching. 

4. Response writes are append-only. 

5. Duplicate response idempotency returns original result. 

## **22.5 Competency contribution** 

```
practice_response
  ↓
score result
  ↓
```

47 

```
competency_signal
  ↓
score snapshot
  ↓
readiness update if affected
```

## **23. Analytics Architecture** 

## **23.1 Read models** 

Analytics does not query raw high-volume tables directly for dashboards. 

Use read models/projections for: 

- Learner progress 

- Course completion 

- Assessment performance 

- Competency trends 

- Readiness bands 

- Community activity 

- Notification engagement 

- Certificate issuance 

- Moderation workload 

## **23.2 Aggregations** 

Aggregation flow: 

```
Domain event
  ↓
Analytics consumer
  ↓
Update rollup/read model
  ↓
Dashboard reads projection
```

## **23.3 Dashboards** 

Dashboard APIs must: 

1. Use approved analytics routes only. 

2. Apply tenant RLS. 

3. Apply entitlement before permission where analytics is gated. 

4. Use cursor pagination for drilldowns. 

5. Avoid unbounded date ranges. 

6. Redact cross-tenant data. 

48 

## **23.4 Export jobs** 

Large exports use background jobs. 

```
User requests export
  ↓
Authorize + audit
  ↓
Create export job
  ↓
Outbox export.requested
  ↓
Worker generates file
  ↓
Store file in R2
  ↓
Notify user when ready
```

## **23.5 Large dataset strategy** 

1. Partition high-volume append-only tables. 

2. Use rollups for dashboard cards. 

3. Use cursor pagination for lists. 

4. Use async exports for large downloads. 

5. Use indexed filter allow-lists. 

6. Use retention/archive policies. 

7. Avoid offset pagination. 

## **24. Background Jobs Architecture** 

## **24.1 Worker categories** 

```
jobs/
├── workers/
```

- `│   ├── outbox-worker.ts` 

- `│   ├── notification-worker.ts` 

- `│   ├── analytics-worker.ts` 

- `│   ├── competency-worker.ts` 

- `│   ├── readiness-worker.ts` 

- `│   ├── export-worker.ts` 

- `│   └── partition-worker.ts` 

- `├── schedules/` 

- `│   ├── retry-schedule.ts` 

- `│   ├── partition-schedule.ts` 

- `│   └── cleanup-schedule.ts` 

49 

```
└── consumers/
    ├── assessment.consumer.ts
    ├── lesson.consumer.ts
    ├── community.consumer.ts
    └── certificate.consumer.ts
```

## **24.2 Worker rules** 

1. Workers validate payloads with Zod. 

2. Workers use `withTenantTx()` for tenant data. 

3. Workers use `withPlatformScope()` only for platform jobs. 

4. Workers are idempotent. 

5. Workers record delivery attempts. 

6. Workers dead-letter exhausted failures. 

7. Workers never bypass RLS. 

## **24.3 Scheduled jobs** 

Approved scheduled jobs include: 

- Outbox retry 

- Dead-letter review support 

- Partition pre-creation 

- Delivered event archival 

- Export cleanup 

- Notification retry 

- Analytics rollup refresh where approved 

No scheduled job may add new product workflow. 

## **24.4 Retry strategy** 

```
Attempt 1
  ↓ fail
Backoff
  ↓
Attempt 2
  ↓ fail
Backoff
  ↓
Attempt N
  ↓ fail
Dead letter
```

Retries must be idempotent and must not duplicate: 

- Notifications 

- Point ledger entries 

50 

• Competency signals • Certificates • Audit rows • Export files 

## **25. Error Handling Architecture** 

## **25.1 Error taxonomy** 

|Category|Examples|Examples|
|---|---|---|
|Validation|Invalid body, invalid params, unsupported flter.||
|Auth|Missing/expired session.||
|Membership|No membership, pending, suspended, removed.||
|Entitlement|Tenant lacks capability.||
|Permission|`can()`|denied.|
|Ownership|Actor does not own resource.||
|Relationship|Actor lacks required relationship.||
|Confict|Duplicate slug, state confict, idempotency replay.||
|Rate limit|Too many requests.||
|Tenant state|Suspended/unavailable/deleted tenant.||
|Internal|Unexpected backend failure.||



## **25.2 Error envelope** 

```
typeErrorEnvelope={
error:{
code:string;
message:string;
requestId:string;
details?:unknown;
};
};
```

`details` is allowed only for safe validation errors. 

51 

## **25.3 Safe messages** 

Error messages must not reveal: 

- Whether another tenant owns a resource 

- Hidden moderation data 

- Hidden platform data 

- Global identity internals 

- Permission catalogue internals 

- Secret references 

- Raw storage keys 

## **25.4 Request IDs** 

Every response includes request ID. 

Request ID is used across: 

- Logs 

- Audit entries 

- Outbox metadata 

- Error envelopes 

- Sentry traces 

- Better Stack logs 

- Support workflows 

## **25.5 Error mapping** 

```
try{
returnawaithandler();
}catch(error){
returnmapErrorToEnvelope(error,requestId);
}
```

Mapping rules: 

- Zod error → `400 VALIDATION_ERROR` 

- Missing auth → `401 AUTH_REQUIRED` 

- Membership block → `403 MEMBERSHIP_*` 

- Entitlement failure → `403 ENTITLEMENT_REQUIRED` 

- `can()` denial → `403 PERMISSION_DENIED` 

- Resource not found/hidden → safe `404` 

- 

- Idempotency replay → `409 IDEMPOTENCY_REPLAY` 

- Unknown → `500 INTERNAL_ERROR` 

52 

## **26. Observability Architecture** 

## **26.1 Sentry** 

Sentry captures: 

- Unhandled exceptions 

- Route failures 

- Worker failures 

- Transaction failures 

- RLS unexpected failures 

- Storage failures 

Sentry tags: 

- `requestId` 

- `route` 

- 

- 

- 

- 

- 

- `tenantId` hashed or safe identifier 

- `actorMembershipId` hashed where allowed 

- `module` 

- `eventType` 

- `jobName` 

## **26.2 PostHog** 

PostHog captures product analytics events. 

Rules: 

1. No raw secrets. 

2. No sensitive payloads. 

3. No cross-tenant data. 

4. Use tenant-safe identifiers. 

5. Product analytics never replaces audit. 

Examples: 

- Diagnostic started 

- Lesson completed 

- Attempt submitted 

- Certificate viewed 

- Community post created 

- CTA token created 

## **26.3 Better Stack** 

Better Stack handles: 

- Structured logs 

53 

- Uptime checks 

- Route health 

- Worker health 

- Alerting 

## **26.4 Tracing** 

Trace spans: 

```
request
  ├── tenant.resolve
  ├── auth.verify
  ├── membership.gate
  ├── entitlement.gate
  ├── resource.load
  ├── can.evaluate
  ├── service.execute
  ├── repository.query
  ├── audit.write
  └── outbox.write
```

## **26.5 Logging** 

Structured log example: 

```
{
"level":"info",
"message":"route_completed",
"requestId":"req_...",
"route":"/api/v1/courses/:id",
"method":"GET",
"status":200,
"durationMs":42
}
```

Never log: 

- Access tokens 

- Refresh tokens 

- Raw passwords 

- Raw IP where hashing is required 

- R2 signed URLs 

- Full request bodies for sensitive routes 

- Secret values 

54 

## **27. Testing Architecture** 

## **27.1 Test folders** 

```
tests/
├── unit/
├── repository/
├── service/
├── authorization/
├── tenant-isolation/
├── api/
├── events/
├── workers/
├── storage/
└── fixtures/
```

## **27.2 Unit tests** 

Cover: 

- Zod schemas 

- Error mapping 

- Pagination helpers 

- Idempotency helpers 

- Permission metadata helpers 

- Event payload validators 

## **27.3 Repository tests** 

Cover: 

- Query shape • Indexed filters 

- Cursor pagination 

- Projection safety 

- No global identity leakage 

- RLS behavior where integration DB is available 

## **27.4 Service tests** 

Cover: 

- Business invariant success 

- Business invariant failure 

- Transaction rollback 

- Audit written 

- Outbox written 

55 

- Idempotency replay 

- No tenant-specific branching 

## **27.5 Authorization tests** 

Cover: 

- Default deny 

- Role allow/deny 

- Permission override allow/deny 

- Ownership checks 

- Relationship checks 

- Entitlement before permission 

- Platform role isolation 

## **27.6 Tenant isolation tests** 

Required for every tenant-facing module: 

```
Tenant A cannot read Tenant B by ID.
Tenant A cannot mutate Tenant B by ID.
Tenant A cannot infer Tenant B existence.
Host wins over JWT tenant.
Client tenant_id is ignored/rejected.
Protected route blocks no membership.
Protected route blocks INVITED/SUSPENDED/REMOVED.
```

## **27.7 API tests** 

Cover: 

- Success envelope 

- Error envelope 

- Request ID presence 

- Zod validation 

- Rate limit where practical 

- Idempotency header requirement 

- Route metadata presence 

- Audit/outbox side effects 

## **27.8 Event tests** 

Cover: 

- Event schema validation 

- Handler idempotency 

- Retry behavior 

- Dead-letter behavior 

- Replay behavior 

56 

• Projection rebuild 

## **28. Security Architecture** 

## **28.1 OWASP controls** 

Backend must enforce: 

- Authentication verification 

- Authorization on every protected route 

- Input validation with Zod 

- Output shaping 

- Rate limiting 

- Secure headers where relevant 

- Safe error messages 

- CSRF controls for Server Actions/forms where needed 

- Logging without secrets 

- Dependency scanning 

- Secure file upload controls 

## **28.2 IDOR prevention** 

IDOR prevention is mandatory. 

Rules: 

1. Do not trust path ID ownership. 

2. Load resource ref inside tenant transaction. 

3. Run `can()` with ownership/relationship predicates. 

4. Return safe 404/403 without cross-tenant leakage. 

5. Test every sensitive route with cross-tenant IDs. 

## **28.3 Tenant isolation** 

Tenant isolation must be proven by tests before feature work proceeds. 

Controls: 

- Host-based tenant resolution 

- No client `tenant_id` 

- `withTenantTx` 

- Transaction-local GUCs 

- RLS 

- `can()` 

- Membership gate 

- IDOR tests 

57 

## **28.4 Input validation** 

Every untrusted boundary uses Zod: 

- API params • API query • API body • Server Action form data • Event payload • Worker payload 

- Environment variables 

## **28.5 Audit requirements** 

Audit is required for irreversible or privileged action. 

No sensitive mutation may merge without: 

- Audit action • Target • Actor • Tenant/platform scope • Request ID • Reason where required • Test proving audit write 

## **28.6 Platform controls** 

Platform access requires: 

- Separate route namespace 

- Platform principal • Platform permission • Reason-bound scope 

- Audit enter/exit 

- No tenant role escalation 

- CI import boundary enforcement 

## **29. Backend Engineering Standards** 

## **29.1 Naming conventions** 

|Type|Convention||
|---|---|---|
|Service|`<verb><Domain>Service`||
|Repository|`<domain>Repository.<method>`||



58 

|Type|Convention||||
|---|---|---|---|---|
|Schema|`<Action><Domain>InputSchema`||||
|Event|`<domain>.<past_tense_action>`||||
|Permission|`<resource>.<action>`||||
|Test|`<domain>.<behavior>.test.ts`||||
|Resource loader|`load<Domain>ResourceRef`||||



## **29.2 Folder conventions** 

1. Domain code lives in `src/modules/<domain>` . 

2. Shared backend primitives live in top-level backend folders. 

3. API routes stay thin. 

4. Repositories stay close to their domain. 

5. Tests stay beside module plus global `tests` for cross-cutting suites. 

## **29.3 Service conventions** 

Services must: 

- Receive `ctx` 

- Receive `tx` 

- Receive validated input 

- Receive loaded resource when required 

- Return DTOs 

- Write audit/outbox where required • Avoid HTTP concerns 

## **29.4 Repository conventions** 

Repositories must: 

- Receive `tx` 

- Select explicit fields 

- Use cursor pagination 

- Use indexed filters 

- 

- Return persistence/domain data • Avoid authorization logic • Avoid tenant IDs from clients 

## **29.5 API conventions** 

API routes must: 

- Export metadata • Use route wrapper • Validate input/output 

59 

- Return standard envelopes 

- Include request ID 

- Require idempotency key where declared 

- Call services only 

## **29.6 Event conventions** 

Events must: 

- Use approved event type 

- Include schema version 

- Include tenant ID where tenant-scoped 

- Include request ID 

- Be idempotent 

- Have handler tests 

- Dead-letter after max retries 

## **29.7 Test conventions** 

Every protected route requires tests for: 

- 401 

- 403 membership • 403 entitlement where applicable 

- 403 permission 

- Ownership/relationship denial where applicable 

- Cross-tenant IDOR 

- Success • Audit/outbox where required 

## **30. Cursor & Claude Backend Rules** 

## **30.1 How AI should generate routes** 

AI must: 

1. Check API Inventory first. 

2. Create route only if approved. 

3. Export route metadata. 

4. Use approved route wrapper. 

5. Validate params/query/body with Zod. 

6. Call service only. 

7. Return response envelope. 

8. Add API tests. 

AI must not: 

- Invent endpoints. 

60 

• Add convenience routes. 

- Skip metadata. • Use Prisma in route. 

- Check roles directly. • Accept `tenant_id` . 

## **30.2 How AI should generate services** 

AI must: 

1. Keep business logic in service. 2. Receive `ctx` and `tx` . 3. Use repositories for data access. 4. Use audit writer for sensitive actions. 5. Use outbox for side effects. 6. Use idempotency where required. 7. Return DTO only. 

AI must not: 

- Import `NextRequest` . • Return `NextResponse` . • Create Prisma client. • Hardcode FundedBeyond. • Add new workflows. 

## **30.3 How AI should generate repositories** 

AI must: 

1. Accept `Prisma.TransactionClient` . 2. Use explicit `select` . 3. Use cursor pagination. 4. Use indexed filters. 5. Avoid authorization. 6. Avoid hidden cross-domain writes. 

AI must not: 

- Call `can()` . • Open transaction. • Accept client tenant ID. • Return unsafe global principal data. 

## **30.4 How AI should generate transactions** 

AI must: 

1. Use `withTenantTx()` for tenant work. 2. Use `withPlatformScope()` for platform work. 3. Put mutation, audit, and outbox in one transaction. 

61 

4. Keep third-party side effects outside transaction through outbox. 

AI must not: 

- Use session-level `SET` . 

- Run Prisma globally for tenant data. 

- Mix platform and tenant scope. 

## **30.5 How AI should generate events** 

AI must: 

1. Use approved event names. 

2. Validate payload schema. 

3. Write to outbox inside transaction. 

4. Make handlers idempotent. 

5. Add retry and dead-letter tests. 

AI must not: 

- Emit events without source mutation. 

- Use eventing to bypass authorization. 

- Add unapproved event types for product features. 

## **30.6 How AI should generate tests** 

AI must add: 

- Unit tests 

- Service tests 

- Repository tests 

- API tests 

- Authorization tests 

- Tenant isolation tests 

- Event tests where outbox used 

Forbidden AI patterns: 

```
// Forbidden: direct role check
if(user.role==='admin'){}
```

```
// Forbidden: Prisma in route
awaitprisma.course.findMany();
```

```
// Forbidden: client tenant ID
consttenantId=req.body.tenantId;
```

```
// Forbidden: hidden Server Action API
exportasyncfunctiondeleteCourseWithoutRouteMetadata(){}
```

62 

```
// Forbidden: tenant fork
if(tenant.slug==='fundedbeyond'){}
```

## **31. Final Validation** 

## **31.1 API Inventory Compliance** 

## **Result:** PASS 

This backend package creates no new API routes. It defines implementation structure only for approved `/api/v1/**` , `/api/v1/public/**` , `/api/v1/internal/**` , and `/api/v1/platform/**` surfaces. 

## **31.2 Permission Matrix Compliance** 

**Result:** PASS 

The package preserves: 

- Default deny 

- `can()` as the only authorization decision point 

- Ownership inside `can()` 

- Relationship inside `can()` 

- Entitlement before permission 

- ACTIVE membership gate 

- Platform scope isolation 

## **31.3 Database Design Compliance** 

**Result:** PASS 

The package preserves: 

- PostgreSQL + Prisma 

- Shared multi-tenant database 

- Transaction-local tenant context 

- RLS policies 

- Append-only audit/event tables 

- Idempotency constraints 

- Partition strategy 

- Deterministic seeds 

## **31.4 Technical Architecture Compliance** 

**Result:** PASS 

63 

The package follows: 

- API-first design 

- Service/repository separation 

- Zod at every boundary 

- RLS backstop 

- Audit/outbox requirements 

- Observability requirements 

- CI enforcement expectations 

## **31.5 Frontend Architecture Compatibility** 

**Result:** PASS 

The backend supports the frontend architecture by providing: 

- Server-authoritative route gates 

- Standard response envelopes 

- Safe error codes 

- Request IDs 

- Approved API routes 

- Entitlement/permission projections 

- Tenant-safe public and protected data 

- No hidden Server Action-only behavior 

## **31.6 Multi-Tenant Validation** 

**Result:** PASS, conditional on tests 

Required before Phase 1 feature work: 

1. Host resolves tenant before auth/business logic. 

2. Host wins over JWT tenant claim. 

3. No client-supplied tenant ID accepted. 

4. ACTIVE membership required for protected routes. 

5. RLS enabled on all tenant tables. 

6. `withTenantTx()` uses `set_config(..., true)` . 

7. Cross-tenant IDOR tests pass. 

8. Second tenant smoke test passes without code changes. 

## **31.7 Security Validation** 

**Result:** PASS, conditional on CI gates 

Required gates: 

1. No route without metadata. 

2. No Prisma access outside transaction wrappers. 

3. No missing Zod validation. 

4. No sensitive mutation without audit. 

64 

5. No event side effect without outbox. 

6. No platform access without reason-bound scope. 

7. No tenant-specific code branches. 

8. No cross-tenant resource leakage. 

## **31.8 Backend Readiness Assessment** 

Backend readiness: **Implementation-ready, conditional on locked artifact compliance and CI enforcement.** 

Ready for: 

- Backend folder scaffolding 

- API route wrappers 

- Service layer implementation 

- Repository layer implementation 

- Transaction helpers 

- RLS helpers 

- Audit/outbox pipeline 

- Supabase auth bridge 

- R2 storage helpers 

- Worker scaffolding 

- Backend tests 

Not allowed: 

- Adding APIs 

- Adding permissions 

- Adding entities 

- Adding workflows 

- Changing tenant architecture 

- Changing authorization architecture 

- Creating FundedBeyond code forks 

- Moving authorization into frontend/client state 

## **31.9 CTO Approval Verdict** 

## **Verdict: APPROVED FOR BACKEND ENGINEERING EXECUTION — conditional.** 

This Backend Architecture Package v1 is approved as the official implementation blueprint for Atlas LMS Phase 0 + Phase 1A + Phase 1B backend work. 

Approval conditions before production release: 

1. All implemented routes must map to API Inventory v1. 

- Every protected route must export metadata. 

2. 

3. Every protected request must pass tenant resolution, auth, membership, entitlement, resource loader, and `can()` in the approved order. 

- All tenant DB work must run through `withTenantTx()` . 

4. 

- RLS must be enabled and tested on tenant-scoped tables. 

5. 

65 

6. Sensitive mutations must write same-transaction audit entries. 

7. Side effects must use outbox. 

8. Server Actions must remain wrappers around the same service path. 

9. Platform scope must remain physically isolated and reason-bound. 

10. FundedBeyond must remain Tenant #1 configuration only. 

11. Cross-tenant IDOR tests must pass before Phase 1 feature work. 

12. Second-tenant smoke test must pass before launch. 

**Final CTO position:** Backend architecture is implementation-ready and safe to hand to backend engineers, full-stack engineers, Cursor, Claude Code, and GitHub Copilot, provided the locked constraints and validation gates are enforced without exception. 

66 

