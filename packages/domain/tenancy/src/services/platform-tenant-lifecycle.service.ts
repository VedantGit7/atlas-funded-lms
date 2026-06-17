import type { PlatformTx } from "@atlas/db";
import { auditWriter } from "@atlas/audit";
import { outbox } from "@atlas/events";
import { updateTenantState } from "../repositories/platform-tenant.repository";
import { readPlatformTenantDetail } from "./platform-tenant-read.service";

type LifecycleCtx = {
  platformPrincipalId: string;
  requestId: string;
  reason: string;
};

export async function suspendTenant(tx: PlatformTx, ctx: LifecycleCtx, tenantId: string) {
  await updateTenantLifecycle(tx, ctx, {
    tenantId,
    from: ["ACTIVE"],
    to: "SUSPENDED",
  });

  return readPlatformTenantDetail(tx, tenantId);
}

export async function resumeTenant(tx: PlatformTx, ctx: LifecycleCtx, tenantId: string) {
  await updateTenantLifecycle(tx, ctx, {
    tenantId,
    from: ["SUSPENDED"],
    to: "ACTIVE",
  });

  return readPlatformTenantDetail(tx, tenantId);
}

export async function archiveTenant(tx: PlatformTx, ctx: LifecycleCtx, tenantId: string) {
  await updateTenantLifecycle(tx, ctx, {
    tenantId,
    from: ["ACTIVE", "SUSPENDED"],
    to: "ARCHIVED",
  });

  return readPlatformTenantDetail(tx, tenantId);
}

async function updateTenantLifecycle(
  tx: PlatformTx,
  ctx: LifecycleCtx,
  input: {
    tenantId: string;
    from: string[];
    to: "ACTIVE" | "SUSPENDED" | "ARCHIVED";
  },
) {
  const result = await updateTenantState(tx, input);

  await auditWriter.write(
    tx,
    {
      tenantId: input.tenantId,
      actorMembershipId: null,
      platformPrincipalId: ctx.platformPrincipalId,
      requestId: ctx.requestId,
    },
    {
      action: "tenant.state_changed",
      target: { type: "tenant", id: input.tenantId },
      before: { state: result.previous_state },
      after: { state: input.to },
      reason: ctx.reason,
      metadata: {},
    },
  );

  await outbox.publish(tx, {
    ctx: {
      tenantId: input.tenantId,
      actorMembershipId: null,
      requestId: ctx.requestId,
    },
    eventType: "tenant.state_changed",
    aggregateType: "tenant",
    aggregateId: input.tenantId,
    payload: {
      tenantId: input.tenantId,
      from: result.previous_state,
      to: input.to,
    },
    idempotencyKey: `${ctx.requestId}:${input.tenantId}:${input.to}`,
  });
}
