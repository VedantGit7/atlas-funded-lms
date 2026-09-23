import { startTestCleanupRun } from "../scripts/db/test-cleanup-run.mjs";

/** No cleanup is inferred from an application URL. Unsafe DB runs fail before workers. */
export default async function setup() {
  const privateKeys = [
    "TEST_CLEANUP_DATABASE_URL",
    "TEST_DATABASE_BOOTSTRAP_URL",
    "TEST_CLEANUP_PASSWORD",
  ] as const;
  const privateEnv = Object.fromEntries(privateKeys.map((key) => [key, process.env[key]]));
  const run = await startTestCleanupRun();
  if (!run) return;
  process.env.PGOPTIONS = run.workerOptions;
  process.env.TEST_RUN_ID = run.runId;
  // Keep privileged cleanup credentials only in the setup closure, out of workers.
  for (const key of privateKeys) Reflect.deleteProperty(process.env, key);
  return async () => {
    try {
      const report = await run.cleanup();
      console.log(
        `[test-cleanup] run=${run.runId}: ${report.tenants} tenants, ${report.childRows} child rows, ${report.principals} owned principals removed; ${report.retainedPrincipals} shared principals retained.`,
      );
    } catch (error) {
      // Vitest logs teardown errors during close but can still exit zero.
      process.exitCode = 1;
      throw error;
    } finally {
      delete process.env.PGOPTIONS;
      delete process.env.TEST_RUN_ID;
      for (const key of privateKeys) {
        if (privateEnv[key] === undefined) Reflect.deleteProperty(process.env, key);
        else process.env[key] = privateEnv[key];
      }
    }
  };
}
