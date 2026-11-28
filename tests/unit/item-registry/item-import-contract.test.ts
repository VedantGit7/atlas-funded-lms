import { describe, expect, it } from "vitest";
import { VALIDATED_ITEM_TYPES } from "../../../backend/apps/api/src/server/item-registry/item-definition.contract";
import {
  ITEM_IMPORT_MAX_ROWS,
  isBlankImportRow,
  itemImportColumns,
  itemImportExamples,
  itemImportInstructions,
  rowToItemDefinition,
  type ImportRow,
} from "../../../backend/apps/api/src/server/item-registry/item-import.contract";

/**
 * The spreadsheet format for importing questions. The template, the browser
 * preview and the import all use these columns and `rowToItemDefinition`, so
 * these tests pin both directions: every example in a template is a valid
 * question, and every common spreadsheet mistake is reported on its column.
 */

const dimensions = [
  { id: "11111111-1111-4111-8111-111111111111", name: "Risk" },
  { id: "22222222-2222-4222-8222-222222222222", name: "Psychology" },
];
const riskWeight = `weight:${dimensions[0]?.id ?? ""}`;

function issuesFor(type: (typeof VALIDATED_ITEM_TYPES)[number], row: ImportRow) {
  const result = rowToItemDefinition(type, row, dimensions);
  return result.ok ? [] : result.issues;
}

describe("item import columns", () => {
  it.each(VALIDATED_ITEM_TYPES)("%s has a usable column layout", (type) => {
    const columns = itemImportColumns(type, dimensions);
    const keys = columns.map((column) => column.key);

    expect(new Set(keys).size).toBe(keys.length);
    expect(keys[0]).toBe("question");
    expect(columns[0]?.required).toBe(true);
    expect(keys).toEqual(expect.arrayContaining(["explanation", "tags", "reference", riskWeight]));
    for (const column of columns) {
      // Excel caps a dropdown list at 255 characters and a hint at 255.
      if (column.validation?.kind === "list") {
        expect(`"${column.validation.values.join(",")}"`.length).toBeLessThanOrEqual(255);
      }
      expect(column.help.length).toBeLessThanOrEqual(255);
      // No dashes in copy that people read.
      expect(column.help).not.toMatch(/[–—]/);
    }
  });

  it("names each academy dimension in a weight column", () => {
    const columns = itemImportColumns("true_false", dimensions);
    expect(columns.filter((column) => column.key.startsWith("weight:"))).toEqual([
      expect.objectContaining({ header: "Weight: Risk", format: "number" }),
      expect.objectContaining({ header: "Weight: Psychology", format: "number" }),
    ]);
    expect(
      itemImportColumns("true_false", []).some((column) => column.key.startsWith("weight:")),
    ).toBe(false);
  });

  it.each(VALIDATED_ITEM_TYPES)("%s instructions mention the row limit", (type) => {
    const text = itemImportInstructions(type).join(" ");
    expect(text).toContain(ITEM_IMPORT_MAX_ROWS.toLocaleString("en"));
    expect(text).not.toMatch(/[–—]/);
  });
});

describe("item import examples", () => {
  it.each(VALIDATED_ITEM_TYPES)("%s example imports as a valid question", (type) => {
    const examples = itemImportExamples(type);
    expect(examples.length).toBeGreaterThan(0);
    for (const example of examples) {
      const result = rowToItemDefinition(type, example, dimensions);
      expect(result.ok ? [] : result.issues).toEqual([]);
    }
  });

  it("imports each type with the answer the author meant", () => {
    const mcq = rowToItemDefinition("mcq_single", itemImportExamples("mcq_single")[0] ?? {}, []);
    expect(
      mcq.ok && mcq.item.options.filter((o) => o.isCorrect).map((o) => o.optionJson.label),
    ).toEqual(["Hammer"]);

    const multi = rowToItemDefinition("mcq_multi", itemImportExamples("mcq_multi")[0] ?? {}, []);
    expect(
      multi.ok && multi.item.options.filter((o) => o.isCorrect).map((o) => o.optionJson.label),
    ).toEqual(["Entry rules", "Risk per trade", "Exit rules"]);

    const tf = rowToItemDefinition("true_false", itemImportExamples("true_false")[0] ?? {}, []);
    expect(tf.ok && tf.item.answerKeyJson["value"]).toBe(false);

    const matching = rowToItemDefinition("matching", itemImportExamples("matching")[0] ?? {}, []);
    expect(matching.ok && matching.item.answerKeyJson).toMatchObject({
      pairs: { "left-1": "right-1", "left-2": "right-2", "left-3": "right-3" },
      leftItems: { "left-1": "Hammer" },
      rightItems: { "right-1": "Bullish reversal", "right-4": "Trend continuation" },
    });

    const ordering = rowToItemDefinition("ordering", itemImportExamples("ordering")[0] ?? {}, []);
    expect(ordering.ok && ordering.item.answerKeyJson["order"]).toEqual([
      "step-1",
      "step-2",
      "step-3",
      "step-4",
    ]);

    const swipe = rowToItemDefinition("swipe", itemImportExamples("swipe")[0] ?? {}, []);
    expect(swipe.ok && swipe.item.answerKeyJson["direction"]).toBe("right");
  });
});

describe("reading a spreadsheet row", () => {
  const mcqRow = (overrides: ImportRow = {}): ImportRow => ({
    question: "Which is a bullish reversal?",
    option_a: "Hammer",
    option_b: "Shooting star",
    correct_option: "A",
    ...overrides,
  });

  it("reads Excel's own values: booleans, numbers and lower-case letters", () => {
    expect(
      rowToItemDefinition(
        "true_false",
        { question: "Statement", correct_answer: true },
        dimensions,
      ),
    ).toMatchObject({ ok: true, item: { answerKeyJson: { value: true } } });
    expect(
      rowToItemDefinition("fill_blank", { question: "2 + 2 = ____", blank_1: 4 }, dimensions),
    ).toMatchObject({ ok: true, item: { answerKeyJson: { acceptedValues: ["4"] } } });
    expect(
      rowToItemDefinition("mcq_single", mcqRow({ correct_option: " b " }), dimensions),
    ).toMatchObject({ ok: true });
  });

  it("reports a correct option that is not a letter, or points at an empty option", () => {
    expect(issuesFor("mcq_single", mcqRow({ correct_option: "Z" }))).toEqual([
      { columns: ["correct_option"], message: '"Z" is not a letter from A to H.' },
    ]);
    expect(issuesFor("mcq_single", mcqRow({ correct_option: "C" }))).toEqual([
      {
        columns: ["option_c", "correct_option"],
        message: "The correct option is C, but Option C is empty.",
      },
    ]);
    expect(issuesFor("mcq_multi", mcqRow({ correct_options: "A, X" }))[0]?.message).toBe(
      '"X" is not a letter from A to H.',
    );
  });

  it("reports a date where text belongs", () => {
    expect(
      issuesFor("fill_blank", { question: "Q", blank_1: new Date(2026, 0, 2) })[0],
    ).toMatchObject({
      columns: ["blank_1"],
      message: expect.stringContaining("contains a date"),
    });
  });

  it("reports weights outside 0 to 1 and keeps valid ones", () => {
    expect(
      issuesFor("true_false", { question: "Q", correct_answer: "TRUE", [riskWeight]: 50 }),
    ).toEqual([
      {
        columns: [riskWeight],
        message: "Weight: Risk must be from 0 to 1, for example 0.5 for half.",
      },
    ]);
    expect(
      rowToItemDefinition(
        "true_false",
        { question: "Q", correct_answer: "TRUE", [riskWeight]: "0.25" },
        dimensions,
      ),
    ).toMatchObject({
      ok: true,
      item: { weights: [{ dimensionId: dimensions[0]?.id, weight: 0.25 }] },
    });
  });

  it("reports half-filled matching pairs and gaps between steps", () => {
    expect(
      issuesFor("matching", {
        question: "Q",
        left_1: "A",
        right_1: "1",
        left_2: "B",
        right_2: "2",
        left_3: "C",
      })[0],
    ).toEqual({
      columns: ["left_3", "right_3"],
      message: "Pair 3 needs both a left and a right item.",
    });
    expect(
      issuesFor("ordering", { question: "Q", step_1: "One", step_2: "Two", step_4: "Four" })[0],
    ).toEqual({
      columns: ["step_3"],
      message: "Step 3 is empty, but a later step is filled. Fill steps without gaps.",
    });
  });

  it("splits, cleans and de-duplicates tags", () => {
    expect(
      rowToItemDefinition(
        "true_false",
        { question: "Q", correct_answer: "FALSE", tags: " risk, Beginner ;beginner\nstops " },
        [],
      ),
    ).toMatchObject({ ok: true, item: { tags: ["risk", "Beginner", "stops"] } });
  });

  it("maps question rule failures back onto the right columns", () => {
    expect(issuesFor("mcq_single", mcqRow({ option_b: "hammer" }))).toEqual([
      {
        columns: [
          "option_a",
          "option_b",
          "option_c",
          "option_d",
          "option_e",
          "option_f",
          "option_g",
          "option_h",
        ],
        message: 'Two options say "hammer". Make each option different.',
      },
    ]);
    expect(issuesFor("swipe", { question: "  " })).toEqual(
      expect.arrayContaining([{ columns: ["question"], message: "Enter the question." }]),
    );
  });

  it("recognises an empty row, including one with only spaces", () => {
    expect(isBlankImportRow({ question: "  ", tags: null, option_a: undefined })).toBe(true);
    expect(isBlankImportRow({ question: "Q" })).toBe(false);
  });
});
