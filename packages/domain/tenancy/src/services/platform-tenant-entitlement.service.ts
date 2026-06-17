import type { PlatformTx } from "@atlas/db";
import { auditWriter } from "@atlas/audit";
import { outbox } from "@atlas/events";
import {
  PutPlatformTenantEntitlementsRequestSchema,
  type PlatformTenantEntitlementInput,
} from "../schemas/platform-tenants";
import type { EntitlementRow } from "../repositories/platform-tenant.types";

function toJsonbLiteral(value: unknown): string {
  return JSON.stringify(value);
}

export async function readPlatformTenantEntitlements(tx: PlatformTx, tenantId: string) {
  const rows = await tx.$queryRaw<EntitlementRow[]>`
    SELECT
      key,
      value_json,
      expires_at
    FROM entitlements
    WHERE tenant_id = ${tenantId}
    ORDER BY key ASC
  `;

  return {
    data: rows.map((row) => ({
      key: row.key,
      enabled: row.value_json !== false && row.value_json !== null,
      value: row.value_json,
      expiresAt: row.expires_at?.toISOString() ?? null,
    })),
  };
}

export async function grantPlatformTenantEntitlements(
  tx: PlatformTx,
  ctx: {
    tenantId: string;
    platformPrincipalId: string;
    requestId: string;
    reason: string;
    entitlements: PlatformTenantEntitlementInput[];
  },
) {
  for (const entitlement of ctx.entitlements) {
    const valueJson = entitlement.enabled ? (entitlement.value ?? true) : false;
    const valueJsonLiteral = toJsonbLiteral(valueJson);

    const existingRows = await tx.$queryRaw<{ value_json: unknown }[]>`
      SELECT value_json
      FROM entitlements
      WHERE tenant_id = ${ctx.tenantId}
        AND key = ${entitlement.key}
      LIMIT 1
    `;
    const oldValueJson = existingRows[0]?.value_json ?? null;
    const oldValueJsonLiteral = oldValueJson != null ? toJsonbLiteral(oldValueJson) : null;

    await tx.$executeRaw`
      INSERT INTO entitlements (
        id,
        tenant_id,
        key,
        value_json,
        source,
        expires_at,
        created_at,
        updated_at
      )
      VALUES (
        gen_random_uuid(),
        ${ctx.tenantId},
        ${entitlement.key},
        ${valueJsonLiteral}::jsonb,
        'platform',
        ${entitlement.expiresAt ? new Date(entitlement.expiresAt) : null},
        now(),
        now()
      )
      ON CONFLICT (tenant_id, key)
      DO UPDATE SET
        value_json = EXCLUDED.value_json,
        source = EXCLUDED.source,
        expires_at = EXCLUDED.expires_at,
        updated_at = now()
    `;

    await tx.$executeRaw`
      INSERT INTO entitlement_grant_history (
        id,
        tenant_id,
        entitlement_key,
        old_value_json,
        new_value_json,
        changed_by_membership_id,
        reason,
        occurred_at
      )
      VALUES (
        gen_random_uuid(),
        ${ctx.tenantId},
        ${entitlement.key},
        ${oldValueJsonLiteral}::jsonb,
        ${valueJsonLiteral}::jsonb,
        NULL,
        ${ctx.reason},
        now()
      )
    `;

    await auditWriter.write(
      tx,
      {
        tenantId: ctx.tenantId,
        actorMembershipId: null,
        platformPrincipalId: ctx.platformPrincipalId,
        requestId: ctx.requestId,
      },
      {
        action: "config.entitlement.changed",
        target: { type: "entitlement", id: null },
        before: null,
        after: entitlement,
        reason: ctx.reason,
        metadata: {
          key: entitlement.key,
        },
      },
    );

    await outbox.publish(tx, {
      ctx: {
        tenantId: ctx.tenantId,
        actorMembershipId: null,
        requestId: ctx.requestId,
      },
      eventType: "entitlement.changed",
      aggregateType: "entitlement",
      aggregateId: ctx.tenantId,
      payload: {
        tenantId: ctx.tenantId,
        key: entitlement.key,
        enabled: entitlement.enabled,
      },
      idempotencyKey: `${ctx.requestId}:${entitlement.key}`,
    });
  }
}

export async function replacePlatformTenantEntitlements(
  tx: PlatformTx,
  ctx: {
    tenantId: string;
    platformPrincipalId: string;
    requestId: string;
    reason: string;
  },
  rawInput: unknown,
) {
  const input = PutPlatformTenantEntitlementsRequestSchema.parse(rawInput);

  await grantPlatformTenantEntitlements(tx, {
    tenantId: ctx.tenantId,
    platformPrincipalId: ctx.platformPrincipalId,
    requestId: ctx.requestId,
    reason: input.reason || ctx.reason,
    entitlements: input.entitlements,
  });

  return readPlatformTenantEntitlements(tx, ctx.tenantId);
}
