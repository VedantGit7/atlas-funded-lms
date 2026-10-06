/**
 * Page-load budgets for the public tenant routes, checked by
 * `pnpm perf:web-vitals` (tests/performance/web-vitals.spec.ts).
 *
 * This replaces the Lighthouse CI configuration removed with @lhci/cli. It
 * keeps that configuration's routes and the core-web-vitals thresholds it
 * asserted (CLS failing, LCP and overall performance warning), and adds Total
 * Blocking Time, the main-thread metric Lighthouse's performance score weighs
 * most. Accessibility, Lighthouse's other category, is covered by the axe
 * browser suites (tests/browser/accessibility).
 *
 * Each route is loaded several times in a fresh, cold browser context; the
 * median is compared with the budget. `error` budgets fail the run; `warn`
 * budgets are reported only.
 */

export const WEB_VITALS_ROUTES = ["/", "/login", "/courses", "/p/home"];

export const WEB_VITALS_BUDGETS = {
  lcpMs: { limit: 2500, severity: "error", label: "Largest Contentful Paint" },
  cls: { limit: 0.1, severity: "error", label: "Cumulative Layout Shift" },
  tbtMs: { limit: 300, severity: "error", label: "Total Blocking Time" },
  fcpMs: { limit: 1800, severity: "warn", label: "First Contentful Paint" },
  ttfbMs: { limit: 800, severity: "warn", label: "Time to First Byte" },
};

/**
 * Lighthouse's desktop preset: no CPU slowdown, 40 ms round trip, 10 Mbps.
 * Measuring on a fast local connection with no emulation would flatter every
 * number.
 */
export const DESKTOP_PROFILE = {
  viewport: { width: 1350, height: 940 },
  deviceScaleFactor: 1,
  cpuSlowdown: 1,
  latencyMs: 40,
  downloadBytesPerSecond: 1_280_000,
  uploadBytesPerSecond: 1_280_000,
};

export function median(values) {
  const finite = values.filter((value) => typeof value === "number" && Number.isFinite(value));
  if (finite.length === 0) return null;
  const sorted = [...finite].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

/**
 * Compare each route's median against the budgets. A metric that was never
 * observed is itself a failure for an `error` budget: a gate that passes
 * because it measured nothing is worse than no gate.
 */
export function evaluateWebVitals(samples, budgets = WEB_VITALS_BUDGETS) {
  const routes = [...new Set(samples.map((sample) => sample.route))];
  const results = [];
  for (const route of routes) {
    const runs = samples.filter((sample) => sample.route === route);
    for (const [metric, budget] of Object.entries(budgets)) {
      const value = median(runs.map((run) => run[metric]));
      results.push({
        route,
        metric,
        label: budget.label,
        severity: budget.severity,
        limit: budget.limit,
        median: value,
        runs: runs.length,
        status: value === null ? "missing" : value <= budget.limit ? "pass" : "over",
      });
    }
  }
  const failures = results.filter(
    (result) => result.severity === "error" && result.status !== "pass",
  );
  const warnings = results.filter(
    (result) => result.severity === "warn" && result.status !== "pass",
  );
  return { results, failures, warnings, passed: failures.length === 0 };
}

export function describeResult(result) {
  const value =
    result.median === null
      ? "not observed"
      : result.metric === "cls"
        ? result.median.toFixed(3)
        : `${Math.round(result.median)} ms`;
  const limit = result.metric === "cls" ? String(result.limit) : `${String(result.limit)} ms`;
  return `${result.route} ${result.label}: ${value} (budget ${limit}, median of ${String(result.runs)})`;
}

/**
 * Refuse to measure a development server: on-demand compilation and
 * unminified bundles make every number meaningless, and a pass there would
 * be read as a pass.
 */
export function assertProductionBuild(html) {
  // Strings that appear only in development pages: Next 16 / Turbopack's HMR
  // client and dev overlay chunks (URL-encoded names), and webpack's refresh
  // runtime. Not "/_next/webpack-hmr": production middleware matchers name it.
  const devMarkers = [
    "_browser_dev_hmr-client",
    "next-devtools",
    "react-refresh",
    "__nextDevClientId",
  ];
  const marker = devMarkers.find((candidate) => html.includes(candidate));
  if (marker) {
    throw new Error(
      `The target is a Next development server (found "${marker}"). Measure a production build (next build && next start).`,
    );
  }
}
