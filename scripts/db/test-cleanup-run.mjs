import { randomUUID } from "node:crypto";
import {
  cleanupConfiguration,
  cleanupClient,
  assertDatabaseIdentity,
  assertSameTarget,
} from "./test-cleanup-boundary.mjs";
import { purgeTestTenants } from "./purge-test-tenants.mjs";

export async function startTestCleanupRun(env = process.env) {
  const dbKeys = Object.keys(env).filter(
    (key) =>
      /^(DATABASE_URL|PLATFORM_DATABASE_URL|DIRECT_DATABASE_URL|DATABASE_DIRECT_URL|ATLAS_APP_LOGIN_URL|.+_TEST_DATABASE_URL)$/.test(
        key,
      ) && env[key],
  );
  if (
    !dbKeys.length &&
    !env.TEST_CLEANUP_DATABASE_URL &&
    env.ALLOW_DESTRUCTIVE_TEST_CLEANUP !== "1"
  )
    return null;
  const config = cleanupConfiguration(env);
  for (const key of dbKeys) assertSameTarget(env[key], config.databaseUrl);
  if (env.PGOPTIONS)
    throw new Error("Clear inherited PGOPTIONS before starting a tracked test run.");
  const runId = randomUUID();
  const client = cleanupClient(config);
  await client.connect();
  try {
    await assertDatabaseIdentity(client, config);
    // Capture hooks must exist and be enabled before any worker creates data.
    const hooks = await client.query(`SELECT t.tgname FROM pg_trigger t
      JOIN (VALUES
        ('public.tenants'::regclass,'atlas_test_capture_tenant','atlas_test_cleanup.capture_insert()'::regprocedure),
        ('public.auth_principals'::regclass,'atlas_test_capture_principal','atlas_test_cleanup.capture_insert()'::regprocedure),
        ('public.tenants'::regclass,'atlas_test_maintain_tenant','atlas_test_cleanup.maintain_identity()'::regprocedure),
        ('public.auth_principals'::regclass,'atlas_test_maintain_principal','atlas_test_cleanup.maintain_identity()'::regprocedure)
      ) expected(relation,name,function) ON t.tgrelid=expected.relation AND t.tgname=expected.name AND t.tgfoid=expected.function
      WHERE NOT t.tgisinternal AND t.tgenabled='O'`);
    if (hooks.rowCount !== 4)
      throw new Error("Test fixture ownership hooks are missing or disabled.");
    await client.query("INSERT INTO atlas_test_cleanup.runs(id) VALUES($1::uuid)", [runId]);
  } finally {
    await client.end();
  }
  const cleanupEnv = {
    TEST_CLEANUP_DATABASE_URL: config.databaseUrl,
    TEST_DATABASE_ID: config.databaseId,
    ALLOW_DESTRUCTIVE_TEST_CLEANUP: "1",
  };
  return {
    runId,
    workerOptions: `-c atlas.test_run_id=${runId}`,
    cleanup: () => purgeTestTenants({ apply: true, runId, env: cleanupEnv }),
  };
}
