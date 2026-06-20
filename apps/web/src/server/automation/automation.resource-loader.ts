import { createTenantResourceRef } from "@atlas/authorization";
import type { TenantTx } from "@atlas/db";
import { automationRuleNotFound } from "./automation.errors";
import { automationRepository } from "./automation.repository";

type LoaderCtx = {
  tenantId: string;
  actorMembershipId: string;
};

export function loadAutomationRuleCatalogResourceRef(args: { ctx: LoaderCtx }) {
  return Promise.resolve(
    createTenantResourceRef({
      type: "automation_rule_catalog",
      id: args.ctx.tenantId,
      tenantId: args.ctx.tenantId,
    }),
  );
}

export async function loadAutomationRuleResourceRefFromBody(args: {
  tx: TenantTx;
  ctx: LoaderCtx;
  input: { id: string };
}) {
  const rule = await automationRepository.findRuleById(args.tx, args.input.id);
  if (!rule || rule.tenant_id !== args.ctx.tenantId) {
    throw automationRuleNotFound();
  }

  return createTenantResourceRef({
    type: "automation_rule",
    id: rule.id,
    tenantId: args.ctx.tenantId,
  });
}
