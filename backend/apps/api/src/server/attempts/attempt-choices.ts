import { createHash, randomBytes } from "node:crypto";

/**
 * What a learner sees of a matching or ordering question during an attempt
 * (QA review 1 N1, M47).
 *
 * Their items used to live only in the answer key, which learners never
 * receive, so a real attempt showed placeholder steps or empty lists and the
 * questions could not be answered. The labels are now sent with the question,
 * but never the ids the answer key uses: those give the answer away (imported
 * steps are `step-1`, `step-2`, … in the correct order, and matching pairs
 * `left-n` with `right-n`). Each attempt gets its own random salt, and every
 * item id is replaced by an opaque token derived from it. Answers come back in
 * tokens and are turned back into the real ids before they are stored, so
 * grading and review are unchanged.
 *
 * Ordering steps are shuffled, never into the correct order; matching answers
 * on the right are shuffled. Both orders are stable for the attempt.
 */

export type ChoiceLabel = { id: string; label: string };

export type AttemptChoices =
  | { kind: "matching"; left: ChoiceLabel[]; right: ChoiceLabel[] }
  | { kind: "ordering"; items: ChoiceLabel[] };

/** A fresh salt, stored in the attempt's presentation metadata at start. */
export function newChoiceSalt(): string {
  return randomBytes(16).toString("hex");
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function labelMap(value: unknown): Map<string, string> {
  const labels = new Map<string, string>();
  for (const [id, label] of Object.entries(asRecord(value))) {
    if (typeof label === "string") labels.set(id, label);
  }
  return labels;
}

/** The author's items, with their real ids and labels, in the author's order. */
export function readChoiceItems(
  itemTypeKey: string,
  answerKey: unknown,
):
  | { kind: "matching"; left: ChoiceLabel[]; right: ChoiceLabel[]; pairs: Map<string, string> }
  | { kind: "ordering"; items: ChoiceLabel[]; order: string[] }
  | null {
  const key = asRecord(answerKey);

  if (itemTypeKey === "matching") {
    const pairs = new Map<string, string>();
    for (const [left, right] of Object.entries(asRecord(key["pairs"]))) {
      if (typeof right === "string") pairs.set(left, right);
    }
    const leftLabels = labelMap(key["leftItems"]);
    const rightLabels = labelMap(key["rightItems"]);
    const leftIds = leftLabels.size > 0 ? [...leftLabels.keys()] : [...pairs.keys()];
    const rightIds = rightLabels.size > 0 ? [...rightLabels.keys()] : [...new Set(pairs.values())];
    return {
      kind: "matching",
      left: leftIds.map((id) => ({ id, label: leftLabels.get(id) ?? id })),
      right: rightIds.map((id) => ({ id, label: rightLabels.get(id) ?? id })),
      pairs,
    };
  }

  if (itemTypeKey === "ordering") {
    const order = Array.isArray(key["order"])
      ? key["order"].filter((id): id is string => typeof id === "string")
      : [];
    const labels = labelMap(key["items"]);
    const ids = order.length > 0 ? order : [...labels.keys()];
    return {
      kind: "ordering",
      items: ids.map((id) => ({ id, label: labels.get(id) ?? id })),
      order,
    };
  }

  return null;
}

function digest(...parts: string[]): string {
  return createHash("sha256").update(parts.join(":")).digest("hex");
}

/** The opaque id a learner sees for one of an item's real ids. */
export function choiceToken(salt: string, assessmentItemId: string, realId: string): string {
  return `c${digest(salt, assessmentItemId, realId).slice(0, 15)}`;
}

function stableShuffle(salt: string, assessmentItemId: string, items: ChoiceLabel[]) {
  return [...items].sort((a, b) =>
    digest(salt, assessmentItemId, "order", a.id).localeCompare(
      digest(salt, assessmentItemId, "order", b.id),
    ),
  );
}

function sameOrder(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((id, index) => id === b[index]);
}

/** The choices to show for an item, in tokens, or null for other item types. */
export function presentChoices(args: {
  itemTypeKey: string;
  answerKey: unknown;
  salt: string;
  assessmentItemId: string;
}): AttemptChoices | null {
  const read = readChoiceItems(args.itemTypeKey, args.answerKey);
  if (!read) return null;
  const token = (id: string) => choiceToken(args.salt, args.assessmentItemId, id);
  const hide = (item: ChoiceLabel): ChoiceLabel => ({ id: token(item.id), label: item.label });

  if (read.kind === "matching") {
    return {
      kind: "matching",
      left: read.left.map(hide),
      right: stableShuffle(args.salt, args.assessmentItemId, read.right).map(hide),
    };
  }

  let items = stableShuffle(args.salt, args.assessmentItemId, read.items);
  const correct = read.order.length > 0 ? read.order : read.items.map((item) => item.id);
  if (
    items.length > 1 &&
    sameOrder(
      items.map((item) => item.id),
      correct,
    )
  ) {
    // Never start in the correct order: rotate by one.
    items = [...items.slice(1), ...items.slice(0, 1)];
  }
  return { kind: "ordering", items: items.map(hide) };
}

function tokenMap(args: {
  itemTypeKey: string;
  answerKey: unknown;
  salt: string;
  assessmentItemId: string;
}): { left: Map<string, string>; right: Map<string, string> } | null {
  const read = readChoiceItems(args.itemTypeKey, args.answerKey);
  if (!read) return null;
  const map = (items: ChoiceLabel[]) =>
    new Map(items.map((item) => [choiceToken(args.salt, args.assessmentItemId, item.id), item.id]));
  return read.kind === "matching"
    ? { left: map(read.left), right: map(read.right) }
    : { left: map(read.items), right: new Map() };
}

/**
 * A learner's answer, from tokens back to the real ids. Tokens that name no
 * item are dropped, so a tampered answer is simply wrong, never an error.
 * Other item types, and attempts without a salt, pass through unchanged.
 */
export function decodeChoiceAnswer(args: {
  itemTypeKey: string;
  answerKey: unknown;
  salt: string | undefined;
  assessmentItemId: string;
  answerJson: Record<string, unknown>;
}): Record<string, unknown> {
  if (!args.salt) return args.answerJson;
  const maps = tokenMap({ ...args, salt: args.salt });
  if (!maps) return args.answerJson;

  if (args.itemTypeKey === "matching") {
    const pairs: Record<string, string> = {};
    for (const [left, right] of Object.entries(asRecord(args.answerJson["pairs"]))) {
      const leftId = maps.left.get(left);
      const rightId = typeof right === "string" ? maps.right.get(right) : undefined;
      if (leftId && rightId) pairs[leftId] = rightId;
    }
    return { ...args.answerJson, pairs };
  }

  const order = Array.isArray(args.answerJson["order"])
    ? args.answerJson["order"]
        .map((token) => (typeof token === "string" ? maps.left.get(token) : undefined))
        .filter((id): id is string => Boolean(id))
    : [];
  return { ...args.answerJson, order };
}

/** A stored answer, from real ids to the tokens the learner's page uses. */
export function encodeChoiceAnswer(args: {
  itemTypeKey: string;
  salt: string;
  assessmentItemId: string;
  answerJson: Record<string, unknown>;
}): Record<string, unknown> {
  const token = (id: string) => choiceToken(args.salt, args.assessmentItemId, id);

  if (args.itemTypeKey === "matching") {
    const pairs: Record<string, string> = {};
    for (const [left, right] of Object.entries(asRecord(args.answerJson["pairs"]))) {
      if (typeof right === "string") pairs[token(left)] = token(right);
    }
    return { ...args.answerJson, pairs };
  }

  if (args.itemTypeKey === "ordering") {
    const order = Array.isArray(args.answerJson["order"])
      ? args.answerJson["order"].filter((id): id is string => typeof id === "string").map(token)
      : [];
    return { ...args.answerJson, order };
  }

  return args.answerJson;
}
