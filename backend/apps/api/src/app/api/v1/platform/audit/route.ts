import { createPlatformRoute } from "@atlas/api/create-platform-route";
import { AuditListQuerySchema, AuditListResponseSchema } from "@atlas/audit";
import { readPlatformAuditLog } from "@atlas/audit";
import { routeMetadata } from "./route.metadata";

export const GET = createPlatformRoute({
  metadata: routeMetadata,
  query: AuditListQuerySchema,
  output: AuditListResponseSchema,
  handler: async ({ tx, query }) => {
    return readPlatformAuditLog(tx, query);
  },
});
