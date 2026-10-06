# Page-load check (web vitals)

`pnpm perf:web-vitals` measures how the public tenant routes load in a real
browser and fails when they exceed their budgets. It replaces the Lighthouse
CI configuration removed with `@lhci/cli`, on the existing Playwright setup.

## What it checks

Routes: `/`, `/login`, `/courses`, `/p/home`.

Each route is loaded three times (`ATLAS_WEB_VITALS_RUNS`), each in a fresh
browser context with the cache disabled, under Lighthouse's desktop
throttling (no CPU slowdown, 40 ms round trip, 10 Mbps). The **median** of the
runs is compared with the budget:

| Metric                   | Budget  | On breach |
| ------------------------ | ------- | --------- |
| Largest Contentful Paint | 2500 ms | fail      |
| Cumulative Layout Shift  | 0.1     | fail      |
| Total Blocking Time      | 300 ms  | fail      |
| First Contentful Paint   | 1800 ms | warn      |
| Time to First Byte       | 800 ms  | warn      |

LCP, CLS, FCP and TTFB come from the `web-vitals` build Next itself ships, as
in the mobile lab. Total Blocking Time is the sum, over long tasks after First
Contentful Paint, of each task's time beyond 50 ms. A metric that is never
observed counts as a failure. Budgets live in
`scripts/perf/web-vitals-budget.mjs`; downloaded JavaScript is reported but
budgeted separately by `ci:learner-bundle-boundary`.

Accessibility, Lighthouse's other category, is covered by the axe browser
suites in `tests/browser/accessibility`.

## Running it

Point it at a **production build**: a staging or preview deployment.

```bash
ATLAS_WEB_VITALS_BASE_URL=https://<tenant-host> pnpm perf:web-vitals
```

It refuses a Next development server: on-demand compilation and unminified
bundles make the numbers meaningless. A local `next start` is a deployed
runtime and needs the full staging configuration (`APP_ENV`, Redis, HTTPS
origins, secrets), so in practice the target is a deployed environment.

The report is written to `.test-results/perf/web-vitals.json`, with every
run's raw values, the medians and each budget's status.

To check the harness itself against any server, including a dev server:

```bash
ATLAS_WEB_VITALS_BASE_URL=http://fundedbeyond.localhost.test:3000 \
ATLAS_WEB_VITALS_MODE=collector-validation pnpm perf:web-vitals
```

That run requires every metric to be observed on every route but applies no
budgets, and the report records `kind: "collector-validation"` and
`passed: null`. Its timings are not a performance result.

## Limits

A synthetic, cold-cache, desktop visit; not field data (p75 of real users),
not mobile (see `pnpm perf:mobile`), and not interaction latency (INP needs
real interactions; the mobile lab measures it on learner routes).
