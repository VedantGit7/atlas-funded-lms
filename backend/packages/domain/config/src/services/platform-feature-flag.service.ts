import { createUuidV7 } from "@atlas/core/id/uuid-v7";
import type { PlatformTx } from "@atlas/db";
import { auditWriter } from "@atlas/audit";
import type {
  CreatePlatformFeatureFlagRequestSchema,
  PlatformFeatureFlagListResponseSchema,
  UpdatePlatformFeatureFlagRequestSchema,
} from "../schemas/platform-feature-flags";
import type { z } from "zod";

type CreateInput = z.infer<typeof CreatePlatformFeatureFlagRequestSchema>;
type UpdateInput = z.infer<typeof UpdatePlatformFeatureFlagRequestSchema>;
type ListResponse = z.infer<typeof PlatformFeatureFlagListResponseSchema>;

function inferRolloutType(value: unknown): "BOOLEAN" | "JSON" {
  return typeof value === "boolean" ? "BOOLEAN" : "JSON";
}

function assertRolloutValueMatchesType(
  rolloutType: "BOOLEAN" | "JSON" | undefined,
  value: unknown,
): void {
  if (rolloutType === undefined) {
    return;
  }

  const inferred = inferRolloutType(value);
  if (inferred !== rolloutType) {
    throw new Error(
      `defaultValue must match rolloutType ${rolloutType} (received ${inferred})`,
    );
  }
}

function mapRow(row: {
  id: string;
  key: string;
  default_value: unknown;
  description: string | null;
  created_at: Date;
  updated_at: Date;
}): ListResponse["data"][number] {
  return {
    id: row.id,
    key: row.key,
    defaultValue: row.default_value,
    description: row.description,
    rolloutType: inferRolloutType(row.default_value),
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

export async function listPlatformFeatureFlags(tx: PlatformTx): Promise<ListResponse> {
  const rows = await tx.$queryRaw<
    {
      id: string;
      key: string;
      default_value: unknown;
      description: string | null;
      created_at: Date;
      updated_at: Date;
    }[]
  >`
    SELECT id::text, key, default_value, description, created_at, updated_at
    FROM feature_flags
    ORDER BY key ASC
  `;

  return { data: rows.map(mapRow) };
}

export async function createPlatformFeatureFlag(
  tx: PlatformTx,
  ctx: { platformPrincipalId: string; requestId: string },
  input: CreateInput,
) {
  assertRolloutValueMatchesType(input.rolloutType, input.defaultValue);

  const id = createUuidV7();
  const rows = await tx.$queryRaw<
    {
      id: string;
      key: string;
      default_value: unknown;
      description: string | null;
      created_at: Date;
      updated_at: Date;
    }[]
  >`
    INSERT INTO feature_flags (id, key, default_value, description, created_at, updated_at)
    VALUES (
      ${id}::uuid,
      ${input.key},
      ${JSON.stringify(input.defaultValue)}::jsonb,
      ${input.description ?? null},
      now(),
      now()
    )
    RETURNING id::text, key, default_value, description, created_at, updated_at
  `;

  const row = rows[0];
  if (!row) {
    throw new Error("Failed to create feature flag");
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
      action: "config.feature_flag.changed",
      target: { type: "feature_flag", id: row.id },
      before: null,
      after: { key: row.key, defaultValue: input.defaultValue },
      reason: input.reason,
      metadata: { scope: "global" },
    },
  );

  return { data: mapRow(row) };
}

export async function updatePlatformFeatureFlag(
  tx: PlatformTx,
  ctx: { platformPrincipalId: string; requestId: string },
  key: string,
  input: UpdateInput,
) {
  const existing = await tx.$queryRaw<{ id: string; default_value: unknown }[]>`
    SELECT id::text, default_value
    FROM feature_flags
    WHERE key = ${key}
    LIMIT 1
  `;
  const before = existing[0];
  if (!before) {
    throw new Error("Feature flag not found");
  }

  assertRolloutValueMatchesType(input.rolloutType, input.defaultValue);

  const rows = await tx.$queryRaw<
    {
      id: string;
      key: string;
      default_value: unknown;
      description: string | null;
      created_at: Date;
      updated_at: Date;
    }[]
  >`
    UPDATE feature_flags
    SET
      default_value = ${JSON.stringify(input.defaultValue)}::jsonb,
      description = COALESCE(${input.description ?? null}, description),
      updated_at = now()
    WHERE key = ${key}
    RETURNING id::text, key, default_value, description, created_at, updated_at
  `;

  const row = rows[0];
  if (!row) {
    throw new Error("Failed to update feature flag");
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
      action: "config.feature_flag.changed",
      target: { type: "feature_flag", id: row.id },
      before: { defaultValue: before.default_value },
      after: { defaultValue: input.defaultValue },
      reason: input.reason,
      metadata: { scope: "global" },
    },
  );

  return { data: mapRow(row) };
}
