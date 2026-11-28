"use client";

import {
  buildPreviewOptions,
  emptyResponseState,
  responseFromWire,
  responseToWire,
  type ItemOptionWire,
  type ItemResponseUiState,
} from "@atlas/contracts/item-registry/answer-ui";
import {
  countBlanks,
  countWords,
  longAnswerWordLimit,
} from "@atlas/contracts/item-registry/answer-rules.contract";
import { ArrowDown, ArrowUp } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { getItemTypeVisual } from "../item-type-config";
import { SwipeCardPreview } from "../swipe-card-preview";
import { FileUploadResponse, type UploadedFile } from "./file-upload-response";
import {
  chipButtonClassName,
  choiceClassName,
  editorInputClassName,
  learnerChoiceClassName,
} from "../shared/editor-styles";

export type ItemResponseRendererProps = {
  itemTypeKey: string;
  stem: string;
  answerKey?: Record<string, unknown>;
  savedAnswer?: Record<string, unknown> | null;
  options?: Array<{
    id: string;
    optionJson: unknown;
    isCorrect: boolean | null;
    position: number;
  }>;
  onAnswerChange?: (answerJson: Record<string, unknown> | null) => void;
  mode?: "preview" | "attempt";
  disabled?: boolean;
  swipeResetToken?: number;
  showStem?: boolean;
  /**
   * A matching or ordering question's items in a real attempt, from the
   * server, with opaque ids (QA review 1 N1). Without it (the author's
   * preview) they are read from the answer key.
   */
  choices?: ResponseChoices | undefined;
  /**
   * Limits in a real attempt, from the server (learners never get the answer
   * key): a long answer's word limit (S3.4b). In the author's preview they are
   * read from the answer key.
   */
  answerLimits?:
    | {
        maxWords?: number | undefined;
        fileTypes?: string[] | undefined;
        maxFileSizeMb?: number | undefined;
      }
    | undefined;
  /** Uploads a file for an upload question, in a real attempt (S3.4c). */
  onUploadFile?: ((file: File) => Promise<UploadedFile>) | undefined;
  /** Opens a file this attempt uploaded. */
  onOpenFile?: ((assetReferenceId: string) => void) | undefined;
};

type LabeledId = { id: string; label: string };

export type ResponseChoices =
  | { kind: "matching"; left: LabeledId[]; right: LabeledId[] }
  | { kind: "ordering"; items: LabeledId[] };

function hashString(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/**
 * The preview's starting order for ordering steps: mixed up, and never the
 * correct order (QA review 1 M47: the preview showed the answer). Stable for
 * the same steps, so the preview doesn't jump on every render.
 */
export function previewOrderingStart(items: LabeledId[]): LabeledId[] {
  if (items.length < 2) return items;
  const mixed = [...items].sort(
    (a, b) => hashString(`${a.id}:${a.label}`) - hashString(`${b.id}:${b.label}`),
  );
  const unchanged = mixed.every((item, index) => item.id === items[index]?.id);
  return unchanged ? [...mixed.slice(1), ...mixed.slice(0, 1)] : mixed;
}

function readLabelMap(value: Record<string, unknown> | undefined): Record<string, string> {
  if (value?.["items"] && typeof value["items"] === "object" && !Array.isArray(value["items"])) {
    return value["items"] as Record<string, string>;
  }
  return {};
}

function readMatchingLists(answerKey: Record<string, unknown> | undefined): {
  leftItems: LabeledId[];
  rightItems: LabeledId[];
} {
  const pairs =
    answerKey?.["pairs"] &&
    typeof answerKey["pairs"] === "object" &&
    !Array.isArray(answerKey["pairs"])
      ? (answerKey["pairs"] as Record<string, string>)
      : {};

  const leftRaw = answerKey?.["leftItems"];
  const rightRaw = answerKey?.["rightItems"];

  const leftItems =
    leftRaw && typeof leftRaw === "object" && !Array.isArray(leftRaw)
      ? Object.entries(leftRaw as Record<string, string>).map(([id, label]) => ({ id, label }))
      : Object.keys(pairs).map((id) => ({ id, label: id }));

  const rightItems =
    rightRaw && typeof rightRaw === "object" && !Array.isArray(rightRaw)
      ? Object.entries(rightRaw as Record<string, string>).map(([id, label]) => ({ id, label }))
      : [...new Set(Object.values(pairs))].map((id) => ({ id, label: id }));

  return { leftItems, rightItems };
}

function readOrderingItems(answerKey: Record<string, unknown> | undefined): LabeledId[] {
  const order = Array.isArray(answerKey?.["order"])
    ? answerKey["order"].filter((entry): entry is string => typeof entry === "string")
    : [];
  const labels = readLabelMap(answerKey ?? {});

  return order.map((id) => ({ id, label: labels[id] ?? id }));
}

export function ItemResponseRenderer({
  itemTypeKey,
  stem,
  answerKey = {},
  savedAnswer = null,
  options: savedOptions,
  onAnswerChange,
  mode = "preview",
  disabled = false,
  swipeResetToken = 0,
  showStem = true,
  choices,
  answerLimits,
  onUploadFile,
  onOpenFile,
}: ItemResponseRendererProps) {
  const [state, setState] = useState<ItemResponseUiState>(() =>
    responseFromWire(itemTypeKey, savedAnswer),
  );

  const previewOptions = useMemo(
    (): ItemOptionWire[] => buildPreviewOptions(itemTypeKey, answerKey, savedOptions),
    [itemTypeKey, answerKey, savedOptions],
  );

  const typeVisual = getItemTypeVisual(itemTypeKey);
  const choiceClass = mode === "attempt" ? learnerChoiceClassName : choiceClassName;
  const displayStem = stem.trim() || "Your question will appear here.";

  useEffect(() => {
    setState(responseFromWire(itemTypeKey, savedAnswer));
  }, [itemTypeKey, savedAnswer]);

  function updateState(next: ItemResponseUiState) {
    setState(next);
    onAnswerChange?.(responseToWire(next));
  }

  if (itemTypeKey === "swipe") {
    return (
      <SwipeCardPreview
        stem={displayStem}
        disabled={disabled}
        resetToken={swipeResetToken}
        onSwipe={(action) => {
          updateState({ type: "swipe", action });
        }}
      />
    );
  }

  const interaction = renderInteraction({
    itemTypeKey,
    state,
    updateState,
    previewOptions,
    typeVisual,
    choiceClass,
    disabled,
    answerKey,
    mode,
    choices,
    stem,
    answerLimits,
    setState,
    onUploadFile,
    onOpenFile,
  });

  if (!showStem) {
    return interaction;
  }

  return (
    <article className="rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-5 shadow-sm motion-safe:animate-[admin-dropdown-in_0.22s_cubic-bezier(0.16,1,0.3,1)]">
      <p className="text-xs font-semibold uppercase tracking-wide text-[var(--admin-on-surface-variant)]">
        Question
      </p>
      <h3 className="mt-2 text-base font-semibold leading-relaxed text-[var(--admin-on-surface)]">
        {displayStem}
      </h3>
      <div className="mt-5">{interaction}</div>
    </article>
  );
}

function renderInteraction(args: {
  itemTypeKey: string;
  state: ItemResponseUiState;
  updateState: (next: ItemResponseUiState) => void;
  previewOptions: ItemOptionWire[];
  typeVisual: ReturnType<typeof getItemTypeVisual>;
  choiceClass: string;
  disabled: boolean;
  answerKey: Record<string, unknown>;
  mode: "preview" | "attempt";
  choices: ResponseChoices | undefined;
  stem: string;
  answerLimits: ItemResponseRendererProps["answerLimits"];
  /** Updates the box without reporting the answer (a long answer over its limit). */
  setState: (next: ItemResponseUiState) => void;
  onUploadFile: ItemResponseRendererProps["onUploadFile"];
  onOpenFile: ItemResponseRendererProps["onOpenFile"];
}) {
  const {
    itemTypeKey,
    state,
    updateState,
    previewOptions,
    typeVisual,
    choiceClass,
    disabled,
    answerKey,
    mode,
    choices,
    stem,
    answerLimits,
    setState,
    onUploadFile,
    onOpenFile,
  } = args;

  if (itemTypeKey === "true_false" && state.type === "true_false") {
    return (
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: "True", value: true },
          { label: "False", value: false },
        ].map((choice) => (
          <button
            key={choice.label}
            type="button"
            disabled={disabled}
            onClick={() => {
              updateState({ type: "true_false", value: choice.value });
            }}
            className={`${chipButtonClassName} ${
              state.value === choice.value
                ? typeVisual.chipClassName
                : "border-[var(--admin-border)] bg-[var(--admin-surface-low)] text-[var(--admin-on-surface-variant)] hover:bg-[var(--admin-surface-high)]"
            }`}
          >
            {choice.label}
          </button>
        ))}
      </div>
    );
  }

  if (itemTypeKey === "mcq_single" && state.type === "mcq_single" && previewOptions.length > 0) {
    return (
      <fieldset className="space-y-2">
        <legend className="sr-only">Select one answer</legend>
        {previewOptions.map((option) => (
          <label key={option.id} className={choiceClass}>
            <input
              type="radio"
              name="item-response-mcq-single"
              disabled={disabled}
              className="mt-1 accent-[var(--admin-primary)]"
              checked={state.selectedOptionId === option.id}
              onChange={() => {
                updateState({ type: "mcq_single", selectedOptionId: option.id });
              }}
            />
            <span className="text-[var(--admin-on-surface)]">{option.label}</span>
          </label>
        ))}
      </fieldset>
    );
  }

  if (itemTypeKey === "mcq_multi" && state.type === "mcq_multi" && previewOptions.length > 0) {
    return (
      <fieldset className="space-y-2">
        <legend className="sr-only">Select all that apply</legend>
        {previewOptions.map((option) => {
          const checked = state.selectedOptionIds.includes(option.id);
          return (
            <label key={option.id} className={choiceClass}>
              <input
                type="checkbox"
                disabled={disabled}
                className="mt-1 accent-[var(--admin-primary)]"
                checked={checked}
                onChange={() => {
                  updateState({
                    type: "mcq_multi",
                    selectedOptionIds: checked
                      ? state.selectedOptionIds.filter((id) => id !== option.id)
                      : [...state.selectedOptionIds, option.id],
                  });
                }}
              />
              <span className="text-[var(--admin-on-surface)]">{option.label}</span>
            </label>
          );
        })}
      </fieldset>
    );
  }

  if (itemTypeKey === "ordering" && state.type === "ordering") {
    const items =
      choices?.kind === "ordering"
        ? choices.items
        : previewOrderingStart(readOrderingItems(answerKey));
    if (items.length === 0) {
      return (
        <p className="text-sm text-[var(--admin-on-surface-variant)]">
          {mode === "attempt" ? "This question has no steps." : "Add steps to see them here."}
        </p>
      );
    }
    return (
      <OrderingResponseEditor
        items={items}
        order={state.order.length > 0 ? state.order : items.map((item) => item.id)}
        disabled={disabled}
        onChange={(order) => {
          updateState({ type: "ordering", order });
        }}
      />
    );
  }

  if (itemTypeKey === "matching" && state.type === "matching") {
    const { leftItems, rightItems } =
      choices?.kind === "matching"
        ? { leftItems: choices.left, rightItems: choices.right }
        : readMatchingLists(answerKey);
    if (leftItems.length === 0) {
      return (
        <p className="text-sm text-[var(--admin-on-surface-variant)]">
          {mode === "attempt" ? "This question has no pairs." : "Add pairs to see them here."}
        </p>
      );
    }
    return (
      <MatchingResponseEditor
        leftItems={leftItems}
        rightItems={rightItems}
        pairs={state.pairs}
        disabled={disabled}
        onChange={(pairs) => {
          updateState({ type: "matching", pairs });
        }}
      />
    );
  }

  if (itemTypeKey === "file_upload" && state.type === "file_upload") {
    return (
      <FileUploadResponse
        state={state}
        updateState={updateState}
        disabled={disabled}
        answerKey={answerKey}
        limits={answerLimits}
        onUploadFile={onUploadFile}
        onOpenFile={onOpenFile}
      />
    );
  }

  if (itemTypeKey === "fill_blank" && state.type === "fill_blank") {
    // One box per blank (____) in the question (QA review 1 M48).
    const blanks = Math.max(countBlanks(stem), state.values.length, 1);
    if (blanks === 1) {
      return (
        <div className="space-y-2">
          <label
            className="text-sm font-medium text-[var(--admin-on-surface)]"
            htmlFor="item-response-text"
          >
            Your response
          </label>
          <input
            id="item-response-text"
            type="text"
            disabled={disabled}
            value={state.values[0] ?? ""}
            onChange={(event) => {
              updateState({ type: "fill_blank", values: [event.target.value] });
            }}
            className={editorInputClassName}
            placeholder="Type the missing word..."
          />
        </div>
      );
    }
    return (
      <fieldset className="space-y-3">
        <legend className="text-sm font-medium text-[var(--admin-on-surface)]">
          Fill each blank, in order
        </legend>
        {Array.from({ length: blanks }, (_, index) => {
          const id = `item-response-blank-${String(index + 1)}`;
          return (
            <div key={id} className="flex items-center gap-3">
              <label
                htmlFor={id}
                className="w-16 shrink-0 text-sm text-[var(--admin-on-surface-variant)]"
              >
                Blank {index + 1}
              </label>
              <input
                id={id}
                type="text"
                disabled={disabled}
                value={state.values[index] ?? ""}
                onChange={(event) => {
                  const values = Array.from(
                    { length: blanks },
                    (__, position) => state.values[position] ?? "",
                  );
                  values[index] = event.target.value;
                  updateState({ type: "fill_blank", values });
                }}
                className={editorInputClassName}
              />
            </div>
          );
        })}
      </fieldset>
    );
  }

  if (
    (itemTypeKey === "short_answer" || itemTypeKey === "long_answer") &&
    (state.type === "short_answer" || state.type === "long_answer")
  ) {
    const isLong = itemTypeKey === "long_answer";
    const maxWords = isLong
      ? (answerLimits?.maxWords ?? longAnswerWordLimit(answerKey) ?? null)
      : null;
    const words = countWords(state.value);
    const over = maxWords != null && words > maxWords;
    return (
      <div className="space-y-2">
        <label
          className="text-sm font-medium text-[var(--admin-on-surface)]"
          htmlFor="item-response-text"
        >
          Your response
        </label>
        {isLong ? (
          <textarea
            id="item-response-text"
            rows={6}
            disabled={disabled}
            value={state.value}
            aria-describedby={maxWords != null ? "item-response-word-count" : undefined}
            aria-invalid={over || undefined}
            onChange={(event) => {
              const next = { ...state, value: event.target.value };
              // Over the word limit (S3.4b): kept on screen, not saved, until
              // it's short enough. The last answer within the limit stays saved.
              if (maxWords != null && countWords(next.value) > maxWords) {
                setState(next);
                return;
              }
              updateState(next);
            }}
            className={`${editorInputClassName} resize-y leading-relaxed`}
            placeholder="Write your answer..."
          />
        ) : (
          <input
            id="item-response-text"
            type="text"
            disabled={disabled}
            value={state.value}
            onChange={(event) => {
              updateState({ ...state, value: event.target.value });
            }}
            className={editorInputClassName}
            placeholder="Type your answer..."
          />
        )}
        {maxWords != null ? (
          <p
            id="item-response-word-count"
            aria-live="polite"
            className={`text-xs ${over ? "font-medium text-[var(--admin-danger)]" : "text-[var(--admin-on-surface-variant)]"}`}
          >
            {over
              ? `${words.toLocaleString("en")} of ${maxWords.toLocaleString("en")} words. Shorten it by ${(words - maxWords).toLocaleString("en")} to save it.`
              : `${words.toLocaleString("en")} of ${maxWords.toLocaleString("en")} words`}
          </p>
        ) : isLong ? (
          <p className="text-xs text-[var(--admin-on-surface-variant)]">
            {words.toLocaleString("en")} {words === 1 ? "word" : "words"}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <p className="text-sm text-[var(--admin-on-surface-variant)]">
      Response UI for this item type is not configured yet.
    </p>
  );
}

function OrderingResponseEditor({
  items,
  order,
  disabled,
  onChange,
}: {
  items: LabeledId[];
  order: string[];
  disabled: boolean;
  onChange: (order: string[]) => void;
}) {
  function move(index: number, direction: -1 | 1) {
    const currentOrder = order.length > 0 ? order : items.map((item) => item.id);
    const target = index + direction;
    if (target < 0 || target >= currentOrder.length) return;
    const nextOrder = [...currentOrder];
    const temp = nextOrder[index];
    const swap = nextOrder[target];
    if (!temp || !swap) return;
    nextOrder[index] = swap;
    nextOrder[target] = temp;
    onChange(nextOrder);
  }

  const displayOrder = order.length > 0 ? order : items.map((item) => item.id);

  return (
    <div className="space-y-2">
      <p className="text-xs text-[var(--admin-on-surface-variant)]">
        Use the arrows to put the steps in the correct order.
      </p>
      <ul className="space-y-2">
        {displayOrder.map((id, index) => {
          const item = items.find((entry) => entry.id === id);
          if (!item) return null;
          return (
            <li
              key={id}
              className="flex items-center gap-2 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 py-2.5 shadow-sm motion-safe:transition-[transform,box-shadow] motion-safe:duration-200"
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--admin-surface-high)] text-xs font-bold text-[var(--admin-on-surface-variant)]">
                {index + 1}
              </span>
              <span className="flex-1 text-sm font-medium text-[var(--admin-on-surface)]">
                {item.label}
              </span>
              <button
                type="button"
                disabled={disabled || index === 0}
                aria-label={`Move "${item.label}" up`}
                onClick={() => {
                  move(index, -1);
                }}
                className="rounded p-1 hover:bg-[var(--admin-surface-high)] disabled:opacity-30"
              >
                <ArrowUp className="h-4 w-4" aria-hidden="true" />
              </button>
              <button
                type="button"
                disabled={disabled || index === displayOrder.length - 1}
                aria-label={`Move "${item.label}" down`}
                onClick={() => {
                  move(index, 1);
                }}
                className="rounded p-1 hover:bg-[var(--admin-surface-high)] disabled:opacity-30"
              >
                <ArrowDown className="h-4 w-4" aria-hidden="true" />
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function MatchingResponseEditor({
  leftItems,
  rightItems,
  pairs,
  disabled,
  onChange,
}: {
  leftItems: LabeledId[];
  rightItems: LabeledId[];
  pairs: Record<string, string>;
  disabled: boolean;
  onChange: (pairs: Record<string, string>) => void;
}) {
  return (
    <div className="space-y-3">
      {leftItems.map((left) => (
        <label
          key={left.id}
          className="flex flex-col gap-2 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-3 sm:flex-row sm:items-center sm:justify-between"
        >
          <span className="text-sm font-semibold text-[var(--admin-on-surface)]">{left.label}</span>
          <select
            aria-label={`Match for "${left.label}"`}
            disabled={disabled}
            value={pairs[left.id] ?? ""}
            onChange={(event) => {
              onChange({ ...pairs, [left.id]: event.target.value });
            }}
            className={`${editorInputClassName} sm:max-w-xs`}
          >
            <option value="">Choose a match</option>
            {rightItems.map((right) => (
              <option key={right.id} value={right.id}>
                {right.label}
              </option>
            ))}
          </select>
        </label>
      ))}
    </div>
  );
}

export function createEmptyResponse(itemTypeKey: string): ItemResponseUiState {
  return emptyResponseState(itemTypeKey);
}

export function wireFromResponse(state: ItemResponseUiState): Record<string, unknown> | null {
  return responseToWire(state);
}
