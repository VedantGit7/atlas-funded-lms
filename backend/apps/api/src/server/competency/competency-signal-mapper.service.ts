import type { TenantTx } from "@atlas/db";
import type { MappedCompetencySignal } from "./competency-projection.types";
import {
  loadAttemptAnswerRows,
  loadItemDimensionWeights,
  loadPracticeResponseRows,
} from "./competency-projection.repository";

const ASSESSMENT_SIGNAL_SOURCE = "assessment";
const PRACTICE_SIGNAL_SOURCE = "practice";

function normalizeItemScore(args: {
  pointsAwarded: number | null;
  isCorrect: boolean | null;
  maxPoints: number;
}): number | null {
  if (args.pointsAwarded != null && args.maxPoints > 0) {
    return Number(((args.pointsAwarded / args.maxPoints) * 100).toFixed(4));
  }

  if (args.isCorrect === true) return 100;
  if (args.isCorrect === false) return 0;
  return null;
}

function normalizePracticeScore(isCorrect: boolean | null): number | null {
  if (isCorrect === true) return 100;
  if (isCorrect === false) return 0;
  return null;
}

async function mapItemResponses(args: {
  tx: TenantTx;
  membershipId: string;
  signalSourceKey: string;
  responses: Array<{
    itemId: string;
    rawScore: number;
  }>;
  metadataBase: Record<string, unknown>;
}): Promise<MappedCompetencySignal[]> {
  const mapped: MappedCompetencySignal[] = [];

  for (const response of args.responses) {
    const weights = await loadItemDimensionWeights({ tx: args.tx, itemId: response.itemId });
    for (const weightRow of weights) {
      mapped.push({
        membershipId: args.membershipId,
        dimensionId: weightRow.dimensionId,
        signalSourceKey: args.signalSourceKey,
        rawScore: response.rawScore,
        weight: weightRow.weight,
        itemId: response.itemId,
        metadataJson: {
          ...args.metadataBase,
          itemId: response.itemId,
        },
      });
    }
  }

  return mapped;
}

export async function mapAssessmentAttemptToSignals(args: {
  tx: TenantTx;
  attemptId: string;
  membershipId: string;
  onlyScoredItems?: boolean;
}): Promise<MappedCompetencySignal[]> {
  const answers = await loadAttemptAnswerRows({ tx: args.tx, attemptId: args.attemptId });
  const responses: Array<{ itemId: string; rawScore: number }> = [];

  for (const answer of answers) {
    const rawScore = normalizeItemScore({
      pointsAwarded: answer.pointsAwarded,
      isCorrect: answer.isCorrect,
      maxPoints: answer.maxPoints,
    });

    if (rawScore == null) {
      if (args.onlyScoredItems) continue;
      continue;
    }

    responses.push({ itemId: answer.itemId, rawScore });
  }

  return mapItemResponses({
    tx: args.tx,
    membershipId: args.membershipId,
    signalSourceKey: ASSESSMENT_SIGNAL_SOURCE,
    responses,
    metadataBase: { attemptId: args.attemptId },
  });
}

export async function mapPracticeSessionToSignals(args: {
  tx: TenantTx;
  practiceSessionId: string;
  membershipId: string;
}): Promise<MappedCompetencySignal[]> {
  const responses = await loadPracticeResponseRows({
    tx: args.tx,
    practiceSessionId: args.practiceSessionId,
  });

  const scored = responses
    .map((response) => {
      const rawScore = normalizePracticeScore(response.isCorrect);
      if (rawScore == null) return null;
      return { itemId: response.itemId, rawScore };
    })
    .filter((row): row is { itemId: string; rawScore: number } => row != null);

  return mapItemResponses({
    tx: args.tx,
    membershipId: args.membershipId,
    signalSourceKey: PRACTICE_SIGNAL_SOURCE,
    responses: scored,
    metadataBase: { practiceSessionId: args.practiceSessionId },
  });
}

export { ASSESSMENT_SIGNAL_SOURCE, PRACTICE_SIGNAL_SOURCE };
