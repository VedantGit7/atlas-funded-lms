import { describe, expect, it } from "vitest";
import {
  buildMatchOptions,
  isMatchItemType,
  readMatchPairs,
  scoreMatchResponse,
} from "../../../backend/apps/api/src/server/practice/match-scoring.service";

const answerKey = {
  pairs: { l1: "r1", l2: "r2", l3: "r3" },
  leftItems: { l1: "Alpha", l2: "Beta", l3: "Sharpe" },
  rightItems: { r1: "Excess return", r2: "Volatility vs market", r3: "Risk-adjusted return" },
  explanation: "Core risk metrics.",
};

describe("buildMatchOptions", () => {
  it("exposes labels for both columns without revealing the pairing", () => {
    const options = buildMatchOptions(answerKey);

    expect(options.leftItems).toHaveLength(3);
    expect(options.rightItems).toHaveLength(3);
    expect(options.leftItems.map((o) => o.label).sort()).toEqual(["Alpha", "Beta", "Sharpe"]);
    // The correct mapping must never appear in the client payload.
    expect(JSON.stringify(options)).not.toContain("pairs");
  });

  it("falls back to ids when labels are missing", () => {
    const options = buildMatchOptions({ pairs: { l1: "r1" } });
    expect(options.leftItems).toEqual([{ id: "l1", label: "l1" }]);
    expect(options.rightItems).toEqual([{ id: "r1", label: "r1" }]);
  });

  it("returns empty lists for a malformed answer key", () => {
    expect(buildMatchOptions(null)).toEqual({ leftItems: [], rightItems: [] });
  });
});

describe("scoreMatchResponse", () => {
  it("marks a fully correct pairing correct", () => {
    expect(
      scoreMatchResponse({
        itemTypeKey: "matching",
        answerKeyJson: answerKey,
        pairs: { l1: "r1", l2: "r2", l3: "r3" },
      }),
    ).toBe(true);
  });

  it("marks a single wrong pair incorrect", () => {
    expect(
      scoreMatchResponse({
        itemTypeKey: "matching",
        answerKeyJson: answerKey,
        pairs: { l1: "r2", l2: "r1", l3: "r3" },
      }),
    ).toBe(false);
  });

  it("rejects a partial submission", () => {
    expect(
      scoreMatchResponse({ itemTypeKey: "matching", answerKeyJson: answerKey, pairs: { l1: "r1" } }),
    ).toBe(false);
  });

  it("rejects extra pairs beyond the answer key", () => {
    expect(
      scoreMatchResponse({
        itemTypeKey: "matching",
        answerKeyJson: answerKey,
        pairs: { l1: "r1", l2: "r2", l3: "r3", l4: "r4" },
      }),
    ).toBe(false);
  });

  it("refuses to grade a non-matching item type", () => {
    expect(
      scoreMatchResponse({ itemTypeKey: "swipe", answerKeyJson: answerKey, pairs: { l1: "r1" } }),
    ).toBe(false);
  });

  it("is not correct when the answer key has no pairs", () => {
    expect(scoreMatchResponse({ itemTypeKey: "matching", answerKeyJson: {}, pairs: {} })).toBe(false);
  });
});

describe("readMatchPairs", () => {
  it("reads the authoritative pairing", () => {
    expect(readMatchPairs(answerKey)).toEqual({ l1: "r1", l2: "r2", l3: "r3" });
  });

  it("ignores non-string entries", () => {
    expect(readMatchPairs({ pairs: { l1: "r1", bad: 42 } })).toEqual({ l1: "r1" });
  });
});

describe("isMatchItemType", () => {
  it("only accepts the matching item type", () => {
    expect(isMatchItemType("matching")).toBe(true);
    expect(isMatchItemType("swipe")).toBe(false);
  });
});
