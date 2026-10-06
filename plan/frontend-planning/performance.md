---
name: Frontend Performance Strategy
status: draft
updated: 2026-06-23
depends-on:
  - complete-frontend-rebuild.md
  - tech-stack.md
---

# Frontend performance strategy

**Problem:** The current `apps/web` UI feels slow — navigation, dashboard load, and interactive surfaces lag.

**Goal:** The rebuilt frontend must feel **fast by default** on median devices and connections. Performance is a **first-class requirement from F0**, not a late F8 afterthought.

---

## 1. Why the current frontend is slow (diagnosis)

| Issue                     | What happens today                                                                         | Fix in rebuild                                                                                                       |
| ------------------------- | ------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| **Self-HTTP round-trips** | RSC `serverApi` fetches same-origin `/api/v1` inside one Next app (extra hop + JSON parse) | After F-1 split: direct internal URL + connection reuse; parallel fetches; consider batch endpoints for L1 dashboard |
| **No client cache**       | No React Query — client islands refetch on every mount/navigation                          | TanStack Query with tuned `staleTime` / `gcTime`; prefetch on hover for nav targets                                  |
| **Request waterfalls**    | Sequential `await` in server loaders                                                       | `Promise.all` for independent resources; Suspense boundaries per widget                                              |
| **Heavy initial bundles** | Monolithic client JS; builders/charts may pull into learner routes                         | Route-group code splitting; `next/dynamic` for studio/admin only                                                     |
| **Minimal loading UX**    | Only 9 `loading.tsx` files; blank waits feel slower than skeletons                         | Skeleton per route group; stream shell chrome first                                                                  |
| **No bundle budgets**     | No CI gate on JS size                                                                      | Enforce max kB per route group in CI                                                                                 |
| **Next 15 dev/build**     | Older toolchain                                                                            | **Next 16.2.9** + Turbopack default for faster dev and optimized prod builds                                         |

---

## 2. Performance targets (enforce in CI + Lighthouse)

Aligned with [Frontend Architecture §26](docs/locked/ATLAS-LMS-Frontend-Architecture-Package-v1.md) and Core Web Vitals.

### Core Web Vitals (learner routes, p75 mobile)

| Metric  | Target  | Priority routes                         |
| ------- | ------- | --------------------------------------- |
| **LCP** | < 2.5s  | `/`, `/courses`, `/courses/[id]`        |
| **INP** | < 200ms | Lesson player, assessment runner, swipe |
| **CLS** | < 0.1   | All learner shells                      |

### Custom budgets

| Measure                           | Target                                  |
| --------------------------------- | --------------------------------------- |
| Learner route initial JS (gzip)   | < 150 kB per route group entry          |
| L1 dashboard TTFB (RSC)           | < 600 ms p95 (staging)                  |
| Client navigation (cached)        | < 100 ms perceived (skeleton → content) |
| API parallelization               | L1 loader: max 1 waterfall depth        |
| Time to interactive (lesson page) | < 3s on Fast 3G throttled               |

### Regression gate

- Lighthouse CI on `/`, `/courses`, `/login` — fail PR if LCP or INP regresses > 10% vs baseline branch
- `@next/bundle-analyzer` report on learner vs admin bundles — fail if learner imports platform/studio-only libs

---

## 3. Architecture decisions (built into every phase)

### 3.1 Server-first + parallel RSC

```ts
// Good: parallel independent fetches in page loader
const [me, competency, streaks] = await Promise.all([
  serverApi.get("/api/v1/me"),
  serverApi.get("/api/v1/me/competency"),
  serverApi.get("/api/v1/me/streaks"),
]);
```

- Never chain independent API calls sequentially in one loader
- Split L1 dashboard into **Suspense islands** so fast widgets (streak) render before slow ones (analytics)

### 3.2 React Query (client islands)

| Surface             | `staleTime` | Notes                                    |
| ------------------- | ----------- | ---------------------------------------- |
| Catalog lists       | 60s         | Invalidate on enroll                     |
| `/me` shell context | 30s         | Background refetch on focus              |
| Notifications count | 15s         | Poll or refetch on route enter           |
| Assessment runner   | 0           | Autosave is mutation-driven, not cache   |
| Admin tables        | 0–30s       | URL-driven filters; paginate server-side |

- Prefetch course detail on catalog row hover/focus
- `placeholderData` / `keepPreviousData` for pagination — no full-table flash

### 3.3 Code splitting (mandatory lazy imports)

**Lazy-load (`next/dynamic`, `ssr: false` where needed):**

- Studio course/assessment builders
- Analytics charts (recharts or equivalent)
- Rich text / drag-drop editors
- Swipe animation extras
- Platform console tables
- PostHog + Sentry (defer non-critical)

**Never lazy-load:** route gates, error boundaries, theme init script, auth shell

### 3.4 Next.js 16 features

- **Turbopack** — default dev bundler
- **Streaming RSC** — `loading.tsx` + Suspense on all learner route groups
- **Partial Prerendering (PPR)** — public shell + tenant bootstrap only (A1, auth); no protected data in static shell
- **`next/image`** — all logos, thumbnails, certificate assets with explicit `width`/`height` to prevent CLS

### 3.5 Caching layers

| Layer                       | Policy                                            |
| --------------------------- | ------------------------------------------------- |
| Public bootstrap / branding | Tag cache by host; invalidate on branding publish |
| Protected member data       | `cache: 'no-store'` default                       |
| React Query                 | Tenant-scoped query keys include host             |
| CDN                         | Static assets immutable; HTML dynamic             |

### 3.6 Monorepo split performance win

Separating `frontend/apps/web` from `backend/apps/api`:

- Frontend bundle excludes Prisma, domain services, and API route code
- Smaller serverless functions on Vercel for UI vs API
- API can scale independently; UI rewrites add ~0ms in prod when colocated on same domain

### 3.7 Data discipline

- **Pagination / cursors** on all admin and community feeds — never load full tables
- **Dashboard aggregation endpoint** (backend): consider `GET /api/v1/me/dashboard` bundling L1 widgets in one round-trip (optional F2 enhancement)
- **Optimistic UI** for mark-complete, enroll, notification read — instant feedback, rollback on 4xx
- **Debounce** search input; server-side search only after 300 ms

---

## 4. Per-surface performance profile

| Surface      | Density           | Speed priority                                     |
| ------------ | ----------------- | -------------------------------------------------- |
| **Learner**  | Clean, low JS     | **Highest** — mobile-first, minimal client islands |
| **Public**   | Marketing         | **High** — PPR/ISR for landing where safe          |
| **Auth**     | Simple forms      | High — tiny bundle                                 |
| **Studio**   | Rich editors      | Medium — lazy-load builders acceptable             |
| **Admin**    | Data-dense tables | Medium — virtualized tables for 100+ rows          |
| **Platform** | Cross-tenant ops  | Medium — separate bundle, never in learner         |

---

## 5. Phase integration (not only F8)

| Phase     | Performance work                                                                                                                                                                                                                           |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **F0**    | Bundle analyzer setup; query-key factory; parallel loader pattern; skeleton components                                                                                                                                                     |
| **F1**    | Bootstrap endpoint single call for theme (no multi round-trip layout)                                                                                                                                                                      |
| **F2**    | Shell streaming; prefetch nav routes; learner bundle budget                                                                                                                                                                                |
| **F3–F4** | Lesson player lazy video embed; assessment runner code-split; swipe lightweight — **F4 shipped**; L1 waterfall / Suspense islands → F8 ([F4 backlog](complete-frontend-rebuild.md#101-phase-f4--completion--remaining-backlog) F4-R08–R10) |
| **F5–F6** | Lazy builders/charts (F5 done); virtualized DataTables (F6)                                                                                                                                                                                |
| **F8**    | Lighthouse CI, CWV regression gates, load test L1/dashboard                                                                                                                                                                                |

---

## 6. F8 exit criteria (performance)

- [x] Lighthouse CI config (`lighthouserc.cjs`) for learner critical paths — replaced 2026-10-06 by the Playwright page-load check `pnpm perf:web-vitals` (docs/runbooks/web-vitals-check.md) when `@lhci/cli` was removed
- [x] Bundle budget CI scaffold (`ci:learner-bundle-boundary`)
- [x] Learner/platform import boundary check in bundle CI script
- [x] L1 dashboard Suspense island for personalized section (waterfall depth 1)
- [x] Documented `staleTime` table implemented for all React Query hooks
- [ ] Manual Fast 3G pass on login → dashboard → lesson → back (ops checklist)

---

## 7. Out of scope (this phase)

- Offline-first / PWA (mobile app handles offline per PRD)
- Self-hosted video (always provider embed)
- Client-side full-text search index
