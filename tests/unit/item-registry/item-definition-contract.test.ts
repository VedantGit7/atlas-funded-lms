import { describe, expect, it } from "vitest";
import {
  ITEM_DEFINITION_LIMITS,
  VALIDATED_ITEM_TYPES,
  describeItemDefinitionIssues,
  validateItemDefinition,
  type ItemDefinitionInput,
} from "../../../backend/apps/api/src/server/item-registry/item-definition.contract";

/**
 * One definition of a gradeable question, shared by the item service, the
 * Studio editor and the spreadsheet importer. Each case below uses the shape
 * the Studio editor actually sends, so tightening the rules cannot silently
 * reject a question the editor can build.
 */

const option = (label: string, isCorrect: boolean, position: number) => ({
  optionJson: { label },
  isCorrect,
  position,
});

function check(input: Partial<ItemDefinitionInput> & { itemTypeKey: string }) {
  return validateItemDefinition({
    stem: "What does a hammer candle at support suggest?",
    answerKeyJson: undefined,
    options: [],
    ...input,
  });
}

function messages(input: Partial<ItemDefinitionInput> & { itemTypeKey: string }): string {
  const result = check(input);
  return result.ok ? "" : describeItemDefinitionIssues(result.issues);
}

describe("item definition contract", () => {
  it("covers every built-in item type", () => {
    expect([...VALIDATED_ITEM_TYPES].sort()).toEqual(
      [
        "fill_blank",
        "file_upload",
        "long_answer",
        "matching",
        "mcq_multi",
        "mcq_single",
        "ordering",
        "short_answer",
        "swipe",
        "true_false",
      ].sort(),
    );
  });

  it("requires the question text for every built-in type", () => {
    for (const itemTypeKey of VALIDATED_ITEM_TYPES) {
      expect(messages({ itemTypeKey, stem: "   " }), itemTypeKey).toContain("Enter the question.");
    }
  });

  it("passes extension item types through untouched", () => {
    const result = check({ itemTypeKey: "vendor.chart_read", answerKeyJson: { anything: 1 } });
    expect(result).toEqual({ ok: true, answerKey: { anything: 1 }, options: null });
  });

  describe("multiple choice (single)", () => {
    it("accepts the editor's payload and drops its option ids from the key", () => {
      // The editor names the correct option by its own temporary id; the
      // service replaces that with the stored option's id.
      const result = check({
        itemTypeKey: "mcq_single",
        answerKeyJson: { correctOptionId: "client-temp-id", explanation: "  Buyers stepped in. " },
        options: [option(" Reversal ", true, 2), option("Continuation", false, 1)],
      });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.answerKey).toEqual({ explanation: "Buyers stepped in." });
      expect(result.options).toEqual([
        { optionJson: { label: "Continuation" }, isCorrect: false, position: 1 },
        { optionJson: { label: "Reversal" }, isCorrect: true, position: 2 },
      ]);
    });

    it("needs exactly one correct option", () => {
      expect(
        messages({
          itemTypeKey: "mcq_single",
          options: [option("A", false, 1), option("B", false, 2)],
        }),
      ).toContain("Mark the correct option.");
      expect(
        messages({
          itemTypeKey: "mcq_single",
          options: [option("A", true, 1), option("B", true, 2)],
        }),
      ).toContain("Mark only one option as correct.");
    });

    it("needs 2 to 8 distinct, non-empty options", () => {
      expect(messages({ itemTypeKey: "mcq_single", options: [option("A", true, 1)] })).toContain(
        "Add at least 2 options.",
      );
      const nine = Array.from({ length: 9 }, (_, i) => option(`O${String(i)}`, i === 0, i + 1));
      expect(messages({ itemTypeKey: "mcq_single", options: nine })).toContain(
        "Use at most 8 options.",
      );
      expect(
        messages({
          itemTypeKey: "mcq_single",
          options: [option("Yes", true, 1), option(" yes ", false, 2)],
        }),
      ).toContain('Two options say "yes"');
      expect(
        messages({
          itemTypeKey: "mcq_single",
          options: [option("Yes", true, 1), option("  ", false, 2)],
        }),
      ).toContain("Option 2 is empty.");
    });
  });

  describe("multiple choice (multi)", () => {
    it("accepts several correct options and needs at least one", () => {
      expect(
        check({
          itemTypeKey: "mcq_multi",
          answerKeyJson: { correctOptionIds: ["stale-1", "stale-2"] },
          options: [option("A", true, 1), option("B", true, 2), option("C", false, 3)],
        }).ok,
      ).toBe(true);
      expect(
        messages({
          itemTypeKey: "mcq_multi",
          options: [option("A", false, 1), option("B", false, 2)],
        }),
      ).toContain("Mark at least one option as correct.");
    });
  });

  it("true / false needs a boolean", () => {
    expect(check({ itemTypeKey: "true_false", answerKeyJson: { value: false } })).toMatchObject({
      ok: true,
      answerKey: { value: false },
    });
    expect(messages({ itemTypeKey: "true_false", answerKeyJson: { value: "TRUE" } })).toContain(
      "Choose True or False.",
    );
  });

  describe("fill in the blank", () => {
    it("drops the editor's empty rows and repeated answers", () => {
      const result = check({
        itemTypeKey: "fill_blank",
        answerKeyJson: { acceptedValues: [" Doji ", "", "doji", "spinning top"] },
      });
      expect(result).toMatchObject({
        ok: true,
        answerKey: { acceptedValues: ["Doji", "spinning top"] },
      });
    });

    it("reads an older single `value` key", () => {
      expect(check({ itemTypeKey: "fill_blank", answerKeyJson: { value: "Doji" } })).toMatchObject({
        ok: true,
        answerKey: { acceptedValues: ["Doji"] },
      });
    });

    it("needs at least one accepted answer", () => {
      expect(
        messages({ itemTypeKey: "fill_blank", answerKeyJson: { acceptedValues: ["", " "] } }),
      ).toContain("Add at least one accepted answer.");
    });
  });

  it("short and long answers need nothing, but keep a rubric and model answer", () => {
    for (const itemTypeKey of ["short_answer", "long_answer"]) {
      expect(check({ itemTypeKey, answerKeyJson: { rubric: "", modelAnswer: "" } })).toMatchObject({
        ok: true,
        answerKey: {},
      });
      expect(
        check({
          itemTypeKey,
          answerKeyJson: { rubric: " Names the pattern. ", modelAnswer: "Doji" },
        }),
      ).toMatchObject({
        ok: true,
        answerKey: { rubric: "Names the pattern.", modelAnswer: "Doji" },
      });
    }
  });

  it("file upload cleans file extensions and rejects anything that is not one", () => {
    expect(
      check({
        itemTypeKey: "file_upload",
        answerKeyJson: { acceptedFileTypes: [".PDF", "png", "pdf", ""] },
      }),
    ).toMatchObject({ ok: true, answerKey: { acceptedFileTypes: ["pdf", "png"] } });
    expect(
      messages({ itemTypeKey: "file_upload", answerKeyJson: { acceptedFileTypes: ["my file"] } }),
    ).toContain('"my file" is not a file extension');
  });

  describe("matching", () => {
    const editorKey = {
      pairs: { "left-1": "right-2", "left-2": "right-1" },
      leftItems: { "left-1": "Hammer", "left-2": "Shooting star" },
      rightItems: { "right-1": "Bearish reversal", "right-2": "Bullish reversal" },
    };

    it("accepts the editor's pairs and labels", () => {
      expect(check({ itemTypeKey: "matching", answerKeyJson: editorKey })).toMatchObject({
        ok: true,
        answerKey: editorKey,
      });
    });

    it("rejects too few pairs, missing items, empty and repeated labels", () => {
      expect(
        messages({
          itemTypeKey: "matching",
          answerKeyJson: { ...editorKey, pairs: { "left-1": "right-2" } },
        }),
      ).toContain("Add at least 2 matching pairs.");
      expect(
        messages({
          itemTypeKey: "matching",
          answerKeyJson: { ...editorKey, pairs: { "left-1": "right-9", "left-2": "right-1" } },
        }),
      ).toContain("A pair points at an item that does not exist.");
      expect(
        messages({
          itemTypeKey: "matching",
          answerKeyJson: { ...editorKey, rightItems: { "right-1": "Same", "right-2": "same" } },
        }),
      ).toContain('Two right items say "same"');
      expect(messages({ itemTypeKey: "matching", answerKeyJson: { pairs: {} } })).toContain(
        "Each pair needs a left item and a right item.",
      );
    });
  });

  describe("ordering", () => {
    const editorKey = {
      order: ["step-b", "step-a", "step-c"],
      items: { "step-a": "Mark the level", "step-b": "Wait for the close", "step-c": "Enter" },
    };

    it("accepts the editor's order and step text", () => {
      expect(check({ itemTypeKey: "ordering", answerKeyJson: editorKey })).toMatchObject({
        ok: true,
        answerKey: editorKey,
      });
    });

    it("rejects too few, repeated, mismatched and empty steps", () => {
      expect(
        messages({ itemTypeKey: "ordering", answerKeyJson: { order: ["a"], items: { a: "One" } } }),
      ).toContain("Add at least 2 steps.");
      expect(
        messages({
          itemTypeKey: "ordering",
          answerKeyJson: { order: ["a", "a"], items: { a: "One", b: "Two" } },
        }),
      ).toContain("A step appears twice in the order.");
      expect(
        messages({
          itemTypeKey: "ordering",
          answerKeyJson: { order: ["a", "b"], items: { a: "One", b: " " } },
        }),
      ).toContain("A step is empty.");
    });
  });

  it("swipe needs Known or Unknown", () => {
    expect(check({ itemTypeKey: "swipe", answerKeyJson: { direction: "right" } })).toMatchObject({
      ok: true,
      answerKey: { direction: "right" },
    });
    expect(messages({ itemTypeKey: "swipe", answerKeyJson: {} })).toContain(
      "Choose Known (swipe right) or Unknown (swipe left).",
    );
  });

  it("limits the question and explanation length", () => {
    expect(
      messages({
        itemTypeKey: "true_false",
        stem: "x".repeat(ITEM_DEFINITION_LIMITS.stemMaxLength + 1),
        answerKeyJson: { value: true },
      }),
    ).toContain("The question is longer than");
    expect(
      messages({
        itemTypeKey: "true_false",
        answerKeyJson: {
          value: true,
          explanation: "x".repeat(ITEM_DEFINITION_LIMITS.explanationMaxLength + 1),
        },
      }),
    ).toContain("The explanation is longer than");
  });
});
