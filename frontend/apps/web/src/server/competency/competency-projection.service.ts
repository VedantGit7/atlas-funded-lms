// Poisons this module for any client bundle. Audit finding M9: nothing at the
// language level stopped a server module being pulled into a client component,
// so a leak of service code -- and whatever secrets or privileged queries it
// closes over -- would only have shown up as a runtime surprise.
import "server-only";

import type { TenantTx } from "@atlas/db";
import { outbox } from "@atlas/events";
import type { MappedCompetencySignal } from "./competency-projection.types";
import {
  buildSignalIdempotencyKey,
  findExistingScore,
  insertCompetencySignal,
  insertScoreSnapshot,
  listActiveScoringProfiles,
  listBandsForProfile,
  listDimensionsForProfile,
  listSignalsForProjection,
  upsertCompetencyScore,
} from "./competency-projection.repository";

type ServiceCtx = {
  tenantId: string;
  requestId: string;
};

export function aggregateWeightedScore(
  signals: Array<{ rawScore: number; weight: number }>,
): number | null {
  if (signals.length === 0) return null;

  const totalWeight = signals.reduce((sum, signal) => sum + signal.weight, 0);
  if (totalWeight <= 0) return null;

  const weightedSum = signals.reduce((sum, signal) => sum + signal.rawScore * signal.weight, 0);
  return Number((weightedSum / totalWeight).toFixed(4));
}

export function assignBandKey(
  score: number,
  bands: Array<{ key: string; minScore: number; maxScore: number; sortOrder: number }>,
): string | null {
  const sorted = [...bands].sort((a, b) => a.sortOrder - b.sortOrder);
  for (const band of sorted) {
    if (score >= band.minScore && score <= band.maxScore) {
      return band.key;
    }
  }
  return null;
}

export async function writeMappedSignals(args: {
  tx: TenantTx;
  ctx: ServiceCtx;
  sourceEventId: string;
  signals: MappedCompetencySignal[];
}): Promise<{ insertedCount: number; membershipIds: string[] }> {
  const membershipIds = new Set<string>();
  let insertedCount = 0;

  for (const signal of args.signals) {
    const idempotencyKey = buildSignalIdempotencyKey({
      sourceEventId: args.sourceEventId,
      membershipId: signal.membershipId,
      dimensionId: signal.dimensionId,
      itemId: signal.itemId,
      signalSourceKey: signal.signalSourceKey,
    });

    const result = await insertCompetencySignal({
      tx: args.tx,
      tenantId: args.ctx.tenantId,
      membershipId: signal.membershipId,
      dimensionId: signal.dimensionId,
      signalSourceKey: signal.signalSourceKey,
      sourceEventId: args.sourceEventId,
      rawScore: signal.rawScore,
      weight: signal.weight,
      idempotencyKey,
      ...(signal.metadataJson != null ? { metadataJson: signal.metadataJson } : {}),
    });

    if (result.inserted) {
      insertedCount += 1;
      membershipIds.add(signal.membershipId);

      await outbox.publish(args.tx, {
        ctx: {
          tenantId: args.ctx.tenantId,
          requestId: args.ctx.requestId,
        },
        eventType: "competency.signal_recorded",
        aggregateType: "competency_signal",
        aggregateId: result.id,
        payload: {
          signalId: result.id,
          membershipId: signal.membershipId,
          dimensionId: signal.dimensionId,
          signalSourceKey: signal.signalSourceKey,
          rawScore: signal.rawScore,
          weight: signal.weight,
        },
        idempotencyKey: `${args.ctx.requestId}:competency.signal_recorded:${result.id}`,
      });
    }
  }

  return { insertedCount, membershipIds: [...membershipIds] };
}

export async function projectMembershipScores(args: {
  tx: TenantTx;
  ctx: ServiceCtx;
  membershipId: string;
}): Promise<void> {
  const profiles = await listActiveScoringProfiles({ tx: args.tx });
  const dimensions = await listDimensionsForProfile({ tx: args.tx });

  for (const profile of profiles) {
    const bands = await listBandsForProfile({ tx: args.tx, profileId: profile.id });
    const snapshotScores: Array<{
      dimensionId: string;
      dimensionKey: string;
      score: number;
      bandKey: string | null;
    }> = [];

    for (const dimension of dimensions) {
      const signals = await listSignalsForProjection({
        tx: args.tx,
        membershipId: args.membershipId,
        dimensionId: dimension.id,
      });

      const score = aggregateWeightedScore(signals);
      if (score == null) continue;

      const bandKey = assignBandKey(score, bands);
      const previous = await findExistingScore({
        tx: args.tx,
        membershipId: args.membershipId,
        dimensionId: dimension.id,
        scoringProfileId: profile.id,
      });

      await upsertCompetencyScore({
        tx: args.tx,
        tenantId: args.ctx.tenantId,
        membershipId: args.membershipId,
        dimensionId: dimension.id,
        scoringProfileId: profile.id,
        score,
        bandKey,
        configVersionId: profile.activeConfigVersionId,
      });

      snapshotScores.push({
        dimensionId: dimension.id,
        dimensionKey: dimension.key,
        score,
        bandKey,
      });

      const scoreChanged =
        previous == null || previous.score !== score || previous.bandKey !== bandKey;

      if (scoreChanged) {
        await outbox.publish(args.tx, {
          ctx: {
            tenantId: args.ctx.tenantId,
            requestId: args.ctx.requestId,
          },
          eventType: "competency.score_changed",
          aggregateType: "competency_score",
          aggregateId: dimension.id,
          payload: {
            membershipId: args.membershipId,
            dimensionId: dimension.id,
            dimensionKey: dimension.key,
            scoringProfileId: profile.id,
            scoringProfileKey: profile.key,
            score,
            bandKey,
            previousScore: previous?.score ?? null,
            previousBandKey: previous?.bandKey ?? null,
          },
          idempotencyKey: `${args.ctx.requestId}:competency.score_changed:${args.membershipId}:${dimension.id}:${profile.id}:${String(score)}:${bandKey ?? "none"}`,
        });
      }
    }

    if (snapshotScores.length > 0) {
      await insertScoreSnapshot({
        tx: args.tx,
        tenantId: args.ctx.tenantId,
        membershipId: args.membershipId,
        scoringProfileId: profile.id,
        snapshotJson: {
          scores: snapshotScores,
          bands: bands.map((band) => ({
            key: band.key,
            label: band.label,
            minScore: band.minScore,
            maxScore: band.maxScore,
          })),
        },
      });
    }
  }
}

export async function ingestSignalsAndProject(args: {
  tx: TenantTx;
  ctx: ServiceCtx;
  sourceEventId: string;
  signals: MappedCompetencySignal[];
}): Promise<void> {
  const { membershipIds } = await writeMappedSignals({
    tx: args.tx,
    ctx: args.ctx,
    sourceEventId: args.sourceEventId,
    signals: args.signals,
  });

  for (const membershipId of membershipIds) {
    await projectMembershipScores({
      tx: args.tx,
      ctx: args.ctx,
      membershipId,
    });
  }
}
