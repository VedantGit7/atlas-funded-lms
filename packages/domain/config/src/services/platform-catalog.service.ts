import { createUuidV7 } from "@atlas/core/id/uuid-v7";
import type { PlatformTx } from "@atlas/db";
import { auditWriter } from "@atlas/audit";
import type {
  CreatePlatformExtensionPointRequestSchema,
  CreatePlatformItemTypeRequestSchema,
  CreatePlatformPermissionRequestSchema,
} from "../schemas/platform-catalog";
import type { z } from "zod";

type CreatePermissionInput = z.infer<typeof CreatePlatformPermissionRequestSchema>;
type CreateItemTypeInput = z.infer<typeof CreatePlatformItemTypeRequestSchema>;
type CreateExtensionPointInput = z.infer<typeof CreatePlatformExtensionPointRequestSchema>;

export async function listPlatformPermissionCatalog(tx: PlatformTx) {
  const rows = await tx.$queryRaw<
    { id: string; key: string; description: string | null; created_at: Date }[]
  >`
    SELECT id::text, key, description, created_at
    FROM permissions
    ORDER BY key ASC
  `;

  return {
    data: rows.map((row) => ({
      id: row.id,
      key: row.key,
      description: row.description,
      createdAt: row.created_at.toISOString(),
    })),
  };
}

export async function createPlatformPermissionCatalogEntry(
  tx: PlatformTx,
  ctx: { platformPrincipalId: string; requestId: string },
  input: CreatePermissionInput,
) {
  const id = createUuidV7();
  const rows = await tx.$queryRaw<
    { id: string; key: string; description: string | null; created_at: Date }[]
  >`
    INSERT INTO permissions (id, key, description, created_at)
    VALUES (${id}::uuid, ${input.key}, ${input.description ?? null}, now())
    RETURNING id::text, key, description, created_at
  `;
  const row = rows[0];
  if (!row) {
    throw new Error("Failed to create permission");
  }

  await auditWriter.write(
    tx,
    {
      tenantId: null,
      actorMembershipId: null,
      platformPrincipalId: ctx.platformPrincipalId,
      requestId: ctx.requestId,
    },
    {
      action: "platform.catalog.permission.created",
      target: { type: "permission", id: row.id },
      before: null,
      after: { key: row.key },
      reason: input.reason,
      metadata: {},
    },
  );

  return {
    data: {
      id: row.id,
      key: row.key,
      description: row.description,
      createdAt: row.created_at.toISOString(),
    },
  };
}

export async function listPlatformItemTypeCatalog(tx: PlatformTx) {
  const rows = await tx.$queryRaw<
    {
      id: string;
      key: string;
      name: string;
      renderer_key: string;
      is_builtin: boolean;
      created_at: Date;
      updated_at: Date;
    }[]
  >`
    SELECT id::text, key, name, renderer_key, is_builtin, created_at, updated_at
    FROM item_types
    ORDER BY key ASC
  `;

  return {
    data: rows.map((row) => ({
      id: row.id,
      key: row.key,
      name: row.name,
      rendererKey: row.renderer_key,
      isBuiltin: row.is_builtin,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    })),
  };
}

export async function createPlatformItemTypeCatalogEntry(
  tx: PlatformTx,
  ctx: { platformPrincipalId: string; requestId: string },
  input: CreateItemTypeInput,
) {
  const id = createUuidV7();
  const rows = await tx.$queryRaw<
    {
      id: string;
      key: string;
      name: string;
      renderer_key: string;
      is_builtin: boolean;
      created_at: Date;
      updated_at: Date;
    }[]
  >`
    INSERT INTO item_types (
      id, key, name, schema_json, grading_json, renderer_key, is_builtin, created_at, updated_at
    )
    VALUES (
      ${id}::uuid,
      ${input.key},
      ${input.name},
      ${JSON.stringify(input.schemaJson)}::jsonb,
      ${input.gradingJson ? JSON.stringify(input.gradingJson) : null}::jsonb,
      ${input.rendererKey},
      false,
      now(),
      now()
    )
    RETURNING id::text, key, name, renderer_key, is_builtin, created_at, updated_at
  `;
  const row = rows[0];
  if (!row) {
    throw new Error("Failed to create item type");
  }

  await auditWriter.write(
    tx,
    {
      tenantId: null,
      actorMembershipId: null,
      platformPrincipalId: ctx.platformPrincipalId,
      requestId: ctx.requestId,
    },
    {
      action: "platform.catalog.item_type.created",
      target: { type: "item_type", id: row.id },
      before: null,
      after: { key: row.key },
      reason: input.reason,
      metadata: {},
    },
  );

  return {
    data: {
      id: row.id,
      key: row.key,
      name: row.name,
      rendererKey: row.renderer_key,
      isBuiltin: row.is_builtin,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    },
  };
}

export async function listPlatformExtensionPointCatalog(tx: PlatformTx) {
  const rows = await tx.$queryRaw<
    {
      id: string;
      key: string;
      point_type: string;
      status: string;
      created_at: Date;
      updated_at: Date;
    }[]
  >`
    SELECT id::text, key, point_type, status::text, created_at, updated_at
    FROM extension_points
    ORDER BY key ASC
  `;

  return {
    data: rows.map((row) => ({
      id: row.id,
      key: row.key,
      pointType: row.point_type,
      status: row.status,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    })),
  };
}

export async function createPlatformExtensionPointCatalogEntry(
  tx: PlatformTx,
  ctx: { platformPrincipalId: string; requestId: string },
  input: CreateExtensionPointInput,
) {
  const id = createUuidV7();
  const rows = await tx.$queryRaw<
    {
      id: string;
      key: string;
      point_type: string;
      status: string;
      created_at: Date;
      updated_at: Date;
    }[]
  >`
    INSERT INTO extension_points (id, key, point_type, schema_json, status, created_at, updated_at)
    VALUES (
      ${id}::uuid,
      ${input.key},
      ${input.pointType},
      ${JSON.stringify(input.schemaJson)}::jsonb,
      'ACTIVE',
      now(),
      now()
    )
    RETURNING id::text, key, point_type, status::text, created_at, updated_at
  `;
  const row = rows[0];
  if (!row) {
    throw new Error("Failed to create extension point");
  }

  await auditWriter.write(
    tx,
    {
      tenantId: null,
      actorMembershipId: null,
      platformPrincipalId: ctx.platformPrincipalId,
      requestId: ctx.requestId,
    },
    {
      action: "platform.catalog.extension_point.created",
      target: { type: "extension_point", id: row.id },
      before: null,
      after: { key: row.key },
      reason: input.reason,
      metadata: {},
    },
  );

  return {
    data: {
      id: row.id,
      key: row.key,
      pointType: row.point_type,
      status: row.status,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    },
  };
}
