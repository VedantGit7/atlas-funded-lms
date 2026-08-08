import { createHash } from "node:crypto";

/**
 * Deterministic UUID-like ID for seed rows.
 *
 * This is for stable seed identifiers only.
 * Runtime entities should continue using the approved application UUID strategy.
 */
export function stableSeedId(namespace: string, key: string): string {
  const hash = createHash("sha256").update(`${namespace}:${key}`).digest("hex");

  return [
    hash.slice(0, 8),
    hash.slice(8, 12),
    `4${hash.slice(13, 16)}`,
    `8${hash.slice(17, 20)}`,
    hash.slice(20, 32),
  ].join("-");
}
