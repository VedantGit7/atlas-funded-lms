import type { RouteMetadata } from "@atlas/api/route-metadata";
import { loadDiagnosticCatalogResourceRef } from "../../../../../server/diagnostics/diagnostic.resource-loaders";

export const routeMetadata = {
  permission: "diagnostic.start",
  entitlement: null,
  audit: "none",
  rateLimit: "authenticatedTenantRead",
  idempotency: "none",
  resourceLoader: async ({ ctx }) => loadDiagnosticCatalogResourceRef({ ctx }),
} satisfies RouteMetadata;
