import { createTenantRoute } from "@atlas/api";
import { listMyDiagnostics } from "../../../../../server/diagnostics/diagnostic-catalog.service";
import { diagnosticCatalogResponseSchema } from "../../../../../server/diagnostics/diagnostic.schemas";
import { routeMetadata } from "./route.metadata";

export const GET = createTenantRoute({
  metadata: routeMetadata,
  output: diagnosticCatalogResponseSchema,
  handler: async ({ tx, ctx }) => listMyDiagnostics(tx, ctx),
});
