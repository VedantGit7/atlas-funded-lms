const MATCH_ITEM_TYPE_KEY = "matching";

export type MatchOption = { id: string; label: string };

export function isMatchItemType(itemTypeKey: string): boolean {
  return itemTypeKey === MATCH_ITEM_TYPE_KEY;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function readStringMap(value: unknown): Record<string, string> {
  const record = asRecord(value);
  if (!record) return {};

  const result: Record<string, string> = {};
  for (const [key, entry] of Object.entries(record)) {
    if (typeof entry === "string") {
      result[key] = entry;
    }
  }
  return result;
}

/** The authoritative leftId -> rightId mapping. Never leaves the server. */
export function readMatchPairs(answerKeyJson: unknown): Record<string, string> {
  const answerKey = asRecord(answerKeyJson);
  return answerKey ? readStringMap(answerKey["pairs"]) : {};
}

/**
 * Deterministic-free shuffle. The right column must not be returned in the same
 * order as the left column, otherwise the index alone reveals the pairing.
 */
function shuffle<T>(input: T[]): T[] {
  const items = [...input];
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const a = items[i];
    const b = items[j];
    if (a !== undefined && b !== undefined) {
      items[i] = b;
      items[j] = a;
    }
  }
  return items;
}

/**
 * Builds the client-safe option lists for a matching item. Labels come from the
 * author's `leftItems` / `rightItems` maps when present, falling back to the raw
 * ids from `pairs`. The right column is shuffled so ordering leaks nothing.
 */
export function buildMatchOptions(answerKeyJson: unknown): {
  leftItems: MatchOption[];
  rightItems: MatchOption[];
} {
  const answerKey = asRecord(answerKeyJson);
  if (!answerKey) return { leftItems: [], rightItems: [] };

  const pairs = readStringMap(answerKey["pairs"]);
  const leftLabels = readStringMap(answerKey["leftItems"]);
  const rightLabels = readStringMap(answerKey["rightItems"]);

  const leftItems: MatchOption[] = Object.keys(pairs).map((id) => ({
    id,
    label: leftLabels[id] ?? id,
  }));

  const rightIds = [...new Set(Object.values(pairs))];
  const rightItems: MatchOption[] = rightIds.map((id) => ({
    id,
    label: rightLabels[id] ?? id,
  }));

  return { leftItems, rightItems: shuffle(rightItems) };
}

/**
 * Grades a submitted pairing. Correct only when every expected pair is present
 * and no extra pairs were supplied.
 */
export function scoreMatchResponse(args: {
  itemTypeKey: string;
  answerKeyJson: unknown;
  pairs: Record<string, string>;
}): boolean {
  if (!isMatchItemType(args.itemTypeKey)) {
    return false;
  }

  const expected = readMatchPairs(args.answerKeyJson);
  const expectedKeys = Object.keys(expected);

  if (expectedKeys.length === 0) return false;
  if (Object.keys(args.pairs).length !== expectedKeys.length) return false;

  return expectedKeys.every((leftId) => args.pairs[leftId] === expected[leftId]);
}
