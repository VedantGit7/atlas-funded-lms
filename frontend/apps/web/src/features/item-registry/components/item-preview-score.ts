export {
  buildPreviewOptions,
  defaultAnswerKeyForType,
  emptyResponseState,
  isManualGradingType,
  isResponseComplete,
  parseAnswerKeyJson,
  parseAnswerKeyText,
  readAnswerKeyExplanation,
  responseFromWire,
  responseToWire,
  scorePreviewAnswer,
  supportsAutoCheck,
  withAnswerKeyExplanation,
  type ItemOptionWire,
  type ItemResponseUiState,
  type PreviewScoreResult,
} from "@atlas/contracts/item-registry/answer-contracts";

export type PreviewOption = {
  id: string;
  label: string;
  isCorrect: boolean | null;
};
