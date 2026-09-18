---
name: Future Backend Flexibility
status: draft
updated: 2026-06-23
depends-on:
  - monorepo-split-and-api-extraction.md
related:
  - ../frontend-planning/complete-frontend-rebuild.md
  - ../frontend-planning/performance.md
---

# Future backend flexibility & swap-readiness

**Intent:** After the frontend rebuild is complete and stable, you may **keep**, **refactor**, or **replace** the backend (different framework, database access layer, microservices, or hosting). The system must be robust enough that those changes do **not** require a frontend rewrite.

**Principle:** The **HTTP API contract** is the only stable seam between frontend and backend. Everything else is an implementation detail behind that seam.

---

## 1. What stays fixed (the contract)

These are the **only** things the frontend may depend on:

| Contract element         | Spec source                                           | Notes                                                    |
| ------------------------ | ----------------------------------------------------- | -------------------------------------------------------- |
| Base path                | `/api/v1/**`                                          | Version in URL; v2 can run parallel later                |
| Request/response shapes  | `@atlas/contracts` + [API Inventory v1](docs/locked/) | Zod schemas; optional OpenAPI export                     |
| Error envelope           | `{ error: { code, message, requestId } }`             | Already used by `clientApi` / `serverApi`                |
| Auth session             | Supabase cookies + host resolution                    | Swap auth provider only if cookie/JWT contract preserved |
| Tenant context           | **Host header** → tenant                              | Never `tenant_id` from client body                       |
| Idempotency              | `idempotency-key` on mutations                        | Preserved across backend rewrites                        |
| Permissions/entitlements | Server-enforced; UI gets projection hints only        | Frontend never encodes RBAC logic                        |

If a future backend honors the same contract, **the frontend keeps working without code changes**.

---

## 2. What can change later (without touching frontend)

| Layer                | Today                                       | Future options (examples)                                                  |
| -------------------- | ------------------------------------------- | -------------------------------------------------------------------------- |
| API runtime          | Next.js route handlers (`backend/apps/api`) | Hono, Fastify, NestJS, Go, separate services per domain                    |
| ORM                  | Prisma + PostgreSQL                         | Drizzle, Kysely, raw SQL, read replicas                                    |
| Monolith vs services | Modular monolith in `backend/packages/`     | Split courses, auth, billing into separate deployables behind same gateway |
| Database             | Single Postgres (RLS)                       | Same DB with new access layer, or CQRS read models                         |
| Auth provider        | Supabase Auth                               | Auth0, Clerk, custom JWT — if session bridge unchanged                     |
| Jobs/workers         | Outbox + workers in backend                 | SQS, Temporal, separate worker fleet                                       |
| Search               | Current search API                          | Elasticsearch, Typesense — same `GET /search` response shape               |
| File storage         | R2 references                               | S3, GCS — same signed-URL contract                                         |
| Hosting              | Vercel functions                            | Fly.io, AWS, K8s — frontend only needs stable `API_URL`                    |

---

## 3. Architecture rules (enforce during F-1 and all backend work)

### 3.1 Contract-first (`@atlas/contracts`)

```text
shared/ or backend/packages/contracts/
├── schemas/          # Zod per route group
├── types/            # inferred TypeScript types
└── openapi/          # generated spec (optional, F8+)
```

- Every public route has a schema in **contracts** before implementation
- Frontend imports **only** from `@atlas/contracts` — never from domain packages
- Breaking changes require `/api/v2` or additive-only v1 fields

### 3.2 Backend internal layering (ports & adapters)

```text
backend/apps/api/src/app/api/v1/     # HTTP adapters (thin)
backend/apps/api/src/server/         # application services
backend/packages/domain/*/           # domain logic
backend/packages/db/                 # Prisma / persistence adapter
```

**Rules:**

- Route handlers: validate → authorize → call service → map response. **No business logic in route files.**
- Domain services depend on **repository interfaces**, not Prisma types in public APIs
- Swapping Prisma → another store = change adapter package, not route contracts

### 3.3 Provider-agnostic patterns (already in Atlas PRD)

Mirror the payment/notification pattern for anything external:

- `NotificationChannel`, storage adapters, video providers — interface + impl
- Tenant config selects provider; no `if (provider === 'x')` in frontend

### 3.4 Events & async boundaries

- Domain mutations emit outbox events (already planned)
- Future microservices **subscribe to events** instead of sharing DB
- Frontend unaffected — still calls synchronous REST for reads/writes it needs today

---

## 4. Frontend responsibilities (swap-proof UI)

Documented in [complete-frontend-rebuild.md](../frontend-planning/complete-frontend-rebuild.md):

| Do                                                 | Don't                                       |
| -------------------------------------------------- | ------------------------------------------- |
| Call `API_URL + /api/v1/...` only                  | Import `@atlas/db`, domain services         |
| Use `@atlas/contracts` for forms and types         | Assume Prisma field names or DB enums in UI |
| Treat 401/403/ENTITLEMENT_REQUIRED uniformly       | Encode permission matrices in client        |
| Use env `NEXT_PUBLIC_API_URL` / `API_INTERNAL_URL` | Hardcode backend host per environment       |

**Result:** Point frontend at a new API deployment → change env vars only.

---

## 5. Contract testing (add in F8)

Prevent silent backend breaks when you refactor later:

| Test type                    | Tool                                  | What it guards                             |
| ---------------------------- | ------------------------------------- | ------------------------------------------ |
| **Schema tests**             | Vitest + Zod                          | Every route response matches contract      |
| **API integration**          | Existing `tests/api/*`                | Handler + DB behavior                      |
| **Consumer contract**        | Optional: Pact or OpenAPI diff in CI  | Frontend expectations vs backend spec      |
| **Breaking change detector** | `openapi-diff` or custom Zod snapshot | PR fails on removed fields / changed types |

Store golden fixtures in `tests/fixtures/api/v1/`.

---

## 6. API versioning strategy (when backend evolves)

```text
/api/v1/...   ← frontend uses this exclusively through rebuild
/api/v2/...   ← future breaking changes; v1 maintained until deprecation window ends
```

**Additive changes (no version bump):** new optional JSON fields, new endpoints, new query params.

**Breaking changes (require v2):** rename fields, change types, change error codes, change auth flow.

**Deprecation policy (recommended):**

1. Ship v2 alongside v1
2. Frontend migrates hook-by-hook
3. Sunset v1 with logged usage metrics

---

## 7. Optional future paths (not in current scope)

These are **compatible** with this architecture if needed later:

| Path                               | Frontend impact                                             |
| ---------------------------------- | ----------------------------------------------------------- |
| **API gateway** (Kong, Cloudflare) | None — same paths                                           |
| **GraphQL BFF**                    | New client layer; REST v1 still supported during transition |
| **gRPC internal + REST edge**      | None on frontend                                            |
| **Multi-region API**               | DNS/routing only                                            |
| **Third-party LMS head**           | New frontend; same API if white-label API product           |

---

## 8. Phased roadmap alignment

| When                        | Backend focus                                    | Frontend impact                             |
| --------------------------- | ------------------------------------------------ | ------------------------------------------- |
| **F-1**                     | Split API app; introduce `@atlas/contracts`      | Env + HTTP only                             |
| **F0–F8**                   | Keep current domain logic; stabilize contracts   | Full rebuild against v1                     |
| **Post-F8 (your decision)** | Option A: **keep & harden** current backend      | None                                        |
|                             | Option B: **refactor internals** (ORM, services) | Contract tests must stay green              |
|                             | Option C: **replace runtime** (non-Next API)     | Reimplement v1 routes; frontend unchanged   |
|                             | Option D: **microservices**                      | Gateway exposes same v1; frontend unchanged |

---

## 9. Exit criteria for “swap-ready” backend

Before you consider the frontend “done” and backend “optional to replace”:

- [ ] `@atlas/contracts` covers every `/api/v1` route the frontend calls
- [ ] Zero frontend imports from `backend/packages/*` (except contracts)
- [ ] OpenAPI or Zod snapshot published from contracts
- [ ] `tests/api/*` + contract schema tests green in CI
- [ ] Route handlers are thin; domain logic in `backend/packages/domain/*`
- [ ] Documented error codes and idempotency behavior per mutation
- [ ] README: “How to point frontend at a different API implementation”

---

## 10. Decision log (fill when you choose)

| Date  | Decision                   | Notes                                 |
| ----- | -------------------------- | ------------------------------------- |
| _TBD_ | Keep current backend stack | Prisma + Next API + Postgres          |
| _TBD_ | Refactor target            | e.g. extract workers, add read models |
| _TBD_ | Replace target             | e.g. Go API, separate services        |

---

## Related plans

- [Monorepo split](monorepo-split-and-api-extraction.md) — establishes the HTTP boundary
- [Frontend rebuild](../frontend-planning/complete-frontend-rebuild.md) — consumes contract only
- Locked: `docs/locked/Atlas API Inventory v1`, Master PRD §0.3 (provider-agnostic pattern)
