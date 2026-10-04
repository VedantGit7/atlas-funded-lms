import { prisma } from "./client";
import { assertNoHeldConnection, holdingConnection } from "./connection-scope";
import { DEFAULT_GLOBAL_TX_TIMEOUT_MS, interactiveTxOptions } from "./transaction-options";

type GlobalDbClient = Pick<typeof prisma, "$queryRaw" | "$executeRaw" | "$executeRawUnsafe">;

/**
 * Runs global-table work (tenants, tenant_domains, auth_principals) under atlas_app.
 * Never accepts client-supplied tenant_id.
 */
export async function withGlobalDb<T>(fn: (db: GlobalDbClient) => Promise<T>): Promise<T> {
  assertNoHeldConnection("withGlobalDb");
  return await prisma.$transaction(
    async (tx) =>
      holdingConnection("withGlobalDb", async () => {
        await tx.$executeRawUnsafe("SET LOCAL ROLE atlas_app");
        return fn(tx);
      }),
    interactiveTxOptions(DEFAULT_GLOBAL_TX_TIMEOUT_MS),
  );
}
