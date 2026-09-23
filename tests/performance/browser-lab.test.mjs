import { test } from "node:test";
import assert from "node:assert/strict";
import {
  normalizeLabSample,
  assertLabCoverage,
  assertLocalLabTarget,
} from "../../scripts/perf/browser-lab-evidence.mjs";

const complete = {
  route: "catalog",
  lcpMs: 123,
  inpMs: 16,
  cls: 0,
  downloadedJsBytes: 12345,
  interactionCount: 1,
};
test("missing browser metrics remain null, never fabricated zero", () => {
  assert.deepEqual(normalizeLabSample({ route: "catalog" }), {
    route: "catalog",
    lcpMs: null,
    inpMs: null,
    cls: null,
    downloadedJsBytes: null,
    interactionCount: 0,
  });
});
test("genuinely observed zero CLS and INP are preserved", () => {
  assert.equal(normalizeLabSample({ ...complete, inpMs: 0 }).inpMs, 0);
  assert.equal(normalizeLabSample(complete).cls, 0);
});
test("missing routes, measurements and interactions fail lab coverage", () => {
  assert.throws(() => assertLabCoverage([], ["catalog"]), /catalog/);
  assert.throws(() => assertLabCoverage([{ ...complete, inpMs: null }], ["catalog"]), /inpMs/);
  assert.throws(
    () => assertLabCoverage([{ ...complete, interactionCount: 0 }], ["catalog"]),
    /interaction/,
  );
  assert.throws(() => assertLabCoverage([{ ...complete, lcpMs: Infinity }], ["catalog"]), /lcpMs/);
  assertLabCoverage([complete], ["catalog"]);
});
test("mobile lab mutations are restricted to explicit disposable local stack", () => {
  assertLocalLabTarget(
    "http://fundedbeyond.localhost:3100",
    "http://127.0.0.1:54326",
    "postgres://user:pass@127.0.0.1:15436/atlas_lms_e2e",
  );
  for (const target of [
    "https://example.com",
    "http://localhost:3000",
    "http://user:pass@localhost:3100",
    "http://localhost:3100/path",
  ]) {
    assert.throws(() =>
      assertLocalLabTarget(
        target,
        "http://127.0.0.1:54326",
        "postgres://user:pass@127.0.0.1:15436/atlas_lms_e2e",
      ),
    );
  }
});
