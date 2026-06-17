import type { PlatformTx } from "@atlas/db";
import { auditWriter } from "@atlas/audit";
import { outbox } from "@atlas/events";
import {
  ProvisionTenantRequestSchema,
  type ProvisionTenantRequest,
} from "../schemas/platform-tenants";
import {
  findTenantBySlug,
  insertProvisioningTenant,
  updateTenantState,
} from "../repositories/platform-tenant.repository";
import {
  insertProvisioningJob,
  updateProvisioningJobStatus,
  findTenantIdByProvisioningIdempotencyKey,
} from "../repositories/provisioning-job.repository";
import { insertFallbackTenantDomain } from "../repositories/platform-tenant-domain.repository";
import { grantPlatformTenantEntitlements } from "./platform-tenant-entitlement.service";
import { readPlatformTenantDetail } from "./platform-tenant-read.service";
import {
  seedOwnerInvitationFromExistingHelper,
  seedTenantSystemRolesFromCatalogue,
} from "./platform-tenant-provisioning.helpers";

export type PlatformProvisioningContext = {
  platformPrincipalId: string;
  requestId: string;
  reason: string;
  idempotencyKey: string;
  tenantBaseDomain: string;
};

export async function provisionTenant(
  tx: PlatformTx,
  ctx: PlatformProvisioningContext,
  rawInput: unknown,
) {
  const input: ProvisionTenantRequest = ProvisionTenantRequestSchema.parse(rawInput);

  const replayTenantId = await findTenantIdByProvisioningIdempotencyKey(tx, ctx.idempotencyKey);
  if (replayTenantId) {
    return readPlatformTenantDetail(tx, replayTenantId);
  }

  const existing = await findTenantBySlug(tx, input.slug);
  if (existing) {
    return readPlatformTenantDetail(tx, existing.id);
  }

  const tenant = await insertProvisioningTenant(tx, input);

  const job = await insertProvisioningJob(tx, {
    tenantId: tenant.id,
    idempotencyKey: ctx.idempotencyKey,
    status: "QUEUED",
    step: "tenant.created",
  });

  await updateProvisioningJobStatus(tx, {
    jobId: job.id,
    status: "RUNNING",
    step: "seeding.foundation",
  });

  const fallbackHostname = `${input.slug}.${ctx.tenantBaseDomain}`;

  await insertFallbackTenantDomain(tx, {
    tenantId: tenant.id,
    hostname: fallbackHostname,
  });

  // Use the existing Sprint 1 seed helpers. Do not duplicate role logic.
  await seedTenantSystemRolesFromCatalogue(tx, {
    tenantId: tenant.id,
  });

  await seedOwnerInvitationFromExistingHelper(tx, {
    tenantId: tenant.id,
    email: input.owner.email,
    displayName: input.owner.displayName,
    requestId: ctx.requestId,
  });

  await grantPlatformTenantEntitlements(tx, {
    tenantId: tenant.id,
    platformPrincipalId: ctx.platformPrincipalId,
    requestId: ctx.requestId,
    reason: ctx.reason,
    entitlements: input.initialEntitlements.map((entitlement) => ({
      key: entitlement.key,
      enabled: entitlement.enabled,
      value: entitlement.value ?? null,
      expiresAt: entitlement.expiresAt ?? null,
    })),
  });

  await auditWriter.write(
    tx,
    {
      tenantId: tenant.id,
      actorMembershipId: null,
      platformPrincipalId: ctx.platformPrincipalId,
      requestId: ctx.requestId,
    },
    {
      action: "tenant.created",
      target: { type: "tenant", id: tenant.id },
      before: null,
      after: {
        slug: input.slug,
        displayName: input.displayName,
        state: "PROVISIONING",
        primaryDomain: fallbackHostname,
      },
      reason: ctx.reason,
      metadata: {
        provisioningJobId: job.id,
      },
    },
  );

  await outbox.publish(tx, {
    ctx: {
      tenantId: tenant.id,
      actorMembershipId: null,
      requestId: ctx.requestId,
    },
    eventType: "tenant.created",
    aggregateType: "tenant",
    aggregateId: tenant.id,
    payload: {
      tenantId: tenant.id,
      slug: input.slug,
      displayName: input.displayName,
    },
    idempotencyKey: ctx.idempotencyKey,
  });

  await updateTenantState(tx, {
    tenantId: tenant.id,
    from: ["PROVISIONING"],
    to: "ACTIVE",
  });

  await updateProvisioningJobStatus(tx, {
    jobId: job.id,
    status: "SUCCEEDED",
    step: "tenant.active",
  });

  await auditWriter.write(
    tx,
    {
      tenantId: tenant.id,
      actorMembershipId: null,
      platformPrincipalId: ctx.platformPrincipalId,
      requestId: ctx.requestId,
    },
    {
      action: "tenant.state_changed",
      target: { type: "tenant", id: tenant.id },
      before: { state: "PROVISIONING" },
      after: { state: "ACTIVE" },
      reason: ctx.reason,
      metadata: {
        provisioningJobId: job.id,
      },
    },
  );

  await outbox.publish(tx, {
    ctx: {
      tenantId: tenant.id,
      actorMembershipId: null,
      requestId: ctx.requestId,
    },
    eventType: "tenant.state_changed",
    aggregateType: "tenant",
    aggregateId: tenant.id,
    payload: {
      tenantId: tenant.id,
      from: "PROVISIONING",
      to: "ACTIVE",
    },
    idempotencyKey: `${ctx.idempotencyKey}:active`,
  });

  return readPlatformTenantDetail(tx, tenant.id);
}
