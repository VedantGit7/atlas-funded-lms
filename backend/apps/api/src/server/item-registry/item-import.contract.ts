import {
  ITEM_DEFINITION_LIMITS,
  VALIDATED_ITEM_TYPES,
  validateItemDefinition,
  type ValidatedItemTypeKey,
} from "./item-definition.contract";

/**
 * The spreadsheet format for importing questions, one template per question
 * type. The server builds the template from these columns, the browser reads
 * an upload with them, and both turn a row into a question with
 * `rowToItemDefinition`, which then goes through the same
 * `validateItemDefinition` the item service enforces. One description of the
 * format, so the template, the preview and the import cannot disagree.
 *
 * It is a contract (synced to the web app), so it imports only other
 * contracts.
 */

export const ITEM_IMPORT_FORMAT = "atlas-item-import";
/** Bump when columns change; an upload from another version is refused. */
export const ITEM_IMPORT_TEMPLATE_VERSION = "1";
/** Questions per file (owner decision, 19 Nov 2026). */
export const ITEM_IMPORT_MAX_ROWS = 5_000;
export const ITEM_IMPORT_MAX_TAGS = 50;
export const ITEM_IMPORT_TAG_MAX_LENGTH = 64;
export const ITEM_IMPORT_REFERENCE_MAX_LENGTH = 120;

const OPTION_LETTERS = ["A", "B", "C", "D", "E", "F", "G", "H"] as const;
const MATCHING_PAIRS = 8;
const MATCHING_EXTRA_RIGHT = 3;
const ORDERING_STEPS = 10;
const FILL_BLANK_ANSWERS = 5;

export const TRUE_FALSE_VALUES = ["TRUE", "FALSE"] as const;
export const SWIPE_VALUES = ["Known (right)", "Unknown (left)"] as const;

export type ImportCell = string | number | boolean | Date | null | undefined;
export type ImportRow = Record<string, ImportCell>;

export type ImportColumnValidation =
  | { kind: "list"; values: string[] }
  | { kind: "decimal"; min: number; max: number }
  | { kind: "textLength"; max: number };

export type ImportColumn = {
  /** Stable key, used to read the column back. */
  key: string;
  header: string;
  required: boolean;
  help: string;
  width: number;
  format: "text" | "number";
  validation?: ImportColumnValidation;
};

export type ImportDimension = { id: string; name: string };

export type ImportedItem = {
  itemTypeKey: ValidatedItemTypeKey;
  contentJson: { stem: string };
  answerKeyJson: Record<string, unknown>;
  options: Array<{ optionJson: { label: string }; isCorrect: boolean; position: number }>;
  tags: string[];
  reference: string | null;
  weights: Array<{ dimensionId: string; weight: number }>;
};

export type ImportRowIssue = {
  /** Keys of the columns to highlight. */
  columns: string[];
  message: string;
};

export type ImportRowResult =
  | { ok: true; item: ImportedItem }
  | { ok: false; issues: ImportRowIssue[] };

export const ITEM_IMPORT_TYPE_NAMES: Record<ValidatedItemTypeKey, string> = {
  mcq_single: "Multiple choice (single)",
  mcq_multi: "Multiple choice (multi)",
  true_false: "True / False",
  fill_blank: "Fill in the blank",
  short_answer: "Short answer",
  long_answer: "Long answer",
  matching: "Matching",
  ordering: "Ordering",
  file_upload: "File upload",
  swipe: "Swipe card",
};

export function isImportableItemType(key: string): key is ValidatedItemTypeKey {
  return (VALIDATED_ITEM_TYPES as readonly string[]).includes(key);
}

const L = ITEM_DEFINITION_LIMITS;

const text = (
  key: string,
  header: string,
  required: boolean,
  help: string,
  max: number,
  width = 30,
): ImportColumn => ({
  key,
  header,
  required,
  help,
  width,
  format: "text",
  validation: { kind: "textLength", max },
});

const choice = (
  key: string,
  header: string,
  help: string,
  values: readonly string[],
): ImportColumn => ({
  key,
  header,
  required: true,
  help,
  width: 18,
  format: "text",
  validation: { kind: "list", values: [...values] },
});

const optionKey = (letter: string) => `option_${letter.toLowerCase()}`;

function typeColumns(type: ValidatedItemTypeKey): ImportColumn[] {
  switch (type) {
    case "mcq_single":
    case "mcq_multi": {
      const options = OPTION_LETTERS.map((letter, index) =>
        text(
          optionKey(letter),
          `Option ${letter}`,
          index < 2,
          index < 2
            ? `Answer choice ${letter}. Options A and B are required; add up to H.`
            : `Answer choice ${letter} (optional). Leave empty if not needed.`,
          L.optionLabelMaxLength,
          24,
        ),
      );
      return type === "mcq_single"
        ? [
            ...options,
            choice(
              "correct_option",
              "Correct option",
              "The letter of the one correct option, A to H.",
              OPTION_LETTERS,
            ),
          ]
        : [
            ...options,
            {
              ...text(
                "correct_options",
                "Correct options",
                true,
                "The letters of every correct option, separated by commas, for example: A, C",
                30,
                18,
              ),
            },
          ];
    }
    case "true_false":
      return [
        choice(
          "correct_answer",
          "Correct answer",
          "TRUE if the statement is true, FALSE if it is false.",
          TRUE_FALSE_VALUES,
        ),
      ];
    case "fill_blank":
      return Array.from({ length: FILL_BLANK_ANSWERS }, (_, index) =>
        text(
          `accepted_${String(index + 1)}`,
          `Accepted answer ${String(index + 1)}`,
          index === 0,
          index === 0
            ? "An answer that counts as correct. Capitals and spaces around it are ignored when marking."
            : "Another answer that also counts as correct (optional).",
          L.acceptedValueMaxLength,
          22,
        ),
      );
    case "short_answer":
    case "long_answer":
      return [
        text(
          "model_answer",
          "Model answer",
          false,
          "An example of a good answer, shown to graders (optional).",
          L.rubricMaxLength,
          40,
        ),
        text(
          "rubric",
          "Grading rubric",
          false,
          "What graders should look for (optional).",
          L.rubricMaxLength,
          40,
        ),
      ];
    case "file_upload":
      return [
        text(
          "rubric",
          "Grading rubric",
          false,
          "What graders should look for (optional).",
          L.rubricMaxLength,
          40,
        ),
        text(
          "accepted_file_types",
          "Accepted file types",
          false,
          "File extensions learners may upload, separated by commas, for example: pdf, png. Leave empty to allow any.",
          200,
          22,
        ),
        text(
          "reference_file_name",
          "Reference file name",
          false,
          "The name of a reference file for graders (optional).",
          L.rubricMaxLength,
          24,
        ),
      ];
    case "matching": {
      const pairs = Array.from({ length: MATCHING_PAIRS }, (_, index) => {
        const n = String(index + 1);
        const required = index < 2;
        return [
          text(
            `left_${n}`,
            `Left ${n}`,
            required,
            `The item to match in pair ${n}${required ? "" : " (optional)"}.`,
            L.matchingLabelMaxLength,
            22,
          ),
          text(
            `right_${n}`,
            `Right ${n}`,
            required,
            `What Left ${n} matches${required ? "" : " (optional)"}.`,
            L.matchingLabelMaxLength,
            22,
          ),
        ];
      }).flat();
      const extras = Array.from({ length: MATCHING_EXTRA_RIGHT }, (_, index) =>
        text(
          `extra_right_${String(index + 1)}`,
          `Extra right ${String(index + 1)}`,
          false,
          "A wrong choice shown on the right side to make the question harder (optional).",
          L.matchingLabelMaxLength,
          22,
        ),
      );
      return [...pairs, ...extras];
    }
    case "ordering":
      return Array.from({ length: ORDERING_STEPS }, (_, index) =>
        text(
          `step_${String(index + 1)}`,
          `Step ${String(index + 1)}`,
          index < 2,
          index < 2
            ? `Step ${String(index + 1)} in the correct order. At least two steps are required.`
            : `Step ${String(index + 1)} in the correct order (optional). Fill steps without gaps.`,
          L.stepLabelMaxLength,
          24,
        ),
      );
    case "swipe":
      return [
        choice(
          "correct_swipe",
          "Correct swipe",
          "Known (right) if learners should know this card, Unknown (left) if not.",
          SWIPE_VALUES,
        ),
      ];
  }
}

export function itemImportColumns(
  type: ValidatedItemTypeKey,
  dimensions: ImportDimension[],
): ImportColumn[] {
  return [
    text(
      "question",
      "Question",
      true,
      "The question exactly as learners will see it.",
      L.stemMaxLength,
      50,
    ),
    ...typeColumns(type),
    text(
      "explanation",
      "Explanation",
      false,
      "Shown to learners after they answer: why the correct answer is right (optional).",
      L.explanationMaxLength,
      40,
    ),
    text(
      "tags",
      "Tags",
      false,
      "Words for filtering, separated by commas, for example: candlesticks, beginner (optional).",
      2_000,
      24,
    ),
    text(
      "reference",
      "Your reference",
      false,
      "Your own ID for this question, used to spot repeats when you import again (optional).",
      ITEM_IMPORT_REFERENCE_MAX_LENGTH,
      16,
    ),
    ...dimensions.map(
      (dimension): ImportColumn => ({
        key: `weight:${dimension.id}`,
        header: `Weight: ${dimension.name}`,
        required: false,
        help: `How much this question counts toward ${dimension.name}, from 0 to 1, for example 0.5 (optional).`,
        width: 16,
        format: "number",
        validation: { kind: "decimal", min: 0, max: 1 },
      }),
    ),
  ];
}

/** One complete, valid example per type, shown on the Examples sheet. */
export function itemImportExamples(type: ValidatedItemTypeKey): ImportRow[] {
  const common = (tags: string) => ({ tags, reference: "" });
  switch (type) {
    case "mcq_single":
      return [
        {
          question: "Which candlestick pattern often signals a bullish reversal at support?",
          option_a: "Hammer",
          option_b: "Shooting star",
          option_c: "Bearish engulfing",
          option_d: "Evening star",
          correct_option: "A",
          explanation: "A hammer shows sellers pushed price down and buyers pushed it back up.",
          ...common("candlesticks, beginner"),
        },
      ];
    case "mcq_multi":
      return [
        {
          question: "Which of these belong in a written trading plan?",
          option_a: "Entry rules",
          option_b: "Risk per trade",
          option_c: "A tip from a friend",
          option_d: "Exit rules",
          correct_options: "A, B, D",
          explanation: "A plan sets your own rules in advance; tips are not rules.",
          ...common("planning"),
        },
      ];
    case "true_false":
      return [
        {
          question: "A stop-loss order always fills at exactly the stop price.",
          correct_answer: "FALSE",
          explanation: "In a fast market the fill can be worse than the stop price (slippage).",
          ...common("risk"),
        },
      ];
    case "fill_blank":
      return [
        {
          question:
            "A candle where the open and close are almost equal, with no real body, is called a ____.",
          accepted_1: "Doji",
          accepted_2: "Doji candle",
          explanation: "A doji shows indecision between buyers and sellers.",
          ...common("candlesticks"),
        },
      ];
    case "short_answer":
      return [
        {
          question: "In one sentence, what is position sizing?",
          model_answer: "Choosing how much to trade so a loss stays within your risk limit.",
          rubric: "Mentions trade size and limiting the loss to a set amount or percentage.",
          ...common("risk"),
        },
      ];
    case "long_answer":
      return [
        {
          question: "Describe how you would review a losing trade.",
          model_answer:
            "Compare the trade with my plan, note what I did differently, and record one change for next time.",
          rubric:
            "Refers to the trading plan, separates the decision from the outcome, ends with an action.",
          ...common("journaling"),
        },
      ];
    case "file_upload":
      return [
        {
          question: "Upload a screenshot of your chart with support and resistance marked.",
          rubric: "At least one support and one resistance level, both clearly labelled.",
          accepted_file_types: "png, jpg, pdf",
          reference_file_name: "",
          ...common("charting"),
        },
      ];
    case "matching":
      return [
        {
          question: "Match each candlestick pattern with what it usually signals.",
          left_1: "Hammer",
          right_1: "Bullish reversal",
          left_2: "Shooting star",
          right_2: "Bearish reversal",
          left_3: "Doji",
          right_3: "Indecision",
          extra_right_1: "Trend continuation",
          ...common("candlesticks"),
        },
      ];
    case "ordering":
      return [
        {
          question: "Put the steps of placing a planned trade in order.",
          step_1: "Mark the key level",
          step_2: "Wait for a confirmation candle",
          step_3: "Place the entry and the stop-loss",
          step_4: "Record the trade in your journal",
          ...common("planning"),
        },
      ];
    case "swipe":
      return [
        {
          question: "Risk only money you can afford to lose.",
          correct_swipe: "Known (right)",
          ...common("risk"),
        },
      ];
  }
}

/** Plain-language instructions for the template's first sheet. */
export function itemImportInstructions(type: ValidatedItemTypeKey): string[] {
  const name = ITEM_IMPORT_TYPE_NAMES[type];
  const typeNotes: Record<ValidatedItemTypeKey, string[]> = {
    mcq_single: [
      "Fill Option A and Option B, and up to Option H if you need more.",
      "Correct option is the letter of the one right answer.",
    ],
    mcq_multi: [
      "Fill Option A and Option B, and up to Option H if you need more.",
      "Correct options lists every right answer's letter, separated by commas, for example: A, C.",
    ],
    true_false: ["Write the question as a statement. Correct answer is TRUE or FALSE."],
    fill_blank: [
      "Show the blank in the question with ____.",
      "Add every answer that should count as correct. Capitals and spaces around the answer are ignored when marking.",
    ],
    short_answer: ["Short answers are graded by a person. The model answer and rubric help them."],
    long_answer: ["Long answers are graded by a person. The model answer and rubric help them."],
    file_upload: [
      "Learners upload a file, and a person grades it.",
      "Accepted file types are extensions such as pdf or png, separated by commas.",
    ],
    matching: [
      "Each Left / Right pair is one correct match. Fill at least two pairs, and up to eight.",
      "Extra right items are wrong choices, to make the question harder.",
    ],
    ordering: ["Write the steps in the correct order, starting at Step 1, without gaps."],
    swipe: ["Each row is one card. Correct swipe is Known (right) or Unknown (left)."],
  };
  return [
    `This template is for ${name} questions only. Use the matching template for other types.`,
    "Fill in the Questions sheet: one question per row, starting on row 2.",
    "Columns marked * are required. Select a cell to see a hint for its column.",
    "Do not rename, move or delete the header row or its columns.",
    `Up to ${ITEM_IMPORT_MAX_ROWS.toLocaleString("en")} questions per file. Empty rows are skipped.`,
    ...typeNotes[type],
    "Tags are separated by commas. Weight columns take a number from 0 to 1 and can be left empty.",
    "The Examples sheet shows complete questions. It is never imported.",
    "Every imported question starts as a Draft, so you can review it before learners see it.",
  ];
}

// --- Reading a row ------------------------------------------------------

function cellText(value: ImportCell): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string")
    return value
      .normalize("NFC")
      .replace(/\u00a0/g, " ")
      .trim();
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "";
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
  return "";
}

export function isBlankImportRow(row: ImportRow): boolean {
  return Object.values(row).every((value) => cellText(value) === "" && !(value instanceof Date));
}

function splitList(value: string): string[] {
  return value
    .split(/[,;\n]/)
    .map((part) => part.trim())
    .filter(Boolean);
}

/** Which template columns a definition issue refers to, for highlighting. */
function columnsForField(type: ValidatedItemTypeKey, field: string): string[] {
  switch (field) {
    case "stem":
      return ["question"];
    case "explanation":
      return ["explanation"];
    case "options":
      return OPTION_LETTERS.map(optionKey);
    case "correctOption":
      return ["correct_option"];
    case "correctOptions":
      return ["correct_options"];
    case "value":
      return ["correct_answer"];
    case "acceptedValues":
      return Array.from({ length: FILL_BLANK_ANSWERS }, (_, i) => `accepted_${String(i + 1)}`);
    case "rubric":
      return ["rubric"];
    case "modelAnswer":
      return type === "file_upload" ? ["reference_file_name"] : ["model_answer"];
    case "acceptedFileTypes":
      return ["accepted_file_types"];
    case "pairs":
      return Array.from({ length: MATCHING_PAIRS }, (_, i) => [
        `left_${String(i + 1)}`,
        `right_${String(i + 1)}`,
      ]).flat();
    case "order":
      return Array.from({ length: ORDERING_STEPS }, (_, i) => `step_${String(i + 1)}`);
    case "direction":
      return ["correct_swipe"];
    default:
      return [];
  }
}

/**
 * Turns one spreadsheet row into a question, or into the reasons it cannot
 * be one. Formatting problems (a date where text belongs, an unknown option
 * letter, a weight that is not a number) are reported per column; the
 * question itself is then checked by `validateItemDefinition`.
 */
export function rowToItemDefinition(
  type: ValidatedItemTypeKey,
  row: ImportRow,
  dimensions: ImportDimension[],
): ImportRowResult {
  const issues: ImportRowIssue[] = [];
  const issue = (columns: string[], message: string) => {
    issues.push({ columns, message });
  };
  const columns = itemImportColumns(type, dimensions);

  for (const column of columns) {
    if (row[column.key] instanceof Date) {
      issue(
        [column.key],
        `${column.header} contains a date. Format the column as text and type the value again.`,
      );
    }
  }
  const get = (key: string) => cellText(row[key]);

  const stem = get("question");
  const explanation = get("explanation");
  const answerKey: Record<string, unknown> = {};
  let options: ImportedItem["options"] = [];

  switch (type) {
    case "mcq_single":
    case "mcq_multi": {
      const filled = OPTION_LETTERS.flatMap((letter) => {
        const label = get(optionKey(letter));
        return label ? [{ letter, label }] : [];
      });
      const correctLetters: string[] = [];
      if (type === "mcq_single") {
        const raw = get("correct_option");
        const match = /^(?:option\s*)?([a-h])$/i.exec(raw);
        if (!raw) issue(["correct_option"], "Enter the letter of the correct option.");
        else if (!match) issue(["correct_option"], `"${raw}" is not a letter from A to H.`);
        else correctLetters.push((match[1] ?? "").toUpperCase());
      } else {
        const raw = get("correct_options");
        const parts = splitList(raw.replace(/\s+/g, ",")).map((part) => part.toUpperCase());
        if (parts.length === 0)
          issue(["correct_options"], "Enter the letters of the correct options, such as A, C.");
        for (const part of parts) {
          if (!(OPTION_LETTERS as readonly string[]).includes(part)) {
            issue(["correct_options"], `"${part}" is not a letter from A to H.`);
          } else if (!correctLetters.includes(part)) {
            correctLetters.push(part);
          }
        }
      }
      for (const letter of correctLetters) {
        if (!filled.some((option) => option.letter === letter)) {
          issue(
            [optionKey(letter), type === "mcq_single" ? "correct_option" : "correct_options"],
            `The correct option is ${letter}, but Option ${letter} is empty.`,
          );
        }
      }
      options = filled.map((option, index) => ({
        optionJson: { label: option.label },
        isCorrect: correctLetters.includes(option.letter),
        position: index + 1,
      }));
      break;
    }

    case "true_false": {
      const raw = get("correct_answer").toUpperCase();
      if (raw === "TRUE") answerKey["value"] = true;
      else if (raw === "FALSE") answerKey["value"] = false;
      else if (!raw) issue(["correct_answer"], "Enter TRUE or FALSE.");
      else issue(["correct_answer"], `"${get("correct_answer")}" is not TRUE or FALSE.`);
      break;
    }

    case "fill_blank":
      answerKey["acceptedValues"] = Array.from({ length: FILL_BLANK_ANSWERS }, (_, i) =>
        get(`accepted_${String(i + 1)}`),
      );
      break;

    case "short_answer":
    case "long_answer":
      answerKey["modelAnswer"] = get("model_answer");
      answerKey["rubric"] = get("rubric");
      break;

    case "file_upload":
      answerKey["rubric"] = get("rubric");
      answerKey["modelAnswer"] = get("reference_file_name");
      answerKey["acceptedFileTypes"] = splitList(get("accepted_file_types"));
      break;

    case "matching": {
      const pairs: Record<string, string> = {};
      const leftItems: Record<string, string> = {};
      const rightItems: Record<string, string> = {};
      const rightIdFor = (label: string) => {
        const existing = Object.entries(rightItems).find(
          ([, other]) => other.toLocaleLowerCase() === label.toLocaleLowerCase(),
        );
        if (existing) return existing[0];
        const id = `right-${String(Object.keys(rightItems).length + 1)}`;
        rightItems[id] = label;
        return id;
      };
      for (let index = 1; index <= MATCHING_PAIRS; index += 1) {
        const n = String(index);
        const left = get(`left_${n}`);
        const right = get(`right_${n}`);
        if (!left && !right) continue;
        if (!left || !right) {
          issue([`left_${n}`, `right_${n}`], `Pair ${n} needs both a left and a right item.`);
          continue;
        }
        const leftId = `left-${n}`;
        leftItems[leftId] = left;
        pairs[leftId] = rightIdFor(right);
      }
      for (let index = 1; index <= MATCHING_EXTRA_RIGHT; index += 1) {
        const extra = get(`extra_right_${String(index)}`);
        if (!extra) continue;
        const before = Object.keys(rightItems).length;
        const id = rightIdFor(extra);
        if (Object.keys(rightItems).length === before && Object.values(pairs).includes(id)) {
          issue(
            [`extra_right_${String(index)}`],
            `Extra right ${String(index)} repeats a right item that is already a correct match.`,
          );
        }
      }
      answerKey["pairs"] = pairs;
      answerKey["leftItems"] = leftItems;
      answerKey["rightItems"] = rightItems;
      break;
    }

    case "ordering": {
      const order: string[] = [];
      const items: Record<string, string> = {};
      let gapAt: number | null = null;
      for (let index = 1; index <= ORDERING_STEPS; index += 1) {
        const step = get(`step_${String(index)}`);
        if (!step) {
          gapAt ??= index;
          continue;
        }
        if (gapAt !== null) {
          issue(
            [`step_${String(gapAt)}`],
            `Step ${String(gapAt)} is empty, but a later step is filled. Fill steps without gaps.`,
          );
          gapAt = null;
        }
        const id = `step-${String(index)}`;
        order.push(id);
        items[id] = step;
      }
      answerKey["order"] = order;
      answerKey["items"] = items;
      break;
    }

    case "swipe": {
      const raw = get("correct_swipe").toLowerCase();
      if (raw === "known (right)" || raw === "known" || raw === "right")
        answerKey["direction"] = "right";
      else if (raw === "unknown (left)" || raw === "unknown" || raw === "left")
        answerKey["direction"] = "left";
      else if (!raw) issue(["correct_swipe"], "Choose Known (right) or Unknown (left).");
      else
        issue(
          ["correct_swipe"],
          `"${get("correct_swipe")}" is not Known (right) or Unknown (left).`,
        );
      break;
    }
  }

  if (explanation) answerKey["explanation"] = explanation;

  // Tags, reference and weights.
  const tags: string[] = [];
  for (const tag of splitList(get("tags"))) {
    if (tag.length > ITEM_IMPORT_TAG_MAX_LENGTH) {
      issue(
        ["tags"],
        `The tag "${tag}" is longer than ${String(ITEM_IMPORT_TAG_MAX_LENGTH)} characters.`,
      );
    } else if (!tags.some((other) => other.toLocaleLowerCase() === tag.toLocaleLowerCase())) {
      tags.push(tag);
    }
  }
  if (tags.length > ITEM_IMPORT_MAX_TAGS) {
    issue(["tags"], `Use at most ${String(ITEM_IMPORT_MAX_TAGS)} tags.`);
  }

  const reference = get("reference");
  if (reference.length > ITEM_IMPORT_REFERENCE_MAX_LENGTH) {
    issue(
      ["reference"],
      `Your reference is longer than ${String(ITEM_IMPORT_REFERENCE_MAX_LENGTH)} characters.`,
    );
  }

  const weights: ImportedItem["weights"] = [];
  for (const dimension of dimensions) {
    const key = `weight:${dimension.id}`;
    const raw = row[key];
    const textValue = cellText(raw);
    if (textValue === "") continue;
    const weight = typeof raw === "number" ? raw : Number(textValue);
    if (!Number.isFinite(weight)) {
      issue([key], `Weight: ${dimension.name} must be a number from 0 to 1.`);
    } else if (weight < 0 || weight > 1) {
      issue(
        [key],
        `Weight: ${dimension.name} must be from 0 to 1${weight > 1 && weight <= 100 ? ", for example 0.5 for half" : ""}.`,
      );
    } else {
      weights.push({ dimensionId: dimension.id, weight });
    }
  }

  // The question itself, by the same rules as everywhere else.
  const definition = validateItemDefinition({
    itemTypeKey: type,
    stem,
    answerKeyJson: answerKey,
    options,
  });
  if (!definition.ok) {
    for (const entry of definition.issues) {
      const entryColumns = columnsForField(type, entry.field);
      // A column already reported for a formatting problem gets no second,
      // vaguer message about the same mistake.
      const alreadyReported = issues.some(
        (existing) =>
          existing.message === entry.message ||
          existing.columns.some((column) => entryColumns.includes(column)),
      );
      if (alreadyReported) continue;
      issue(entryColumns, entry.message);
    }
  }

  if (issues.length > 0 || !definition.ok) return { ok: false, issues };

  return {
    ok: true,
    item: {
      itemTypeKey: type,
      contentJson: { stem },
      answerKeyJson: definition.answerKey,
      options: (definition.options ?? []).map((option) => ({
        optionJson: { label: option.optionJson.label },
        isCorrect: option.isCorrect,
        position: option.position,
      })),
      tags,
      reference: reference || null,
      weights,
    },
  };
}
