import { createHash, randomInt } from "node:crypto";

/**
 * The order an attempt presents its items and options in (audit M9).
 *
 * Shuffles used to be recomputed with Math.random() on every fetch, so
 * reloading the runner reordered the exam: questions moved, and option
 * positions changed under answers the learner had already read. The order is
 * now drawn once, when the attempt starts, stored in the attempt's metadata,
 * and every later read (the runner, and review after submission) uses it.
 *
 * Ids, not positions, are stored, so an order stays valid if the assessment's
 * positions are renumbered. Anything added to the assessment after the attempt
 * started is presented after the stored order, by position.
 */
export type PresentationOrder = {
  /** Assessment item ids (assessment_items.id), in presentation order. */
  itemOrder: string[];
  /** Option ids per assessment item id, for items whose options are shuffled. */
  optionOrder: Record<string, string[]>;
};

type Positioned = { id: string; position: number };

/** Fisher-Yates with a cryptographic source. */
export function secureShuffle<T>(items: readonly T[]): T[] {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = randomInt(index + 1);
    const current = copy[index] as T;
    copy[index] = copy[swapIndex] as T;
    copy[swapIndex] = current;
  }
  return copy;
}

const byPosition = <T extends Positioned>(a: T, b: T) => a.position - b.position;

/** Draw the order once, at attempt start. */
export function planPresentationOrder(args: {
  items: Array<Positioned & { options: Positioned[] }>;
  shuffleItems: boolean;
  shuffleOptions: boolean;
}): PresentationOrder {
  const ordered = [...args.items].sort(byPosition);
  const items = args.shuffleItems ? secureShuffle(ordered) : ordered;
  const optionOrder: Record<string, string[]> = {};
  if (args.shuffleOptions) {
    for (const item of items) {
      if (item.options.length > 1) {
        optionOrder[item.id] = secureShuffle(item.options).map((option) => option.id);
      }
    }
  }
  return { itemOrder: items.map((item) => item.id), optionOrder };
}

/**
 * Attempts started before the order was stored have none. Derive a stable one
 * from the attempt id, so their runner stops reordering from this fetch on.
 */
function stableKey(seed: string, id: string): string {
  return createHash("sha256").update(`${seed}:${id}`).digest("hex");
}

function stableShuffle<T extends Positioned>(seed: string, rows: readonly T[]): T[] {
  return [...rows].sort((a, b) => stableKey(seed, a.id).localeCompare(stableKey(seed, b.id)));
}

/** Rows in the stored order; rows it does not know come last, by position. */
function orderBy<T extends Positioned>(rows: readonly T[], order: readonly string[]): T[] {
  const rank = new Map(order.map((id, index) => [id, index]));
  const known = rows.filter((row) => rank.has(row.id));
  const unknown = rows.filter((row) => !rank.has(row.id)).sort(byPosition);
  known.sort((a, b) => (rank.get(a.id) ?? 0) - (rank.get(b.id) ?? 0));
  return [...known, ...unknown];
}

export function orderItems<T extends Positioned>(
  rows: readonly T[],
  args: { order: PresentationOrder | undefined; attemptId: string; shuffleItems: boolean },
): T[] {
  if (args.order) return orderBy(rows, args.order.itemOrder);
  const ordered = [...rows].sort(byPosition);
  return args.shuffleItems ? stableShuffle(args.attemptId, ordered) : ordered;
}

export function orderOptions<T extends Positioned>(
  options: readonly T[],
  args: {
    order: PresentationOrder | undefined;
    attemptId: string;
    assessmentItemId: string;
    shuffleOptions: boolean;
  },
): T[] {
  const stored = args.order?.optionOrder[args.assessmentItemId];
  if (stored) return orderBy(options, stored);
  const ordered = [...options].sort(byPosition);
  if (args.order || !args.shuffleOptions) return ordered;
  return stableShuffle(`${args.attemptId}:${args.assessmentItemId}`, ordered);
}

/** The stored order from attempt metadata, if it is well formed. */
export function readPresentationOrder(value: unknown): PresentationOrder | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const candidate = value as Record<string, unknown>;
  const itemOrder = candidate["itemOrder"];
  const optionOrder = candidate["optionOrder"];
  if (!Array.isArray(itemOrder) || !itemOrder.every((id) => typeof id === "string")) {
    return undefined;
  }
  const options: Record<string, string[]> = {};
  if (optionOrder && typeof optionOrder === "object" && !Array.isArray(optionOrder)) {
    for (const [key, ids] of Object.entries(optionOrder as Record<string, unknown>)) {
      if (Array.isArray(ids) && ids.every((id) => typeof id === "string")) {
        options[key] = ids;
      }
    }
  }
  return { itemOrder, optionOrder: options };
}
