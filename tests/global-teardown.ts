// @ts-expect-error - .mjs sibling script without type declarations.
import { purgeTestTenants } from "../scripts/db/purge-test-tenants.mjs";

/**
 * Vitest global teardown.
 *
 * Test fixtures (e.g. createTenantIsolationFixture, the platform-provisioning
 * isolation tests, branding/smoke e2e suites) provision throwaway tenants with
 * deterministic slugs and historically never cleaned them up, so they piled up
 * into tens of thousands of rows on shared dev databases.
 *
 * Rather than wiring teardown into 30+ individual test files, we purge all
 * matching test tenants once per run here. Skipped automatically when no
 * DATABASE_URL is configured (e.g. pure unit-test runs).
 */
// Vitest runs globalSetup files' `setup` before the suite and `teardown` after.
export function setup(): void {}

export async function teardown(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    return;
  }

  try {
    const report = (await purgeTestTenants({ apply: true })) as {
      tenants: number;
      childRows: number;
      principals: number;
    };

    if (report.tenants > 0) {
      console.log(
        `[global-teardown] purged ${report.tenants} test tenants, ` +
          `${report.childRows} child rows, ${report.principals} orphaned principals.`,
      );
    }
  } catch (error) {
    // Teardown must never fail the suite; surface the problem and move on.
    console.warn("[global-teardown] failed to purge test tenants:", error);
  }
}
