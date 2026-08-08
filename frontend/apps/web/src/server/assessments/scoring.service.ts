const OBJECTIVE_ITEM_TYPES = new Set([
  "mcq_single",
  "mcq_multi",
  "true_false",
  "fill_blank",
  "matching",
  "ordering",
]);

const MANUAL_ITEM_TYPES = new Set(["short_answer", "long_answer", "file_upload", "assignment"]);

export type ScoringItem = {
  assessmentItemId: string;
  itemId: string;
  itemTypeKey: string;
  points: number;
  answerKeyJson: unknown;
  options: Array<{
    id: string;
    isCorrect: boolean | null;
    position: number;
  }>;
};

export type ScoringResult = {
  earnedPoints: number;
  possiblePoints: number;
  scorePercent: number | null;
  requiresManualGrading: boolean;
  itemResults: Array<{
    assessmentItemId: string;
    isCorrect: boolean | null;
    pointsAwarded: number;
    requiresManualGrading: boolean;
  }>;
};

function normalizeString(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().toLowerCase();
}

function compareSets(a: string[], b: string[]): boolean {
  if (a.length !== b.length) {
    return false;
  }

  const sortedA = [...a].sort();
  const sortedB = [...b].sort();

  return sortedA.every((value, index) => value === sortedB[index]);
}

function scoreObjectiveItem(
  item: ScoringItem,
  answerJson: Record<string, unknown> | null,
): { isCorrect: boolean; pointsAwarded: number; requiresManualGrading: false } {
  if (!answerJson) {
    return { isCorrect: false, pointsAwarded: 0, requiresManualGrading: false };
  }

  const answerKey =
    item.answerKeyJson &&
    typeof item.answerKeyJson === "object" &&
    !Array.isArray(item.answerKeyJson)
      ? (item.answerKeyJson as Record<string, unknown>)
      : {};

  switch (item.itemTypeKey) {
    case "mcq_single": {
      const selected = answerJson["selectedOptionId"];
      const correct =
        typeof selected === "string" &&
        (selected === answerKey["correctOptionId"] ||
          item.options.find((option) => option.id === selected)?.isCorrect === true);
      return {
        isCorrect: correct,
        pointsAwarded: correct ? item.points : 0,
        requiresManualGrading: false,
      };
    }
    case "mcq_multi": {
      const selected = Array.isArray(answerJson["selectedOptionIds"])
        ? answerJson["selectedOptionIds"].filter(
            (value): value is string => typeof value === "string",
          )
        : [];
      const correctIds =
        Array.isArray(answerKey["correctOptionIds"]) && answerKey["correctOptionIds"].length > 0
          ? answerKey["correctOptionIds"].filter(
              (value): value is string => typeof value === "string",
            )
          : item.options.filter((option) => option.isCorrect).map((option) => option.id);
      const correct = compareSets(selected, correctIds);
      return {
        isCorrect: correct,
        pointsAwarded: correct ? item.points : 0,
        requiresManualGrading: false,
      };
    }
    case "true_false": {
      const value = answerJson["value"];
      const correctValue = answerKey["value"];
      const correct = value === correctValue;
      return {
        isCorrect: correct,
        pointsAwarded: correct ? item.points : 0,
        requiresManualGrading: false,
      };
    }
    case "fill_blank": {
      const value = normalizeString(answerJson["value"]);
      const accepted = Array.isArray(answerKey["acceptedValues"])
        ? answerKey["acceptedValues"].map((entry) => normalizeString(entry))
        : [normalizeString(answerKey["value"])];
      const correct = accepted.includes(value) && value.length > 0;
      return {
        isCorrect: correct,
        pointsAwarded: correct ? item.points : 0,
        requiresManualGrading: false,
      };
    }
    case "matching": {
      const pairs = answerJson["pairs"];
      const expected = answerKey["pairs"];
      const correct =
        JSON.stringify(pairs ?? null) === JSON.stringify(expected ?? null) &&
        pairs != null &&
        expected != null;
      return {
        isCorrect: correct,
        pointsAwarded: correct ? item.points : 0,
        requiresManualGrading: false,
      };
    }
    case "ordering": {
      const order = answerJson["order"];
      const expected = answerKey["order"];
      const correct =
        JSON.stringify(order ?? null) === JSON.stringify(expected ?? null) &&
        order != null &&
        expected != null;
      return {
        isCorrect: correct,
        pointsAwarded: correct ? item.points : 0,
        requiresManualGrading: false,
      };
    }
    default:
      return { isCorrect: false, pointsAwarded: 0, requiresManualGrading: false };
  }
}

export function scoreAttempt(args: {
  items: ScoringItem[];
  answers: Map<string, Record<string, unknown> | null>;
}): ScoringResult {
  let earnedPoints = 0;
  let possibleObjectivePoints = 0;
  let requiresManualGrading = false;
  const itemResults: ScoringResult["itemResults"] = [];

  for (const item of args.items) {
    const answer = args.answers.get(item.assessmentItemId) ?? null;

    if (MANUAL_ITEM_TYPES.has(item.itemTypeKey)) {
      requiresManualGrading = true;
      itemResults.push({
        assessmentItemId: item.assessmentItemId,
        isCorrect: null,
        pointsAwarded: 0,
        requiresManualGrading: true,
      });
      continue;
    }

    if (!OBJECTIVE_ITEM_TYPES.has(item.itemTypeKey)) {
      requiresManualGrading = true;
      itemResults.push({
        assessmentItemId: item.assessmentItemId,
        isCorrect: null,
        pointsAwarded: 0,
        requiresManualGrading: true,
      });
      continue;
    }

    possibleObjectivePoints += item.points;
    const result = scoreObjectiveItem(item, answer);
    earnedPoints += result.pointsAwarded;
    itemResults.push({
      assessmentItemId: item.assessmentItemId,
      isCorrect: result.isCorrect,
      pointsAwarded: result.pointsAwarded,
      requiresManualGrading: false,
    });
  }

  const scorePercent =
    !requiresManualGrading && possibleObjectivePoints > 0
      ? Number(((earnedPoints / possibleObjectivePoints) * 100).toFixed(4))
      : requiresManualGrading
        ? null
        : 0;

  return {
    earnedPoints,
    possiblePoints: possibleObjectivePoints,
    scorePercent,
    requiresManualGrading,
    itemResults,
  };
}

export function isObjectiveItemType(itemTypeKey: string): boolean {
  return OBJECTIVE_ITEM_TYPES.has(itemTypeKey);
}

export function canReviewAnswers(args: {
  showAnswersPolicy: "never" | "after_submit" | "after_pass" | "after_graded";
  attemptStatus: string;
  passed: boolean | null;
}): boolean {
  if (args.showAnswersPolicy === "never") {
    return false;
  }

  if (args.attemptStatus === "STARTED") {
    return false;
  }

  if (args.showAnswersPolicy === "after_submit") {
    return args.attemptStatus === "SUBMITTED" || args.attemptStatus === "GRADED";
  }

  if (args.showAnswersPolicy === "after_pass") {
    return args.passed === true;
  }

  return args.attemptStatus === "GRADED";
}
