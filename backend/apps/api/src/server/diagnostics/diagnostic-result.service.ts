import type { TenantTx } from "@atlas/db";
import { AtlasHttpError } from "@atlas/core/http/errors";
import {
  assignBandKey,
  aggregateWeightedScore,
} from "../../server/competency/competency-projection.service";
import {
  listActiveScoringProfiles,
  listBandsForProfile,
  listDimensionsForProfile,
  listMembershipScores,
} from "../../server/competency/competency-projection.repository";
import {
  assessmentsRepository,
  extractAssessmentConfig,
  readItemRequired,
} from "../../server/assessments/assessments.repository";
import { scoreAttempt, type ScoringItem } from "../../server/assessments/scoring.service";
import { findReadinessPolicy } from "../../server/readiness/readiness.repository";
import { containsUnsafeCopy } from "../../server/readiness/readiness.schemas";
import {
  decodeExplanationJson,
  itemRegistryRepository,
} from "../../server/item-registry/item-registry.repository";
import type {
  DiagnosticNextAction,
  DiagnosticQuestion,
  DiagnosticScorecard,
  DiagnosticSessionMetadata,
} from "./diagnostic.types";

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    const current = copy[index];
    const swap = copy[swapIndex];
    if (current !== undefined && swap !== undefined) {
      copy[index] = swap;
      copy[swapIndex] = current;
    }
  }
  return copy;
}

async function loadScoringItems(tx: TenantTx, assessmentId: string): Promise<ScoringItem[]> {
  const rows = await assessmentsRepository.listAssessmentItems(tx, assessmentId);
  const items: ScoringItem[] = [];

  for (const row of rows) {
    const item = await itemRegistryRepository.findItemById(tx, row.item_id);
    if (!item) continue;

    const options = await itemRegistryRepository.listItemOptions(tx, row.item_id);
    const decoded = decodeExplanationJson(item.explanation_json);

    items.push({
      assessmentItemId: row.id,
      itemId: row.item_id,
      itemTypeKey: item.item_type_key,
      points: Number(row.points),
      answerKeyJson: decoded.answerKeyJson,
      options: options.map((option) => ({
        id: option.id,
        isCorrect: option.is_correct ?? null,
        position: option.position,
      })),
    });
  }

  return items;
}

export async function buildPublicDiagnosticQuestions(
  tx: TenantTx,
  assessmentId: string,
): Promise<{ title: string; items: DiagnosticQuestion[] }> {
  const assessment = await assessmentsRepository.findById(tx, assessmentId);
  if (!assessment) {
    throw new AtlasHttpError({
      code: "PERMISSION_DENIED",
      status: 404,
      message: "Diagnostic assessment not found.",
    });
  }

  const config = extractAssessmentConfig(assessment.config_json);
  const rows = await assessmentsRepository.listAssessmentItems(tx, assessmentId);
  let orderedRows = [...rows].sort((a, b) => a.position - b.position);

  if (config.shuffleItems) {
    orderedRows = shuffle(orderedRows);
  }

  const items: DiagnosticQuestion[] = [];

  for (const row of orderedRows) {
    const item = await itemRegistryRepository.findItemById(tx, row.item_id);
    if (!item) continue;

    let options = await itemRegistryRepository.listItemOptions(tx, row.item_id);
    if (config.shuffleOptions) {
      options = shuffle(options);
    }

    items.push({
      assessmentItemId: row.id,
      itemId: row.item_id,
      itemTypeKey: item.item_type_key,
      position: row.position,
      points: Number(row.points),
      required: readItemRequired(row.config_json),
      contentJson: item.stem_json as Record<string, unknown>,
      options: options.map((option) => ({
        id: option.id,
        optionJson: option.option_json as Record<string, unknown>,
        position: option.position,
      })),
    });
  }

  return {
    title: assessment.title,
    items,
  };
}

async function loadDimensionWeights(
  tx: TenantTx,
  itemId: string,
): Promise<Array<{ dimensionId: string; weight: number }>> {
  const rows = await tx.$queryRaw<Array<{ dimension_id: string; weight: unknown }>>`
    select dimension_id::text, weight
    from item_dimension_weights
    where item_id = ${itemId}::uuid
  `;

  return rows.map((row) => ({
    dimensionId: row.dimension_id,
    weight: Number(row.weight),
  }));
}

function resolveBandLabel(
  bandKey: string | null,
  bands: Array<{ key: string; label: string }>,
): string | null {
  if (!bandKey) return null;
  return bands.find((band) => band.key === bandKey)?.label ?? bandKey;
}

function buildNextAction(args: {
  dimensions: DiagnosticScorecard["dimensions"];
  partial: boolean;
}): DiagnosticNextAction {
  const sorted = [...args.dimensions].sort((a, b) => a.score - b.score);
  const focus = sorted[0];

  if (!focus) {
    return {
      key: "continue_learning",
      title: "Continue your learning journey",
      description: args.partial
        ? "Create a free account to unlock your full diagnostic insights and personalized next steps."
        : "Review your competency profile and continue with recommended learning activities.",
    };
  }

  return {
    key: `focus_${focus.dimensionKey}`,
    title: `Focus on ${focus.dimensionName}`,
    description: args.partial
      ? `Your ${focus.dimensionName.toLowerCase()} area shows the most room to grow. Create a free account to unlock your full scorecard and personalized learning path.`
      : `Your ${focus.dimensionName.toLowerCase()} area shows the most room to grow. Start with recommended lessons and practice in this area.`,
  };
}

function resolveInterpretation(args: {
  bandKey: string | null;
  bandLabel: string | null;
  partial: boolean;
  bandNotes: Record<string, string>;
}): string {
  const note = args.bandKey != null ? args.bandNotes[args.bandKey] : undefined;

  if (note && !containsUnsafeCopy(note)) {
    return note;
  }

  if (args.partial) {
    return args.bandLabel
      ? `Your preliminary band is ${args.bandLabel}. This educational snapshot highlights areas to explore further after you create an account.`
      : "This educational snapshot highlights competency themes to explore further after you create an account.";
  }

  return args.bandLabel
    ? `Your current overall band is ${args.bandLabel}. Use these educational insights to guide your learning focus.`
    : "Use these educational insights to guide your learning focus.";
}

export async function buildScorecardFromAnswers(args: {
  tx: TenantTx;
  assessmentId: string;
  answers: Map<string, Record<string, unknown>>;
  partial: boolean;
}): Promise<DiagnosticScorecard> {
  const scoringItems = await loadScoringItems(args.tx, args.assessmentId);
  const scoring = scoreAttempt({ items: scoringItems, answers: args.answers });

  const profiles = await listActiveScoringProfiles({ tx: args.tx });
  const profile = profiles[0];
  const dimensions = profile ? await listDimensionsForProfile({ tx: args.tx }) : [];
  const bands = profile ? await listBandsForProfile({ tx: args.tx, profileId: profile.id }) : [];
  const policy = await findReadinessPolicy({ tx: args.tx });
  const bandNotes = policy?.legalCopy?.bandNotes ?? {};

  const dimensionAccumulator = new Map<
    string,
    {
      dimensionKey: string;
      dimensionName: string;
      weightedScores: Array<{ rawScore: number; weight: number }>;
    }
  >();

  for (const dimension of dimensions) {
    dimensionAccumulator.set(dimension.id, {
      dimensionKey: dimension.key,
      dimensionName: dimension.name,
      weightedScores: [],
    });
  }

  for (const item of scoringItems) {
    const itemResult = scoring.itemResults.find(
      (result) => result.assessmentItemId === item.assessmentItemId,
    );
    if (!itemResult || itemResult.requiresManualGrading) continue;

    const rawScore =
      item.points > 0
        ? Number(((itemResult.pointsAwarded / item.points) * 100).toFixed(4))
        : itemResult.isCorrect
          ? 100
          : 0;

    const weights = await loadDimensionWeights(args.tx, item.itemId);
    for (const weightRow of weights) {
      const bucket = dimensionAccumulator.get(weightRow.dimensionId);
      if (!bucket) continue;
      bucket.weightedScores.push({ rawScore, weight: weightRow.weight });
    }
  }

  const dimensionScores = [...dimensionAccumulator.entries()]
    .map(([dimensionId, bucket]) => {
      const score = aggregateWeightedScore(bucket.weightedScores);
      if (score == null) return null;
      const bandKey = assignBandKey(score, bands);
      return {
        dimensionId,
        dimensionKey: bucket.dimensionKey,
        dimensionName: bucket.dimensionName,
        score,
        bandKey,
        bandLabel: resolveBandLabel(bandKey, bands),
      };
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry != null)
    .sort((a, b) => a.dimensionKey.localeCompare(b.dimensionKey));

  const overallScore =
    dimensionScores.length > 0
      ? Number(
          (
            dimensionScores.reduce((sum, entry) => sum + entry.score, 0) / dimensionScores.length
          ).toFixed(4),
        )
      : scoring.scorePercent;

  const overallBandKey = overallScore != null ? assignBandKey(overallScore, bands) : null;
  const overallBandLabel = resolveBandLabel(overallBandKey, bands);

  const scorecard: DiagnosticScorecard = {
    partial: args.partial,
    overallScore,
    overallBandKey,
    overallBandLabel,
    interpretation: resolveInterpretation({
      bandKey: overallBandKey,
      bandLabel: overallBandLabel,
      partial: args.partial,
      bandNotes,
    }),
    dimensions: dimensionScores,
    nextAction: buildNextAction({ dimensions: dimensionScores, partial: args.partial }),
  };

  if (
    containsUnsafeCopy(scorecard.interpretation) ||
    containsUnsafeCopy(scorecard.nextAction.description)
  ) {
    throw new AtlasHttpError({
      code: "VALIDATION_ERROR",
      status: 400,
      message: "Diagnostic copy must not include guaranteed outcomes or financial advice.",
    });
  }

  return scorecard;
}

export async function buildAuthenticatedScorecard(args: {
  tx: TenantTx;
  membershipId: string;
  metadata: DiagnosticSessionMetadata;
  partial?: boolean;
}): Promise<DiagnosticScorecard | null> {
  if (args.metadata.partialScorecard) {
    return args.metadata.partialScorecard;
  }

  const scores = await listMembershipScores({ tx: args.tx, membershipId: args.membershipId });
  if (scores.length === 0) {
    return null;
  }

  const profiles = await listActiveScoringProfiles({ tx: args.tx });
  const profile = profiles[0];
  const bands = profile ? await listBandsForProfile({ tx: args.tx, profileId: profile.id }) : [];
  const policy = await findReadinessPolicy({ tx: args.tx });
  const bandNotes = policy?.legalCopy?.bandNotes ?? {};

  const dimensions = scores.map((score) => ({
    dimensionId: score.dimensionId,
    dimensionKey: score.dimensionKey,
    dimensionName: score.dimensionName,
    score: score.score,
    bandKey: score.bandKey,
    bandLabel: score.bandLabel,
  }));

  const overallScore = Number(
    (
      dimensions.reduce((sum, entry) => sum + entry.score, 0) / Math.max(dimensions.length, 1)
    ).toFixed(4),
  );
  const overallBandKey = assignBandKey(overallScore, bands);
  const overallBandLabel = resolveBandLabel(overallBandKey, bands);

  return {
    partial: args.partial ?? false,
    overallScore,
    overallBandKey,
    overallBandLabel,
    interpretation: resolveInterpretation({
      bandKey: overallBandKey,
      bandLabel: overallBandLabel,
      partial: args.partial ?? false,
      bandNotes,
    }),
    dimensions,
    nextAction: buildNextAction({ dimensions, partial: args.partial ?? false }),
  };
}

export function mapAnswersByAssessmentItemId(args: {
  questions: DiagnosticQuestion[];
  answers: Array<{ itemId: string; answerJson: Record<string, unknown> }>;
}): Map<string, Record<string, unknown>> {
  const answerMap = new Map<string, Record<string, unknown>>();

  for (const answer of args.answers) {
    const question = args.questions.find((item) => item.itemId === answer.itemId);
    if (!question) {
      throw new AtlasHttpError({
        code: "VALIDATION_ERROR",
        status: 400,
        message: "One or more answers do not match the diagnostic questions.",
      });
    }

    answerMap.set(question.assessmentItemId, answer.answerJson);
  }

  return answerMap;
}

export function toStoredAnswers(args: {
  questions: DiagnosticQuestion[];
  answers: Array<{ itemId: string; answerJson: Record<string, unknown> }>;
}): NonNullable<DiagnosticSessionMetadata["answers"]> {
  const stored: NonNullable<DiagnosticSessionMetadata["answers"]> = {};

  for (const answer of args.answers) {
    const question = args.questions.find((item) => item.itemId === answer.itemId);
    if (!question) continue;
    stored[question.assessmentItemId] = {
      assessmentItemId: question.assessmentItemId,
      answerJson: answer.answerJson,
    };
  }

  return stored;
}

export function toAttemptDraftAnswers(
  answers: NonNullable<DiagnosticSessionMetadata["answers"]>,
): Record<string, { answerJson: Record<string, unknown>; updatedAt: string }> {
  const savedAt = new Date().toISOString();
  const draft: Record<string, { answerJson: Record<string, unknown>; updatedAt: string }> = {};

  for (const [assessmentItemId, answer] of Object.entries(answers)) {
    draft[assessmentItemId] = {
      answerJson: answer.answerJson,
      updatedAt: savedAt,
    };
  }

  return draft;
}
