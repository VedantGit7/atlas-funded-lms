import { z } from "zod";

export const BUILTIN_ITEM_TYPE_KEYS = [
  "mcq_single",
  "mcq_multi",
  "true_false",
  "fill_blank",
  "short_answer",
  "long_answer",
  "matching",
  "ordering",
  "file_upload",
  "swipe",
] as const;

export type BuiltinItemTypeKey = (typeof BUILTIN_ITEM_TYPE_KEYS)[number];

export type ParseResult<T> = { ok: true; value: T } | { ok: false; error: string };

export type PreviewScoreKind = "correct" | "incorrect" | "manual" | "neutral";

export type PreviewScoreResult = {
  kind: PreviewScoreKind;
  title: string;
  detail: string;
};

export type ItemOptionWire = {
  id: string;
  label: string;
  isCorrect: boolean | null;
};

const uuidLike = z.string().min(1);

export const McqSingleAnswerWireSchema = z.object({
  selectedOptionId: uuidLike,
});

export const McqMultiAnswerWireSchema = z.object({
  selectedOptionIds: z.array(uuidLike).min(1),
});

export const TrueFalseAnswerWireSchema = z.object({
  value: z.boolean(),
});

export const TextValueAnswerWireSchema = z.object({
  value: z.string(),
});

export const FileUploadAnswerWireSchema = z.object({
  fileName: z.string().min(1),
});

export const MatchingAnswerWireSchema = z.object({
  pairs: z.record(z.string(), z.string()),
});

export const OrderingAnswerWireSchema = z.object({
  order: z.array(z.string()).min(1),
});

export const SwipeAnswerWireSchema = z.object({
  action: z.enum(["known", "unknown"]),
});

export const McqSingleAnswerKeySchema = z.object({
  correctOptionId: uuidLike.optional(),
});

export const McqMultiAnswerKeySchema = z.object({
  correctOptionIds: z.array(uuidLike).optional(),
});

export const TrueFalseAnswerKeySchema = z
  .object({
    value: z.boolean(),
  })
  .loose();

export const FillBlankAnswerKeySchema = z.object({
  value: z.string().optional(),
  acceptedValues: z.array(z.string()).optional(),
});

export const StructuredAnswerKeySchema = z.object({
  pairs: z.record(z.string(), z.string()).optional(),
  order: z.array(z.string()).optional(),
});

export const SwipeAnswerKeySchema = z
  .object({
    direction: z.enum(["left", "right"]),
  })
  .loose();

export const ManualAnswerKeySchema = z.object({
  rubric: z.string().optional(),
  modelAnswer: z.string().optional(),
  acceptedFileTypes: z.array(z.string()).optional(),
});

export type ItemResponseUiState =
  | { type: "mcq_single"; selectedOptionId: string | null }
  | { type: "mcq_multi"; selectedOptionIds: string[] }
  | { type: "true_false"; value: boolean | null }
  | { type: "fill_blank"; value: string }
  | { type: "short_answer"; value: string }
  | { type: "long_answer"; value: string }
  | { type: "matching"; pairs: Record<string, string> }
  | { type: "ordering"; order: string[] }
  | { type: "swipe"; action: "known" | "unknown" | null }
  | { type: "file_upload"; fileName: string };

export type ItemAnswerKeyUiState =
  | { type: "mcq_single"; correctOptionId: string | null }
  | { type: "mcq_multi"; correctOptionIds: string[] }
  | { type: "true_false"; value: boolean }
  | { type: "fill_blank"; acceptedValues: string[] }
  | { type: "short_answer"; rubric: string; modelAnswer: string }
  | { type: "long_answer"; rubric: string; modelAnswer: string }
  | { type: "matching"; pairs: Record<string, string> }
  | { type: "ordering"; order: string[] }
  | { type: "file_upload"; rubric: string; acceptedFileTypes: string[] }
  | { type: "swipe"; direction: "left" | "right" };

export function isBuiltinItemTypeKey(key: string): key is BuiltinItemTypeKey {
  return (BUILTIN_ITEM_TYPE_KEYS as readonly string[]).includes(key);
}

export function readAnswerKeyExplanation(raw: Record<string, unknown> | undefined): string {
  return typeof raw?.["explanation"] === "string" ? raw["explanation"] : "";
}

export function withAnswerKeyExplanation(
  key: Record<string, unknown>,
  explanation: string,
): Record<string, unknown> {
  const trimmed = explanation.trim();
  if (!trimmed) {
    const rest = { ...key };
    delete rest["explanation"];
    return rest;
  }
  return { ...key, explanation: trimmed };
}

export function defaultAnswerKeyForType(itemTypeKey: string): Record<string, unknown> {
  switch (itemTypeKey) {
    case "mcq_single":
      return { correctOptionId: "" };
    case "mcq_multi":
      return { correctOptionIds: [] };
    case "true_false":
      return { value: true };
    case "fill_blank":
      return { acceptedValues: [""] };
    case "short_answer":
    case "long_answer":
      return { rubric: "", modelAnswer: "" };
    case "matching":
      return { pairs: {} };
    case "ordering":
      return { order: [] };
    case "file_upload":
      return { rubric: "", acceptedFileTypes: [] };
    case "swipe":
      return { direction: "right" };
    default:
      return {};
  }
}

export function parseAnswerKeyJson(
  itemTypeKey: string,
  raw: unknown,
): ParseResult<Record<string, unknown>> {
  if (raw === null || raw === undefined) {
    return { ok: true, value: defaultAnswerKeyForType(itemTypeKey) };
  }

  if (typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, error: "Answer key must be a JSON object." };
  }

  const value = raw as Record<string, unknown>;
  const schema = answerKeySchemaForType(itemTypeKey);
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid answer key shape." };
  }

  return { ok: true, value: parsed.data };
}

export function parseAnswerKeyText(text: string): ParseResult<Record<string, unknown>> {
  const trimmed = text.trim();
  if (!trimmed) {
    return { ok: true, value: {} };
  }

  try {
    const parsed: unknown = JSON.parse(trimmed);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { ok: false, error: "Answer key must be a JSON object." };
    }
    return { ok: true, value: parsed as Record<string, unknown> };
  } catch {
    return { ok: false, error: "Answer key JSON is invalid." };
  }
}

function answerKeySchemaForType(itemTypeKey: string): z.ZodType<Record<string, unknown>> {
  switch (itemTypeKey) {
    case "mcq_single":
      return McqSingleAnswerKeySchema.loose();
    case "mcq_multi":
      return McqMultiAnswerKeySchema.loose();
    case "true_false":
      return TrueFalseAnswerKeySchema;
    case "fill_blank":
      return FillBlankAnswerKeySchema.loose();
    case "matching":
    case "ordering":
      return StructuredAnswerKeySchema.loose();
    case "swipe":
      return SwipeAnswerKeySchema;
    case "short_answer":
    case "long_answer":
    case "file_upload":
      return ManualAnswerKeySchema.loose();
    default:
      return z.record(z.string(), z.unknown());
  }
}

export function answerKeyToUiState(
  itemTypeKey: string,
  raw: Record<string, unknown>,
): ItemAnswerKeyUiState {
  switch (itemTypeKey) {
    case "mcq_single":
      return {
        type: "mcq_single",
        correctOptionId: typeof raw["correctOptionId"] === "string" ? raw["correctOptionId"] : null,
      };
    case "mcq_multi":
      return {
        type: "mcq_multi",
        correctOptionIds: Array.isArray(raw["correctOptionIds"])
          ? raw["correctOptionIds"].filter((entry): entry is string => typeof entry === "string")
          : [],
      };
    case "true_false":
      return {
        type: "true_false",
        value: raw["value"] === false ? false : true,
      };
    case "fill_blank":
      return {
        type: "fill_blank",
        acceptedValues: Array.isArray(raw["acceptedValues"])
          ? raw["acceptedValues"].filter((entry): entry is string => typeof entry === "string")
          : typeof raw["value"] === "string" && raw["value"].trim()
            ? [raw["value"]]
            : [""],
      };
    case "short_answer":
      return {
        type: "short_answer",
        rubric: typeof raw["rubric"] === "string" ? raw["rubric"] : "",
        modelAnswer: typeof raw["modelAnswer"] === "string" ? raw["modelAnswer"] : "",
      };
    case "long_answer":
      return {
        type: "long_answer",
        rubric: typeof raw["rubric"] === "string" ? raw["rubric"] : "",
        modelAnswer: typeof raw["modelAnswer"] === "string" ? raw["modelAnswer"] : "",
      };
    case "matching":
      return {
        type: "matching",
        pairs:
          raw["pairs"] && typeof raw["pairs"] === "object" && !Array.isArray(raw["pairs"])
            ? (raw["pairs"] as Record<string, string>)
            : {},
      };
    case "ordering":
      return {
        type: "ordering",
        order: Array.isArray(raw["order"])
          ? raw["order"].filter((entry): entry is string => typeof entry === "string")
          : [],
      };
    case "file_upload":
      return {
        type: "file_upload",
        rubric: typeof raw["rubric"] === "string" ? raw["rubric"] : "",
        acceptedFileTypes: Array.isArray(raw["acceptedFileTypes"])
          ? raw["acceptedFileTypes"].filter((entry): entry is string => typeof entry === "string")
          : [],
      };
    case "swipe":
      return {
        type: "swipe",
        direction: raw["direction"] === "left" ? "left" : "right",
      };
    default:
      return { type: "true_false", value: true };
  }
}

export function uiStateToAnswerKey(state: ItemAnswerKeyUiState): Record<string, unknown> {
  switch (state.type) {
    case "mcq_single":
      return state.correctOptionId ? { correctOptionId: state.correctOptionId } : {};
    case "mcq_multi":
      return { correctOptionIds: state.correctOptionIds };
    case "true_false":
      return { value: state.value };
    case "fill_blank":
      return {
        acceptedValues: state.acceptedValues.map((entry) => entry.trim()).filter(Boolean),
      };
    case "short_answer":
    case "long_answer":
      return { rubric: state.rubric, modelAnswer: state.modelAnswer };
    case "matching":
      return { pairs: state.pairs };
    case "ordering":
      return { order: state.order };
    case "file_upload":
      return { rubric: state.rubric, acceptedFileTypes: state.acceptedFileTypes };
    case "swipe":
      return { direction: state.direction };
  }
}

export function emptyResponseState(itemTypeKey: string): ItemResponseUiState {
  switch (itemTypeKey) {
    case "mcq_single":
      return { type: "mcq_single", selectedOptionId: null };
    case "mcq_multi":
      return { type: "mcq_multi", selectedOptionIds: [] };
    case "true_false":
      return { type: "true_false", value: null };
    case "fill_blank":
      return { type: "fill_blank", value: "" };
    case "short_answer":
      return { type: "short_answer", value: "" };
    case "long_answer":
      return { type: "long_answer", value: "" };
    case "matching":
      return { type: "matching", pairs: {} };
    case "ordering":
      return { type: "ordering", order: [] };
    case "swipe":
      return { type: "swipe", action: null };
    case "file_upload":
      return { type: "file_upload", fileName: "" };
    default:
      return { type: "short_answer", value: "" };
  }
}

export function responseFromWire(
  itemTypeKey: string,
  wire: Record<string, unknown> | null,
): ItemResponseUiState {
  const empty = emptyResponseState(itemTypeKey);
  if (!wire) return empty;

  switch (itemTypeKey) {
    case "mcq_single":
      return {
        type: "mcq_single",
        selectedOptionId:
          typeof wire["selectedOptionId"] === "string" ? wire["selectedOptionId"] : null,
      };
    case "mcq_multi":
      return {
        type: "mcq_multi",
        selectedOptionIds: Array.isArray(wire["selectedOptionIds"])
          ? wire["selectedOptionIds"].filter((entry): entry is string => typeof entry === "string")
          : [],
      };
    case "true_false":
      return {
        type: "true_false",
        value: typeof wire["value"] === "boolean" ? wire["value"] : null,
      };
    case "fill_blank":
    case "short_answer":
    case "long_answer":
      return {
        type: itemTypeKey,
        value: typeof wire["value"] === "string" ? wire["value"] : "",
      };
    case "matching":
      return {
        type: "matching",
        pairs:
          wire["pairs"] && typeof wire["pairs"] === "object" && !Array.isArray(wire["pairs"])
            ? (wire["pairs"] as Record<string, string>)
            : {},
      };
    case "ordering":
      return {
        type: "ordering",
        order: Array.isArray(wire["order"])
          ? wire["order"].filter((entry): entry is string => typeof entry === "string")
          : [],
      };
    case "swipe":
      return {
        type: "swipe",
        action: wire["action"] === "known" || wire["action"] === "unknown" ? wire["action"] : null,
      };
    case "file_upload":
      return {
        type: "file_upload",
        fileName: typeof wire["fileName"] === "string" ? wire["fileName"] : "",
      };
    default:
      return empty;
  }
}

export function responseToWire(state: ItemResponseUiState): Record<string, unknown> | null {
  switch (state.type) {
    case "mcq_single":
      return state.selectedOptionId ? { selectedOptionId: state.selectedOptionId } : null;
    case "mcq_multi":
      return state.selectedOptionIds.length > 0
        ? { selectedOptionIds: state.selectedOptionIds }
        : null;
    case "true_false":
      return state.value === null ? null : { value: state.value };
    case "fill_blank":
    case "short_answer":
    case "long_answer":
      return state.value.trim() ? { value: state.value } : null;
    case "matching":
      return Object.keys(state.pairs).length > 0 ? { pairs: state.pairs } : null;
    case "ordering":
      return state.order.length > 0 ? { order: state.order } : null;
    case "swipe":
      return state.action ? { action: state.action } : null;
    case "file_upload":
      return state.fileName.trim() ? { fileName: state.fileName } : null;
  }
}

export function isResponseComplete(
  itemTypeKey: string,
  wire: Record<string, unknown> | null,
): boolean {
  return responseToWire(responseFromWire(itemTypeKey, wire)) !== null;
}

export function isManualGradingType(itemTypeKey: string): boolean {
  return (
    itemTypeKey === "short_answer" || itemTypeKey === "long_answer" || itemTypeKey === "file_upload"
  );
}

export function supportsAutoCheck(itemTypeKey: string): boolean {
  return (
    itemTypeKey === "mcq_single" ||
    itemTypeKey === "mcq_multi" ||
    itemTypeKey === "true_false" ||
    itemTypeKey === "fill_blank" ||
    itemTypeKey === "matching" ||
    itemTypeKey === "ordering" ||
    itemTypeKey === "swipe"
  );
}

function normalizeString(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.trim().toLowerCase();
}

function compareSets(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const sortedA = [...a].sort();
  const sortedB = [...b].sort();
  return sortedA.every((value, index) => value === sortedB[index]);
}

export function buildPreviewOptions(
  itemTypeKey: string,
  answerKey: Record<string, unknown>,
  savedOptions?: Array<{
    id: string;
    optionJson: unknown;
    isCorrect: boolean | null;
    position: number;
  }>,
): ItemOptionWire[] {
  if (savedOptions && savedOptions.length > 0) {
    return [...savedOptions]
      .sort((a, b) => a.position - b.position)
      .map((option) => ({
        id: option.id,
        label:
          typeof option.optionJson === "object" &&
          option.optionJson !== null &&
          "label" in option.optionJson &&
          typeof (option.optionJson as { label?: unknown }).label === "string"
            ? (option.optionJson as { label: string }).label
            : `Option ${String(option.position)}`,
        isCorrect: option.isCorrect,
      }));
  }

  if (itemTypeKey === "mcq_single" || itemTypeKey === "mcq_multi") {
    return ["A", "B", "C", "D"].map((letter, index) => ({
      id: `preview-opt-${String(index + 1)}`,
      label: `Sample option ${letter}`,
      isCorrect: null,
    }));
  }

  return [];
}

export function scorePreviewAnswer(args: {
  itemTypeKey: string;
  answerKey: Record<string, unknown>;
  answerJson: Record<string, unknown> | null;
  options: ItemOptionWire[];
}): PreviewScoreResult {
  const { itemTypeKey, answerKey, answerJson, options } = args;

  if (isManualGradingType(itemTypeKey)) {
    const rubric =
      typeof answerKey["rubric"] === "string" && answerKey["rubric"].trim().length > 0
        ? answerKey["rubric"]
        : null;
    return {
      kind: "manual",
      title: "Manual grading in production",
      detail: rubric
        ? `Instructors would score against this rubric: ${rubric}`
        : "Learner responses for this type are queued for instructor review.",
    };
  }

  if (!supportsAutoCheck(itemTypeKey)) {
    return {
      kind: "neutral",
      title: "Preview only",
      detail: "This item type does not have automatic scoring configured yet.",
    };
  }

  if (!answerJson) {
    return {
      kind: "incorrect",
      title: "No response",
      detail: "Select or enter an answer before checking.",
    };
  }

  switch (itemTypeKey) {
    case "mcq_single": {
      const selected = answerJson["selectedOptionId"];
      const correct =
        typeof selected === "string" &&
        (selected === answerKey["correctOptionId"] ||
          options.find((option) => option.id === selected)?.isCorrect === true);
      return correct
        ? { kind: "correct", title: "Correct", detail: "Selected option matches the answer key." }
        : { kind: "incorrect", title: "Incorrect", detail: "Selected option does not match." };
    }
    case "mcq_multi": {
      const selected = Array.isArray(answerJson["selectedOptionIds"])
        ? answerJson["selectedOptionIds"].filter(
            (value): value is string => typeof value === "string",
          )
        : [];
      const correctIds =
        Array.isArray(answerKey["correctOptionIds"]) && answerKey["correctOptionIds"].length > 0
          ? answerKey["correctOptionIds"].filter(
              (value): value is string => typeof value === "string",
            )
          : options.filter((option) => option.isCorrect).map((option) => option.id);
      const correct = compareSets(selected, correctIds);
      return correct
        ? { kind: "correct", title: "Correct", detail: "All correct options selected." }
        : {
            kind: "incorrect",
            title: "Incorrect",
            detail: "Selection does not match the answer key.",
          };
    }
    case "true_false": {
      const isCorrect = answerJson["value"] === answerKey["value"];
      return isCorrect
        ? { kind: "correct", title: "Correct", detail: "Response matches the answer key value." }
        : {
            kind: "incorrect",
            title: "Incorrect",
            detail: "Response does not match the answer key value.",
          };
    }
    case "fill_blank": {
      const value = normalizeString(answerJson["value"]);
      const accepted = Array.isArray(answerKey["acceptedValues"])
        ? answerKey["acceptedValues"].map((entry) => normalizeString(entry))
        : [normalizeString(answerKey["value"])];
      const isCorrect = accepted.includes(value) && value.length > 0;
      return isCorrect
        ? { kind: "correct", title: "Correct", detail: "Response matches an accepted value." }
        : {
            kind: "incorrect",
            title: "Incorrect",
            detail: "Response is not among accepted values.",
          };
    }
    case "matching":
    case "ordering": {
      const field = itemTypeKey === "matching" ? "pairs" : "order";
      const isCorrect =
        JSON.stringify(answerJson[field] ?? null) === JSON.stringify(answerKey[field] ?? null) &&
        answerJson[field] != null &&
        answerKey[field] != null;
      return isCorrect
        ? {
            kind: "correct",
            title: "Correct",
            detail: "Structured response matches the answer key.",
          }
        : {
            kind: "incorrect",
            title: "Incorrect",
            detail: "Structured response does not match the answer key.",
          };
    }
    case "swipe": {
      const action = answerJson["action"];
      if (action !== "known" && action !== "unknown") {
        return {
          kind: "incorrect",
          title: "No swipe yet",
          detail: "Drag the card right (Known) or left (Unknown) before checking.",
        };
      }
      const expectedDirection = answerKey["direction"] === "left" ? "left" : "right";
      const responseDirection = action === "known" ? "right" : "left";
      const isCorrect = responseDirection === expectedDirection;
      return isCorrect
        ? {
            kind: "correct",
            title: "Correct",
            detail:
              action === "known"
                ? "Known (swipe right) matches the answer key."
                : "Unknown (swipe left) matches the answer key.",
          }
        : {
            kind: "incorrect",
            title: "Needs review",
            detail:
              action === "known"
                ? "Known (swipe right) does not match the configured answer key direction."
                : "Unknown (swipe left) does not match the configured answer key direction.",
          };
    }
    default:
      return {
        kind: "neutral",
        title: "Preview only",
        detail: "Automatic check is not available for this item type.",
      };
  }
}

export type ItemTypeSchemaJson = {
  fields: string[];
  answerKeyShape: string;
  responseShape: string;
  requiresOptions: boolean;
  gradingMode: "auto" | "manual";
};

export function schemaJsonForItemType(itemTypeKey: string): ItemTypeSchemaJson {
  switch (itemTypeKey) {
    case "mcq_single":
      return {
        fields: ["stem"],
        answerKeyShape: "{ correctOptionId: string }",
        responseShape: "{ selectedOptionId: string }",
        requiresOptions: true,
        gradingMode: "auto",
      };
    case "mcq_multi":
      return {
        fields: ["stem"],
        answerKeyShape: "{ correctOptionIds: string[] }",
        responseShape: "{ selectedOptionIds: string[] }",
        requiresOptions: true,
        gradingMode: "auto",
      };
    case "true_false":
      return {
        fields: ["stem"],
        answerKeyShape: "{ value: boolean }",
        responseShape: "{ value: boolean }",
        requiresOptions: false,
        gradingMode: "auto",
      };
    case "fill_blank":
      return {
        fields: ["stem"],
        answerKeyShape: "{ acceptedValues: string[] }",
        responseShape: "{ value: string }",
        requiresOptions: false,
        gradingMode: "auto",
      };
    case "short_answer":
      return {
        fields: ["stem"],
        answerKeyShape: "{ rubric?: string, modelAnswer?: string }",
        responseShape: "{ value: string }",
        requiresOptions: false,
        gradingMode: "manual",
      };
    case "long_answer":
      return {
        fields: ["stem"],
        answerKeyShape: "{ rubric?: string, modelAnswer?: string }",
        responseShape: "{ value: string }",
        requiresOptions: false,
        gradingMode: "manual",
      };
    case "matching":
      return {
        fields: ["stem"],
        answerKeyShape: "{ pairs: Record<string, string> }",
        responseShape: "{ pairs: Record<string, string> }",
        requiresOptions: false,
        gradingMode: "auto",
      };
    case "ordering":
      return {
        fields: ["stem"],
        answerKeyShape: "{ order: string[] }",
        responseShape: "{ order: string[] }",
        requiresOptions: false,
        gradingMode: "auto",
      };
    case "file_upload":
      return {
        fields: ["stem"],
        answerKeyShape: "{ rubric?: string, acceptedFileTypes?: string[] }",
        responseShape: "{ fileName: string }",
        requiresOptions: false,
        gradingMode: "manual",
      };
    case "swipe":
      return {
        fields: ["stem"],
        answerKeyShape: '{ direction: "left" | "right" }',
        responseShape: '{ action: "known" | "unknown" }',
        requiresOptions: false,
        gradingMode: "auto",
      };
    default:
      return {
        fields: ["stem"],
        answerKeyShape: "object",
        responseShape: "object",
        requiresOptions: false,
        gradingMode: "manual",
      };
  }
}
