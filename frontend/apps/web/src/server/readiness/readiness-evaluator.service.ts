// Poisons this module for any client bundle. Audit finding M9: nothing at the
// language level stopped a server module being pulled into a client component,
// so a leak of service code -- and whatever secrets or privileged queries it
// closes over -- would only have shown up as a runtime surprise.
import "server-only";

import type { TenantTx } from "@atlas/db";
import { outbox } from "@atlas/events";
import { assignBandKey, aggregateWeightedScore } from "../competency/competency-projection.service";
import type { competencyScoreChangedPayloadSchema } from "./readiness.schemas";
import { deriveProminence } from "./readiness.schemas";
import { DEFAULT_COMPOSITE_KEY } from "./readiness.types";
import {
  findCompositeReadinessState,
  findReadinessPolicy,
  getActiveConfigVersionId,
  listBandsForProfile,
  listMembershipDimensionScores,
  upsertCompositeReadinessState,
} from "./readiness.repository";
import type { CompositeReadinessProjection } from "./readiness.types";
import type { z } from "zod";

type ServiceCtx = {
  tenantId: string;
  requestId: string;
};

type ScoreChangedPayload = z.infer<typeof competencyScoreChangedPayloadSchema>;

export function computeCompositeScore(scores: Array<{ score: number }>): number | null {
  if (scores.length === 0) return null;
  const average = scores.reduce((sum, entry) => sum + entry.score, 0) / Math.max(scores.length, 1);
  return Number(average.toFixed(4));
}

export async function evaluateMembershipReadiness(args: {
  tx: TenantTx;
  ctx: ServiceCtx;
  membershipId: string;
  scoringProfileId: string;
}): Promise<{
  compositeKey: string;
  score: number;
  bandKey: string;
  previousBandKey: string | null;
  bandChanged: boolean;
} | null> {
  const [dimensionScores, bands, configVersionId] = await Promise.all([
    listMembershipDimensionScores({
      tx: args.tx,
      membershipId: args.membershipId,
      scoringProfileId: args.scoringProfileId,
    }),
    listBandsForProfile({ tx: args.tx, profileId: args.scoringProfileId }),
    getActiveConfigVersionId({ tx: args.tx, profileId: args.scoringProfileId }),
  ]);

  if (dimensionScores.length === 0 || bands.length === 0 || configVersionId == null) {
    return null;
  }

  const weightedSignals = dimensionScores.map((entry) => ({ rawScore: entry.score, weight: 1 }));
  const score = aggregateWeightedScore(weightedSignals) ?? computeCompositeScore(dimensionScores);
  if (score == null) return null;

  const bandKey = assignBandKey(score, bands);
  if (!bandKey) return null;

  const previous = await findCompositeReadinessState({
    tx: args.tx,
    membershipId: args.membershipId,
    scoringProfileId: args.scoringProfileId,
    compositeKey: DEFAULT_COMPOSITE_KEY,
  });

  const upserted = await upsertCompositeReadinessState({
    tx: args.tx,
    tenantId: args.ctx.tenantId,
    membershipId: args.membershipId,
    scoringProfileId: args.scoringProfileId,
    compositeKey: DEFAULT_COMPOSITE_KEY,
    score,
    bandKey,
    configVersionId,
  });

  const previousBandKey = previous?.bandKey ?? upserted.previousBandKey;
  const bandChanged = previousBandKey != null && previousBandKey !== bandKey;

  return {
    compositeKey: DEFAULT_COMPOSITE_KEY,
    score,
    bandKey,
    previousBandKey,
    bandChanged,
  };
}

export async function projectReadinessAfterScoreChanged(args: {
  tx: TenantTx;
  ctx: ServiceCtx;
  payload: ScoreChangedPayload;
}): Promise<void> {
  const evaluation = await evaluateMembershipReadiness({
    tx: args.tx,
    ctx: args.ctx,
    membershipId: args.payload.membershipId,
    scoringProfileId: args.payload.scoringProfileId,
  });

  if (!evaluation) return;

  if (evaluation.bandChanged) {
    await outbox.publish(args.tx, {
      ctx: {
        tenantId: args.ctx.tenantId,
        requestId: args.ctx.requestId,
      },
      eventType: "readiness.band_changed",
      aggregateType: "composite_readiness_state",
      aggregateId: args.payload.membershipId,
      payload: {
        membershipId: args.payload.membershipId,
        scoringProfileId: args.payload.scoringProfileId,
        compositeKey: evaluation.compositeKey,
        bandKey: evaluation.bandKey,
        previousBandKey: evaluation.previousBandKey,
        score: evaluation.score,
      },
      idempotencyKey: `${args.ctx.requestId}:readiness.band_changed:${args.payload.membershipId}:${args.payload.scoringProfileId}:${evaluation.bandKey}`,
    });
  }
}

export async function buildReadinessEvaluation(args: {
  tx: TenantTx;
  membershipId: string;
}): Promise<{ composites: CompositeReadinessProjection[] }> {
  const policy = await findReadinessPolicy({ tx: args.tx });
  if (!policy) {
    return { composites: [] };
  }

  const composite = await findCompositeReadinessState({
    tx: args.tx,
    membershipId: args.membershipId,
    scoringProfileId: policy.scoringProfileId,
    compositeKey: DEFAULT_COMPOSITE_KEY,
  });

  if (!composite) {
    return { composites: [] };
  }

  return {
    composites: [
      {
        compositeKey: DEFAULT_COMPOSITE_KEY,
        scoringProfileId: policy.scoringProfileId,
        score: composite.score,
        bandKey: composite.bandKey,
        prominence: deriveProminence(composite.bandKey, policy.ctaPolicy.bandProminenceRules),
        calculatedAt: composite.calculatedAt,
      },
    ],
  };
}
