import type { RouteMetadata } from "@atlas/api/route-metadata";
import {
  loadAutomationRuleCatalogResourceRef,
  loadAutomationRuleResourceRefFromBody,
} from "./automation.resource-loader";

export const listAutomationRulesMetadata = {
  permission: "automation.rule.read",
  audit: "none",
  rateLimit: "authenticatedTenantRead",
  idempotency: "none",
  resourceLoader: loadAutomationRuleCatalogResourceRef,
} satisfies RouteMetadata;

export const mutateAutomationRulesMetadata = {
  permission: "automation.rule.manage",
  audit: "none",
  rateLimit: "authenticatedTenantWrite",
  idempotency: "required",
  resourceLoader: loadAutomationRuleCatalogResourceRef,
} satisfies RouteMetadata;

export const updateAutomationRuleMetadata = {
  permission: "automation.rule.manage",
  audit: "none",
  rateLimit: "authenticatedTenantWrite",
  idempotency: "required",
  resourceLoader: async ({ tx, ctx, input }) =>
    loadAutomationRuleResourceRefFromBody({
      tx,
      ctx,
      input: input as { id: string },
    }),
} satisfies RouteMetadata;

export const deleteAutomationRuleMetadata = {
  permission: "automation.rule.manage",
  audit: "none",
  rateLimit: "authenticatedTenantWrite",
  idempotency: "required",
  resourceLoader: async ({ tx, ctx, input }) =>
    loadAutomationRuleResourceRefFromBody({
      tx,
      ctx,
      input: input as { id: string },
    }),
} satisfies RouteMetadata;
