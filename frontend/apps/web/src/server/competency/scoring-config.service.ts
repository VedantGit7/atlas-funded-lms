// Poisons this module for any client bundle. Audit finding M9: nothing at the
// language level stopped a server module being pulled into a client component,
// so a leak of service code -- and whatever secrets or privileged queries it
// closes over -- would only have shown up as a runtime surprise.
import "server-only";

import type { TenantTx } from "@atlas/db";
import { auditWriter } from "@atlas/audit";
import { AtlasHttpError } from "@atlas/core/http/errors";
import type { PublishScoringConfigBody, ReplaceBandsBody } from "./competency-config.schemas";
import {
  buildConfigSnapshot,
  findScoringProfileById,
  getNextConfigVersion,
  insertScoringConfigVersion,
  listBandsForProfile,
  listDimensions,
  replaceBandsForProfile,
  setActiveConfigVersion,
} from "./competency-config.repository";
import { competencyConfigNotFound } from "./competency-config.resource-loaders";

type ServiceCtx = {
  tenantId: string;
  actorMembershipId: string;
  requestId: string;
};

function publishNotReady(message: string): AtlasHttpError {
  return new AtlasHttpError({
    code: "VALIDATION_ERROR",
    status: 409,
    message,
  });
}

export async function listProfileBands(tx: TenantTx, profileId: string) {
  const profile = await findScoringProfileById({ tx, profileId });
  if (!profile) throw competencyConfigNotFound();

  const bands = await listBandsForProfile({ tx, profileId });
  return { data: bands };
}

export async function replaceProfileBands(
  tx: TenantTx,
  ctx: ServiceCtx,
  profileId: string,
  input: ReplaceBandsBody,
) {
  const profile = await findScoringProfileById({ tx, profileId });
  if (!profile) throw competencyConfigNotFound();

  const before = await listBandsForProfile({ tx, profileId });
  const after = await replaceBandsForProfile({
    tx,
    tenantId: ctx.tenantId,
    profileId,
    bands: input.bands,
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
      action: "competency.bands.replaced",
      target: { type: "scoring_profile", id: profileId },
      before: before.length > 0 ? { bands: before } : null,
      after: { bands: after },
      reason: null,
      metadata: {},
    },
  );

  return { data: after };
}

export async function publishScoringConfig(
  tx: TenantTx,
  ctx: ServiceCtx,
  profileId: string,
  input: PublishScoringConfigBody,
) {
  const profile = await findScoringProfileById({ tx, profileId });
  if (!profile) throw competencyConfigNotFound();

  const dimensions = await listDimensions({ tx });
  if (dimensions.length === 0) {
    throw publishNotReady("At least one competency dimension is required before publishing.");
  }

  const bands = await listBandsForProfile({ tx, profileId });
  if (bands.length === 0) {
    throw publishNotReady("At least one competency band is required before publishing.");
  }

  const configJson = await buildConfigSnapshot({ tx, profile });
  const version = await getNextConfigVersion({ tx, profileId });
  const created = await insertScoringConfigVersion({
    tx,
    tenantId: ctx.tenantId,
    profileId,
    version,
    configJson,
    createdByMembershipId: ctx.actorMembershipId,
  });

  await setActiveConfigVersion({
    tx,
    profileId,
    configVersionId: created.id,
  });

  const payload = {
    profileId,
    configVersionId: created.id,
    version: created.version,
    activatedAt: created.activatedAt.toISOString(),
    activeConfigVersionId: created.id,
  };

  await auditWriter.write(
    tx,
    {
      tenantId: ctx.tenantId,
      actorMembershipId: ctx.actorMembershipId,
      platformPrincipalId: null,
      requestId: ctx.requestId,
    },
    {
      action: "scoring_config.published",
      target: { type: "scoring_config_version", id: created.id },
      before: {
        activeConfigVersionId: profile.activeConfigVersionId,
        activeVersion: profile.activeVersion,
      },
      after: payload,
      reason: input.comment ?? null,
      metadata: {},
    },
  );

  return { data: payload };
}

export async function buildPublishSnapshotForTest(tx: TenantTx, profileId: string) {
  const profile = await findScoringProfileById({ tx, profileId });
  if (!profile) throw competencyConfigNotFound();
  return buildConfigSnapshot({ tx, profile });
}

export async function getNextPublishVersionForTest(tx: TenantTx, profileId: string) {
  return getNextConfigVersion({ tx, profileId });
}
