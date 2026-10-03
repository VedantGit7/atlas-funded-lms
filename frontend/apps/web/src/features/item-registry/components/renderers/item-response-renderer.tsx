"use client";

import {
  buildPreviewOptions,
  emptyResponseState,
  responseFromWire,
  responseToWire,
  type ItemOptionWire,
  type ItemResponseUiState,
} from "@atlas/contracts/item-registry/answer-ui";
import { ArrowDown, ArrowUp, Upload } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { getItemTypeVisual } from "../item-type-config";
import { SwipeCardPreview } from "../swipe-card-preview";
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
};

type LabeledId = { id: string; label: string };

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

  if (order.length > 0) {
    return order.map((id) => ({ id, label: labels[id] ?? id }));
  }

  return [
    { id: "step-1", label: "First step" },
    { id: "step-2", label: "Second step" },
    { id: "step-3", label: "Third step" },
  ];
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
    return (
      <OrderingResponseEditor
        items={readOrderingItems(answerKey)}
        order={
          state.order.length > 0 ? state.order : readOrderingItems(answerKey).map((item) => item.id)
        }
        disabled={disabled}
        onChange={(order) => {
          updateState({ type: "ordering", order });
        }}
      />
    );
  }

  if (itemTypeKey === "matching" && state.type === "matching") {
    const { leftItems, rightItems } = readMatchingLists(answerKey);
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
      <div className="rounded-xl border border-dashed border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-4 py-8 text-center motion-safe:transition-colors motion-safe:duration-200 hover:border-[color-mix(in_srgb,var(--admin-primary)_35%,var(--admin-border))]">
        <Upload
          className="mx-auto h-8 w-8 text-[var(--admin-on-surface-variant)]"
          aria-hidden="true"
        />
        <p className="mt-2 text-sm font-medium text-[var(--admin-on-surface)]">Drop a file here</p>
        <p className="mt-1 text-xs text-[var(--admin-on-surface-variant)]">
          Or enter a file name for preview simulation.
        </p>
        <input
          type="text"
          disabled={disabled}
          value={state.fileName}
          onChange={(event) => {
            updateState({ type: "file_upload", fileName: event.target.value });
          }}
          placeholder="example-chart.png"
          className={`${editorInputClassName} mx-auto mt-4 max-w-sm`}
          aria-label="Simulated file name"
        />
      </div>
    );
  }

  if (
    (itemTypeKey === "fill_blank" ||
      itemTypeKey === "short_answer" ||
      itemTypeKey === "long_answer") &&
    (state.type === "fill_blank" || state.type === "short_answer" || state.type === "long_answer")
  ) {
    const isLong = itemTypeKey === "long_answer";
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
            onChange={(event) => {
              updateState({ ...state, value: event.target.value });
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
            placeholder={
              itemTypeKey === "fill_blank" ? "Type the missing word..." : "Type your answer..."
            }
          />
        )}
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
        Drag steps into the correct order.
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
                aria-label="Move up"
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
                aria-label="Move down"
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
