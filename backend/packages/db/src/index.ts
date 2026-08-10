export { prisma } from "./client";
export type { AtlasPrismaClient } from "./client";

export type { TenantRequestContext } from "./tenant-context";

export { withTenantTx, TenantTransactionError } from "./with-tenant-tx";

export type { TenantTx } from "./with-tenant-tx";

export type { PlatformContext, PlatformPermission } from "./platform-context";

export { withPlatformScope, PlatformScopeError } from "./with-platform-scope";

export type { PlatformTx } from "./with-platform-scope";

export {
  DEFAULT_STATEMENT_TIMEOUT_MS,
  DEFAULT_TENANT_TX_TIMEOUT_MS,
  DEFAULT_PLATFORM_TX_TIMEOUT_MS,
  DEFAULT_GLOBAL_TX_TIMEOUT_MS,
  DEFAULT_TX_MAX_WAIT_MS,
  interactiveTxOptions,
  resolveInteractiveTimeoutMs,
  resolveStatementTimeoutMs,
} from "./transaction-options";

export type { InteractiveTxOptions } from "./transaction-options";
