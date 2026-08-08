import type { TenantTx } from "@atlas/db";
import { auditWriter } from "@atlas/audit";
import { outbox } from "@atlas/events";
import {
  getTenantConfig,
  insertTenantConfigVersion,
  listTenantConfigVersions,
  markTenantConfigPublished,
  upsertTenantConfigDraft,
} from "../repositories/tenant-config.repository";
import type { TenantConfigResponse, UpdateTenantConfigRequest } from "../schemas/tenant-config";

function mapConfig(row: {
  tenant_id: string;
  config_json: unknown;
  current_version_id: string | null;
  updated_at: Date;
}): TenantConfigResponse["data"] {
  return {
    tenantId: row.tenant_id,
    configJson:
      row.config_json && typeof row.config_json === "object"
        ? (row.config_json as Record<string, unknown>)
        : {},
    version: row.current_version_id ? 1 : 0,
    updatedAt: row.updated_at.toISOString(),
    currentVersionId: row.current_version_id,
  };
}

export async function readTenantConfig(tx: TenantTx): Promise<TenantConfigResponse> {
  const row = await getTenantConfig(tx);
  if (!row) {
    return {
      data: {
        tenantId: "",
        configJson: {},
        version: 0,
        updatedAt: new Date(0).toISOString(),
        currentVersionId: null,
      },
    };
  }

  return { data: mapConfig(row) };
}

export async function readTenantConfigVersions(tx: TenantTx) {
  const rows = await listTenantConfigVersions(tx);

  return {
    data: rows.map((row) => ({
      id: row.id,
      version: row.version,
      createdByMembershipId: row.created_by_membership_id,
      createdAt: row.created_at.toISOString(),
      isCurrent: row.current_version_id === row.id,
    })),
  };
}

export async function updateTenantConfigDraft(
  tx: TenantTx,
  input: UpdateTenantConfigRequest,
): Promise<TenantConfigResponse> {
  const row = await upsertTenantConfigDraft(tx, input);
  return { data: mapConfig(row) };
}

export async function publishTenantConfig(
  tx: TenantTx,
  ctx: {
    tenantId: string;
    actorMembershipId: string;
    requestId: string;
  },
): Promise<TenantConfigResponse> {
  const before = await getTenantConfig(tx);
  if (!before) {
    throw new Error("CONFIG_NOT_FOUND");
  }

  const version = await insertTenantConfigVersion(tx, {
    snapshot: before.config_json,
    createdByMembershipId: ctx.actorMembershipId,
  });

  const after = await markTenantConfigPublished(tx, version.id);

  await auditWriter.write(
    tx,
    {
      tenantId: ctx.tenantId,
      actorMembershipId: ctx.actorMembershipId,
      platformPrincipalId: null,
      requestId: ctx.requestId,
    },
    {
      action: "config.config.published",
      target: { type: "tenant_config", id: ctx.tenantId },
      before: { currentVersionId: before.current_version_id },
      after: { currentVersionId: version.id, version: version.version },
      reason: null,
      metadata: {},
    },
  );

  await outbox.publish(tx, {
    ctx: {
      tenantId: ctx.tenantId,
      actorMembershipId: ctx.actorMembershipId,
      requestId: ctx.requestId,
    },
    eventType: "config.config.published",
    aggregateType: "tenant_config",
    aggregateId: ctx.tenantId,
    payload: {
      tenantId: ctx.tenantId,
      version: version.version,
    },
    idempotencyKey: `${ctx.requestId}:config-publish`,
  });

  return { data: mapConfig(after) };
}
