import { createTenantResourceRef } from "@atlas/authorization";
import type { RouteMetadata } from "@atlas/api/route-metadata";
import type { TenantTx } from "@atlas/db";

type LoaderCtx = {
  tenantId: string;
  actorMembershipId: string;
};

export function loadAtRiskCatalogResourceRef(args: { tenantId: string }) {
  return createTenantResourceRef({
    type: "at_risk_alert",
    id: args.tenantId,
    tenantId: args.tenantId,
  });
}

export async function loadAtRiskAlertResourceRef(args: {
  tx: TenantTx;
  tenantId: string;
  alertId: string;
}) {
  const rows = await args.tx.$queryRaw<Array<{ id: string }>>`
    select id::text
    from at_risk_alerts
    where tenant_id = current_setting('app.tenant_id')::uuid
      and id = ${args.alertId}::uuid
    limit 1
  `;

  const alertId = rows[0]?.id ?? args.alertId;
  return createTenantResourceRef({
    type: "at_risk_alert",
    id: alertId,
    tenantId: args.tenantId,
  });
}

export async function loadAtRiskRuleResourceRef(args: {
  tx: TenantTx;
  tenantId: string;
  ruleId: string;
}) {
  const rows = await args.tx.$queryRaw<Array<{ id: string }>>`
    select id::text
    from at_risk_rules
    where tenant_id = current_setting('app.tenant_id')::uuid
      and id = ${args.ruleId}::uuid
    limit 1
  `;

  const ruleId = rows[0]?.id ?? args.ruleId;
  return createTenantResourceRef({
    type: "at_risk_alert",
    id: ruleId,
    tenantId: args.tenantId,
  });
}

export const listAtRiskAlertsMetadata = {
  permission: "analytics.at_risk.view",
  entitlement: "analytics.dashboard.view",
  audit: "none",
  rateLimit: "authenticatedTenantRead",
  idempotency: "none",
  resourceLoader: async ({ ctx }: { ctx: LoaderCtx }) =>
    loadAtRiskCatalogResourceRef({ tenantId: ctx.tenantId }),
} satisfies RouteMetadata;

export const acknowledgeAtRiskAlertMetadata = {
  permission: "analytics.at_risk.manage",
  entitlement: "analytics.dashboard.view",
  audit: "required",
  rateLimit: "authenticatedTenantWrite",
  idempotency: "required",
  resourceLoader: async ({
    tx,
    ctx,
    params,
  }: {
    tx: TenantTx;
    ctx: LoaderCtx;
    params: Record<string, string>;
  }) => {
    const alertId = params["alertId"];
    if (!alertId) {
      throw new Error("Missing alert id");
    }
    return loadAtRiskAlertResourceRef({ tx, tenantId: ctx.tenantId, alertId });
  },
} satisfies RouteMetadata;

export const listAtRiskRulesMetadata = {
  permission: "analytics.at_risk.view",
  entitlement: "analytics.dashboard.view",
  audit: "none",
  rateLimit: "authenticatedTenantRead",
  idempotency: "none",
  resourceLoader: async ({ ctx }: { ctx: LoaderCtx }) =>
    loadAtRiskCatalogResourceRef({ tenantId: ctx.tenantId }),
} satisfies RouteMetadata;

export const updateAtRiskRuleMetadata = {
  permission: "analytics.at_risk.manage",
  entitlement: "analytics.dashboard.view",
  audit: "required",
  rateLimit: "authenticatedTenantWrite",
  idempotency: "required",
  resourceLoader: async ({
    tx,
    ctx,
    params,
  }: {
    tx: TenantTx;
    ctx: LoaderCtx;
    params: Record<string, string>;
  }) => {
    const ruleId = params["ruleId"];
    if (!ruleId) {
      throw new Error("Missing rule id");
    }
    return loadAtRiskRuleResourceRef({ tx, tenantId: ctx.tenantId, ruleId });
  },
} satisfies RouteMetadata;

export const evaluateAtRiskAlertsMetadata = {
  permission: "analytics.at_risk.manage",
  entitlement: "analytics.dashboard.view",
  audit: "required",
  rateLimit: "authenticatedTenantWrite",
  idempotency: "required",
  resourceLoader: async ({ ctx }: { ctx: LoaderCtx }) =>
    loadAtRiskCatalogResourceRef({ tenantId: ctx.tenantId }),
} satisfies RouteMetadata;
