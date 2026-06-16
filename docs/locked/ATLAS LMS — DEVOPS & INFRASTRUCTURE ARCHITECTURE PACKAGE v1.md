## **ATLAS LMS — DEVOPS & INFRASTRUCTURE ARCHITECTURE PACKAGE v1** 

## **Phase 0 + Phase 1A + Phase 1B** 

**Status:** Implementation-ready DevOps and Infrastructure blueprint **Scope:** Deployment, infrastructure, CI/CD, secrets, monitoring, backups, disaster recovery, release management, and production operations only 

**Binding Rule:** This package creates no new product scope, screens, APIs, permissions, workflows, entities, database architecture, tenant strategy, frontend architecture, backend architecture, or FundedBeyond-specific fork. 

**Source of Truth:** Locked Atlas LMS artifacts only. 

## **1. Infrastructure Executive Summary** 

Atlas LMS infrastructure is a single multi-tenant, white-label SaaS operational platform deployed on the locked stack: 

- **Hosting:** Vercel 

- **Edge / DNS / CDN / WAF:** Cloudflare 

- **Database:** PostgreSQL 

- **ORM:** Prisma 

- **Authentication:** Supabase Auth 

- **Storage:** Cloudflare R2 

- **Monitoring:** Sentry, PostHog, Better Stack 

- **Validation:** Zod 

- **Frontend / Backend Runtime:** Next.js 15+ with API Routes and Server Actions 

The infrastructure exists to operate the approved Atlas LMS system safely across development, staging, and production without changing product behavior. 

## **1.1 Infrastructure goals** 

1. Deploy immutable builds through controlled CI/CD. 

2. Keep environments isolated. 

3. Protect tenant isolation at the infrastructure, runtime, database, and operational layers. 

4. Support white-label domain onboarding. 

5. Provide observable production operations. 

6. Enable backup, restore, rollback, and incident response. 

- Support FundedBeyond Academy as Tenant #1 through configuration only. 

7. 

8. Support future tenants without code, database, or infrastructure redesign. 

## **1.2 Reliability goals** 

- Production deployment must support instant rollback through Vercel deployment promotion. • PostgreSQL must support tested restore procedures. 

1 

- Cloudflare DNS and SSL must support tenant custom-domain operations. 

- 

- Monitoring must detect API errors, latency, uptime failures, worker failures, queue backlog, and tenant-domain issues. 

- Phase 0 tenant isolation gates must pass before Phase 1 feature deployment. 

## **1.3 Security goals** 

- No production secret in code, logs, screenshots, tickets, or AI prompts. 

- Production access requires least privilege and MFA. 

- No tenant database work outside `withTenantTx` . 

- 

- No platform work outside `withPlatformScope` . 

- No protected route without authorization metadata. 

- 

- No client-supplied `tenant_id` . 

- 

- No unaudited sensitive mutation. 

- No raw R2 object access for protected assets. 

- No cross-tenant observability leakage. 

## **1.4 Scalability goals** 

- Keep web/API runtime stateless. 

- Use PostgreSQL indexing, cursor pagination, and read projections. 

- Use Cloudflare CDN for public static assets. 

- 

- Use R2 for object storage, not app filesystem. 

- 

- Use outbox workers for side effects and derived projections. 

- 

- Scale by tenant usage budgets, database capacity planning, and worker backlog thresholds. 

## **1.5 Multi-tenant goals** 

- Host resolves tenant. 

- Host wins over JWT tenant claim. 

- 

- Tenant state gate runs before protected access. 

- 

- ACTIVE membership is required for protected tenant access. 

- 

- Entitlement is checked before permission. 

- RLS is the database backstop. 

- Platform scope is physically and operationally isolated. 

- 

## **1.6 White-label goals** 

- Tenant domains map through `tenant_domains` . 

- Tenant branding/theme/config controls white-label appearance. 

- 

- Custom domains are operationally provisioned through Cloudflare + Vercel domain setup. 

- 

- FundedBeyond Academy uses `academy.fundedbeyond.com` as Tenant #1 domain configuration. 

Future tenants use the same onboarding process. 

- 

2 

## **2. Infrastructure Principles** 

## **2.1 Immutable deployments** 

Every production deployment is a built artifact. Production servers are never patched manually. 

Rules: 

- Merge to protected production branch triggers production build. 

- Preview deployments are immutable per pull request. 

- Rollback means promoting a previous known-good deployment. 

- Runtime configuration changes are tracked and reviewed. 

## **2.2 Infrastructure as configuration** 

Atlas does not introduce a full Terraform/IaC mandate in Phase 0/1 unless later approved. However, all infrastructure must be reproducible from versioned configuration files and documented runbooks. 

Minimum required configuration sources: 

- `.env.example` 

- Vercel project settings record 

- Cloudflare DNS/WAF/cache rules record 

- Supabase project settings record 

- R2 bucket policy record 

- Better Stack monitor definitions 

- Sentry project/release settings 

- PostHog project/event rules 

- Runbooks in `/runbooks` 

## **2.3 Least privilege** 

Access is granted only for the role required. 

Examples: 

- Developers may access development and preview secrets only. 

- Senior engineers may access staging secrets. 

- Production secrets are restricted to CTO/DevOps owner. 

- Database migration access is separate from read-only debugging access. 

- Supabase service-role key is server-only and never exposed to client bundles. 

- R2 write credentials are scoped per environment. 

## **2.4 Zero trust** 

No internal request is trusted because it is internal. 

3 

Required controls: 

- Every route validates with Zod. 

- Every protected route declares metadata. 

- Every tenant DB path sets transaction-local tenant context. 

- Workers validate event payloads. 

- Worker jobs use tenant/platform wrappers. 

- Logs never become authorization evidence. • Monitoring never replaces audit. 

## **2.5 Multi-tenant safety** 

Tenant safety is a release gate. 

Required checks: 

- Host/JWT mismatch test. 

- Cross-tenant read denial. 

- Cross-tenant write denial. 

- RLS raw SQL denial. 

- No Prisma outside `withTenantTx` . 

- No client `tenant_id` accepted. 

- Second-tenant smoke test. 

## **2.6 Auditability** 

Every sensitive operation must leave traceable evidence. 

Audit required for: 

- Tenant lifecycle changes. 

- Membership invite, suspend, remove. 

- Role assignment and revocation. 

- Permission overrides. 

- Entitlement changes. 

- Branding/domain changes. 

- Publish/review transitions. 

- Certificate issue/revoke. 

- Moderation decisions. 

- Data export/deletion. 

- Platform scope enter/exit. 

- Secret emergency access where operationally recorded. 

## **2.7 Disaster recovery readiness** 

Backups are not considered valid until restore is tested. 

Rules: 

- Database backups must have restore drills. 

4 

- R2 versioning must be enabled for protected assets. 

- Configuration must be recoverable. 

- Runbooks must exist before production. 

- RTO/RPO must be defined before launch. 

- Restore validation must include tenant isolation tests. 

## **2.8 Environment parity** 

Development, staging, and production must behave the same in architecture, not in data sensitivity. 

Environment parity means: 

- Same code paths. 

- Same route metadata checks. 

- Same RLS behavior. 

- Same authorization pipeline. 

- Same object-storage integration pattern. 

- Same monitoring hooks where safe. 

- Separate secrets, databases, buckets, domains, and provider projects. 

## **3. Environment Architecture** 

## **3.1 Environment list** 

Atlas uses three primary environments: 

1. Development 

2. Staging 3. Production 

Preview deployments are Vercel deployment instances attached to pull requests and use development/ preview-safe data only. 

## **3.2 Environment diagram** 

```
Developer Machine
  |
  | git push / PR
  v
GitHub
  |
  | CI: install → lint → typecheck → tests → build → security checks
  v
Vercel Preview
  |
  | PR review + gates green
  v
```

5 

```
Staging
  |
  | release approval + migration approval + smoke tests
  v
Production
  |
  +--> Cloudflare DNS / WAF / CDN
  +--> PostgreSQL production DB
  +--> Supabase Auth production project
  +--> Cloudflare R2 production buckets
  +--> Sentry / PostHog / Better Stack production projects
```

## **3.3 Development** 

## **Purpose** 

Development supports local engineering, story work, tests, and non-production debugging. 

## **Access rules** 

- Developers may use local `.env.local` . • No production secrets. 

- No production data. 

- Local Supabase or hosted dev Supabase project allowed. 

- R2 dev bucket or storage mock allowed. 

- Developer access is revoked when no longer needed. 

## **Data rules** 

- Synthetic seed data only. • FundedBeyond tenant seed may exist as configuration sample. 

- Second smoke tenant seed must exist. 

- No production exports. • No real learner data. 

## **Deployment rules** 

- Local only. 

- Preview deploys may be created from PRs. 

- No manual changes to production from development. 

## **3.4 Staging** 

## **Purpose** 

Staging validates integration, migrations, tenant isolation, release candidates, worker behavior, and observability before production. 

## **Access rules** 

- Restricted to engineering, QA, CTO, DevOps owner. 

6 

- MFA required for provider dashboards. 

- Staging secrets separate from production. 

- Production service-role keys forbidden. 

## **Data rules** 

- Synthetic or anonymized data only. • Must include FundedBeyond-like tenant config. 

- Must include second tenant for smoke tests. 

- Must include representative R2 assets. 

- • Must include authorization matrix fixtures. 

## **Deployment rules** 

- Deploy from protected staging branch or approved release branch. 

- Database migrations run here before production. 

- Release candidate cannot promote unless staging validation passes. 

## **3.5 Production** 

## **Purpose** 

Production serves live tenants, including FundedBeyond Academy. 

## **Access rules** 

- Least privilege. 

- MFA mandatory. 

- No shared accounts. 

- Production database write access limited to migration pipeline and emergency responders. 

- Platform operations require reason-bound access. 

- Production support access is audited. 

## **Data rules** 

- Real tenant data. 

- Real authentication. 

- Real R2 assets. 

- Real logs with sensitive data controls. 

- No raw production data copied downward without anonymization. 

## **Deployment rules** 

- Only protected branch or approved release tag deploys. 

- Production deploy requires green CI. 

- Production migration requires explicit approval. 

- Rollback uses previous immutable deployment. 

- Feature release is controlled by feature flags/entitlements, not code branches. 

7 

## **4. Vercel Architecture** 

## **4.1 Vercel project model** 

Use a single Vercel project for the Atlas LMS web/API runtime: 

```
Vercel Team
└── atlas-lms
    ├── Preview deployments
    ├── Staging deployment target
    └── Production deployment target
```

This preserves the approved single-codebase architecture. 

## **4.2 Vercel environments** 

|Vercel Environment|Atlas Use|Branch Source|Data|
|---|---|---|---|
|Development|Local dev / preview-safe|feature branches|synthetic|
|Preview|PR validation|pull requests|synthetic|
|Production|live app|protected main|real|



If staging is implemented through Vercel production-like deployment, it must use separate staging env vars, database, Supabase project, R2 bucket, and domains. 

## **4.3 Build settings** 

Required settings: 

```
Framework: Next.js
Package manager: pnpm
Install command: pnpm install --frozen-lockfile
Build command: pnpm build
Output: Next.js default
Node version: locked in .nvmrc or package.json engines
```

Required build gates before deployment promotion: 

```
pnpm lint
pnpm typecheck
pnpm test:unit
pnpm test:integration
pnpm test:authorization
```

8 

```
pnpm test:tenant-isolation
pnpm build
```

## **4.4 Preview deployments** 

Preview deployments are created per PR. 

Rules: 

- Preview deployments use preview-safe secrets only. 

- Preview deployments must not connect to production DB, production Supabase, or production R2. 

- Preview URLs are not custom tenant domains. 

- Preview data is synthetic. 

- Preview deployment must expose health route. 

- Preview deployment must run critical E2E paths where configured. 

## **4.5 Production deployments** 

Production deploys only from protected branch or release tag. 

Required sequence: 

```
Merge approved PR
  ↓
CI green
  ↓
Vercel production build
  ↓
Database migration gate if migration exists
  ↓
Production deployment
  ↓
Health check
  ↓
Smoke tests
  ↓
Monitoring watch
```

## **4.6 Rollback strategy** 

Rollback is deployment rollback first, database rollback second. 

Rules: 

1. Prefer Vercel rollback to previous deployment. 

2. Do not roll back database destructively. 

3. Use expand/contract migrations to avoid rollback pressure. 

9 

4. If schema rollback is required, execute only approved recovery migration. 

5. Verify tenant isolation after rollback. 

- Confirm Sentry/Better Stack error rates return to normal. 

6. 

## **4.7 Environment variable strategy** 

Vercel env vars are separated by environment. 

Required categories: 

```
APP_ENV
APP_URL
PLATFORM_HOST
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
SENTRY_AUTH_TOKEN
SENTRY_ORG
SENTRY_PROJECT
POSTHOG_KEY
POSTHOG_HOST
BETTER_STACK_SOURCE_TOKEN
BETTER_STACK_HEARTBEAT_URL
CLOUDFLARE_ACCOUNT_ID
CLOUDFLARE_ZONE_ID
CLOUDFLARE_API_TOKEN
CRON_SECRET
INTERNAL_WORKER_SECRET
```

Client-exposed variables must use explicit public naming and must never include service-role, database, R2 secret, Cloudflare token, or Better Stack source token. 

10 

## **4.8 Vercel setup checklist** 

- Create `atlas-lms` Vercel project. 

- Connect GitHub repository. 

- Set pnpm build commands. 

- Configure environment variables per environment. 

- Enable preview deployments. 

- Configure production domain routing. 

- Configure Sentry release upload. 

- Configure build output checks. 

- Restrict production deployment permissions. • Document rollback procedure. 

## **5. Cloudflare Architecture** 

## **5.1 Cloudflare role** 

## 

Cloudflare owns: 

- DNS • Proxy 

- SSL/TLS 

- WAF 

- Bot protection 

- Rate limiting 

- CDN caching 

- Tenant custom-domain routing support 

Cloudflare does not own application authorization. It protects the edge but does not replace middleware, `can()` , RLS, or audit. 

## **5.2 Cloudflare architecture diagram** 

```
User Browser
  |
  v
Cloudflare DNS / Proxy / WAF / Bot Protection / Rate Limits
  |
  v
Vercel Edge / Next.js App
  |
  +--> Supabase Auth
  |
  +--> PostgreSQL via Prisma + withTenantTx
  |
  +--> Cloudflare R2 signed upload/download
```

11 

```
  |
  +--> Sentry / PostHog / Better Stack
```

## **5.3 DNS** 

DNS zones: 

```
{atlas_primary_domain}
fundedbeyond.com
future tenant domains
```

Required records: 

|Domain Type|Record||Target|
|---|---|---|---|
|Platform console|`platform.`<br>`{atlas_primary_domain}`||Vercel|
|Atlas-managed tenant<br>subdomain|`*.{tenant_base_domain}`||Vercel|
|FundedBeyond Academy|`academy.fundedbeyond.com`||Vercel|
|Future custom tenant domain|tenant-owned hostname||Vercel verifcation|
||||target|



## **5.4 Proxy** 

Cloudflare proxy should be enabled for public tenant and platform domains unless a Vercel verification requirement temporarily needs DNS-only mode. 

Rules: 

- Proxy public tenant domains. 

- Proxy Atlas platform domains. 

- Avoid proxy changes without runbook. 

- Record every production DNS change. 

## **5.5 SSL** 

SSL requirements: 

- Full strict SSL where possible. 

- Automatic certificate provisioning. 

- 

- Tenant custom domain certificate status tracked operationally. 

- 

- Certificate failure must trigger alert before tenant launch. 

- 

12 

## **5.6 WAF** 

Required WAF policies: 

- Block known malicious traffic. 

- Challenge suspicious bot traffic. 

- Protect auth endpoints. 

- Protect public diagnostic start endpoint. 

- Protect certificate verification endpoint. 

- 

- Protect platform console route prefix. 

- Protect upload-signing endpoints. 

- Block common injection patterns. 

## **5.7 Bot protection** 

Bot protection applies strongest controls to: 

- Public diagnostic. 

- Login/signup. • Password reset. • Certificate verification. • Public landing form actions. • CTA token generation. 

## **5.8 Rate limiting** 

Cloudflare edge rate limits are coarse-grained. Application rate limits remain authoritative. 

Cloudflare rate-limit examples: 

|Surface|||Limit Type|
|---|---|---|---|
|`/api/v1/public/diagnostic/start`|||per IP / host|
|`/api/v1/public/certificates/verify`|||per IP / host|
|`/api/v1/auth/*`|||per IP|
|`/api/v1/platform/*`|||per IP + stricter WAF|
|Upload signing routes|||per authenticated actor|



## **5.9 Caching** 

Allowed cache: 

- Static app assets. 

- Public tenant assets. 

- Public landing content where safe. • Public-safe certificate visuals where approved. 

13 

Forbidden cache: 

- Authenticated API responses. 

- Permission-sensitive responses. 

- Tenant admin data. 

- Platform data. 

- Signed URLs. 

- Private R2 objects. 

- Anything missing tenant-safe cache key. 

## **5.10 Custom domains** 

Custom domains use the approved `tenant_domains` model and domain APIs. Infrastructure only provisions DNS, SSL, and routing support. 

Custom domain states should be operationally tracked as: 

```
REQUESTED
VERIFYING
ACTIVE
FAILED
REMOVED
```

These are operational status concepts only and must align with the approved domain table/status definitions if already defined. 

## **5.11 Tenant domains** 

Tenant resolution is app-owned: 

```
Host header
  ↓
tenant_domains lookup
  ↓
tenant state gate
  ↓
public/protected route handling
```

Cloudflare only brings traffic to the app. The app must not trust Cloudflare hostname alone as authorization. 

14 

## **6. Domain Strategy** 

## **6.1 Domain types** 

|Domain Type|Purpose|
|---|---|
|Atlas platform domain|Platform operations console|
|Atlas tenant fallback domain|Future tenant default hosted domain|
|FundedBeyond Academy domain|Tenant #1 academy domain|
|Future tenant custom domain|Tenant-owned branded domain|



## **6.2 Atlas platform domains** 

Required production configuration: 

```
PLATFORM_HOST=platform.{atlas_primary_domain}
APP_URL=https://{primary_app_host}
```

Platform console rules: 

- Platform console lives only on platform host. 

- Platform routes are not embedded in tenant hosts. 

- Platform operations require platform principal. 

- Platform scope requires reason. 

- Platform access is audited. 

## **6.3 FundedBeyond Academy** 

Tenant #1 domain: 

```
academy.fundedbeyond.com
```

Rules: 

- Must resolve to FundedBeyond tenant through `tenant_domains` . • Must use FundedBeyond branding/theme/config. 

- Must not be hardcoded anywhere in platform logic. 

- Must pass second-tenant smoke test proving no code fork. 

## **6.4 Future tenant domains** 

Future tenants may use: 

15 

```
{tenant-slug}.{tenant_base_domain}
custom tenant-owned domain
```

Rules: 

- Tenant slug is configuration. 

- Domain points to same Vercel app. 

- Tenant resolved from host. 

- No code deployment required. 

- Branding/config pulled after tenant resolution. 

## **6.5 Custom domains** 

Custom domain onboarding uses approved domain management flows/APIs only. 

Infrastructure responsibilities: 

- DNS verification instructions. 

- Cloudflare zone/proxy configuration where Atlas manages DNS. 

- Vercel domain registration/verification. 

- SSL status monitoring. 

- Tenant-domain activation only after verification. 

## **6.6 Tenant resolution** 

Resolution order: 

```
Incoming host
  ↓
Normalize host
  ↓
Lookup tenant_domains
  ↓
Validate domain status
  ↓
Load tenant
```

```
  ↓
Tenant state gate
  ↓
Route execution
```

Forbidden: 

- Resolving tenant from request body. 

- Resolving tenant from query string. 

- Trusting hidden form field. 

- Trusting localStorage. 

- Letting JWT tenant claim override host. 

16 

- Falling back to FundedBeyond as default tenant. 

## **6.7 SSL provisioning** 

SSL requirements: 

- SSL must be active before domain launch. 

- Failed certificate state blocks production launch for that domain. 

- Certificate expiry must be monitored. 

- Domain status must be visible to Tenant Admin only through approved screens/APIs. 

## **6.8 Domain onboarding workflow** 

```
Tenant Admin requests domain
  ↓
API validates permission + entitlement
  ↓
Domain record created
  ↓
DNS verification values shown
  ↓
Cloudflare/Vercel verification checked
  ↓
SSL provisioned
  ↓
Domain activated
  ↓
Audit entry written
  ↓
Tenant smoke test performed
```

No new product workflow is introduced; this is the operational execution of the approved domain management capability. 

## **7. PostgreSQL Infrastructure** 

## **7.1 Database model** 

Atlas uses a shared PostgreSQL database with strict tenant isolation. 

Core rules: 

- Every tenant business row carries `tenant_id` . 

- RLS enabled on tenant tables. 

- `withTenantTx` sets transaction-local tenant context. 

- Platform scope uses separate operational wrapper. 

- Migrations are controlled and reviewed. 

- 

17 

## **7.2 Development database** 

Purpose: 

- Local schema work. 

- Unit/integration tests. 

- RLS harness. 

- Seed testing. 

Rules: 

- Synthetic data only. 

- Reset allowed. 

- Local credentials only. 

- Same RLS SQL as staging/production. 

- Same Prisma migrations as production. 

## **7.3 Staging database** 

Purpose: 

- Release candidate validation. 

- Migration rehearsal. 

- Tenant isolation testing. 

- Restore testing where safe. 

- Performance query checks. 

Rules: 

- Separate DB from production. 

- Synthetic/anonymized data only. 

- RLS enabled. 

- Representative table volume where possible. 

- Migrations run before production. 

## **7.4 Production database** 

Purpose: 

- Live tenant data. 

Rules: 

- No direct manual writes except approved emergency procedure. 

- Migration role separated from app role. 

- Backups enabled. 

- PITR enabled where provider supports. 

- Monitoring enabled. 

- Statement timeouts configured. 

- 

- Tenant-leading indexes enforced where applicable. 

18 

## **7.5 Connection management** 

Required pattern: 

```
Next.js route/server action/worker
  ↓
Prisma client
  ↓
withTenantTx / withPlatformScope
  ↓
PostgreSQL transaction
  ↓
transaction-local set_config(..., true)
  ↓
RLS-protected queries
```

Forbidden: 

- Session-level tenant `SET` . 

- Raw Prisma access from route handlers. • Tenant queries outside transaction wrapper. • Background job tenant access without tenant context. 

## **7.6 Pooling** 

Production must assume serverless-safe pooling. 

Rules: 

- Use transaction-local `set_config(..., true)` . • Never rely on connection session state. • Test transaction-mode pooling leakage. • Fail CI if tenant Prisma access bypasses wrapper. 

## **7.7 Migration strategy** 

Use expand/contract migrations. 

```
Expand
  ↓
Deploy code compatible with old + new schema
  ↓
Backfill through worker/job if needed
  ↓
Validate
  ↓
Contract in later release
```

19 

Rules: 

- No destructive migration in same release as code depending on it. 

- RLS policy migration reviewed with schema migration. 

- Index creation must consider production lock risk. 

- Append-only constraints must be preserved. 

- Migration files are reviewed like code. 

## **7.8 Backup strategy** 

PostgreSQL backups: 

- Automated daily backups. 

- PITR where supported. 

- Encrypted at rest. 

- Separate backup access control. 

- Restore drills documented. 

- Backup success monitored. 

## **7.9 Restore strategy** 

Restore process: 

```
Declare incident
  ↓
Identify restore point
  ↓
Restore DB to isolated environment
  ↓
Run migration compatibility check
  ↓
Run tenant isolation tests
  ↓
Validate critical tenant records
  ↓
Promote restored DB only after approval
```

## **7.10 Monitoring** 

Database signals: 

- Connection count. 

- Query latency. 

- p95/p99 route latency correlation. 

- Slow queries. 

- Statement timeout count. 

- Lock waits. 

- Migration duration. 

- Disk/storage growth. 

20 

- Table/index bloat where available. 

- Worker query load. 

- Failed RLS/authorization anomalies. 

## **7.11 Capacity planning** 

Track by tenant: 

- Request volume. 

- Storage usage. 

- R2 usage. 

- Row growth on append-only tables. 

- Audit/event volume. 

- Community activity. 

- Assessment/practice response volume. 

- Analytics rollup volume. 

- Worker backlog contribution. 

Scaling triggers: 

- Sustained p95 API latency breach. 

- Database CPU/memory pressure. 

- Connection saturation. 

- Storage growth trend. 

- Slow query regression. 

- Worker lag above threshold. 

- Tenant-specific budget exhaustion. 

## **8. Supabase Architecture** 

## **8.1 Supabase role** 

Supabase provides authentication only. Atlas authorization remains app-owned through membership, entitlements, `can()` , and RLS. 

## **8.2 Projects** 

Use separate Supabase projects: 

```
atlas-dev-auth
atlas-staging-auth
atlas-production-auth
```

Each project has separate: 

- Auth settings. 

- Redirect URLs. 

21 

• Email templates. • JWT configuration. • Service role key. • Web anon key. • Allowed domains. 

## **8.3 Environment separation** 

|Environment|Supabase Project|Data|
|---|---|---|
|Development|dev/local|synthetic|
|Staging|staging|synthetic/anonymized|
|Production|production|real|



No lower environment may use production Supabase keys. 

## **8.4 Auth configuration** 

Required: 

- Email/password or approved auth methods only. 

- Email confirmation rules configured per product decision. 

- 

- Password reset redirects per environment. 

- 

- Invite acceptance redirects per environment. 

- 

- Session expiration policy documented. 

- 

- MFA required for admins/platform users where supported by implementation policy. 

## **8.5 Email configuration** 

Email templates must be tenant-safe. 

Rules: 

- Auth email must not leak another tenant brand. 

- 

- Links must resolve to correct tenant host. 

- 

- Production email sender domain must be verified. 

- 

- Staging email sender must be clearly non-production. 

- 

- Supabase auth templates must not hardcode FundedBeyond except where tenant-specific template routing is approved through configuration. 

## **8.6 JWT strategy** 

JWT is authentication evidence only. 

Rules: 

- JWT identifies principal. 

- 

- JWT does not authorize tenant access. 

- JWT tenant claims do not override host. 

22 

- ACTIVE membership is rechecked per protected request. 

- Role/permission changes take effect server-side. 

- Session revocation cache/checks apply where implemented. 

## **8.7 Session management** 

Rules: 

- Protected route checks session server-side. 

- Expired/missing session returns `AUTH_REQUIRED` . 

- Membership state changes block immediately on next request. 

- Suspended/removed users do not retain access through stale UI state. 

- Admin/platform sessions use stricter operational review. 

## **8.8 Secrets management** 

Supabase secrets: 

|Secret|||Class|Location|
|---|---|---|---|---|
|`SUPABASE_URL`|||Confg|Vercel env|
|`SUPABASE_ANON_KEY`|||Public client-<br>safe|Vercel env with public naming only where<br>needed|
|`SUPABASE_SERVICE_ROLE_KEY`|||Critical secret|Server-only Vercel env|
||||||



Rules: 

- Service role key never reaches client bundle. 

- Service role key never logged. 

- Rotation runbook required. 

- Emergency rotation tested in staging. 

## **9. Cloudflare R2 Architecture** 

## **9.1 R2 role** 

R2 stores approved file assets only. Backend stores references, not raw public object access. 

## **9.2 Buckets** 

Recommended bucket separation: 

23 

```
atlas-dev-assets
atlas-staging-assets
atlas-production-assets
```

Alternative per-data-class buckets may be added only if it does not change the database/entity model. 

## **9.3 Environment separation** 

|Environment|Bucket|Data|
|---|---|---|
|Development|dev bucket/mock|synthetic|
|Staging|staging bucket|synthetic/anonymized|
|Production|production bucket|real tenant assets|



No production R2 credentials in lower environments. 

## **9.4 Object organization** 

Object keys must be tenant-scoped and non-guessable. 

Pattern: 

```
tenants/{tenantId}/assets/{assetType}/{uuidv7}/{filename}
tenants/{tenantId}/exports/{exportJobId}/{filename}
tenants/{tenantId}/certificates/{certificateId}/{filename}
public/{tenantId}/branding/{assetId}/{filename}
```

Rules: 

- Raw keys are not exposed in UI when avoidable. 

- Protected assets require signed URLs. 

- Public-safe assets may be CDN cached. 

- Object metadata may include safe request correlation but never secrets. 

## **9.5 Upload strategy** 

```
Client requests upload
```

```
  ↓
API validates auth, membership, entitlement, permission, file policy
```

```
  ↓
API creates signed upload URL
```

```
  ↓
Client uploads to R2
```

```
  ↓
API confirms/records asset reference
```

24 

```
  ↓
Audit/outbox where required
```

Rules: 

- Validate file type. 

- Validate file size. 

- Validate target resource relationship. 

- Use signed upload. 

- Never accept client-provided tenant scope. 

- Virus/malware scanning may be added if approved by security roadmap; not required to create new product scope here. 

## **9.6 Download strategy** 

Public assets: 

```
CDN URL allowed only for public-safe assets
```

Protected assets: 

```
Request protected asset
  ↓
Authorize
  ↓
Generate short-lived signed URL
  ↓
Log requestId
```

Forbidden: 

- Permanent public URL for protected learner/admin assets. • Logging signed URL. 

- Sharing object keys across tenants. 

## **9.7 Lifecycle rules** 

Recommended: 

|Asset Class|Lifecycle|
|---|---|
|Branding assets|retain while active + version history as required|
|Course/lesson assets|retain while referenced|
|Export fles|expire after confgured export retention|
|Temporary uploads|delete if unconfrmed|



25 

|Asset Class|Lifecycle|
|---|---|
|Certifcate assets|retain according to certifcate/audit policy|
|Logs/debug artifacts|do not store in R2 unless explicitly approved|



## **9.8 Retention** 

Retention must follow approved data rights and audit rules. 

- Audit records are not deleted through R2. • Export files expire. • Tenant deletion follows approved data deletion workflow. 

- Archived tenant data follows approved archive/delete policy. 

## **9.9 Backup considerations** 

R2 production bucket requirements: 

- Versioning enabled where available. 

- Accidental deletion protection where available. 

- 

- Lifecycle policy reviewed. 

- Critical public branding assets recoverable. 

- Export files recoverable only within retention window. 

- 

## **10. Secrets Management** 

## **10.1 Secret ownership** 

|Secret Category|Owner|
|---|---|
|Vercel project secrets|DevOps owner / CTO|
|Database credentials|DevOps owner / CTO|
|Supabase service-role key|Backend lead / CTO|
|R2 credentials|DevOps owner|
|Cloudfare API token|DevOps owner / CTO|
|Sentry auth token|DevOps owner|
|Better Stack token|DevOps owner|
|PostHog key|Product/DevOps owner|
|Cron/internal worker secrets|Backend lead / DevOps owner|



26 

## **10.2 Secret classification model** 

|Class|Examples|Access|
|---|---|---|
|Public confg|app URL, public PostHog key where approved|app/client as needed|
|Internal confg|environment name, non-secret feature confg|server/team|
|Sensitive secret|R2 key, Sentry token, Better Stack token|restricted server only|
|Critical secret|database URL, Supabase service role, Cloudfare API<br>token|CTO/DevOps only|
|Emergency<br>secret|break-glass DB/admin access|break-glass only,<br>audited|



## **10.3 Environment variables** 

Rules: 

- `.env.example` contains placeholders only. 

- 

- `.env.local` is never committed. 

- Production vars live only in Vercel/provider secret stores. 

- Secrets are never copied into docs. 

- Secret names may be documented; values may not. 

## **10.4 Secret rotation** 

Rotation triggers: 

- Team member offboarding. 

- Suspected exposure. 

- Provider compromise. 

- Production incident. 

- Scheduled security review. 

- Accidental logging. 

- AI/tooling exposure. 

Rotation process: 

## `Identify secret` 

```
  ↓
Create replacement
```

```
  ↓
Deploy replacement to staging
```

```
  ↓
Validate
```

```
  ↓
Deploy replacement to production
```

```
  ↓
```

```
Revoke old secret
```

27 

```
  ↓
Confirm no errors
```

```
  ↓
Record rotation
```

## **10.5 Developer access** 

Developers may access: 

- Local dev env values. 

- Dev Supabase. 

- Dev R2. 

- Preview logs without secrets. 

Developers may not access: 

- Production database URL. 

- Supabase production service role. 

- Production R2 secret. 

- Cloudflare production API token. 

- Production Better Stack source token. 

## **10.6 CI/CD access** 

CI/CD gets only required secrets. 

Rules: 

- PRs from untrusted branches do not receive production secrets. 

- Preview deploys use preview-safe env. 

- Production deploy job has production env access only after approval. 

- Migration job secrets separate from app runtime where possible. 

## **10.7 Production access** 

Production access requires: 

- MFA. 

- Named accounts. 

- Least privilege. 

- Approval for write operations. 

- Audit record for emergency access. 

- Post-incident review if break-glass used. 

## **10.8 Emergency access** 

Break-glass access is allowed only for production incident response. 

28 

Rules: 

- Must be time-bound. 

- Must be recorded. 

- Must be reviewed after use. 

- Must rotate affected secrets if exposure occurred. 

- Must not become normal operating procedure. 

## **11. CI/CD Architecture** 

## **11.1 Git strategy** 

Use protected branches and short-lived feature branches. 

```
feature/*
  ↓ PR
develop or staging branch
  ↓ release PR
main
  ↓ production deploy
```

If the team chooses trunk-based deployment, `main` remains protected and production deploys are still gated. 

## **11.2 Main branch** 

`main` is production-bound. 

Rules: 

- Protected. 

- No direct pushes. 

- Required PR review. 

- Required checks green. 

- Required migration approval if schema changes. 

- Required CODEOWNERS review for security, database, auth, infra changes. 

## **11.3 Development branch** 

`develop` may be used for integration. 

Rules: 

- Protected. 

- Preview/staging deploy target. 

- Synthetic data only. 

29 

• No production secrets. 

## **11.4 Release branch strategy** 

Release branches are optional but recommended when stabilizing production releases. 

Pattern: 

```
release/YYYY-MM-DD
```

Rules: 

- Only bug fixes and release-hardening changes. • No scope expansion. • Production release tag created after approval. 

## **11.5 Pull request workflow** 

```
Create feature branch
  ↓
Open PR
  ↓
CI runs
  ↓
Preview deployment
  ↓
Review by CODEOWNERS
  ↓
QA checks if user-facing
  ↓
Security/database review if relevant
  ↓
Merge only when all gates green
```

## **11.6 Approval workflow** 

Required reviewers: 

|Change Type|Required Review|
|---|---|
|UI only|frontend owner|
|API route|backend owner|
|Authorization|security/backend owner|
|Prisma migration|database owner|
|RLS/policies|database + security owner|



30 

|Change Type|Required Review|
|---|---|
|CI/CD|DevOps owner|
|Secrets/confg|DevOps owner / CTO|
|Platform scope|CTO/security owner|
|Tenant provisioning/domain|backend + DevOps owner|



## **11.7 Deployment workflow** 

```
PR merged
  ↓
Production build starts
  ↓
Build checks complete
  ↓
Migration gate if needed
  ↓
Deploy
  ↓
Health checks
  ↓
Smoke tests
  ↓
Monitor release
```

## **11.8 Rollback workflow** 

```
Incident detected
  ↓
Classify severity
  ↓
Freeze deploys
  ↓
Promote previous Vercel deployment
  ↓
Disable feature flag if applicable
  ↓
Validate health
  ↓
Check DB compatibility
  ↓
Incident review
```

31 

## **11.9 CI/CD diagram** 

```
GitHub PR
  |
  +--> Static checks
  |     lint / typecheck / import boundaries / secret scan
  |
  +--> Test checks
  |     unit / integration / authz / tenant isolation / workers / E2E
  |
  +--> Build
  |     Next.js build / schema generation
  |
  +--> Preview deploy
  |
  +--> Review approval
  |
  v
Protected merge
  |
  +--> Staging deploy
  |
  +--> Migration validation
  |
  +--> Production deploy
  |
  v
Health + monitoring + rollback ready
```

## **12. GitHub Architecture** 

## **12.1 Repositories** 

Use one primary repository: 

```
atlas-lms
```

This aligns with the single-codebase architecture. 

Repository contains: 

```
src/
prisma/
infrastructure/
.github/
```

32 

```
scripts/
monitoring/
runbooks/
docs/
tests/
```

## **12.2 Branch protection** 

Protected branches: 

```
main
develop
release/*
```

Required: 

- Pull request before merge. 

- Required status checks. 

- Require branches up to date. 

- Require conversation resolution. 

- Restrict force pushes. 

- Restrict deletions. 

- Require CODEOWNERS review. 

- Require signed commits if adopted by team policy. 

## **12.3 Required reviews** 

Minimum: 

- 1 review for normal changes. 

- 2 reviews for auth, DB, RLS, CI/CD, secrets, platform, tenant isolation, production runbooks. 

- CTO approval for production infrastructure change. 

## **12.4 Code owners** 

Required CODEOWNERS areas: 

```
/prisma/                 @db-owner @security-owner
/src/db/                 @db-owner @backend-owner
/src/permissions/        @security-owner @backend-owner
/src/entitlements/       @security-owner @backend-owner
/src/tenancy/            @security-owner @backend-owner
/src/app/api/            @backend-owner
/src/app/platform/       @security-owner @backend-owner
/infrastructure/         @devops-owner
/.github/                @devops-owner
/scripts/                @devops-owner @backend-owner
```

33 

```
/monitoring/             @devops-owner
/runbooks/               @devops-owner @cto
```

## **12.5 Labels** 

Recommended labels: 

```
type:feature
type:bug
type:security
type:infra
type:database
type:auth
type:tenant-isolation
type:frontend
type:backend
type:worker
type:docs
risk:low
risk:medium
risk:high
risk:critical
phase:0
phase:1a
phase:1b
```

## **12.6 Milestones** 

Milestones align to locked sprint planning: 

```
Sprint 0
Sprint 1
...
Sprint 10
Phase 0 Release
Phase 1A Release
Phase 1B Release
FundedBeyond Tenant #1 Launch
```

## **12.7 Issue workflow** 

```
Backlog
  ↓
Ready
  ↓
In Progress
```

34 

```
  ↓
In Review
  ↓
QA / Validation
  ↓
Done
```

Issues must reference: 

- Approved artifact section. 

- Screen ID if user-facing. 

- API route if backend. 

- Permission if protected. 

- Database table if schema/data. 

- Entitlement if gated. 

- Test requirements. 

## **12.8 Release workflow** 

```
Create release candidate
  ↓
Freeze scope
  ↓
Run full CI
  ↓
Run staging validation
  ↓
Run migration rehearsal
  ↓
Run smoke tests
  ↓
Approve release
  ↓
Tag release
  ↓
Deploy production
  ↓
Monitor
  ↓
Publish release notes
```

## **13. Build Pipeline Architecture** 

## **13.1 Pipeline stages** 

Required CI pipeline: 

35 

```
install
  ↓
format/lint
  ↓
typecheck
  ↓
unit tests
  ↓
integration tests
  ↓
authorization tests
  ↓
tenant isolation tests
  ↓
worker/event tests
  ↓
database validation
  ↓
security checks
  ↓
build
  ↓
preview deploy
  ↓
E2E smoke
```

## **13.2 Lint** 

Must enforce: 

- No forbidden imports. 

- No repositories imported by UI. 

- No Prisma in route handlers. 

- 

- No platform client in tenant code. 

- 

- No raw `tenant_id` from client. 

- 

- No `dangerouslySetInnerHTML` without approved sanitizer. 

- No secrets in source. 

## **13.3 Typecheck** 

Must enforce: 

- Strict TypeScript. 

- Typed route metadata. 

- Typed Zod schemas. 

- Typed event envelopes. 

- 

- Typed environment schema. 

- 

- Typed permission names from catalogue. 

- 

- Typed entitlement keys from approved source. 

36 

## **13.4 Unit tests** 

Required coverage: 

- Zod schemas. 

- Permission metadata helpers. 

- Entitlement resolver. 

- Tenant resolver. 

- Error envelope mapper. 

- Idempotency helpers. 

- Event payload validators. 

- Storage policy helpers. 

- Secret/env schema parser. 

## **13.5 Integration tests** 

Required coverage: 

- Route handler success/error paths. 

- Prisma transaction behavior. 

- Audit write behavior. 

- Outbox write behavior. 

- R2 signed upload/download policy. 

- Supabase session bridge. 

- Worker event processing. 

- Rate-limit behavior where practical. 

## **13.6 Authorization tests** 

Matrix dimensions: 

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

- Default deny. 

- Permission allow. 

- Permission deny. 

- Override deny wins. 

- Ownership checks. 

- Relationship checks. 

- Entitlement before permission. 

- Platform role isolation. 

37 

## **13.7 Tenant isolation tests** 

Required tests: 

- Tenant A cannot read Tenant B by ID. 

- Tenant A cannot update Tenant B by ID. 

- Tenant A cannot delete Tenant B by ID. 

- Tenant A cannot infer Tenant B resource existence. 

- Host wins over JWT tenant claim. 

- No client-supplied `tenant_id` accepted. 

- RLS blocks direct cross-tenant query. 

- Transaction-mode pooling does not leak tenant GUC. 

- Platform scope cannot leak into tenant code. 

- Second tenant smoke test passes without code changes. 

## **13.8 Build validation** 

Build fails if: 

- Missing route metadata. 

- Missing Zod schema at boundary. 

- Prisma access outside approved wrappers. 

- Sensitive mutation lacks audit. 

- Event producer lacks outbox. 

- Client bundle includes server secret. 

- Environment schema invalid. 

- Forbidden Phase 2–4 endpoint/screen/module appears. 

- FundedBeyond-specific branch appears in platform code. 

## **13.9 Artifact generation** 

Build artifacts: 

- Next.js build output. 

- Prisma generated client. 

- Sentry release artifacts. 

- Test reports. 

- Coverage reports. 

- E2E reports. 

- Migration validation logs. 

## **13.10 Deployment gates** 

Production deployment requires: 

- Green CI. 

- Green tenant isolation suite. 

- Green authorization suite. 

- Successful staging migration. 

- Successful staging smoke. 

38 

- No unresolved critical Sentry/Better Stack issue. • Approved production release checklist. 

## **14. Database Migration Pipeline** 

## **14.1 Migration creation** 

Rules: 

- Prisma schema change must include migration. 

- Raw SQL must be used where needed for RLS, grants, triggers, append-only protections, partitioning, and indexes. 

- Migration must map to approved Database Design v2 tables only. 

- No new table without approved artifact update. 

- No destructive change without expand/contract plan. 

## **14.2 Migration review** 

Required reviewers: 

- Database owner. 

- Backend owner. 

- Security owner for RLS/auth-related changes. • CTO for production-risk migrations. 

Review checklist: 

- Approved table only. 

- RLS policy updated. 

- Index strategy reviewed. 

- Backfill strategy defined. 

- Lock risk reviewed. 

- Rollback/recovery plan documented. 

- Seed changes reviewed. 

- Tenant isolation tests updated. 

## **14.3 Migration validation** 

Validation steps: 

```
Apply migration to local
  ↓
Run Prisma generate
  ↓
Run unit/integration tests
  ↓
Run RLS SQL tests
```

39 

```
  ↓
Run tenant isolation tests
  ↓
Apply to staging
  ↓
Run smoke tests
  ↓
Review monitoring
```

## **14.4 Staging migration** 

Rules: 

- Staging migration must run before production. 

- Staging DB must contain representative tenants. 

- Second-tenant smoke test must pass. 

- Worker compatibility must be checked. 

- Rollback/forward-fix plan must be ready. 

## **14.5 Production migration** 

Rules: 

- Run during approved release window. 

- Freeze conflicting deploys. 

- Capture pre-migration backup/restore point. 

- Run migration with migration role. 

- Monitor DB health. 

- Run post-migration smoke. 

- Keep rollback/forward-fix team available. 

## **14.6 Rollback process** 

Preferred rollback is forward fix or application rollback. 

Schema rollback only if: 

- Data loss risk is understood. 

- Recovery migration is approved. 

- Backup/restore point exists. 

- CTO approves. 

## **14.7 RLS validation** 

Every RLS migration requires: 

- Policy test. 

- Raw SQL denial test. 

- `withTenantTx` success test. 

40 

- Cross-tenant denial test. 

- Platform scope separation test. 

- Transaction pooling leakage test where applicable. 

## **14.8 Seed validation** 

Seed files must create only approved seed data: 

- Permission catalogue. 

- Role mappings. 

- Entitlements. 

- Feature flags. 

- 

- Item types. 

- Workflow templates. 

- 

- FundedBeyond tenant config. 

- • Second smoke tenant. 

Seeds must be idempotent. 

## **15. Monitoring Architecture** 

## **15.1 Monitoring tools** 

|Tool|Purpose|
|---|---|
|Sentry|Exceptions, traces, release health|
|PostHog|Product analytics, funnels, feature usage|
|Better Stack|Logs, uptime, alerts, status checks|



Audit remains separate from monitoring. 

## **15.2 Sentry** 

Sentry captures: 

- Frontend errors. 

- API route exceptions. 

- Server Action failures. 

- Worker failures. 

- Transaction failures. 

- RLS unexpected failures. 

- 

- Storage failures. 

- Deployment release regressions. 

Required tags: 

41 

```
requestId
route
method
statusCode
tenantSafeId
actorSafeId
module
eventType
jobName
release
environment
```

Do not send: 

- Access tokens. 

- Refresh tokens. 

- Raw passwords. 

- Supabase service-role key. 

- Database URL. 

- R2 signed URLs. 

- Full sensitive request bodies. 

- Raw PII unless approved and minimized. 

## **15.3 PostHog** 

PostHog captures product analytics only. 

Allowed examples: 

- Diagnostic started. 

- Lesson completed. 

- Attempt submitted. • Certificate viewed. 

- Community post created. 

- CTA token created. 

- Search used. 

- Notification opened. 

Rules: 

- Product analytics never replaces audit. 

- Use tenant-safe identifiers. 

- No secrets. 

- No sensitive payloads. 

- No cross-tenant properties. 

- Respect data-rights policies. 

42 

## **15.4 Better Stack** 

Better Stack handles: 

- Structured logs. 

- Uptime checks. 

- API health checks. 

- Worker heartbeat. 

- Deployment health. 

- Alert routing. 

- Status page where approved. 

Required log fields: 

```
{
"level":"info",
"message":"route_completed",
"requestId":"req_...",
"route":"/api/v1/...",
"method":"GET",
"statusCode":200,
"durationMs":42,
"tenantSafeId":"t_...",
"errorCode":null,
"environment":"production"
}
```

## **15.5 Metrics** 

Required metrics: 

- API request count. 

- API error rate. 

- API p95 latency. 

- API p99 latency. 

- Auth failures. 

- Membership gate denials. 

- Entitlement denials. 

- Permission denials. 

- RLS failures. 

- Worker backlog. 

- Worker failure count. 

- Dead-letter count. 

- Outbox lag. 

- Database slow queries. 

- R2 upload/download failures. 

- Domain verification failures. 

- SSL certificate failures. 

- Deployment failures. 

43 

- Tenant health score. 

## **15.6 Logs** 

Logs must be structured, searchable, and request-correlated. 

Log streams: 

- Application logs. 

- API logs. 

- Worker logs. 

- Deployment logs. 

- Security event logs. 

- Domain operation logs. 

## **15.7 Tracing** 

Trace shape: 

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

## **15.8 Alerting** 

Alerts are routed through Better Stack and/or provider-native integrations. 

Critical signals: 

- Production down. 

- Error spike. 

- p95 latency breach. 

- DB unavailable. 

- Tenant isolation test failure in pipeline. 

- Worker backlog critical. 

- 

- Dead-letter spike. 

- 

- Certificate/domain failure for active tenant. 

- 

- Secret exposure. 

44 

## **15.9 Dashboards** 

Dashboards: 

- Application dashboard. 

- API dashboard. 

- Worker dashboard. 

- Database dashboard. 

- Tenant health dashboard. 

- Infrastructure dashboard. 

- Release health dashboard. 

## **15.10 Ownership** 

|Area|Owner|
|---|---|
|Sentry|Backend/Frontend owners|
|PostHog|Product + Engineering|
|Better Stack|DevOps owner|
|Database monitoring|Database owner|
|Worker monitoring|Backend owner|
|Tenant health|Product + DevOps|
|Security alerts|Security owner / CTO|



## **15.11 Escalation** 

Escalation order: 

```
On-call engineer
  ↓
Backend/Frontend/DevOps owner based on area
  ↓
CTO
  ↓
Provider support if required
```

## **16. Logging Architecture** 

## **16.1 Structured logs** 

All server logs must be structured JSON. 

45 

Required fields: 

```
timestamp
level
message
requestId
environment
route/jobName
durationMs
statusCode
errorCode
tenantSafeId
actorSafeId
release
```

## **16.2 Log levels** 

|Level|Use|
|---|---|
|debug|local/staging diagnostic only|
|info|successful route/job lifecycle|
|warn|retryable issue, rate limit, degraded dependency|
|error|failed request/job requiring investigation|
|fatal|production outage or unsafe state|



Production debug logs are disabled unless explicitly enabled for time-bound incident response. 

## **16.3 Correlation IDs** 

Every request must have `requestId` . 

Used in: 

- API response envelope. • Logs. • Audit entries. • Outbox metadata. • Sentry events. • Better Stack logs. • Support workflows. 

## **16.4 Request IDs** 

Rules: 

- Generate request ID at edge/app entry. 

46 

- Preserve through service, DB, audit, outbox, worker. 

- 

- Include in every error envelope. 

- Never reuse across independent requests. 

- Include parent request ID for worker event if event came from request. 

## **16.5 Retention** 

Suggested retention: 

|Log Class|Retention|
|---|---|
|Application logs|30–90 days|
|Security-relevant logs|90–180 days|
|Deployment logs|180 days|
|Audit entries|per approved audit retention, not ordinary logs|
|Debug logs|shortest practical retention|



## **16.6 Searchability** 

Logs must support search by: 

- requestId. • route. • errorCode. • release. • environment. 

- tenantSafeId. • jobName. • eventType. 

## **16.7 Sensitive data controls** 

Never log: 

- Access tokens. • Refresh tokens. • Passwords. • Supabase service-role key. 

- Database URLs. • Cloudflare tokens. • R2 signed URLs. • Raw request bodies for sensitive routes. 

- Raw storage keys. • Full payment/financial details. • Hidden platform data. 

- Cross-tenant resource names on denial. 

47 

## **17. Observability Dashboards** 

## **17.1 Application dashboard** 

Signals: 

- Request volume. 

- Error rate. 

- p95/p99 latency. 

- Active releases. 

- Top failing routes. 

- Sentry issue count. 

- Deployment status. 

- Health-check status. 

## **17.2 API dashboard** 

Signals: 

- Per-route latency. 

- Per-route error rate. 

- Validation error count. 

- Auth error count. 

- Membership denial count. 

- Entitlement denial count. 

- Permission denial count. 

- Rate-limit count. 

- Idempotency replay count. 

## **17.3 Worker dashboard** 

Signals: 

- Outbox lag. 

- Events processed. 

- Event failure count. 

- Retry count. 

- Dead-letter count. 

- Worker heartbeat. 

- Export job duration. 

- Notification dispatch failures. 

- Analytics rollup lag. 

- Competency/readiness update lag. 

## **17.4 Database dashboard** 

Signals: 

- Connection count. 

48 

- CPU/memory where available. 

- Slow queries. • Lock waits. 

- Statement timeouts. • Migration duration. • Table growth. • Index usage. • Backup success. • Restore drill result. 

## **17.5 Tenant health dashboard** 

Signals: 

- Tenant domain status. 

- SSL status. • Tenant state. • Request volume. • Error rate by tenant. • Worker backlog by tenant. • Storage usage. • Entitlement limit pressure. 

- Recent audit-sensitive operations. 

- Last successful smoke check. 

## **17.6 Infrastructure dashboard** 

Signals: 

- Cloudflare traffic. 

- WAF blocks. 

- Bot challenges. 

- Rate-limit blocks. 

- Vercel deployment status. 

- Vercel function errors. 

- R2 operation failures. 

- Supabase auth errors. 

- Better Stack uptime checks. 

## **18. Alerting Architecture** 

## **18.1 Severity model** 

|Severity|Meaning|
|---|---|
|Critical|Production outage, data isolation risk, auth failure, DB unavailable|
|High|Major tenant-impacting issue, worker backlog, high error rate|



49 

|Severity|Meaning|
|---|---|
|Medium|Degraded functionality, isolated tenant issue, non-critical worker failures|
|Low|Warning, trend, non-urgent operational task|



## **18.2 Critical alerts** 

Critical alerts: 

- Production app unavailable. 

- PostgreSQL unavailable. 

- Supabase Auth unavailable for production login. 

- Tenant isolation test failure in release pipeline. 

- Cross-tenant access anomaly. 

- Platform scope anomaly. 

- Secret exposure. 

- Production migration failed. • Active tenant domain unreachable. • Error rate exceeds critical threshold. 

## **18.3 High alerts** 

High alerts: 

- p95 latency sustained breach. 

- Worker backlog high. 

- Dead-letter spike. • R2 upload/download failures. 

- Auth failures spike. • WAF security anomaly. 

- Deployment health degraded. • Certificate expiry/failure approaching active tenant impact. 

## **18.4 Medium alerts** 

Medium alerts: 

- Non-critical route error spike. 

- Slow query regression. 

- Staging migration failure. 

- Preview deployment failures. 

- PostHog ingestion issue. 

- 

- Non-active tenant domain verification failure. 

- 

## **18.5 Low alerts** 

Low alerts: 

- Cost threshold warning. 

50 

- Storage growth warning. 

- Unused secrets review reminder. 

- Scheduled restore drill reminder. • Dependency update available. 

- Documentation drift reminder. 

## **18.6 Notification channels** 

Channels: 

- Slack/Teams engineering alerts. 

- Email for non-urgent summaries. 

- Phone/pager for Critical. 

- GitHub issue auto-create for follow-up tasks. 

- Provider dashboard alerts where needed. 

## **18.7 Escalation paths** 

```
Critical
  On-call immediately
  ↓
  CTO if not acknowledged
  ↓
  Provider escalation
High
  On-call
  ↓
  Area owner
Medium
  Area owner next working cycle
Low
  Backlog / scheduled maintenance
```

## **18.8 Response expectations** 

|Severity|Acknowledgement|Action|
|---|---|---|
|Critical|immediate|incident channel + mitigation|
|High|fast|owner triage + fx/rollback|
|Medium|same day|issue + scheduled fx|
|Low|planned|backlog or maintenance|



51 

## **19. Backup Architecture** 

## **19.1 Database backups** 

Requirements: 

- Automated backups. 

- PITR where supported. 

- Encryption at rest. 

- Restore-point documentation. 

- Backup success alerts. 

- Access restricted. 

- Restore drills scheduled. 

## **19.2 R2 backups** 

Requirements: 

- Versioning for production assets where available. 

- Lifecycle rules documented. 

- Critical object recovery tested. 

- Temporary/export object retention enforced. 

- Accidental deletion recovery tested for representative asset. 

## **19.3 Configuration backups** 

Configuration to preserve: 

- Vercel env var names and settings record. 

- Cloudflare DNS/WAF/cache/rate-limit settings. 

- Supabase Auth settings. 

- R2 bucket settings. 

- Sentry project settings. 

- Better Stack monitors. 

- PostHog project settings. 

- GitHub branch protection and CODEOWNERS. 

Secret values are not stored in repository. 

## **19.4 Retention schedules** 

Suggested baseline: 

|Backup Type|Retention|
|---|---|
|PostgreSQL daily backup|30 days minimum|
|PostgreSQL PITR|provider-supported window|
|R2 versioned objects|per asset class|



52 

|Backup Type|Retention|
|---|---|
|Export fles|short retention only|
|Confg snapshots|180 days|
|Restore drill reports|1 year|



## **19.5 Verification process** 

A backup is verified only after restore test. 

Verification steps: 

```
Restore to isolated environment
  ↓
Run migration compatibility
  ↓
Run app health check
  ↓
Run tenant isolation tests
  ↓
Run auth smoke
  ↓
Run R2 asset access test
  ↓
Record result
```

## **19.6 Recovery testing** 

Required drills: 

- Database point-in-time restore. 

- R2 object restore. 

- Vercel rollback. 

- Secret rotation. 

- Domain reactivation. 

- Worker dead-letter replay. 

- Tenant smoke after restore. 

## **20. Disaster Recovery Architecture** 

## **20.1 Failure scenarios** 

Covered scenarios: 

- Database failure. 

53 

- Region/provider failure. 

- Deployment failure. 

- Secret compromise. 

- Tenant domain failure. 

- R2 object access failure. 

- Supabase auth degradation. 

- Worker backlog/dead-letter incident. 

- Migration failure. 

## **20.2 Database failure** 

Procedure: 

```
Declare incident
  ↓
Freeze deploys/migrations
  ↓
Check provider health
  ↓
Fail to restored DB or provider recovery path
  ↓
Update environment connection if required
  ↓
Run app smoke
  ↓
Run tenant isolation validation
  ↓
Monitor
```

## **20.3 Region failure** 

Phase 0/1 does not introduce multi-region architecture. Recovery relies on provider recovery, redeploy, and backup restore. 

Procedure: 

- Confirm provider incident. 

- Communicate status. 

- Preserve data integrity. 

- Restore to supported region only if approved. 

- Validate tenant isolation after restore. 

- Document incident. 

## **20.4 Deployment failure** 

Procedure: 

54 

```
Detect failed deployment
  ↓
Promote previous Vercel deployment
  ↓
Disable feature flag if relevant
  ↓
Check DB compatibility
  ↓
Run smoke tests
  ↓
Monitor errors
```

## **20.5 Secret compromise** 

Procedure: 

```
Identify exposed secret
  ↓
Revoke/rotate immediately
  ↓
Redeploy affected services
  ↓
Inspect logs for misuse
  ↓
Audit access
  ↓
Open incident report
  ↓
Add prevention control
```

## **20.6 Tenant domain failure** 

Procedure: 

```
Detect domain/SSL failure
  ↓
Check Cloudflare DNS
  ↓
Check Vercel domain verification
  ↓
Check SSL certificate state
  ↓
Temporarily route to safe fallback if approved
  ↓
Restore domain
```

55 

```
  ↓
Run host tenant resolution smoke
```

## **20.7 Recovery procedures** 

Minimum runbooks: 

```
runbooks/db-restore.md
runbooks/vercel-rollback.md
runbooks/secret-rotation.md
runbooks/domain-recovery.md
runbooks/r2-object-restore.md
runbooks/worker-dead-letter.md
runbooks/security-incident.md
runbooks/tenant-isolation-incident.md
```

## **20.8 RTO** 

Baseline targets for Phase 0/1: 

|Failure|RTO Target|
|---|---|
|Deployment failure|minutes through rollback|
|Tenant domain misconfguration|same incident window|
|Worker backlog|same day unless Critical|
|Database restore|documented drill target before production|
|Secret compromise|immediate rotation priority|
|R2 asset recovery|per asset class|



Exact commercial SLA is not defined in this package. 

## **20.9 RPO** 

Baseline: 

|Data Class|RPO Priority|
|---|---|
|Audit/security data|tightest|
|Learning progress/assessments|tight|
|Course/content confguration|moderate|
|R2 export fles|retention-dependent|
|Temporary fles|acceptable loss|



56 

|Data Class|RPO Priority|
|---|---|
|Analytics projections|rebuildable|



## **20.10 Recovery validation** 

After recovery: 

- App health passes. • Auth works. 

- Tenant resolution works. 

- FundedBeyond domain works. 

- Second tenant works. 

- RLS tests pass. 

- Authorization tests pass. 

- Worker resumes. 

- Monitoring normalizes. 

- Incident report completed. 

## **21. Security Operations Architecture** 

## **21.1 Access control** 

Provider access must follow least privilege. 

Systems requiring MFA: 

- GitHub. • Vercel. • Cloudflare. 

- Supabase. • Sentry. • PostHog. 

- Better Stack. • Database provider/admin. 

## **21.2 Admin access** 

Tenant admin is product access. Provider admin is infrastructure access. They must not be confused. 

Rules: 

- Tenant Admin cannot access provider consoles. 

- Platform Super Admin cannot bypass infrastructure controls. 

- Provider access is granted only by operational role. 

- All privileged app operations still audit through Atlas. 

57 

## **21.3 Production access** 

Production access requirements: 

- Named account. 

- MFA. 

- Minimum role. 

- Time-bound where possible. 

- Approval for sensitive operations. 

- Emergency access record. 

- Offboarding removal checklist. 

## **21.4 Audit logging** 

Security operations audit: 

- Platform scope enter/exit. 

- Role/permission changes. 

- Entitlement changes. 

- Tenant lifecycle changes. 

- Export/delete actions. 

- Sensitive denials where required. 

- Provider emergency access recorded operationally. 

## **21.5 Security reviews** 

Required review cadence: 

- Before production launch. 

- Before auth changes. 

- Before RLS changes. 

- Before domain/security changes. • Before production migration touching tenant tables. • Periodic quarterly review after launch. 

## **21.6 Dependency scanning** 

CI must include: 

- Dependency audit. 

- Secret scanning. 

- SAST where available. 

- License review where required. 

- SBOM generation where adopted. 

## **21.7 Vulnerability management** 

Process: 

58 

```
Detect vulnerability
  ↓
Classify severity
  ↓
Identify affected package/service
  ↓
Patch or mitigate
  ↓
Run tests
  ↓
Deploy
  ↓
Record remediation
```

## **21.8 Incident response** 

Incident phases: 

1. Detect. 

2. Classify. 

3. Contain. 

4. Eradicate. 

5. Recover. 

6. Validate. 

7. Review. 

Security incident priorities: 

- Tenant isolation risk. • Auth compromise. • Secret exposure. • Platform scope misuse. 

- Data export/deletion misuse. 

- R2 protected asset exposure. 

## **22. Release Management Architecture** 

## **22.1 Release process** 

```
Scope freeze
  ↓
Release candidate branch/tag
  ↓
Full CI
  ↓
Staging deploy
```

59 

```
  ↓
Migration rehearsal
  ↓
Smoke tests
  ↓
Security/tenant isolation validation
  ↓
Production approval
  ↓
Production deploy
  ↓
Monitoring window
  ↓
Release notes
```

## **22.2 Feature rollout** 

Feature release is decoupled from deployment. 

Controls: 

- Feature flags. 

- Entitlements. 

- Tenant config. 

- Workflow state. 

- Readiness policy config. 

- Branding/theme config. 

Rules: 

- Deploy code dark where appropriate. 

- Enable per tenant only after validation. 

- Kill switch exists for risky features. 

- No hardcoded FundedBeyond rollout path. 

## **22.3 Hotfix process** 

```
Open hotfix branch from main
  ↓
Patch minimal issue
  ↓
Run focused + required CI
  ↓
Review
  ↓
Deploy
  ↓
Monitor
```

60 

```
  ↓
Back-merge to develop/release branch
```

Rules: 

- No scope expansion. 

- No opportunistic refactor. 

- No migration unless absolutely required and approved. • Incident report updated. 

## **22.4 Rollback process** 

Rollback hierarchy: 

1. Disable feature flag. 

2. Roll back Vercel deployment. 

3. Pause worker/queue where safe. 

4. Forward-fix database. 

5. Restore database only for severe data incident. 

## **22.5 Production approval process** 

Production approval requires: 

- Release owner. 

- Engineering owner. 

- DevOps owner. 

- Database owner if migration. 

- Security owner if auth/RLS/platform. 

- CTO for high-risk release. 

## **22.6 Release checklist** 

- CI green. 

- Migration reviewed. 

- Staging deployed. 

- Smoke tests passed. 

- Tenant isolation tests passed. 

- Authorization tests passed. 

- Sentry release configured. 

- Better Stack health checks active. 

- Rollback target known. 

- Feature flags configured. 

- Runbooks current. 

- Support notes ready. 

61 

## **23. Worker & Background Job Operations** 

## **23.1 Worker deployment** 

Workers are part of the approved backend operations layer and process outbox-driven side effects. 

Worker categories: 

- Outbox worker. 

- Notification worker. 

- Analytics worker. 

- Competency worker. 

- Readiness worker. 

- Export worker. 

- Partition/maintenance worker. 

Deployment rules: 

- Same repository. 

- Same environment separation. 

- Same secrets classification. 

- Same tenant isolation rules. 

- Workers validate payloads with Zod. 

- Workers use `withTenantTx` for tenant work. 

- Workers use `withPlatformScope` for platform work. 

- Workers never bypass RLS. 

## **23.2 Monitoring** 

Worker monitoring: 

- Heartbeat. 

- Queue/outbox lag. 

- Processed count. 

- Failed count. 

- Retry count. 

- Dead-letter count. 

- Duration. 

- Last successful run. 

- Tenant-safe failure grouping. 

## **23.3 Retries** 

Retry rules: 

- Retry only idempotent handlers. • Use backoff. 

- Preserve request/event correlation. 

- Do not duplicate audit rows. 

62 

- Do not duplicate notifications. • Do not duplicate points/certificates/signals. • Stop after max retries. 

## **23.4 Dead letters** 

Dead-letter when: 

- Max retries exceeded. 

- Event schema invalid. 

- Handler consistently fails. 

- Target resource no longer processable. 

- Required tenant context cannot be resolved. 

Dead-letter record includes: 

- Event ID. 

- Tenant safe ID. 

- Error code. 

- Safe error message. 

- Retry count. 

- Last attempted time. 

- Request ID. 

## **23.5 Scaling** 

Scaling triggers: 

- Outbox lag sustained. 

- Export queue growth. 

- Notification retry backlog. 

- Analytics rollup delay. 

- Competency/readiness update delay. 

- Dead-letter spike. 

Scaling actions: 

- Increase worker concurrency where safe. 

- Split worker category deployment. 

- Pause non-critical jobs. 

- Optimize query/index. 

- Add backpressure to producer route where approved. 

## **23.6 Recovery** 

Worker recovery procedure: 

```
Identify failed job/event
```

```
  ↓
Inspect safe logs by requestId/eventId
```

63 

```
  ↓
Fix handler/config/data issue
  ↓
Replay eligible event
  ↓
Validate no duplicate side effect
  ↓
Clear dead-letter only after success
```

## **23.7 Operational ownership** 

|Worker|Owner|
|---|---|
|Outbox|Backend owner|
|Notifcation|Backend owner|
|Analytics|Backend/Product owner|
|Competency/readiness|Backend/Product owner|
|Export|Backend/DevOps owner|
|Partition/maintenance|Database/DevOps owner|



## **24. Performance Operations** 

## **24.1 Latency targets** 

Baseline internal targets: 

|Surface|Target|
|---|---|
|Public landing|fast CDN-assisted response|
|Authenticated API p95|monitored and budgeted|
|Admin tables|cursor-paginated, indexed|
|Worker processing|backlog within operational threshold|
|Export jobs|async, not request-blocking|



Exact public SLA is not defined in Phase 0/1. 

## **24.2 Availability targets** 

Production must support: 

- Health checks. 

64 

- Rollback. 

- Provider status monitoring. 

- Backup/restore. 

- Incident response. 

- Critical alerting. 

## **24.3 Error budgets** 

Track: 

- API 5xx rate. 

- Frontend error rate. 

- Worker failure rate. 

- Auth failure spike. 

- Domain/SSL failure. 

- R2 operation failure. 

- Database timeout rate. 

## **24.4 Capacity planning** 

Review monthly after production launch: 

- Tenant count. 

- Active learners. 

- API volume. 

- Database growth. 

- R2 storage. 

- Worker backlog. 

- Audit/event volume. 

- Analytics projections. 

- Cost per tenant. 

## **24.5 Scaling triggers** 

Scale when: 

- p95 latency breach sustained. 

- DB connection pressure. 

- Slow query count increases. 

- Worker lag sustained. 

- R2 failure rate rises. 

- Tenant storage exceeds warning threshold. 

- Cloudflare WAF/rate-limit blocks spike. 

## **24.6 Cost monitoring** 

Track: 

- Vercel usage. 

- Database usage. 

65 

- Supabase Auth usage. 

- R2 storage/operations. 

- Sentry event volume. 

- PostHog event volume. 

- Better Stack ingestion. 

- Domain/SSL costs where applicable. 

Cost controls: 

- No self-hosted video. 

- Cache public-safe assets. 

- Limit analytics event volume. 

- Retain logs appropriately. 

- Expire exports. 

- Use async jobs for heavy work. 

## **25. Tenant Operations** 

## **25.1 Tenant provisioning** 

Tenant provisioning uses approved platform tenant provisioning flow. 

Operational steps: 

```
Platform operator creates tenant
  ↓
Provisioning job created
  ↓
Branding/theme/config seeded
  ↓
Roles/permissions/entitlements seeded
  ↓
Domain configured
  ↓
Storage namespace ready
  ↓
Smoke test runs
  ↓
Tenant marked ready/active as approved
```

Rules: 

- No one-off SQL for FundedBeyond. 

- No code branch for tenant. 

- Idempotent provisioning. 

- Audit every lifecycle action. 

- Second tenant must provision without code change. 

66 

## **25.2 Tenant suspension** 

Suspension effects: 

- Tenant state gate blocks protected access as approved. 

- Public unavailable/suspended notice shown where approved. 

- Workers must respect tenant state. 

- Domain remains configured unless removed separately. 

- Audit entry required. 

## **25.3 Tenant deletion** 

Deletion follows approved data rights/deletion workflow. 

Rules: 

- No direct hard delete outside approved process. • Export/right-to-data requirements handled first where applicable. • R2 objects follow retention/deletion policy. 

- Audit/deletion record preserved as approved. 

- Production deletion requires owner/CTO approval. 

## **25.4 Domain changes** 

Domain change steps: 

```
Request domain change
  ↓
Authorize + entitlement
  ↓
Verify DNS
  ↓
Provision SSL
  ↓
Activate new domain
  ↓
Deactivate old domain if requested
  ↓
Run host resolution smoke
  ↓
Audit
```

## **25.5 Branding deployment** 

Branding/theme changes: 

- Stored as tenant config/theme/branding. • Versioned where approved. 

67 

- No code deploy required. 

- Public cache invalidated if needed. 

- Audit required for sensitive branding/domain changes. 

## **25.6 Entitlement changes** 

Entitlement changes: 

- Platform/authorized admin operation only. 

- Audit required. 

- Cache invalidation required. 

- Route/action gates update on next request. 

- 

- No plan-name checks in code. 

## **25.7 Operational audits** 

Tenant operations audit review includes: 

- Recent lifecycle changes. 

- Domain changes. 

- Entitlement changes. 

- Role changes. 

- Export/delete requests. 

- Failed auth/permission anomalies. 

- Worker failures by tenant. 

- Domain/SSL health. 

## **26. Compliance & Audit Operations** 

## **26.1 Audit retention** 

Audit retention follows approved audit policy and must be longer than ordinary logs. 

Rules: 

- Append-only. 

- Hash-chained. 

- Tenant-scoped where tenant-related. 

- Platform-scoped where platform-related. 

- No update/delete path. 

- Corrections are compensating entries. 

## **26.2 Operational audits** 

Monthly after launch: 

- Provider access review. 

- Secret access review. 

68 

- Production deployment review. 

- Incident review. 

- Backup/restore evidence review. 

- Tenant domain status review. 

- Monitoring alert quality review. 

## **26.3 Access reviews** 

Review: 

- GitHub access. 

- Vercel access. • Cloudflare access. • Supabase access. 

- Database access. 

- R2 access. 

- Sentry/PostHog/Better Stack access. 

- Atlas platform roles. 

## **26.4 Permission reviews** 

Review: 

- Permission catalogue drift. 

- Role mapping. 

- Overrides. 

- Owner/admin assignments. 

- Platform role assignments. 

- Suspended/removed membership behavior. 

- Entitlement gate behavior. 

## **26.5 Infrastructure change logs** 

Infrastructure changes must record: 

- What changed. 

- Who approved. 

- Who executed. 

- Environment. 

- Risk. 

- Rollback plan. 

- Validation result. 

## **26.6 Security review cadence** 

Required cadence: 

- Pre-production launch. 

- Monthly access review. 

- Quarterly security review. 

69 

- After every Critical/High incident. 

- Before RLS/auth/platform changes. 

- Before adding a new provider integration. 

## **27. Local Development Infrastructure** 

## **27.1 Local setup** 

Commands: 

```
gitclone<repo>
cdatlas-lms
pnpminstall
cp.env.example.env.local
pnpmdb:setup
pnpmdb:seed
pnpmtest:tenant-isolation
pnpmdev
```

## **27.2 Environment variables** 

`.env.example` must include placeholders for: 

```
APP_ENV=
APP_URL=
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
CRON_SECRET=
INTERNAL_WORKER_SECRET=
```

70 

No real values committed. 

## **27.3 Database setup** 

Local DB setup: 

```
pnpmdb:migrate
pnpmdb:seed:catalogues
pnpmdb:seed:tenants
pnpmdb:seed:fundedbeyond
pnpmdb:seed:smoke-tenant
pnpmtest:tenant-isolation
```

## **27.4 Supabase setup** 

Options: 

- Supabase local. 

- Hosted dev Supabase project. 

Rules: 

- Dev project only. • Dev redirect URLs only. • Dev email templates. • Dev service-role key only in `.env.local` . 

## **27.5 R2 setup** 

Options: 

- Dev R2 bucket. 

- Local storage mock where compatible. 

Rules: 

- Same signed upload/download code path. 

- Synthetic files only. 

- No production bucket access. 

## **27.6 Seed process** 

Seeds create: 

- Permission catalogue. 

- Permission bundles. 

- Roles. 

- Role permissions. 

- Feature flags. 

71 

- Entitlements. 

- Item types. 

- Workflow templates. 

- FundedBeyond tenant config. 

- Second smoke tenant. 

Seeds must be idempotent. 

## **27.7 Development workflow** 

```
Pull latest
  ↓
Install
  ↓
Migrate
  ↓
Seed
  ↓
Run tests
  ↓
Create branch
  ↓
Implement approved story
  ↓
Run local validation
  ↓
Open PR
  ↓
CI
  ↓
Preview
  ↓
Review
```

Rules: 

- No feature work before Phase 0 gates. 

- No schema change without migration. 

- No route without metadata. 

- No API beyond approved inventory. 

- No screen beyond approved inventory. 

- No FundedBeyond branch. 

72 

## **28. Infrastructure Folder Structure** 

## **28.1 Required structure** 

```
infrastructure/
├── vercel/
│   ├── project-settings.md
│   ├── environment-variables.md
│   └── rollback.md
├── cloudflare/
│   ├── dns.md
│   ├── waf.md
│   ├── rate-limits.md
│   ├── cache-rules.md
│   └── custom-domains.md
├── supabase/
│   ├── auth-settings.md
│   ├── email-settings.md
│   └── jwt-session.md
├── r2/
│   ├── buckets.md
│   ├── lifecycle.md
│   └── access-policy.md
└── database/
    ├── backups.md
    ├── restore.md
    └── migration-policy.md
.github/
├── workflows/
│   ├── ci.yml
│   ├── preview.yml
│   ├── staging.yml
│   ├── production.yml
│   ├── migrations.yml
│   └── security.yml
├── CODEOWNERS
└── pull_request_template.md
```

```
scripts/
├── db/
│   ├── migrate.sh
│   ├── seed.sh
│   ├── restore-check.sh
│   └── rls-check.sh
├── ci/
│   ├── check-route-metadata.ts
│   ├── check-prisma-boundaries.ts
```

73 

```
│   ├── check-secrets.ts
│   └── check-forbidden-scope.ts
├── deploy/
│   ├── predeploy-check.sh
│   ├── postdeploy-smoke.sh
│   └── rollback-check.sh
└── ops/
    ├── rotate-secret.md
    ├── domain-smoke.sh
    └── tenant-smoke.sh
monitoring/
├── sentry/
│   ├── project-settings.md
│   └── alert-rules.md
├── posthog/
│   ├── event-taxonomy.md
│   └── privacy-rules.md
├── better-stack/
│   ├── monitors.md
│   ├── log-schema.md
│   └── alert-routing.md
└── dashboards/
    ├── application.md
    ├── api.md
    ├── workers.md
    ├── database.md
    ├── tenants.md
    └── infrastructure.md
```

```
runbooks/
├── db-restore.md
├── vercel-rollback.md
├── production-deploy.md
├── secret-rotation.md
├── tenant-domain-onboarding.md
├── tenant-domain-recovery.md
├── r2-object-restore.md
├── worker-dead-letter.md
├── security-incident.md
├── tenant-isolation-incident.md
└── release-checklist.md
```

## **28.2 Folder explanations** 

|Folder|Purpose|
|---|---|
|`infrastructure/`|Provider confguration records and operational setup docs|



74 

|Folder|||Purpose|
|---|---|---|---|
|`.github/`|||CI/CD, code ownership, PR workfows|
|`scripts/`|||Repeatable operational checks and deployment helpers|
|`monitoring/`|||Sentry/PostHog/Better Stack confguration and dashboards|
|`runbooks/`|||Incident, release, rollback, restore, and tenant operations procedures|



## **29. Cursor & Claude DevOps Rules** 

## **29.1 Allowed AI generation** 

AI may generate: 

- GitHub Actions YAML. 

- CI check scripts. 

- Deployment smoke scripts. 

- Monitoring config docs. 

- 

- Runbook drafts. 

- `.env.example` placeholders. 

- Secret classification tables. 

- 

- Log schema validators. 

Test harness scaffolding. 

- 

- Migration validation scripts. 

## **29.2 Required AI constraints** 

Every AI-generated DevOps change must: 

- Use locked stack only. 

- Avoid new APIs/screens/entities/permissions. 

- 

- Preserve environment separation. 

- Use placeholder secret values only. 

- Avoid production secret examples. 

- Include failure behavior. 

- Include rollback/restore consideration. 

- Respect tenant isolation gates. 

- Respect `withTenantTx` and `withPlatformScope` . 

## **29.3 CI/CD config rules** 

AI-generated CI/CD must include gates for: 

- Install. • Lint. 

- Typecheck. • Unit tests. 

75 

- Integration tests. 

- Authorization tests. 

- Tenant isolation tests. 

- Build. 

- Secret scan. 

- Dependency scan. 

- Route metadata check. 

- Prisma boundary check. 

- Forbidden scope check. 

## **29.4 Infrastructure script rules** 

Scripts must: 

- Be idempotent where possible. 

- Support environment argument. 

- Refuse production unless explicit flag/approval marker. • Never echo secrets. 

- Use safe logging. 

- Exit non-zero on failure. • Produce machine-readable output where useful. 

## **29.5 Deployment script rules** 

Deployment scripts must: 

- Verify branch/tag. 

- Verify CI status. 

- Verify migration state. 

- Run health checks. 

- Run smoke tests. 

- Print rollback target. 

- Not mutate tenant data unless explicitly designed and approved. 

## **29.6 Monitoring config rules** 

Monitoring config must: 

- Include requestId correlation. 

- Avoid raw PII/secrets. 

- Separate production/staging. 

- Include ownership. 

- Include escalation path. 

- Include alert severity. 

## **29.7 Forbidden AI patterns** 

AI must not generate: 

- Real secret values. 

76 

- Hardcoded FundedBeyond branches. 

- New APIs. 

- New screens. 

- New permissions. 

- New database tables. 

- Tenant resolution from query/body/localStorage. 

- Direct Prisma access outside wrappers. 

- Session-level tenant `SET` . 

- Platform access from tenant route. 

- Public bucket access for protected assets. 

- Logs containing tokens, signed URLs, raw passwords, or service keys. 

- Destructive production migration without expand/contract plan. 

- Provider-specific manual steps without runbook documentation. 

- “Temporary” security bypasses. 

## **30. Production Readiness Checklist** 

## **30.1 Infrastructure readiness** 

- Vercel project configured. 

- Cloudflare DNS configured. 

- Cloudflare WAF/rate limits configured. 

- Production domains verified. 

- 

- FundedBeyond domain verified. 

- 

- Platform domain isolated. 

- Supabase production project configured. 

- R2 production bucket configured. 

- 

- PostgreSQL production DB configured. 

- 

- Environment variables set. 

- Rollback runbook ready. 

## **30.2 Security readiness** 

- MFA enabled on provider accounts. 

- Branch protection enabled. 

- CODEOWNERS enabled. 

- Secret scanning enabled. 

- Dependency scanning enabled. 

- Production secrets restricted. 

- Supabase service-role server-only. 

- Cloudflare token restricted. 

- R2 credentials scoped. 

- Platform access audited. 

- Security incident runbook ready. 

## **30.3 Monitoring readiness** 

- Sentry configured. 

77 

- Sentry release tracking enabled. 

- PostHog configured. 

- 

- Better Stack uptime checks configured. 

- Structured logs flowing. 

- Worker heartbeat configured. 

- Alert routing tested. 

- Dashboards created. • Request ID correlation verified. 

## **30.4 Backup readiness** 

- DB backups enabled. 

- PITR enabled where supported. 

- R2 versioning/lifecycle configured. 

- Config backup docs complete. 

- Restore drill completed. 

- Restore drill report stored. 

- Recovery runbooks ready. 

## **30.5 Recovery readiness** 

- Vercel rollback tested. 

- Secret rotation tested. 

- DB restore tested. 

- R2 object restore tested. 

- Domain recovery tested. 

- Worker dead-letter replay tested. • Tenant isolation after restore tested. 

## **30.6 Deployment readiness** 

- CI green. 

- Build green. 

- Migration staging rehearsal complete. 

- Tenant isolation tests green. 

- Authorization tests green. 

- E2E smoke green. 

- Feature flags configured. 

- Rollback target known. 

- Production approval recorded. 

## **30.7 Tenant readiness** 

• FundedBeyond tenant provisioned through approved provisioning. • `academy.fundedbeyond.com` resolves correctly. • Branding/theme/config loaded from tenant config. • Entitlements configured. 

- Roles/permissions seeded. • R2 namespace works. • Public routes work. 

- Protected routes gate correctly. 

78 

• Second tenant smoke test passes. 

## **31. Final Validation** 

## **31.1 Technical Architecture Compliance** 

**Result:** PASS with implementation gates. 

This DevOps package complies with the locked technical architecture by preserving: 

- Single codebase. 

- Vercel hosting. 

- Cloudflare edge/CDN/WAF. 

- PostgreSQL + Prisma. 

- Supabase Auth. 

- Cloudflare R2. 

- Sentry/PostHog/Better Stack. 

- Zod validation. 

- CI gates for correctness. 

## **31.2 Frontend Architecture Compatibility** 

**Result:** PASS. 

Infrastructure supports: 

- Next.js 15+ App Router deployment. 

- Server-first rendering. 

- Protected route gate-before-render. 

- Tenant-safe branding/theme loading. 

- Preview deployments for frontend review. 

- Sentry/PostHog client instrumentation without secrets. 

- No new screens. 

## **31.3 Backend Architecture Compatibility** 

**Result:** PASS. 

Infrastructure supports: 

- Next.js API Routes. 

- Server Actions as orchestration wrappers. 

- 

- `withTenantTx` . 

- 

- `withPlatformScope` . 

- Outbox workers. 

- Audit writes. 

- R2 signed access. 

- Structured logging and request IDs. 

79 

• No new APIs. 

## **31.4 Multi-Tenant Validation** 

**Result:** PASS only after Phase 0 gates are green. 

Required proof: 

- Host resolves tenant. 

- Host wins over JWT. 

- ACTIVE membership gate enforced. 

- Entitlement before permission. 

- `can()` only authorization decision point. 

- • RLS enabled. 

- No Prisma outside `withTenantTx` . • Second tenant smoke test passes. 

## **31.5 Security Validation** 

**Result:** PASS with mandatory controls. 

Required controls: 

- Least privilege provider access. 

- MFA. 

- Secret classification. 

- Secret rotation runbook. 

- Audit for sensitive actions. 

- WAF/rate limiting. 

- Dependency/secret scanning. 

- No sensitive logs. 

- Incident response runbooks. 

## **31.6 Scalability Validation** 

**Result:** PASS for Phase 0/1 scale. 

Supported by: 

- Stateless Vercel runtime. 

- Cloudflare CDN. 

- R2 object storage. 

- PostgreSQL indexes and RLS. 

- Cursor pagination. 

- Worker/outbox pattern. 

- Read projections for dashboards. 

- Tenant usage monitoring. 

80 

Not included in Phase 0/1: 

- Multi-region active-active. 

- Dedicated tenant infrastructure. 

- Formal enterprise SLA. 

- Native mobile build pipeline. 

## **31.7 Disaster Recovery Validation** 

**Result:** PASS only after restore drill. 

Required before production: 

- DB restore drill. 

- R2 restore check. 

- Vercel rollback test. 

- Secret rotation test. 

- Domain recovery test. 

- Tenant isolation validation after restore. 

## **31.8 Operational Readiness Assessment** 

Atlas is operationally ready for Phase 0 implementation when: 

- CI/CD gates exist. 

- Infrastructure environments are separated. 

- RLS/tenant isolation harness exists. 

- Monitoring is wired. 

- Backups are configured. 

- Runbooks are written. 

- Access controls are enforced. 

Atlas is operationally ready for Phase 1 production only after: 

- Phase 0 isolation gates pass. 

- Staging migration rehearsal passes. 

- FundedBeyond tenant is provisioned through generic provisioning. 

- Second tenant smoke test passes. 

- Production readiness checklist passes. 

## **31.9 CTO Approval Verdict** 

## **Verdict: APPROVED FOR PHASE 0 DEVOPS IMPLEMENTATION.** 

## **Conditional approval for Phase 1 production operations** depends on: 

1. Transaction-pooled RLS test harness passing. 

2. No Prisma access outside `withTenantTx` . 

3. Route metadata checks enforced in CI. 

4. Authorization and tenant isolation suites green. 

81 

5. Staging restore drill completed. 

6. Production backup and rollback runbooks tested. 

7. Sentry/PostHog/Better Stack operational dashboards live. 

8. FundedBeyond configured as Tenant #1 without code fork. 

9. Second tenant smoke test passing before launch. 

**Final position:** This package is implementation-ready as the official DevOps & Infrastructure blueprint for Atlas LMS Phase 0 + Phase 1A + Phase 1B, provided it is executed without introducing new product scope or weakening tenant isolation, authorization, audit, or recovery controls. 

82 

