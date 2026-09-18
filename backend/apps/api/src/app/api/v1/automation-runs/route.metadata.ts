import type { RouteMetadata } from "@atlas/api/route-metadata";
import { loadAutomationRuleCatalogResourceRef } from "../../../../server/automation/automation.resource-loader";

export const routeMetadata = {
  permission: "automation.rule.read",
  entitlement: null,
  audit: "none",
  rateLimit: "authenticatedTenantRead",
  idempotency: "none",
  resourceLoader: loadAutomationRuleCatalogResourceRef,
} satisfies RouteMetadata;
