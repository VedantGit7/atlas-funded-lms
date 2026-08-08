import type { TenantTx } from "@atlas/db";
import { auditWriter } from "@atlas/audit";
import { AtlasHttpError } from "@atlas/core/http/errors";
import type {
  CreateDimensionBody,
  CreateScoringProfileBody,
  UpdateDimensionBody,
  UpdateScoringProfileBody,
} from "./competency-config.schemas";
import {
  countDimensionReferences,
  deleteDimensionRecord,
  findDimensionById,
  findDimensionByKey,
  findScoringProfileById,
  findScoringProfileByKey,
  insertDimension,
  insertScoringProfile,
  listDimensions,
  listScoringProfiles,
  updateDimensionRecord,
  updateScoringProfileRecord,
} from "./competency-config.repository";
import { competencyConfigNotFound } from "./competency-config.resource-loaders";

type ServiceCtx = {
  tenantId: string;
  actorMembershipId: string;
  requestId: string;
};

function dimensionKeyConflict(): AtlasHttpError {
  return new AtlasHttpError({
    code: "VALIDATION_ERROR",
    status: 409,
    message: "A competency dimension with this key already exists.",
  });
}

function scoringProfileKeyConflict(): AtlasHttpError {
  return new AtlasHttpError({
    code: "VALIDATION_ERROR",
    status: 409,
    message: "A scoring profile with this key already exists.",
  });
}

function dimensionInUse(): AtlasHttpError {
  return new AtlasHttpError({
    code: "VALIDATION_ERROR",
    status: 409,
    message: "This competency dimension is referenced by scoring data and cannot be deleted.",
  });
}

export async function listCompetencyDimensions(tx: TenantTx) {
  const items = await listDimensions({ tx });
  return { data: items };
}

export async function createCompetencyDimension(
  tx: TenantTx,
  ctx: ServiceCtx,
  input: CreateDimensionBody,
) {
  const existing = await findDimensionByKey({ tx, key: input.key });
  if (existing) throw dimensionKeyConflict();

  const created = await insertDimension({
    tx,
    tenantId: ctx.tenantId,
    key: input.key,
    name: input.name,
    description: input.description ?? null,
  });

  await auditWriter.write(
    tx,
    {
      tenantId: ctx.tenantId,
      actorMembershipId: ctx.actorMembershipId,
      platformPrincipalId: null,
      requestId: ctx.requestId,
    },
    {
      action: "competency.dimension.created",
      target: { type: "competency_dimension", id: created.id },
      before: null,
      after: created,
      reason: null,
      metadata: {},
    },
  );

  return { data: created };
}

export async function updateCompetencyDimension(
  tx: TenantTx,
  ctx: ServiceCtx,
  dimensionId: string,
  input: UpdateDimensionBody,
) {
  const before = await findDimensionById({ tx, dimensionId });
  if (!before) throw competencyConfigNotFound();

  const updated = await updateDimensionRecord({
    tx,
    dimensionId,
    ...(input.name != null ? { name: input.name } : {}),
    ...(input.description !== undefined ? { description: input.description } : {}),
  });

  if (!updated) throw competencyConfigNotFound();

  await auditWriter.write(
    tx,
    {
      tenantId: ctx.tenantId,
      actorMembershipId: ctx.actorMembershipId,
      platformPrincipalId: null,
      requestId: ctx.requestId,
    },
    {
      action: "competency.dimension.updated",
      target: { type: "competency_dimension", id: updated.id },
      before,
      after: updated,
      reason: null,
      metadata: {},
    },
  );

  return { data: updated };
}

export async function deleteCompetencyDimension(
  tx: TenantTx,
  ctx: ServiceCtx,
  dimensionId: string,
) {
  const before = await findDimensionById({ tx, dimensionId });
  if (!before) throw competencyConfigNotFound();

  const references = await countDimensionReferences({ tx, dimensionId });
  if (references > 0) throw dimensionInUse();

  const deleted = await deleteDimensionRecord({ tx, dimensionId });
  if (!deleted) throw competencyConfigNotFound();

  await auditWriter.write(
    tx,
    {
      tenantId: ctx.tenantId,
      actorMembershipId: ctx.actorMembershipId,
      platformPrincipalId: null,
      requestId: ctx.requestId,
    },
    {
      action: "competency.dimension.deleted",
      target: { type: "competency_dimension", id: before.id },
      before,
      after: null,
      reason: null,
      metadata: {},
    },
  );

  return { data: { id: before.id, deleted: true as const } };
}

export async function listTenantScoringProfiles(tx: TenantTx) {
  const items = await listScoringProfiles({ tx });
  return { data: items };
}

export async function createScoringProfile(
  tx: TenantTx,
  ctx: ServiceCtx,
  input: CreateScoringProfileBody,
) {
  const existing = await findScoringProfileByKey({ tx, key: input.key });
  if (existing) throw scoringProfileKeyConflict();

  const created = await insertScoringProfile({
    tx,
    tenantId: ctx.tenantId,
    key: input.key,
    name: input.name,
    status: input.status ?? "ACTIVE",
  });

  await auditWriter.write(
    tx,
    {
      tenantId: ctx.tenantId,
      actorMembershipId: ctx.actorMembershipId,
      platformPrincipalId: null,
      requestId: ctx.requestId,
    },
    {
      action: "scoring_profile.created",
      target: { type: "scoring_profile", id: created.id },
      before: null,
      after: created,
      reason: null,
      metadata: {},
    },
  );

  return { data: created };
}

export async function updateScoringProfile(
  tx: TenantTx,
  ctx: ServiceCtx,
  profileId: string,
  input: UpdateScoringProfileBody,
) {
  const before = await findScoringProfileById({ tx, profileId });
  if (!before) throw competencyConfigNotFound();

  const updated = await updateScoringProfileRecord({
    tx,
    profileId,
    ...(input.name != null ? { name: input.name } : {}),
    ...(input.status != null ? { status: input.status } : {}),
  });

  if (!updated) throw competencyConfigNotFound();

  await auditWriter.write(
    tx,
    {
      tenantId: ctx.tenantId,
      actorMembershipId: ctx.actorMembershipId,
      platformPrincipalId: null,
      requestId: ctx.requestId,
    },
    {
      action: "scoring_profile.updated",
      target: { type: "scoring_profile", id: updated.id },
      before,
      after: updated,
      reason: null,
      metadata: {},
    },
  );

  return { data: updated };
}
