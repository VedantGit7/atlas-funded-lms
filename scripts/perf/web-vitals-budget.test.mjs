import assert from "node:assert/strict";
import test from "node:test";
import {
  WEB_VITALS_BUDGETS,
  assertProductionBuild,
  describeResult,
  evaluateWebVitals,
  median,
} from "./web-vitals-budget.mjs";

const run = (route, values) => ({ route, ...values });
const good = { lcpMs: 1200, cls: 0.01, tbtMs: 40, fcpMs: 700, ttfbMs: 120 };

test("median takes the middle of finite observations", () => {
  assert.equal(median([3, 1, 2]), 2);
  assert.equal(median([4, 1, 3, 2]), 2.5);
  assert.equal(median([null, 5, Number.NaN]), 5);
  assert.equal(median([null]), null);
});

test("passes when every route's median is within budget", () => {
  const report = evaluateWebVitals([run("/", good), run("/", good), run("/login", good)]);
  assert.equal(report.passed, true);
  assert.equal(report.failures.length, 0);
});

test("fails on an error budget, judged on the median rather than one slow run", () => {
  const oneSlow = [run("/", good), run("/", { ...good, lcpMs: 9000 }), run("/", good)];
  assert.equal(evaluateWebVitals(oneSlow).passed, true);

  const mostlySlow = [
    run("/", { ...good, lcpMs: 3000 }),
    run("/", { ...good, lcpMs: 3200 }),
    run("/", good),
  ];
  const report = evaluateWebVitals(mostlySlow);
  assert.equal(report.passed, false);
  assert.deepEqual(
    report.failures.map((failure) => [failure.route, failure.metric]),
    [["/", "lcpMs"]],
  );
});

test("reports a warn budget without failing", () => {
  const report = evaluateWebVitals([run("/login", { ...good, ttfbMs: 2000 })]);
  assert.equal(report.passed, true);
  assert.deepEqual(
    report.warnings.map((warning) => warning.metric),
    ["ttfbMs"],
  );
});

test("treats a metric that was never observed as a failure", () => {
  const report = evaluateWebVitals([run("/courses", { ...good, cls: null })]);
  assert.equal(report.passed, false);
  assert.equal(report.failures[0].status, "missing");
});

test("keeps the thresholds the Lighthouse configuration enforced", () => {
  assert.equal(WEB_VITALS_BUDGETS.cls.limit, 0.1);
  assert.equal(WEB_VITALS_BUDGETS.lcpMs.limit, 2500);
});

test("describes results in units a reader expects", () => {
  const [lcp, cls] = evaluateWebVitals([run("/", good)]).results;
  assert.match(describeResult(lcp), /^\/ Largest Contentful Paint: 1200 ms \(budget 2500 ms/);
  assert.match(describeResult(cls), /Cumulative Layout Shift: 0\.010 \(budget 0\.1/);
});

test("refuses a development server, and only a development server", () => {
  // What Next 16 with Turbopack actually serves in development.
  assert.throws(
    () =>
      assertProductionBuild(
        '<script src="/_next/static/chunks/%5Bturbopack%5D_browser_dev_hmr-client_hmr-client_ts_1p7whg_._.js"></script>',
      ),
    /development server/,
  );
  assert.throws(
    () =>
      assertProductionBuild('<script src="/_next/static/chunks/next-devtools_index.js"></script>'),
    /development server/,
  );
  // A production page, including a middleware matcher that names the HMR path.
  assert.doesNotThrow(() =>
    assertProductionBuild(
      '<script src="/_next/static/chunks/a.js"></script><script>"(?!_next/webpack-hmr)"</script>',
    ),
  );
});
