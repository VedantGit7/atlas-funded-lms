import { createTenantRoute } from "@atlas/api";
import {
  AuditListResponseSchema,
  TenantAuditListQuerySchema,
  readTenantAuditLog,
} from "@atlas/audit";
import { routeMetadata } from "./route.metadata";

export const GET = createTenantRoute({
  metadata: routeMetadata,
  input: TenantAuditListQuerySchema,
  output: AuditListResponseSchema,
  handler: async ({ tx, input }) => readTenantAuditLog(tx, input),
});
