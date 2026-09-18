// Poisons this module for any client bundle. Audit finding M9: nothing at the
// language level stopped a server module being pulled into a client component,
// so a leak of service code -- and whatever secrets or privileged queries it
// closes over -- would only have shown up as a runtime surprise.
import "server-only";

import type { TenantTx } from "@atlas/db";
import type {
  CompetencyHistoryQuery,
  CompetencySignalsQuery,
} from "./competency-projection.schemas";
import {
  listCompositeReadiness,
  listCompetencySignals,
  listMembershipScores,
  listScoreSnapshots,
} from "./competency-projection.repository";

type ServiceCtx = {
  tenantId: string;
  actorMembershipId: string;
};

export async function getMyCompetency(tx: TenantTx, ctx: ServiceCtx) {
  const [scores, composites] = await Promise.all([
    listMembershipScores({ tx, membershipId: ctx.actorMembershipId }),
    listCompositeReadiness({ tx, membershipId: ctx.actorMembershipId }),
  ]);

  return {
    data: {
      scores,
      composites,
    },
  };
}

export async function getMemberCompetency(tx: TenantTx, membershipId: string) {
  const [scores, composites] = await Promise.all([
    listMembershipScores({ tx, membershipId }),
    listCompositeReadiness({ tx, membershipId }),
  ]);

  return {
    data: {
      scores,
      composites,
    },
  };
}

export async function getMyCompetencyHistory(
  tx: TenantTx,
  ctx: ServiceCtx,
  query: CompetencyHistoryQuery,
) {
  const result = await listScoreSnapshots({
    tx,
    membershipId: ctx.actorMembershipId,
    limit: query.limit,
    ...(query.scoringProfileId != null ? { scoringProfileId: query.scoringProfileId } : {}),
    ...(query.cursor != null ? { cursor: query.cursor } : {}),
  });

  const lastItem = result.items[result.items.length - 1];

  return {
    data: {
      items: result.items,
      pageInfo: {
        nextCursor: result.hasNextPage && lastItem ? lastItem.id : null,
        hasNextPage: result.hasNextPage,
      },
    },
  };
}

export async function listTenantCompetencySignals(tx: TenantTx, query: CompetencySignalsQuery) {
  const result = await listCompetencySignals({
    tx,
    limit: query.limit,
    ...(query.membershipId != null ? { membershipId: query.membershipId } : {}),
    ...(query.dimensionId != null ? { dimensionId: query.dimensionId } : {}),
    ...(query.signalSourceKey != null ? { signalSourceKey: query.signalSourceKey } : {}),
    ...(query.cursor != null ? { cursor: query.cursor } : {}),
  });

  const lastItem = result.items[result.items.length - 1];

  return {
    data: {
      items: result.items,
      pageInfo: {
        nextCursor: result.hasNextPage && lastItem ? lastItem.id : null,
        hasNextPage: result.hasNextPage,
      },
    },
  };
}
