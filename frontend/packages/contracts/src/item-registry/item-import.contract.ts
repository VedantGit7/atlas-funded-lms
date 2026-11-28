import {
  ANSWER_FILE_LIMITS,
  ANSWER_FILE_TYPES,
  ANSWER_RULE_LIMITS,
  DEFAULT_ANSWER_FILE_TYPES,
} from "./answer-rules.contract";
import {
  ITEM_DEFINITION_LIMITS,
  VALIDATED_ITEM_TYPES,
  validateItemDefinition,
  type ValidatedItemTypeKey,
} from "./item-definition.contract";

/**
 * The spreadsheet format for importing questions: one template per question
 * type, and a mixed template whose rows say their own type (QA review 2 4.1,
 * S3.4b). The server builds the template from these columns, the browser reads
 * an upload with them, and both turn a row into a question with
 * `rowToItemDefinition`, which then goes through the same
 * `validateItemDefinition` the item service enforces. One description of the
 * format, so the template, the preview and the import cannot disagree.
 *
 * It is a contract (synced to the web app), so it imports only other
 * contracts.
 */

export const ITEM_IMPORT_FORMAT = "atlas-item-import";
/**
 * Bump when columns change; an upload from another version is refused.
 * 2 (S3.4b): fill in the blank takes answers per blank, short answer takes
 * keywords, long answer a word limit, and the mixed template exists.
 * 3 (S3.4c): file upload takes the largest file size.
 */
export const ITEM_IMPORT_TEMPLATE_VERSION = "3";
/** Questions per file (owner decision, 19 Nov 2026). */
export const ITEM_IMPORT_MAX_ROWS = 5_000;
export const ITEM_IMPORT_MAX_TAGS = 50;
export const ITEM_IMPORT_TAG_MAX_LENGTH = 64;
export const ITEM_IMPORT_REFERENCE_MAX_LENGTH = 120;

const OPTION_LETTERS = ["A", "B", "C", "D", "E", "F", "G", "H"] as const;
const MATCHING_PAIRS = 8;
const MATCHING_EXTRA_RIGHT = 3;
const ORDERING_STEPS = 10;
const FILL_BLANK_BLANKS = 5;

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

/** The template whose rows can be any type, each naming its own (S3.4b). */
export const ITEM_IMPORT_MIXED = "mixed";

/** A template: one question type, or mixed. */
export type ImportTemplateType = ValidatedItemTypeKey | typeof ITEM_IMPORT_MIXED;

export const ITEM_IMPORT_TEMPLATE_TYPES = [...VALIDATED_ITEM_TYPES, ITEM_IMPORT_MIXED] as const;

export function isImportTemplateType(key: string): key is ImportTemplateType {
  return key === ITEM_IMPORT_MIXED || isImportableItemType(key);
}

/** What a template is called, for messages and the download's name. */
export function importTemplateName(type: ImportTemplateType): string {
  return type === ITEM_IMPORT_MIXED ? "Mixed (any type)" : ITEM_IMPORT_TYPE_NAMES[type];
}

/** The question type a mixed template's row names: its name, or its key. */
export function readImportRowType(value: string): ValidatedItemTypeKey | null {
  const wanted = value.trim().toLocaleLowerCase();
  if (!wanted) return null;
  for (const type of VALIDATED_ITEM_TYPES) {
    if (
      ITEM_IMPORT_TYPE_NAMES[type].toLocaleLowerCase() === wanted ||
      type === wanted.replace(/[\s/-]+/g, "_")
    ) {
      return type;
    }
  }
  return null;
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
      return Array.from({ length: FILL_BLANK_BLANKS }, (_, index) =>
        text(
          `blank_${String(index + 1)}`,
          `Blank ${String(index + 1)} answers`,
          index === 0,
          index === 0
            ? "Every answer that counts as right for the first blank, separated by semicolons, for example: Doji; Doji candle. Capitals and extra spaces are ignored."
            : `Answers for blank ${String(index + 1)}, if the question has that many blanks (optional).`,
          2_000,
          24,
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
        ...(type === "short_answer"
          ? [
              text(
                "keywords",
                "Keywords",
                false,
                "Words or phrases that mark the answer automatically, separated by semicolons, for example: stop loss; risk (optional). Leave empty for a person to mark it.",
                2_000,
                30,
              ),
              {
                key: "keywords_needed",
                header: "Keywords needed",
                required: false,
                help: "How many of the keywords an answer needs for full marks (optional; all of them if empty).",
                width: 14,
                format: "number" as const,
                validation: {
                  kind: "decimal" as const,
                  min: 1,
                  max: ANSWER_RULE_LIMITS.maxKeywords,
                },
              },
            ]
          : [
              {
                key: "max_words",
                header: "Word limit",
                required: false,
                help: "The most words an answer may have (optional; no limit if empty).",
                width: 12,
                format: "number" as const,
                validation: {
                  kind: "decimal" as const,
                  min: 1,
                  max: ANSWER_RULE_LIMITS.maxWordLimit,
                },
              },
            ]),
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
          `File extensions learners may upload, separated by commas, for example: pdf, png. Choose from ${Object.keys(ANSWER_FILE_TYPES).join(", ")}. Leave empty for ${DEFAULT_ANSWER_FILE_TYPES.join(", ")}.`,
          200,
          22,
        ),
        {
          key: "max_file_size_mb",
          header: "Largest file (MB)",
          required: false,
          help: `The largest file a learner may upload, in MB, from 1 to ${String(ANSWER_FILE_LIMITS.maxMb)} (optional; ${String(ANSWER_FILE_LIMITS.defaultMaxMb)} if empty).`,
          width: 14,
          format: "number" as const,
          validation: { kind: "decimal" as const, min: 1, max: ANSWER_FILE_LIMITS.maxMb },
        },
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

/**
 * The mixed template's own columns: every type's columns once each, saying
 * which types use them. A row fills only the ones its type needs.
 */
function mixedTypeColumns(): ImportColumn[] {
  const byKey = new Map<string, { column: ImportColumn; types: ValidatedItemTypeKey[] }>();
  for (const type of VALIDATED_ITEM_TYPES) {
    for (const column of typeColumns(type)) {
      const entry = byKey.get(column.key);
      if (entry) entry.types.push(type);
      else byKey.set(column.key, { column, types: [type] });
    }
  }
  return [...byKey.values()].map(({ column, types }) => ({
    ...column,
    required: false,
    help: `${types.map((type) => ITEM_IMPORT_TYPE_NAMES[type]).join(", ")}: ${column.help}`,
  }));
}

export function itemImportColumns(
  type: ImportTemplateType,
  dimensions: ImportDimension[],
): ImportColumn[] {
  const typeNames = VALIDATED_ITEM_TYPES.map((key) => ITEM_IMPORT_TYPE_NAMES[key]);
  return [
    ...(type === ITEM_IMPORT_MIXED
      ? [
          choice(
            "question_type",
            "Question type",
            "The type of this question. Choose from the list; fill only the columns that type uses.",
            typeNames,
          ),
        ]
      : []),
    text(
      "question",
      "Question",
      true,
      "The question exactly as learners will see it.",
      L.stemMaxLength,
      50,
    ),
    ...(type === ITEM_IMPORT_MIXED ? mixedTypeColumns() : typeColumns(type)),
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
export function itemImportExamples(type: ImportTemplateType): ImportRow[] {
  if (type === ITEM_IMPORT_MIXED) {
    return VALIDATED_ITEM_TYPES.flatMap((each) =>
      itemImportExamples(each).map((row) => ({
        question_type: ITEM_IMPORT_TYPE_NAMES[each],
        ...row,
      })),
    );
  }
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
          blank_1: "Doji; Doji candle",
          explanation: "A doji shows indecision between buyers and sellers.",
          ...common("candlesticks"),
        },
        {
          question: "Price bouncing off a ____ level twice forms a double ____.",
          blank_1: "support",
          blank_2: "bottom",
          explanation: "Two lows at the same support make a double bottom.",
          ...common("patterns"),
        },
      ];
    case "short_answer":
      return [
        {
          question: "In one sentence, what is position sizing?",
          model_answer: "Choosing how much to trade so a loss stays within your risk limit.",
          rubric: "Mentions trade size and limiting the loss to a set amount or percentage.",
          keywords: "size; risk; loss",
          keywords_needed: 2,
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
          max_words: 200,
          ...common("journaling"),
        },
      ];
    case "file_upload":
      return [
        {
          question: "Upload a screenshot of your chart with support and resistance marked.",
          rubric: "At least one support and one resistance level, both clearly labelled.",
          accepted_file_types: "png, jpg, pdf",
          max_file_size_mb: 5,
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
export function itemImportInstructions(type: ImportTemplateType): string[] {
  if (type === ITEM_IMPORT_MIXED) {
    return [
      "This template takes questions of any type in one file.",
      "Fill in the Questions sheet: one question per row, starting on row 2.",
      "Choose each row's Question type first, then fill the Question and only the columns that type uses. Each column's hint says which types use it.",
      "Do not rename, move or delete the header row or its columns.",
      `Up to ${ITEM_IMPORT_MAX_ROWS.toLocaleString("en")} questions per file. Empty rows are skipped.`,
      "Fill in the blank: mark each blank in the question with ____ and give each blank's answers, separated by semicolons.",
      "Short answer: add keywords to mark it automatically; leave them empty for a person to mark it.",
      "Tags are separated by commas. Weight columns take a number from 0 to 1 and can be left empty.",
      "The Examples sheet shows one complete question of each type. It is never imported.",
      "Every imported question starts as a Draft, so you can review it before learners see it.",
    ];
  }
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
      "Mark each blank in the question with ____ (three or more underscores). A question can have up to five blanks.",
      "For each blank, list every answer that counts as right, separated by semicolons, for example: Doji; Doji candle. Capitals and extra spaces are ignored.",
      "With several blanks, each right blank earns an equal share of the question's marks.",
    ],
    short_answer: [
      "With Keywords (separated by semicolons), answers are marked automatically: full marks when an answer has enough of them. Keywords needed says how many; all of them if empty.",
      "Without keywords a person marks the answer. The model answer and rubric help them.",
    ],
    long_answer: [
      "Long answers are graded by a person. The model answer and rubric help them.",
      "Word limit is the most words an answer may have; leave it empty for no limit.",
    ],
    file_upload: [
      "Learners upload a file, and a person grades it.",
      "Accepted file types are extensions such as pdf or png, separated by commas. Leave it empty for everyday documents and images.",
      "Largest file (MB) is the size limit; 10 MB if empty.",
    ],
    matching: [
      "Each Left / Right pair is one correct match. Fill at least two pairs, and up to eight.",
      "Extra right items are wrong choices, to make the question harder.",
    ],
    ordering: ["Write the steps in the correct order, starting at Step 1, without gaps."],
    swipe: ["Each row is one card. Correct swipe is Known (right) or Unknown (left)."],
  };
  return [
    `This template is for ${name} questions only. Use the matching template for other types, or the Mixed template for several types in one file.`,
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

/** Answers and keywords: separated by semicolons (answers may hold commas, as in 1,000). */
function splitAnswers(value: string): string[] {
  return value
    .split(/[;\n]/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function readWholeNumber(raw: ImportCell, textValue: string): number | null {
  if (textValue === "") return null;
  const number = typeof raw === "number" ? raw : Number(textValue);
  return Number.isFinite(number) ? number : Number.NaN;
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
      return ["blank_1"];
    case "blanks":
      return Array.from({ length: FILL_BLANK_BLANKS }, (_, i) => `blank_${String(i + 1)}`);
    case "keywords":
      return ["keywords"];
    case "keywordsRequired":
      return ["keywords_needed"];
    case "maxWords":
      return ["max_words"];
    case "rubric":
      return ["rubric"];
    case "modelAnswer":
      return type === "file_upload" ? ["reference_file_name"] : ["model_answer"];
    case "acceptedFileTypes":
      return ["accepted_file_types"];
    case "maxFileSizeMb":
      return ["max_file_size_mb"];
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
  templateType: ImportTemplateType,
  row: ImportRow,
  dimensions: ImportDimension[],
): ImportRowResult {
  const issues: ImportRowIssue[] = [];
  const issue = (columns: string[], message: string) => {
    issues.push({ columns, message });
  };

  // A mixed template's row names its own type (S3.4b).
  let type: ValidatedItemTypeKey;
  if (templateType === ITEM_IMPORT_MIXED) {
    const named = cellText(row["question_type"]);
    const resolved = readImportRowType(named);
    if (!resolved) {
      return {
        ok: false,
        issues: [
          {
            columns: ["question_type"],
            message: named
              ? `"${named}" is not a question type. Choose one from the list.`
              : "Choose the question type.",
          },
        ],
      };
    }
    type = resolved;
  } else {
    type = templateType;
  }
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

    case "fill_blank": {
      // One column per blank; the last filled one says how many there are.
      const cells = Array.from({ length: FILL_BLANK_BLANKS }, (_, i) =>
        get(`blank_${String(i + 1)}`),
      );
      let last = 0;
      cells.forEach((cell, index) => {
        if (cell) last = index + 1;
      });
      const sets = cells.slice(0, Math.max(last, 1)).map(splitAnswers);
      sets.forEach((set, index) => {
        if (set.length === 0 && index > 0) {
          issue(
            [`blank_${String(index + 1)}`],
            `Blank ${String(index + 1)} has no answers, but a later blank does. Fill blanks in order.`,
          );
        }
      });
      if (sets.length <= 1) answerKey["acceptedValues"] = sets[0] ?? [];
      else answerKey["blanks"] = sets.map((acceptedValues) => ({ acceptedValues }));
      break;
    }

    case "short_answer":
    case "long_answer":
      answerKey["modelAnswer"] = get("model_answer");
      answerKey["rubric"] = get("rubric");
      if (type === "short_answer") {
        const keywords = splitAnswers(get("keywords"));
        if (keywords.length > 0) answerKey["keywords"] = keywords;
        const needed = readWholeNumber(row["keywords_needed"], get("keywords_needed"));
        if (needed !== null) {
          if (keywords.length === 0) {
            issue(["keywords_needed"], "Keywords needed is set, but there are no keywords.");
          } else if (Number.isNaN(needed)) {
            issue(["keywords_needed"], "Keywords needed must be a whole number.");
          } else {
            answerKey["keywordsRequired"] = needed;
          }
        }
      } else {
        const limit = readWholeNumber(row["max_words"], get("max_words"));
        if (limit !== null) {
          if (Number.isNaN(limit)) issue(["max_words"], "Word limit must be a whole number.");
          else answerKey["maxWords"] = limit;
        }
      }
      break;

    case "file_upload":
      answerKey["rubric"] = get("rubric");
      answerKey["modelAnswer"] = get("reference_file_name");
      answerKey["acceptedFileTypes"] = splitList(get("accepted_file_types"));
      {
        const size = readWholeNumber(row["max_file_size_mb"], get("max_file_size_mb"));
        if (size !== null) {
          if (Number.isNaN(size)) {
            issue(["max_file_size_mb"], "Largest file (MB) must be a whole number.");
          } else {
            answerKey["maxFileSizeMb"] = size;
          }
        }
      }
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
