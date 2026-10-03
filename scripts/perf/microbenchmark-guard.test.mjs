import test from "node:test";
import assert from "node:assert/strict";
import { microbenchmarkSettings } from "./microbenchmark-guard.mjs";
const fixture = {
  PERF_LOCAL_FIXTURE: "1",
  DATABASE_URL: "postgres://fixture:fixture@127.0.0.1:15436/atlas_lms_e2e",
  PERF_TENANT_ID: "00000000-0000-4000-a000-000000000001",
  PERF_LEVELS: "1,2",
  PERF_SECONDS: "1",
};
test("invalid connection URLs do not expose their input in startup errors", () => {
  assert.throws(
    () => microbenchmarkSettings({ ...fixture, DATABASE_URL: "private-connection-secret" }),
    (error) => !JSON.stringify(error).includes("private-connection-secret"),
  );
});
test("microbenchmark requires explicit disposable database, tenant and bounded workload", () => {
  assert.deepEqual(microbenchmarkSettings(fixture).levels, [1, 2]);
  for (const patch of [
    { PERF_LOCAL_FIXTURE: "" },
    { PERF_TENANT_ID: "" },
    { DATABASE_URL: "postgres://owner:secret@prod.example/app" },
    { DATABASE_URL: fixture.DATABASE_URL + "?host=prod.example" },
    { PERF_LEVELS: "1,2garbage" },
    { PERF_LEVELS: "" },
    { PERF_LEVELS: "10000" },
    { PERF_SECONDS: "0" },
    { PERF_SECONDS: "Infinity" },
  ])
    assert.throws(() => microbenchmarkSettings({ ...fixture, ...patch }));
});
