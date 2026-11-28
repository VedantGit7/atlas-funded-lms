import { readChoiceItems } from "./attempt-choices";
import {
  fillBlankAnswerSets,
  fillBlankResponses,
  shortAnswerKeywordRule,
} from "../item-registry/answer-rules.contract";

/**
 * An attempt's answers in words, for the result page (QA review 2 H23).
 *
 * The result page used to print the learner's answer as JSON and never showed
 * the correct answer or the author's explanation, even when the quiz was set
 * to show answers. This turns each answer, and the correct one, into short
 * lines of text. It runs only when the quiz's "show answers" setting allows
 * review, so the answer key never reaches a learner otherwise.
 */

export type ReviewItemInput = {
  itemTypeKey: string;
  answerKeyJson: unknown;
  options: Array<{ id: string; label: string; isCorrect: boolean | null; position: number }>;
  answerJson: Record<string, unknown> | null;
};

export type ItemReview = {
  /** The learner's answer, one line per part; empty when unanswered. */
  yourAnswer: string[];
  /** The correct answer, one line per part; empty when there is no single answer. */
  correctAnswer: string[];
  /** What the correct answer is called: "Correct answer" or "Model answer". */
  correctAnswerLabel: string;
  explanation: string | null;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function strings(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string")
    : [];
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

const SWIPE_LABEL = { known: "Known", unknown: "Unknown" } as const;

export function reviewItem(input: ReviewItemInput): ItemReview {
  const key = asRecord(input.answerKeyJson);
  const answer = input.answerJson ?? {};
  const optionLabel = (id: string) => input.options.find((option) => option.id === id)?.label;
  const explanation = text(key["explanation"]);
  const base = { correctAnswerLabel: "Correct answer", explanation };

  switch (input.itemTypeKey) {
    case "mcq_single": {
      const selected =
        typeof answer["selectedOptionId"] === "string" ? answer["selectedOptionId"] : null;
      const correctId =
        typeof key["correctOptionId"] === "string" && optionLabel(key["correctOptionId"])
          ? key["correctOptionId"]
          : input.options.find((option) => option.isCorrect === true)?.id;
      return {
        ...base,
        yourAnswer: selected ? [optionLabel(selected) ?? "An option that was removed"] : [],
        correctAnswer: correctId ? [optionLabel(correctId) ?? ""].filter(Boolean) : [],
      };
    }

    case "mcq_multi": {
      const byPosition = [...input.options].sort((a, b) => a.position - b.position);
      const selected = new Set(strings(answer["selectedOptionIds"]));
      const keyIds = strings(key["correctOptionIds"]).filter((id) => optionLabel(id));
      const correct = new Set(
        keyIds.length > 0
          ? keyIds
          : input.options.filter((option) => option.isCorrect === true).map((option) => option.id),
      );
      return {
        ...base,
        yourAnswer: byPosition.filter((option) => selected.has(option.id)).map((o) => o.label),
        correctAnswer: byPosition.filter((option) => correct.has(option.id)).map((o) => o.label),
      };
    }

    case "true_false":
      return {
        ...base,
        yourAnswer:
          typeof answer["value"] === "boolean" ? [answer["value"] ? "True" : "False"] : [],
        correctAnswer: typeof key["value"] === "boolean" ? [key["value"] ? "True" : "False"] : [],
      };

    case "fill_blank": {
      const sets = fillBlankAnswerSets(key).map((values) =>
        values.map((value) => value.trim()).filter(Boolean),
      );
      const given = fillBlankResponses(answer).map((value) => value.trim());
      // One blank: as before. Several: a line per blank (S3.4b).
      if (sets.length <= 1) {
        const values = sets[0] ?? [];
        return {
          ...base,
          correctAnswerLabel: values.length > 1 ? "Accepted answers" : "Correct answer",
          yourAnswer: given[0] ? [given[0]] : [],
          correctAnswer: values,
        };
      }
      return {
        ...base,
        correctAnswerLabel: "Accepted answers",
        yourAnswer: given.some(Boolean)
          ? sets.map((_, index) => `Blank ${String(index + 1)}: ${given[index] || "(empty)"}`)
          : [],
        correctAnswer: sets.map(
          (values, index) => `Blank ${String(index + 1)}: ${values.join(" / ")}`,
        ),
      };
    }

    case "short_answer":
    case "long_answer": {
      const given = text(answer["value"]);
      const model = text(key["modelAnswer"]);
      const rule = input.itemTypeKey === "short_answer" ? shortAnswerKeywordRule(key) : null;
      if (rule) {
        // Marked by keywords (S3.4b): say which ones count.
        const needs =
          rule.required === rule.keywords.length
            ? `All of: ${rule.keywords.join(", ")}`
            : `At least ${String(rule.required)} of: ${rule.keywords.join(", ")}`;
        return {
          ...base,
          correctAnswerLabel: "Keywords",
          yourAnswer: given ? [given] : [],
          correctAnswer: [needs, ...(model ? [`Model answer: ${model}`] : [])],
        };
      }
      return {
        ...base,
        correctAnswerLabel: "Model answer",
        yourAnswer: given ? [given] : [],
        correctAnswer: model ? [model] : [],
      };
    }

    case "file_upload": {
      const given = text(answer["fileName"]);
      return { ...base, yourAnswer: given ? [given] : [], correctAnswer: [] };
    }

    case "matching": {
      const read = readChoiceItems("matching", key);
      if (read?.kind !== "matching") return { ...base, yourAnswer: [], correctAnswer: [] };
      const left = new Map(read.left.map((item) => [item.id, item.label]));
      const right = new Map(read.right.map((item) => [item.id, item.label]));
      const given = asRecord(answer["pairs"]);
      return {
        ...base,
        yourAnswer: read.left
          .filter((item) => typeof given[item.id] === "string")
          .map((item) => `${item.label} → ${right.get(given[item.id] as string) ?? "?"}`),
        correctAnswer: [...read.pairs].map(
          ([leftId, rightId]) => `${left.get(leftId) ?? leftId} → ${right.get(rightId) ?? rightId}`,
        ),
      };
    }

    case "ordering": {
      const read = readChoiceItems("ordering", key);
      if (read?.kind !== "ordering") return { ...base, yourAnswer: [], correctAnswer: [] };
      const labels = new Map(read.items.map((item) => [item.id, item.label]));
      const number = (ids: string[]) =>
        ids.map((id, index) => `${String(index + 1)}. ${labels.get(id) ?? id}`);
      return {
        ...base,
        correctAnswerLabel: "Correct order",
        yourAnswer: number(strings(answer["order"]).filter((id) => labels.has(id))),
        correctAnswer: number(read.order),
      };
    }

    case "swipe": {
      const action = answer["action"];
      return {
        ...base,
        yourAnswer: action === "known" || action === "unknown" ? [SWIPE_LABEL[action]] : [],
        correctAnswer: [key["direction"] === "left" ? SWIPE_LABEL.unknown : SWIPE_LABEL.known],
      };
    }

    default:
      return { ...base, yourAnswer: [], correctAnswer: [] };
  }
}
