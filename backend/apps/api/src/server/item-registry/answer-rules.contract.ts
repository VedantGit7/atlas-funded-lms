/**
 * How fill-in-the-blank, short-answer and long-answer questions are marked
 * (QA review 1 M48 and m25; S3.4b). One description, used by the server's
 * marking, the question rules, the editor, the learner's answer box, the
 * result review and the spreadsheet import.
 *
 * - Fill in the blank: each blank in the question is written as ____ (three
 *   or more underscores). Each blank has its own accepted answers, and each
 *   right blank earns an equal share of the question's marks. A question with
 *   one blank keeps the older answer key, `acceptedValues`.
 * - Short answer: optional keywords. With keywords it's marked automatically:
 *   full marks when the answer contains at least `keywordsRequired` of them
 *   (all of them unless set), otherwise none. Without keywords a person marks
 *   it, as before.
 * - Long answer: an optional word limit, `maxWords`.
 *
 * It is a contract (synced to the web app), so it imports nothing.
 */

export const ANSWER_RULE_LIMITS = {
  maxBlanks: 10,
  maxKeywords: 20,
  keywordMaxLength: 100,
  maxWordLimit: 5_000,
} as const;

/** A blank in a question: three or more underscores. */
const BLANK_PATTERN = /_{3,}/g;

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

/** Text compared for marking: Unicode-normalised, lower case, single spaces. */
export function normalizeAnswerText(value: unknown): string {
  return typeof value === "string"
    ? value.normalize("NFC").trim().replace(/\s+/g, " ").toLocaleLowerCase()
    : "";
}

/** How many blanks (____) the question has. */
export function countBlanks(stem: unknown): number {
  return typeof stem === "string" ? (stem.match(BLANK_PATTERN) ?? []).length : 0;
}

/** The question split around its blanks, for showing a box in each one. */
export function splitAtBlanks(stem: string): string[] {
  return stem.split(BLANK_PATTERN);
}

/**
 * The accepted answers for each blank, in order. Older questions have one
 * blank: `acceptedValues`, or a single `value`.
 */
export function fillBlankAnswerSets(answerKey: unknown): string[][] {
  const key = asRecord(answerKey);
  if (Array.isArray(key["blanks"])) {
    return (key["blanks"] as unknown[]).map((blank) => strings(asRecord(blank)["acceptedValues"]));
  }
  const accepted = strings(key["acceptedValues"]);
  if (accepted.length > 0) return [accepted];
  return typeof key["value"] === "string" ? [[key["value"]]] : [[]];
}

/** The learner's answer for each blank: `values`, or one `value`. */
export function fillBlankResponses(answerJson: unknown): string[] {
  const answer = asRecord(answerJson);
  if (Array.isArray(answer["values"])) {
    return (answer["values"] as unknown[]).map((value) => (typeof value === "string" ? value : ""));
  }
  return typeof answer["value"] === "string" ? [answer["value"]] : [];
}

/** How many blanks the learner got right, of how many. */
export function markFillBlank(
  answerKey: unknown,
  answerJson: unknown,
): { right: number; total: number } {
  const sets = fillBlankAnswerSets(answerKey);
  const given = fillBlankResponses(answerJson);
  let right = 0;
  sets.forEach((accepted, index) => {
    const value = normalizeAnswerText(given[index]);
    if (value && accepted.some((entry) => normalizeAnswerText(entry) === value)) right += 1;
  });
  return { right, total: sets.length };
}

export type KeywordRule = { keywords: string[]; required: number };

/** A short answer's keywords, or null when a person marks it. */
export function shortAnswerKeywordRule(answerKey: unknown): KeywordRule | null {
  const key = asRecord(answerKey);
  const keywords = strings(key["keywords"])
    .map((keyword) => keyword.trim())
    .filter(Boolean);
  if (keywords.length === 0) return null;
  const raw = key["keywordsRequired"];
  const required =
    typeof raw === "number" && Number.isInteger(raw) && raw >= 1
      ? Math.min(raw, keywords.length)
      : keywords.length;
  return { keywords, required };
}

/** Whether this question is marked automatically by its keywords. */
export function isKeywordMarked(itemTypeKey: string, answerKey: unknown): boolean {
  return itemTypeKey === "short_answer" && shortAnswerKeywordRule(answerKey) !== null;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * The keywords the answer contains, as whole words or phrases, ignoring
 * capitals and extra spaces ("stop" doesn't match "stopped").
 */
export function matchedKeywords(answer: unknown, keywords: string[]): string[] {
  const text = normalizeAnswerText(answer);
  if (!text) return [];
  return keywords.filter((keyword) => {
    const wanted = normalizeAnswerText(keyword);
    if (!wanted) return false;
    return new RegExp(`(^|[^\\p{L}\\p{N}])${escapeRegExp(wanted)}($|[^\\p{L}\\p{N}])`, "u").test(
      text,
    );
  });
}

/** Words in an answer, counted the way the learner's counter shows them. */
export function countWords(text: unknown): number {
  if (typeof text !== "string") return 0;
  const trimmed = text.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

/** A long answer's word limit, or null for none. */
export function longAnswerWordLimit(answerKey: unknown): number | null {
  const raw = asRecord(answerKey)["maxWords"];
  return typeof raw === "number" && Number.isInteger(raw) && raw >= 1 ? raw : null;
}
