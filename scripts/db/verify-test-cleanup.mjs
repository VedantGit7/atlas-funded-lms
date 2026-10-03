import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { Client } from "pg";
import { initializeTestCleanup } from "./initialize-test-cleanup.mjs";
import { startTestCleanupRun } from "./test-cleanup-run.mjs";
import { purgeTestTenants } from "./purge-test-tenants.mjs";

// Fixed fresh Docker fixture; no .env files or inherited application credentials.
const adminUrl = "postgres://postgres:atlas_f20_disposable_only@127.0.0.1:15440/atlas_lms_test";
const appUrl = "postgres://f20_fixture:atlas_f20_fixture_only@127.0.0.1:15440/atlas_lms_test";
const config = {
  TEST_CLEANUP_DATABASE_URL:
    "postgres://atlas_test_cleanup:atlas_f20_cleanup_only@127.0.0.1:15440/atlas_lms_test",
  TEST_DATABASE_ID: "f31daf80-1739-4818-834a-4d0f3883301a",
  ALLOW_DESTRUCTIVE_TEST_CLEANUP: "1",
  DATABASE_URL: appUrl,
};
const admin = new Client({ connectionString: adminUrl, options: "" });
await admin.connect();
async function tracked(run) {
  const client = new Client({ connectionString: appUrl, options: run.workerOptions });
  await client.connect();
  return client;
}
async function tenant(
  client,
  principalId = randomUUID(),
  slug = `sprint0-a-${randomUUID().slice(0, 8)}`,
) {
  const id = randomUUID();
  await client.query("INSERT INTO auth_principals(id) VALUES($1) ON CONFLICT DO NOTHING", [
    principalId,
  ]);
  await client.query("INSERT INTO tenants(id,slug) VALUES($1,$2)", [id, slug]);
  await client.query("INSERT INTO memberships(id,tenant_id,auth_principal_id) VALUES($1,$2,$3)", [
    randomUUID(),
    id,
    principalId,
  ]);
  await client.query("INSERT INTO append_only(id,tenant_id) VALUES($1,$2)", [randomUUID(), id]);
  return { id, principalId };
}
try {
  assert.equal(
    (await admin.query("SELECT current_database() AS name")).rows[0].name,
    "atlas_lms_test",
  );
  assert.equal(
    (await admin.query("SELECT count(*)::int AS n FROM pg_tables WHERE schemaname='public'"))
      .rows[0].n,
    0,
    "Use a fresh disposable container; this verifier never resets existing data.",
  );
  await admin.query(`CREATE TABLE tenants(id uuid PRIMARY KEY,slug text NOT NULL);
    CREATE TABLE auth_principals(id uuid PRIMARY KEY);
    CREATE TABLE memberships(id uuid PRIMARY KEY,tenant_id uuid REFERENCES tenants(id),auth_principal_id uuid REFERENCES auth_principals(id));
    CREATE TABLE append_only(id uuid PRIMARY KEY,tenant_id uuid REFERENCES tenants(id));
    CREATE TABLE global_ref(id uuid PRIMARY KEY,principal_id uuid REFERENCES auth_principals(id));
    CREATE TABLE cascade_ref(id uuid PRIMARY KEY,principal_id uuid REFERENCES auth_principals(id) ON DELETE CASCADE);
    CREATE FUNCTION forbid_delete() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'append-only'; END $$;
    CREATE TRIGGER append_only_guard BEFORE DELETE ON append_only FOR EACH ROW EXECUTE FUNCTION forbid_delete();
    CREATE ROLE f20_fixture LOGIN PASSWORD 'atlas_f20_fixture_only';
    GRANT USAGE ON SCHEMA public TO f20_fixture; GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public TO f20_fixture;`);
  await assert.rejects(startTestCleanupRun(config), { code: "28P01" });
  await initializeTestCleanup({
    TEST_DATABASE_BOOTSTRAP_URL: adminUrl,
    TEST_DATABASE_DISPOSABLE: "1",
    TEST_DATABASE_ID: config.TEST_DATABASE_ID,
    TEST_CLEANUP_PASSWORD: "atlas_f20_cleanup_only",
  });
  const preexisting = await tenant(admin);
  await assert.rejects(
    initializeTestCleanup({
      TEST_DATABASE_BOOTSTRAP_URL: adminUrl,
      TEST_DATABASE_DISPOSABLE: "1",
      TEST_DATABASE_ID: config.TEST_DATABASE_ID,
      TEST_CLEANUP_PASSWORD: "atlas_f20_cleanup_only",
    }),
    /empty/,
  );
  await assert.rejects(
    startTestCleanupRun({
      ...config,
      DATABASE_URL: appUrl.replace("atlas_lms_test", "atlas_lms_dev"),
    }),
    /disposable/,
  );
  await assert.rejects(
    startTestCleanupRun({ ...config, TEST_DATABASE_ID: randomUUID() }),
    /marker/,
  );
  await assert.rejects(
    startTestCleanupRun({ ...config, ALLOW_DESTRUCTIVE_TEST_CLEANUP: "" }),
    /ALLOW_DESTRUCTIVE/,
  );
  assert.equal(await startTestCleanupRun({}), null);
  const runA = await startTestCleanupRun(config),
    runB = await startTestCleanupRun(config);
  const a = await tracked(runA),
    b = await tracked(runB);
  await tenant(a);
  const other = await tenant(b);
  await tenant(a, preexisting.principalId);
  await a.end();
  await b.end();
  const dry = await purgeTestTenants({ env: config, runId: runA.runId });
  assert.equal(dry.tenants, 2);
  assert.equal(dry.applied, false);
  const report = await runA.cleanup();
  assert.equal(report.tenants, 2);
  assert.equal(report.principals, 1);
  assert.equal(report.childRows, 4);
  const remaining = (await admin.query("SELECT id::text FROM tenants ORDER BY id")).rows.map(
    (r) => r.id,
  );
  assert.deepEqual(remaining.sort(), [preexisting.id, other.id].sort());
  assert.equal(
    (
      await admin.query("SELECT count(*)::int AS n FROM auth_principals WHERE id=$1", [
        preexisting.principalId,
      ])
    ).rows[0].n,
    1,
  );
  assert.equal((await runA.cleanup()).tenants, 0, "Repeat cleanup cannot broaden targets");
  assert.equal((await runB.cleanup()).tenants, 1);
  const closedWriter = await tracked(runB);
  await assert.rejects(
    closedWriter.query("INSERT INTO tenants(id,slug) VALUES($1,$2)", [randomUUID(), "late-writer"]),
    /no longer active/,
  );
  await assert.rejects(closedWriter.query("SELECT * FROM atlas_test_cleanup.owned_rows"), {
    code: "42501",
  });
  await closedWriter.end();

  // UUID reuse after a fixture is removed must never retain its old ownership.
  const reusedRun = await startTestCleanupRun(config);
  const reusedWriter = await tracked(reusedRun);
  const reusedId = randomUUID();
  await reusedWriter.query("INSERT INTO tenants(id,slug) VALUES($1,$2)", [reusedId, "old-fixture"]);
  await assert.rejects(
    reusedWriter.query("UPDATE tenants SET id=$1 WHERE id=$2", [randomUUID(), reusedId]),
  );
  await reusedWriter.query("DELETE FROM tenants WHERE id=$1", [reusedId]);
  await reusedWriter.query("INSERT INTO tenants(id,slug) VALUES($1,$2)", [
    reusedId,
    "tracked-reinsert",
  ]);
  await reusedWriter.query("DELETE FROM tenants WHERE id=$1", [reusedId]);
  await admin.query("INSERT INTO tenants(id,slug) VALUES($1,$2)", [
    reusedId,
    "unowned-replacement",
  ]);
  await reusedWriter.end();
  assert.equal((await reusedRun.cleanup()).tenants, 0);
  assert.equal(
    (await admin.query("SELECT count(*)::int AS n FROM tenants WHERE id=$1", [reusedId])).rows[0].n,
    1,
  );

  const cascadeRun = await startTestCleanupRun(config);
  const cascadeWriter = await tracked(cascadeRun);
  const cascadeFixture = await tenant(cascadeWriter);
  await cascadeWriter.end();
  await admin.query("INSERT INTO cascade_ref(id,principal_id) VALUES($1,$2)", [
    randomUUID(),
    cascadeFixture.principalId,
  ]);
  await assert.rejects(cascadeRun.cleanup(), { code: "TEST_CLEANUP_REFERENCED_PRINCIPAL" });
  assert.equal(
    (
      await admin.query("SELECT count(*)::int AS n FROM cascade_ref WHERE principal_id=$1", [
        cascadeFixture.principalId,
      ])
    ).rows[0].n,
    1,
  );
  await admin.query("DELETE FROM cascade_ref WHERE principal_id=$1", [cascadeFixture.principalId]);
  await cascadeRun.cleanup();
  // Cleanup failures must roll back all prior child and tenant deletes.
  const failed = await startTestCleanupRun(config);
  const writer = await tracked(failed);
  const failureFixture = await tenant(writer);
  await writer.end();
  await admin.query("INSERT INTO global_ref(id,principal_id) VALUES($1,$2)", [
    randomUUID(),
    failureFixture.principalId,
  ]);
  await assert.rejects(failed.cleanup(), { code: "TEST_CLEANUP_REFERENCED_PRINCIPAL" });
  assert.equal(
    (
      await admin.query("SELECT count(*)::int AS n FROM append_only WHERE tenant_id=$1", [
        failureFixture.id,
      ])
    ).rows[0].n,
    1,
  );
  await admin.query("DELETE FROM global_ref WHERE principal_id=$1", [failureFixture.principalId]);
  await failed.cleanup();
  const protectedRun = await startTestCleanupRun(config);
  const protectedWriter = await tracked(protectedRun);
  const protectedFixture = await tenant(protectedWriter, randomUUID(), "fundedbeyond");
  await protectedWriter.end();
  await assert.rejects(protectedRun.cleanup(), /Protected tenant/);
  await admin.query("UPDATE tenants SET slug=$1 WHERE id=$2", [
    "fixture-renamed",
    protectedFixture.id,
  ]);
  await protectedRun.cleanup();

  // Exercise the real Vitest global setup -> worker -> teardown lifecycle.
  const directory = resolve(".test-results/f20");
  mkdirSync(directory, { recursive: true });
  const smoke = resolve(directory, "worker.test.ts");
  writeFileSync(
    smoke,
    `import { test, expect } from 'vitest'; import { Client } from 'pg'; import { randomUUID } from 'node:crypto';
test('worker carries run identity without cleanup credentials',async()=>{
 expect(process.env.TEST_CLEANUP_DATABASE_URL).toBeUndefined();expect(process.env.PGOPTIONS).toContain('atlas.test_run_id=');
 const c=new Client({connectionString:process.env.DATABASE_URL});await c.connect();try{
 const id=randomUUID();await c.query('INSERT INTO tenants(id,slug) VALUES($1,$2)',[id,'worker-fixture']);
 if(process.env.F20_FORCE_CLEANUP_FAILURE==='1'){
 const principal=randomUUID();await c.query('INSERT INTO auth_principals(id) VALUES($1)',[principal]);
 await c.query('INSERT INTO global_ref(id,principal_id) VALUES($1,$2)',[randomUUID(),principal]);}
 expect((await c.query("SELECT current_setting('atlas.test_run_id') AS id")).rows[0].id).toBe(process.env.TEST_RUN_ID);
 }finally{await c.end()}});`,
  );
  const vitestConfig = resolve(directory, "vitest.config.mjs");
  writeFileSync(
    vitestConfig,
    `export default {test:{include:[${JSON.stringify(smoke.replaceAll("\\", "/"))}],globalSetup:[${JSON.stringify(resolve("tests/global-teardown.ts").replaceAll("\\", "/"))}]}};`,
  );
  const cleanEnv = { ...process.env };
  for (const key of Object.keys(cleanEnv))
    if (
      /DATABASE_URL|DATABASE_DIRECT_URL|ATLAS_APP_LOGIN_URL|REDIS_URL|PGOPTIONS|TEST_CLEANUP|TEST_DATABASE|TEST_RUN/.test(
        key,
      )
    )
      delete cleanEnv[key];
  const smokeResult = spawnSync(
    process.execPath,
    ["node_modules/vitest/vitest.mjs", "run", "--config", vitestConfig],
    { env: { ...cleanEnv, ...config }, encoding: "utf8", timeout: 60000 },
  );
  assert.equal(smokeResult.status, 0, smokeResult.stdout + smokeResult.stderr);
  assert.equal(
    (await admin.query("SELECT count(*)::int AS n FROM tenants WHERE slug='worker-fixture'"))
      .rows[0].n,
    0,
  );
  const unsafe = spawnSync(
    process.execPath,
    ["node_modules/vitest/vitest.mjs", "run", "--config", vitestConfig],
    {
      env: { ...cleanEnv, DATABASE_URL: appUrl.replace("atlas_lms_test", "atlas_lms_dev") },
      encoding: "utf8",
      timeout: 60000,
    },
  );
  assert.notEqual(unsafe.status, 0);
  assert.match(unsafe.stdout + unsafe.stderr, /TEST_CLEANUP_DATABASE_URL/);
  const failedTeardown = spawnSync(
    process.execPath,
    ["node_modules/vitest/vitest.mjs", "run", "--config", vitestConfig],
    {
      env: { ...cleanEnv, ...config, F20_FORCE_CLEANUP_FAILURE: "1" },
      encoding: "utf8",
      timeout: 60000,
    },
  );
  assert.notEqual(failedTeardown.status, 0, failedTeardown.stdout + failedTeardown.stderr);
  assert.match(failedTeardown.stdout + failedTeardown.stderr, /TEST_CLEANUP_REFERENCED_PRINCIPAL/);
  console.log("Verified: a passing Vitest worker with failed cleanup exits unsuccessfully.");
  console.log(
    JSON.stringify(
      {
        urlRefusal: true,
        markerRefusal: true,
        explicitAuthorization: true,
        runOwnership: true,
        otherRunPreserved: true,
        preexistingSlugPreserved: true,
        existingPrincipalPreserved: true,
        rollbackOnFailure: true,
        protectedTenantRefusal: true,
        idempotent: true,
        realVitestWorkerTracking: true,
        cleanupSecretsNotInWorkers: true,
        unsafeVitestRunRefused: true,
        teardownFailureFailsVitest: true,
        closedRunRejectsWrites: true,
        appCannotReadOwnershipRegistry: true,
        reusedIdsPreserved: true,
        cascadingReferencesPreserved: true,
      },
      null,
      2,
    ),
  );
} finally {
  await admin.end();
}
