import assert from "node:assert/strict";
import { test } from "node:test";
import { initializeTestCleanup } from "./initialize-test-cleanup.mjs";
import { startTestCleanupRun } from "./test-cleanup-run.mjs";
import {
  cleanupConfiguration,
  parseDisposableDatabaseUrl,
  assertSameTarget,
} from "./test-cleanup-boundary.mjs";

const app = "postgres://atlas_app_login:fixture@127.0.0.1:15440/atlas_lms_test";
const cleanup = "postgres://atlas_test_cleanup:separate@127.0.0.1:15440/atlas_lms_test";
const env = {
  TEST_CLEANUP_DATABASE_URL: cleanup,
  TEST_DATABASE_ID: "43dbeecd-cb24-4260-a685-cedaa77cc93b",
  ALLOW_DESTRUCTIVE_TEST_CLEANUP: "1",
};

test("requires separate cleanup credentials and explicit opt-in", () => {
  assert.throws(() => cleanupConfiguration({ DATABASE_URL: app }), /TEST_CLEANUP_DATABASE_URL/);
  assert.throws(
    () => cleanupConfiguration({ ...env, ALLOW_DESTRUCTIVE_TEST_CLEANUP: "" }),
    /ALLOW_DESTRUCTIVE/,
  );
  assert.throws(() => cleanupConfiguration({ ...env, TEST_DATABASE_ID: "" }), /TEST_DATABASE_ID/);
  assert.throws(
    () => cleanupConfiguration({ ...env, TEST_CLEANUP_DATABASE_URL: app }),
    /atlas_test_cleanup/,
  );
  assert.equal(cleanupConfiguration(env).target.database, "atlas_lms_test");
});

for (const url of [
  app.replace("atlas_lms_test", "atlas_lms_dev"),
  app.replace("atlas_lms_test", "postgres"),
  app.replace("127.0.0.1", "db.hosted.example"),
  app + "?host=db.hosted.example",
  app + "?options=-csearch_path%3Dother",
  app.replace("atlas_lms_test", "atlas_lms_test%2Fother"),
  "file:///atlas_lms_test",
])
  test(`rejects unsafe target ${url.replace(/:fixture@/, ":***@")}`, () =>
    assert.throws(() => parseDisposableDatabaseUrl(url), /disposable|database|PostgreSQL/i));

test("errors do not print passwords or the supplied URL", () => {
  assert.throws(
    () => parseDisposableDatabaseUrl("postgres://name:private-secret@prod/real"),
    (error) => !error.message.includes("private-secret") && !error.message.includes("postgres://"),
  );
});

test("rejects a different application target even if both names are test-like", () => {
  assert.throws(() => assertSameTarget(app.replace("15440", "5432"), cleanup), /same/);
  assert.throws(
    () => assertSameTarget(app.replace("atlas_lms_test", "atlas_lms_ci"), cleanup),
    /same/,
  );
  assert.doesNotThrow(() => assertSameTarget(app, cleanup));
});

test("bootstrap and test preflight refuse unsafe configuration before connecting", async () => {
  await assert.rejects(initializeTestCleanup({}), /TEST_DATABASE_DISPOSABLE/);
  await assert.rejects(
    initializeTestCleanup({
      TEST_DATABASE_DISPOSABLE: "1",
      TEST_DATABASE_BOOTSTRAP_URL: app.replace("atlas_lms_test", "atlas_lms_dev"),
    }),
    /disposable/,
  );
  assert.equal(await startTestCleanupRun({}), null);
  await assert.rejects(startTestCleanupRun({ DATABASE_URL: app }), /TEST_CLEANUP_DATABASE_URL/);
  await assert.rejects(
    startTestCleanupRun({ ...env, DATABASE_URL: app, PGOPTIONS: "-c role=postgres" }),
    /PGOPTIONS/,
  );
  await assert.rejects(
    startTestCleanupRun({
      ...env,
      F15_TEST_DATABASE_URL: app.replace("atlas_lms_test", "postgres"),
    }),
    /disposable/,
  );
});
