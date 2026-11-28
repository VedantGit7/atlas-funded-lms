import {
  isKeywordMarked,
  markFillBlank,
  matchedKeywords,
  shortAnswerKeywordRule,
} from "../item-registry/answer-rules.contract";

const OBJECTIVE_ITEM_TYPES = new Set([
  "mcq_single",
  "mcq_multi",
  "true_false",
  "fill_blank",
  "matching",
  "ordering",
  // A card the learner marks Known (right) or Unknown (left). It used to fall
  // through to manual grading, so one card in a quiz held the whole score back
  // although the preview already checked it against the key.
  "swipe",
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

function readPairs(value: unknown): Map<string, string> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const pairs = new Map<string, string>();
  for (const [left, right] of Object.entries(value as Record<string, unknown>)) {
    if (typeof right !== "string") return null;
    pairs.set(left, right);
  }
  return pairs;
}

/** Same left items, each matched to the same right item, in any order. */
function samePairs(answer: unknown, expected: unknown): boolean {
  const given = readPairs(answer);
  const key = readPairs(expected);
  if (!given || !key || key.size === 0 || given.size !== key.size) return false;
  for (const [left, right] of key) {
    if (given.get(left) !== right) return false;
  }
  return true;
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
      // The key's ids count only if they name this item's options. Options
      // used to get new ids on every save while the key kept the old ones, so
      // a stale key would mark every correct answer wrong; the options' own
      // `isCorrect` flags are the fallback.
      const optionIds = new Set(item.options.map((option) => option.id));
      const keyIds = Array.isArray(answerKey["correctOptionIds"])
        ? answerKey["correctOptionIds"].filter(
            (value): value is string => typeof value === "string",
          )
        : [];
      const correctIds =
        keyIds.length > 0 && keyIds.every((id) => optionIds.has(id))
          ? keyIds
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
      // Each right blank earns an equal share of the marks (S3.4b); one
      // blank is all or nothing, as before.
      const { right, total } = markFillBlank(answerKey, answerJson);
      const correct = total > 0 && right === total;
      return {
        isCorrect: correct,
        pointsAwarded: total > 0 ? Math.round(((item.points * right) / total) * 100) / 100 : 0,
        requiresManualGrading: false,
      };
    }
    case "short_answer": {
      // Marked by its keywords (S3.4b): all marks when the answer has enough
      // of them, none otherwise.
      const rule = shortAnswerKeywordRule(answerKey);
      const correct =
        rule !== null &&
        matchedKeywords(answerJson["value"], rule.keywords).length >= rule.required;
      return {
        isCorrect: correct,
        pointsAwarded: correct ? item.points : 0,
        requiresManualGrading: false,
      };
    }
    case "matching": {
      // Compared pair by pair. Comparing the JSON text made the order the
      // learner matched them in count, so a fully correct answer given in a
      // different order was marked wrong (practice already compared this way).
      const correct = samePairs(answerJson["pairs"], answerKey["pairs"]);
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
    case "swipe": {
      const action = answerJson["action"];
      const expected = answerKey["direction"] === "left" ? "unknown" : "known";
      const correct = (action === "known" || action === "unknown") && action === expected;
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

/**
 * Whether the learner gave an answer at all. Negative marking takes marks
 * only for a wrong answer, never for a question left blank.
 */
export function hasObjectiveAnswer(
  itemTypeKey: string,
  answerJson: Record<string, unknown> | null,
): boolean {
  if (!answerJson) return false;
  switch (itemTypeKey) {
    case "mcq_single":
      return typeof answerJson["selectedOptionId"] === "string";
    case "mcq_multi":
      return (
        Array.isArray(answerJson["selectedOptionIds"]) && answerJson["selectedOptionIds"].length > 0
      );
    case "true_false":
      return typeof answerJson["value"] === "boolean";
    case "fill_blank":
      return (
        normalizeString(answerJson["value"]).length > 0 ||
        (Array.isArray(answerJson["values"]) &&
          answerJson["values"].some((value) => normalizeString(value).length > 0))
      );
    case "short_answer":
      return normalizeString(answerJson["value"]).length > 0;
    case "matching": {
      const pairs = answerJson["pairs"];
      return (
        !!pairs &&
        typeof pairs === "object" &&
        !Array.isArray(pairs) &&
        Object.keys(pairs).length > 0
      );
    }
    case "ordering":
      return Array.isArray(answerJson["order"]) && answerJson["order"].length > 0;
    case "swipe":
      return answerJson["action"] === "known" || answerJson["action"] === "unknown";
    default:
      return false;
  }
}

/** Marks taken for a wrong answer, to two decimal places. */
export function negativeMarks(points: number, negativeMarkPercent: number): number {
  if (!(negativeMarkPercent > 0) || !(points > 0)) return 0;
  return Math.round(points * negativeMarkPercent) / 100;
}

export function scoreAttempt(args: {
  items: ScoringItem[];
  answers: Map<string, Record<string, unknown> | null>;
  /** Share of a question's marks lost for a wrong answer (0 = off). */
  negativeMarkPercent?: number;
}): ScoringResult {
  const negativePercent = args.negativeMarkPercent ?? 0;
  let earnedPoints = 0;
  let possibleObjectivePoints = 0;
  let requiresManualGrading = false;
  const itemResults: ScoringResult["itemResults"] = [];

  for (const item of args.items) {
    const answer = args.answers.get(item.assessmentItemId) ?? null;

    if (isManualScoringItem(item.itemTypeKey, item.answerKeyJson)) {
      requiresManualGrading = true;
      itemResults.push({
        assessmentItemId: item.assessmentItemId,
        isCorrect: null,
        pointsAwarded: 0,
        requiresManualGrading: true,
      });
      continue;
    }

    if (
      !OBJECTIVE_ITEM_TYPES.has(item.itemTypeKey) &&
      !isKeywordMarked(item.itemTypeKey, item.answerKeyJson)
    ) {
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
    // Negative marks only for an answer that earned nothing: a fill-in-the-
    // blank with some blanks right keeps its share.
    const lost =
      !result.isCorrect &&
      result.pointsAwarded === 0 &&
      hasObjectiveAnswer(item.itemTypeKey, answer)
        ? negativeMarks(item.points, negativePercent)
        : 0;
    const pointsAwarded = lost > 0 ? -lost : result.pointsAwarded;
    earnedPoints += pointsAwarded;
    itemResults.push({
      assessmentItemId: item.assessmentItemId,
      isCorrect: result.isCorrect,
      pointsAwarded,
      requiresManualGrading: false,
    });
  }

  // Negative marks can take the total down to zero, not below.
  earnedPoints = Math.max(0, earnedPoints);
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

/**
 * Whether a person marks this question: written and uploaded answers, except
 * a short answer with keywords, which is marked automatically (S3.4b).
 */
export function isManualScoringItem(itemTypeKey: string, answerKeyJson: unknown): boolean {
  return MANUAL_ITEM_TYPES.has(itemTypeKey) && !isKeywordMarked(itemTypeKey, answerKeyJson);
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
