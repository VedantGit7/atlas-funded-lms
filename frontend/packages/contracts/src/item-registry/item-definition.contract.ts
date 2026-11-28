import { z } from "zod";
import {
  ANSWER_FILE_LIMITS,
  ANSWER_FILE_TYPES,
  ANSWER_RULE_LIMITS,
  countBlanks,
  describeAnswerFileTypes,
  fillBlankAnswerSets,
  isAnswerFileType,
} from "./answer-rules.contract";

/**
 * What makes a question gradeable, per built-in item type.
 *
 * The server used to accept any answer key for any type: only the Studio
 * editor checked it, and only loosely. A question saved with a broken key
 * (no correct option, an empty accepted answer, a matching pair that points at
 * nothing) could be published and then marked every learner wrong. This is
 * the one definition of a valid question. The item service enforces it on
 * every create and answer change, the editor checks with it before saving,
 * and the spreadsheet importer validates each row with it, so the three can
 * never disagree.
 *
 * It is a contract (synced to the web app), so it imports only zod and other
 * contracts.
 */

export const ITEM_DEFINITION_LIMITS = {
  stemMaxLength: 10_000,
  optionLabelMaxLength: 500,
  minOptions: 2,
  maxOptions: 8,
  explanationMaxLength: 5_000,
  rubricMaxLength: 10_000,
  acceptedValueMaxLength: 200,
  maxAcceptedValues: 20,
  minPairs: 2,
  maxPairs: 20,
  matchingLabelMaxLength: 500,
  minSteps: 2,
  maxSteps: 20,
  stepLabelMaxLength: 500,
  maxFileTypes: 20,
} as const;

/** Item types whose correct answer lives on the options (`isCorrect`). */
export const OPTION_ITEM_TYPES = ["mcq_single", "mcq_multi"] as const;

/** Built-in item types this contract validates; extension types pass through. */
export const VALIDATED_ITEM_TYPES = [
  "mcq_single",
  "mcq_multi",
  "true_false",
  "fill_blank",
  "short_answer",
  "long_answer",
  "matching",
  "ordering",
  "file_upload",
  "swipe",
] as const;

export type ValidatedItemTypeKey = (typeof VALIDATED_ITEM_TYPES)[number];

export type ItemDefinitionIssue = {
  /** Which part of the question is wrong, e.g. `options`, `pairs`, `acceptedValues`. */
  field: string;
  /** Plain-language message an author can act on. */
  message: string;
};

export type ItemDefinitionOptionInput = {
  optionJson: unknown;
  isCorrect?: boolean | null | undefined;
  position: number;
};

export type NormalizedItemOption = {
  optionJson: { label: string } & Record<string, unknown>;
  isCorrect: boolean;
  position: number;
};

export type ItemDefinitionInput = {
  itemTypeKey: string;
  stem: unknown;
  answerKeyJson: unknown;
  options: ItemDefinitionOptionInput[] | null | undefined;
};

export type ItemDefinitionResult =
  | {
      ok: true;
      /**
       * The canonical answer key. For option types it carries no option ids:
       * those are assigned when the options are stored, and the service adds
       * `correctOptionId` / `correctOptionIds` for the stored ids.
       */
      answerKey: Record<string, unknown>;
      /** Trimmed options renumbered 1..n, or null for types without options. */
      options: NormalizedItemOption[] | null;
    }
  | { ok: false; issues: ItemDefinitionIssue[] };

export function isValidatedItemType(key: string): key is ValidatedItemTypeKey {
  return (VALIDATED_ITEM_TYPES as readonly string[]).includes(key);
}

export function isOptionItemType(key: string): boolean {
  return (OPTION_ITEM_TYPES as readonly string[]).includes(key);
}

const L = ITEM_DEFINITION_LIMITS;

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

/** Trim and normalise Unicode, so look-alike text compares equal. */
function clean(value: unknown): string {
  return typeof value === "string" ? value.normalize("NFC").trim() : "";
}

function sameText(a: string, b: string): boolean {
  return a.toLocaleLowerCase() === b.toLocaleLowerCase();
}

function firstDuplicate(values: string[]): string | null {
  const seen: string[] = [];
  for (const value of values) {
    if (seen.some((other) => sameText(other, value))) return value;
    seen.push(value);
  }
  return null;
}

function readLabel(optionJson: unknown): string {
  return clean(asRecord(optionJson)["label"]);
}

function readLabelMap(value: unknown): Array<{ id: string; label: string }> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return Object.entries(value as Record<string, unknown>).map(([id, label]) => ({
    id,
    label: clean(label),
  }));
}

export function validateItemDefinition(input: ItemDefinitionInput): ItemDefinitionResult {
  const issues: ItemDefinitionIssue[] = [];
  const issue = (field: string, message: string) => {
    issues.push({ field, message });
  };

  if (!isValidatedItemType(input.itemTypeKey)) {
    // Extension item types define their own answer shape.
    return { ok: true, answerKey: asRecord(input.answerKeyJson), options: null };
  }

  const stem = clean(input.stem);
  if (!stem) issue("stem", "Enter the question.");
  else if (stem.length > L.stemMaxLength)
    issue("stem", `The question is longer than ${String(L.stemMaxLength)} characters.`);

  const raw = asRecord(input.answerKeyJson);
  const answerKey: Record<string, unknown> = {};

  const explanation = clean(raw["explanation"]);
  if (explanation.length > L.explanationMaxLength) {
    issue(
      "explanation",
      `The explanation is longer than ${String(L.explanationMaxLength)} characters.`,
    );
  }

  let options: NormalizedItemOption[] | null = null;

  switch (input.itemTypeKey) {
    case "mcq_single":
    case "mcq_multi": {
      const single = input.itemTypeKey === "mcq_single";
      const sorted = [...(input.options ?? [])].sort((a, b) => a.position - b.position);
      const labels = sorted.map((option) => readLabel(option.optionJson));

      if (sorted.length < L.minOptions) {
        issue("options", `Add at least ${String(L.minOptions)} options.`);
      } else if (sorted.length > L.maxOptions) {
        issue("options", `Use at most ${String(L.maxOptions)} options.`);
      }
      labels.forEach((label, index) => {
        if (!label) issue("options", `Option ${String(index + 1)} is empty.`);
        else if (label.length > L.optionLabelMaxLength)
          issue(
            "options",
            `Option ${String(index + 1)} is longer than ${String(L.optionLabelMaxLength)} characters.`,
          );
      });
      const duplicate = firstDuplicate(labels.filter(Boolean));
      if (duplicate)
        issue("options", `Two options say "${duplicate}". Make each option different.`);

      const correctCount = sorted.filter((option) => option.isCorrect === true).length;
      if (single && correctCount !== 1) {
        issue(
          "correctOption",
          correctCount === 0
            ? "Mark the correct option."
            : "Mark only one option as correct. Use Multiple choice (multi) for more.",
        );
      }
      if (!single && correctCount === 0) {
        issue("correctOptions", "Mark at least one option as correct.");
      }

      options = sorted.map((option, index) => ({
        optionJson: { ...asRecord(option.optionJson), label: labels[index] ?? "" },
        isCorrect: option.isCorrect === true,
        position: index + 1,
      }));
      break;
    }

    case "true_false": {
      if (typeof raw["value"] !== "boolean") issue("value", "Choose True or False.");
      else answerKey["value"] = raw["value"];
      break;
    }

    case "fill_blank": {
      // One set of accepted answers per blank (____) in the question; a
      // question with one blank keeps the older `acceptedValues` key.
      const sets = fillBlankAnswerSets(raw).map((listed) => {
        const accepted: string[] = [];
        for (const value of listed.map(clean).filter(Boolean)) {
          if (!accepted.some((other) => sameText(other, value))) accepted.push(value);
        }
        return accepted;
      });
      const blanksInStem = countBlanks(stem);
      const multiple = sets.length > 1;
      if (sets.length > ANSWER_RULE_LIMITS.maxBlanks) {
        issue("blanks", `Use at most ${String(ANSWER_RULE_LIMITS.maxBlanks)} blanks.`);
      }
      if (multiple && blanksInStem !== sets.length) {
        issue(
          "blanks",
          blanksInStem < sets.length
            ? `There are answers for ${String(sets.length)} blanks, but the question shows ${String(blanksInStem)}. Mark each blank in the question with ____.`
            : `The question shows ${String(blanksInStem)} blanks (____) but has answers for ${String(sets.length)}. Add the accepted answers for each blank.`,
        );
      } else if (!multiple && blanksInStem > 1) {
        issue(
          "blanks",
          `The question shows ${String(blanksInStem)} blanks (____). Add the accepted answers for each blank.`,
        );
      }
      sets.forEach((accepted, index) => {
        const which = multiple ? `blank ${String(index + 1)}` : "the blank";
        if (accepted.length === 0)
          issue(
            multiple ? "blanks" : "acceptedValues",
            multiple
              ? `Add at least one accepted answer for ${which}.`
              : "Add at least one accepted answer.",
          );
        if (accepted.length > L.maxAcceptedValues)
          issue(
            multiple ? "blanks" : "acceptedValues",
            `Use at most ${String(L.maxAcceptedValues)} accepted answers for ${which}.`,
          );
        if (accepted.some((value) => value.length > L.acceptedValueMaxLength))
          issue(
            multiple ? "blanks" : "acceptedValues",
            `Each accepted answer must be at most ${String(L.acceptedValueMaxLength)} characters.`,
          );
      });
      if (multiple) {
        answerKey["blanks"] = sets.map((acceptedValues) => ({ acceptedValues }));
      } else {
        answerKey["acceptedValues"] = sets[0] ?? [];
      }
      break;
    }

    case "short_answer":
    case "long_answer":
    case "file_upload": {
      const rubric = clean(raw["rubric"]);
      const modelAnswer = clean(raw["modelAnswer"]);
      if (rubric.length > L.rubricMaxLength)
        issue(
          "rubric",
          `The grading rubric is longer than ${String(L.rubricMaxLength)} characters.`,
        );
      if (modelAnswer.length > L.rubricMaxLength)
        issue(
          "modelAnswer",
          `The model answer is longer than ${String(L.rubricMaxLength)} characters.`,
        );
      if (rubric) answerKey["rubric"] = rubric;
      if (modelAnswer) answerKey["modelAnswer"] = modelAnswer;

      // Short answer: keywords mark it automatically (S3.4b).
      if (input.itemTypeKey === "short_answer") {
        const keywords: string[] = [];
        const listedKeywords = Array.isArray(raw["keywords"]) ? (raw["keywords"] as unknown[]) : [];
        for (const value of listedKeywords.map(clean).filter(Boolean)) {
          if (!keywords.some((other) => sameText(other, value))) keywords.push(value);
        }
        if (keywords.length > ANSWER_RULE_LIMITS.maxKeywords)
          issue("keywords", `Use at most ${String(ANSWER_RULE_LIMITS.maxKeywords)} keywords.`);
        if (keywords.some((value) => value.length > ANSWER_RULE_LIMITS.keywordMaxLength))
          issue(
            "keywords",
            `Each keyword must be at most ${String(ANSWER_RULE_LIMITS.keywordMaxLength)} characters.`,
          );
        if (keywords.length > 0) {
          answerKey["keywords"] = keywords;
          const required = raw["keywordsRequired"];
          if (required !== undefined && required !== null && required !== "") {
            const count = typeof required === "number" ? required : Number(required);
            if (!Number.isInteger(count) || count < 1 || count > keywords.length) {
              issue(
                "keywordsRequired",
                `Keywords needed must be a whole number from 1 to ${String(keywords.length)}.`,
              );
            } else {
              answerKey["keywordsRequired"] = count;
            }
          }
        }
      }

      // Long answer: an optional word limit (S3.4b).
      if (input.itemTypeKey === "long_answer") {
        const limit = raw["maxWords"];
        if (limit !== undefined && limit !== null && limit !== "") {
          const count = typeof limit === "number" ? limit : Number(limit);
          if (!Number.isInteger(count) || count < 1 || count > ANSWER_RULE_LIMITS.maxWordLimit) {
            issue(
              "maxWords",
              `The word limit must be a whole number from 1 to ${ANSWER_RULE_LIMITS.maxWordLimit.toLocaleString("en")}.`,
            );
          } else {
            answerKey["maxWords"] = count;
          }
        }
      }

      if (input.itemTypeKey === "file_upload") {
        const listed = Array.isArray(raw["acceptedFileTypes"])
          ? (raw["acceptedFileTypes"] as unknown[])
          : [];
        // Only types learners can actually upload (S3.4c). Empty: the
        // everyday default set.
        const types: string[] = [];
        for (const value of listed.map(clean).filter(Boolean)) {
          const type = value.replace(/^\.+/, "").toLowerCase();
          if (!/^[a-z0-9]{1,10}$/.test(type)) {
            issue("acceptedFileTypes", `"${value}" is not a file extension, such as pdf or png.`);
          } else if (!isAnswerFileType(type)) {
            issue(
              "acceptedFileTypes",
              `Learners can't upload .${type} files. Choose from ${describeAnswerFileTypes(Object.keys(ANSWER_FILE_TYPES))}.`,
            );
          } else if (!types.includes(type)) {
            types.push(type);
          }
        }
        if (types.length > L.maxFileTypes)
          issue("acceptedFileTypes", `Use at most ${String(L.maxFileTypes)} file types.`);
        answerKey["acceptedFileTypes"] = types;

        const size = raw["maxFileSizeMb"];
        if (size !== undefined && size !== null && size !== "") {
          const megabytes = typeof size === "number" ? size : Number(size);
          if (
            !Number.isInteger(megabytes) ||
            megabytes < 1 ||
            megabytes > ANSWER_FILE_LIMITS.maxMb
          ) {
            issue(
              "maxFileSizeMb",
              `The largest file must be a whole number of MB from 1 to ${String(ANSWER_FILE_LIMITS.maxMb)}.`,
            );
          } else {
            answerKey["maxFileSizeMb"] = megabytes;
          }
        }
      }
      break;
    }

    case "matching": {
      const pairs = asRecord(raw["pairs"]);
      const pairEntries = Object.entries(pairs).filter(
        (entry): entry is [string, string] => typeof entry[1] === "string",
      );
      const leftItems = readLabelMap(raw["leftItems"]);
      const rightItems = readLabelMap(raw["rightItems"]);

      if (pairEntries.length < L.minPairs) {
        issue("pairs", `Add at least ${String(L.minPairs)} matching pairs.`);
      } else if (pairEntries.length > L.maxPairs) {
        issue("pairs", `Use at most ${String(L.maxPairs)} matching pairs.`);
      }
      if (!leftItems || !rightItems) {
        issue("pairs", "Each pair needs a left item and a right item.");
        break;
      }

      const leftIds = new Set(leftItems.map((item) => item.id));
      const rightIds = new Set(rightItems.map((item) => item.id));
      for (const [left, right] of pairEntries) {
        if (!leftIds.has(left) || !rightIds.has(right)) {
          issue("pairs", "A pair points at an item that does not exist.");
          break;
        }
      }
      for (const [side, items] of [
        ["left", leftItems],
        ["right", rightItems],
      ] as const) {
        if (items.some((item) => !item.label)) issue("pairs", `A ${side} item is empty.`);
        if (items.some((item) => item.label.length > L.matchingLabelMaxLength))
          issue(
            "pairs",
            `A ${side} item is longer than ${String(L.matchingLabelMaxLength)} characters.`,
          );
        const duplicate = firstDuplicate(items.map((item) => item.label).filter(Boolean));
        if (duplicate)
          issue("pairs", `Two ${side} items say "${duplicate}". Make each one different.`);
      }

      answerKey["pairs"] = Object.fromEntries(pairEntries);
      answerKey["leftItems"] = Object.fromEntries(leftItems.map((item) => [item.id, item.label]));
      answerKey["rightItems"] = Object.fromEntries(rightItems.map((item) => [item.id, item.label]));
      break;
    }

    case "ordering": {
      const order = Array.isArray(raw["order"])
        ? (raw["order"] as unknown[]).filter((id): id is string => typeof id === "string")
        : [];
      const items = readLabelMap(raw["items"]);

      if (order.length < L.minSteps) {
        issue("order", `Add at least ${String(L.minSteps)} steps.`);
      } else if (order.length > L.maxSteps) {
        issue("order", `Use at most ${String(L.maxSteps)} steps.`);
      }
      if (new Set(order).size !== order.length)
        issue("order", "A step appears twice in the order.");
      if (!items) {
        issue("order", "Each step needs its text.");
        break;
      }
      const ids = new Set(items.map((item) => item.id));
      if (order.some((id) => !ids.has(id)) || items.length !== order.length)
        issue("order", "The steps and their order do not match.");
      if (items.some((item) => !item.label)) issue("order", "A step is empty.");
      if (items.some((item) => item.label.length > L.stepLabelMaxLength))
        issue("order", `A step is longer than ${String(L.stepLabelMaxLength)} characters.`);
      const duplicate = firstDuplicate(items.map((item) => item.label).filter(Boolean));
      if (duplicate) issue("order", `Two steps say "${duplicate}". Make each step different.`);

      answerKey["order"] = order;
      answerKey["items"] = Object.fromEntries(items.map((item) => [item.id, item.label]));
      break;
    }

    case "swipe": {
      const direction = raw["direction"];
      if (direction !== "left" && direction !== "right")
        issue("direction", "Choose Known (swipe right) or Unknown (swipe left).");
      else answerKey["direction"] = direction;
      break;
    }
  }

  if (explanation) answerKey["explanation"] = explanation;

  if (issues.length > 0) return { ok: false, issues };
  return { ok: true, answerKey, options };
}

/** The issue list as one sentence block, for an API error message. */
export function describeItemDefinitionIssues(issues: ItemDefinitionIssue[]): string {
  const messages = [...new Set(issues.map((entry) => entry.message))];
  return messages.join(" ");
}

export const ItemDefinitionIssueSchema = z.object({
  field: z.string(),
  message: z.string(),
});
