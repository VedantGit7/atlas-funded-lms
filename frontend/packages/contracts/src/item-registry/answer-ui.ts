import type { ItemOptionWire, ItemResponseUiState } from "./answer-contracts";
export type { ItemOptionWire, ItemResponseUiState } from "./answer-contracts";
export function emptyResponseState(itemTypeKey: string): ItemResponseUiState {
  switch (itemTypeKey) {
    case "mcq_single":
      return { type: "mcq_single", selectedOptionId: null };
    case "mcq_multi":
      return { type: "mcq_multi", selectedOptionIds: [] };
    case "true_false":
      return { type: "true_false", value: null };
    case "fill_blank":
      return { type: "fill_blank", values: [""] };
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
    case "fill_blank": {
      // `values` for several blanks (S3.4b), `value` for one.
      const values = Array.isArray(wire["values"])
        ? wire["values"].map((entry) => (typeof entry === "string" ? entry : ""))
        : [typeof wire["value"] === "string" ? wire["value"] : ""];
      return { type: "fill_blank", values: values.length > 0 ? values : [""] };
    }
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
        assetReferenceId:
          typeof wire["assetReferenceId"] === "string" ? wire["assetReferenceId"] : undefined,
        sizeBytes: typeof wire["sizeBytes"] === "number" ? wire["sizeBytes"] : undefined,
        contentType: typeof wire["contentType"] === "string" ? wire["contentType"] : undefined,
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
      if (!state.values.some((value) => value.trim())) return null;
      return state.values.length <= 1 ? { value: state.values[0] ?? "" } : { values: state.values };
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
      if (!state.fileName.trim()) return null;
      // A real attempt saves the confirmed file (S3.4c); the author's preview
      // only has a name.
      return state.assetReferenceId
        ? {
            assetReferenceId: state.assetReferenceId,
            fileName: state.fileName,
            ...(state.sizeBytes != null ? { sizeBytes: state.sizeBytes } : {}),
            ...(state.contentType ? { contentType: state.contentType } : {}),
          }
        : { fileName: state.fileName };
  }
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
