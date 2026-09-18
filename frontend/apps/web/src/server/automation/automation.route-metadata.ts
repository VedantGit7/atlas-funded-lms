// Poisons this module for any client bundle. Audit finding M9: nothing at the
// language level stopped a server module being pulled into a client component,
// so a leak of service code -- and whatever secrets or privileged queries it
// closes over -- would only have shown up as a runtime surprise.
import "server-only";

import type { RouteMetadata } from "@atlas/api/route-metadata";
import {
  loadAutomationRuleCatalogResourceRef,
  loadAutomationRuleResourceRefFromBody,
} from "./automation.resource-loader";

export const listAutomationRunsMetadata = {
  permission: "automation.rule.read",
  audit: "none",
  rateLimit: "authenticatedTenantRead",
  idempotency: "none",
  resourceLoader: loadAutomationRuleCatalogResourceRef,
} satisfies RouteMetadata;

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
