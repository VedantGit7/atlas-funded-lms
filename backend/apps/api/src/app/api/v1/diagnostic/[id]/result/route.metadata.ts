import type { RouteMetadata } from "@atlas/api/route-metadata";
import { loadDiagnosticSessionResourceRef } from "../../../../../../server/diagnostics/diagnostic.resource-loaders";

export const routeMetadata = {
  permission: "diagnostic.start",
  entitlement: null,
  audit: "none",
  rateLimit: "authenticatedTenantRead",
  idempotency: "none",
  resourceLoader: async ({ tx, ctx, params }) => {
    const sessionId = params["id"];
    if (!sessionId) throw new Error("Missing diagnostic session id");
    return loadDiagnosticSessionResourceRef({ tx, ctx, sessionId });
  },
} satisfies RouteMetadata;
