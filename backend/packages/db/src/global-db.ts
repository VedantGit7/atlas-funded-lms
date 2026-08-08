import { prisma } from "./client";

type GlobalDbClient = Pick<typeof prisma, "$queryRaw" | "$executeRaw" | "$executeRawUnsafe">;

/**
 * Runs global-table work (tenants, tenant_domains, auth_principals) under atlas_app.
 * Never accepts client-supplied tenant_id.
 */
export async function withGlobalDb<T>(fn: (db: GlobalDbClient) => Promise<T>): Promise<T> {
  return await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe("SET LOCAL ROLE atlas_app");
    return fn(tx);
  });
}
