import { createTenantResourceRef } from "@atlas/authorization";
import type { TenantTx } from "@atlas/db";
import { AtlasHttpError } from "@atlas/core/http/errors";
import { findDimensionById, findScoringProfileById } from "./competency-config.repository";

type LoaderCtx = {
  tenantId: string;
  actorMembershipId: string;
};

export function competencyConfigNotFound(): AtlasHttpError {
  return new AtlasHttpError({
    code: "PERMISSION_DENIED",
    status: 404,
    message: "Competency resource not found or access denied.",
  });
}

export async function loadCompetencyConfigCatalogResourceRef(args: { ctx: LoaderCtx }) {
  return Promise.resolve(
    createTenantResourceRef({
      type: "competency_config_catalog",
      id: args.ctx.tenantId,
      tenantId: args.ctx.tenantId,
    }),
  );
}

export async function loadCompetencyDimensionResourceRef(args: {
  tx: TenantTx;
  ctx: LoaderCtx;
  dimensionId: string;
}) {
  const dimension = await findDimensionById({ tx: args.tx, dimensionId: args.dimensionId });
  if (!dimension) throw competencyConfigNotFound();

  return createTenantResourceRef({
    type: "competency_dimension",
    id: dimension.id,
    tenantId: args.ctx.tenantId,
  });
}

export async function loadScoringProfileResourceRef(args: {
  tx: TenantTx;
  ctx: LoaderCtx;
  profileId: string;
}) {
  const profile = await findScoringProfileById({ tx: args.tx, profileId: args.profileId });
  if (!profile) throw competencyConfigNotFound();

  return createTenantResourceRef({
    type: "scoring_profile",
    id: profile.id,
    tenantId: args.ctx.tenantId,
  });
}

export async function loadScoringConfigPublishResourceRef(args: {
  tx: TenantTx;
  ctx: LoaderCtx;
  profileId: string;
}) {
  return await loadScoringProfileResourceRef(args);
}

export async function loadCompetencyBandResourceRef(args: {
  tx: TenantTx;
  ctx: LoaderCtx;
  profileId: string;
}) {
  const profile = await findScoringProfileById({ tx: args.tx, profileId: args.profileId });
  if (!profile) throw competencyConfigNotFound();

  return createTenantResourceRef({
    type: "competency_band",
    id: profile.id,
    tenantId: args.ctx.tenantId,
  });
}
