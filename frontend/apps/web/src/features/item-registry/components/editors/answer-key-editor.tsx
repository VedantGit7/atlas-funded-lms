"use client";

import {
  answerKeyToUiState,
  readAnswerKeyExplanation,
  withAnswerKeyExplanation,
  type ItemAnswerKeyUiState,
  uiStateToAnswerKey,
} from "@atlas/contracts/item-registry/answer-contracts";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { EditorOptionRow } from "../shared/item-options-builder";
import {
  answerKeyFromOptions,
  ItemOptionsBuilder,
} from "../shared/item-options-builder";
import { AnswerKeyExplanationEditor } from "../shared/answer-key-explanation-editor";
import {
  chipButtonClassName,
  editorHintClassName,
  editorInputClassName,
  editorLabelClassName,
  editorPanelClassName,
} from "../shared/editor-styles";
import { getItemTypeVisual } from "../item-type-config";

type AnswerKeyEditorProps = {
  itemTypeKey: string;
  value: Record<string, unknown>;
  onChange: (value: Record<string, unknown>) => void;
  options: EditorOptionRow[];
  onOptionsChange?: (options: EditorOptionRow[]) => void;
};

type LabeledId = { id: string; label: string };

let editorRowIdCounter = 0;

function createId(prefix: string): string {
  editorRowIdCounter += 1;
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${prefix}-${String(Date.now())}-${String(editorRowIdCounter)}-${String(Math.random()).slice(2, 9)}`;
}

function defaultLabeledItems(prefix: string, labels: string[]): LabeledId[] {
  return labels.map((label, index) => ({
    id: `${prefix}-default-${String(index)}`,
    label,
  }));
}

export function AnswerKeyEditor({
  itemTypeKey,
  value,
  onChange,
  options,
  onOptionsChange,
}: AnswerKeyEditorProps) {
  const uiState = useMemo(() => answerKeyToUiState(itemTypeKey, value), [itemTypeKey, value]);
  const typeVisual = getItemTypeVisual(itemTypeKey);
  const explanation = readAnswerKeyExplanation(value);

  function preserveExplanation(next: Record<string, unknown>) {
    onChange(withAnswerKeyExplanation(next, explanation));
  }

  function commit(next: ItemAnswerKeyUiState) {
    preserveExplanation(uiStateToAnswerKey(next));
  }

  let typeEditor: ReactNode = null;

  if (itemTypeKey === "mcq_single" || itemTypeKey === "mcq_multi") {
    typeEditor = (
      <div className={editorPanelClassName}>
        {onOptionsChange ? (
          <ItemOptionsBuilder
            options={options}
            onChange={(next) => {
              onOptionsChange(next);
              preserveExplanation(
                answerKeyFromOptions(next, itemTypeKey === "mcq_single" ? "single" : "multi"),
              );
            }}
            mode={itemTypeKey === "mcq_single" ? "single" : "multi"}
          />
        ) : (
          <p className={editorHintClassName}>Options builder unavailable.</p>
        )}
      </div>
    );
  } else if (uiState.type === "true_false") {
    typeEditor = (
      <div className={`${editorPanelClassName} grid grid-cols-2 gap-3`}>
        {[
          { label: "True is correct", value: true },
          { label: "False is correct", value: false },
        ].map((choice) => (
          <button
            key={choice.label}
            type="button"
            onClick={() => {
              commit({ type: "true_false", value: choice.value });
            }}
            className={`${chipButtonClassName} ${
              uiState.value === choice.value
                ? typeVisual.chipClassName
                : "border-[var(--admin-border)] bg-[var(--admin-surface-low)] text-[var(--admin-on-surface-variant)] hover:bg-[var(--admin-surface-high)]"
            }`}
          >
            {choice.label}
          </button>
        ))}
      </div>
    );
  } else if (uiState.type === "fill_blank") {
    typeEditor = (
      <AcceptedValuesEditor
        values={uiState.acceptedValues}
        onChange={(acceptedValues) => {
          commit({ type: "fill_blank", acceptedValues });
        }}
        addLabel="Add accepted answer"
      />
    );
  } else if (uiState.type === "swipe") {
    typeEditor = (
      <div className={`${editorPanelClassName} grid grid-cols-2 gap-3`}>
        {[
          { label: "Known (swipe right)", direction: "right" as const },
          { label: "Unknown (swipe left)", direction: "left" as const },
        ].map((choice) => (
          <button
            key={choice.direction}
            type="button"
            onClick={() => {
              commit({ type: "swipe", direction: choice.direction });
            }}
            className={`${chipButtonClassName} ${
              uiState.direction === choice.direction
                ? typeVisual.chipClassName
                : "border-[var(--admin-border)] bg-[var(--admin-surface-low)] text-[var(--admin-on-surface-variant)] hover:bg-[var(--admin-surface-high)]"
            }`}
          >
            {choice.label}
          </button>
        ))}
      </div>
    );
  } else if (uiState.type === "short_answer" || uiState.type === "long_answer") {
    typeEditor = (
      <ManualRubricEditor
        rubric={uiState.rubric}
        modelAnswer={uiState.modelAnswer}
        onChange={(patch) => {
          commit({ ...uiState, ...patch });
        }}
        long={uiState.type === "long_answer"}
      />
    );
  } else if (uiState.type === "file_upload") {
    typeEditor = (
      <div className={`${editorPanelClassName} space-y-4`}>
        <ManualRubricEditor
          rubric={uiState.rubric}
          modelAnswer=""
          onChange={(patch) => {
            commit({ ...uiState, rubric: patch.rubric });
          }}
          long={false}
          modelAnswerLabel="Reference file name (optional)"
        />
        <AcceptedValuesEditor
          values={uiState.acceptedFileTypes.length > 0 ? uiState.acceptedFileTypes : ["pdf"]}
          onChange={(acceptedFileTypes) => {
            commit({ ...uiState, acceptedFileTypes });
          }}
          addLabel="Add file extension"
          placeholder=".pdf"
        />
      </div>
    );
  } else if (uiState.type === "ordering") {
    typeEditor = (
      <OrderingKeyEditor
        order={uiState.order}
        labels={readLabelMap(value)}
        onChange={(order, labels) => {
          preserveExplanation({ order, items: labels });
        }}
      />
    );
  } else if (uiState.type === "matching") {
    typeEditor = (
      <MatchingKeyEditor
        pairs={uiState.pairs}
        meta={readMatchingMeta(value)}
        onChange={(pairs, meta) => {
          preserveExplanation({
            pairs,
            leftItems: meta.leftItems,
            rightItems: meta.rightItems,
          });
        }}
      />
    );
  }

  return (
    <div className="space-y-4">
      {typeEditor}
      <AnswerKeyExplanationEditor
        value={explanation}
        onChange={(nextExplanation) => {
          onChange(withAnswerKeyExplanation(value, nextExplanation));
        }}
      />
    </div>
  );
}

function AcceptedValuesEditor({
  values,
  onChange,
  addLabel,
  placeholder = "Accepted answer",
}: {
  values: string[];
  onChange: (values: string[]) => void;
  addLabel: string;
  placeholder?: string;
}) {
  const rows = values.length > 0 ? values : [""];

  return (
    <div className={`${editorPanelClassName} space-y-2`}>
      {rows.map((entry, index) => (
        <div key={`${String(index)}-accepted`} className="flex gap-2">
          <input
            type="text"
            value={entry}
            placeholder={placeholder}
            onChange={(event) => {
              const next = [...rows];
              next[index] = event.target.value;
              onChange(next);
            }}
            className={editorInputClassName}
          />
          <button
            type="button"
            aria-label="Remove value"
            disabled={rows.length <= 1}
            onClick={() => {
              onChange(rows.filter((_, rowIndex) => rowIndex !== index));
            }}
            className="rounded-lg border border-[var(--admin-border)] px-2 text-[var(--admin-on-surface-variant)] hover:text-[var(--admin-danger)] disabled:opacity-40"
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => {
          onChange([...rows, ""]);
        }}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--admin-primary)]"
      >
        <Plus className="h-4 w-4" aria-hidden="true" />
        {addLabel}
      </button>
    </div>
  );
}

function ManualRubricEditor({
  rubric,
  modelAnswer,
  onChange,
  long,
  modelAnswerLabel = "Model answer (optional)",
}: {
  rubric: string;
  modelAnswer: string;
  onChange: (patch: { rubric: string; modelAnswer: string }) => void;
  long: boolean;
  modelAnswerLabel?: string;
}) {
  return (
    <div className={`${editorPanelClassName} space-y-4`}>
      <div>
        <label className={editorLabelClassName}>Grading rubric</label>
        <textarea
          rows={long ? 5 : 3}
          value={rubric}
          onChange={(event) => {
            onChange({ rubric: event.target.value, modelAnswer });
          }}
          placeholder="What should instructors look for when grading?"
          className={`${editorInputClassName} resize-y leading-relaxed`}
        />
      </div>
      <div>
        <label className={editorLabelClassName}>{modelAnswerLabel}</label>
        {long ? (
          <textarea
            rows={4}
            value={modelAnswer}
            onChange={(event) => {
              onChange({ rubric, modelAnswer: event.target.value });
            }}
            className={`${editorInputClassName} resize-y leading-relaxed`}
          />
        ) : (
          <input
            type="text"
            value={modelAnswer}
            onChange={(event) => {
              onChange({ rubric, modelAnswer: event.target.value });
            }}
            className={editorInputClassName}
          />
        )}
      </div>
    </div>
  );
}

function readLabelMap(value: Record<string, unknown>): Record<string, string> {
  if (value["items"] && typeof value["items"] === "object" && !Array.isArray(value["items"])) {
    return value["items"] as Record<string, string>;
  }
  return {};
}

function OrderingKeyEditor({
  order,
  labels,
  onChange,
}: {
  order: string[];
  labels: Record<string, string>;
  onChange: (order: string[], labels: Record<string, string>) => void;
}) {
  const [items, setItems] = useState<LabeledId[]>(() => {
    if (order.length > 0) {
      return order.map((id) => ({ id, label: labels[id] ?? id }));
    }
    return defaultLabeledItems("step", ["First step", "Second step", "Third step"]);
  });

  const didSeedRef = useRef(false);

  useEffect(() => {
    if (order.length > 0 || didSeedRef.current) return;
    didSeedRef.current = true;
    onChange(
      items.map((item) => item.id),
      Object.fromEntries(items.map((item) => [item.id, item.label])),
    );
  }, [order.length, items, onChange]);

  function emit(nextItems: LabeledId[]) {
    setItems(nextItems);
    onChange(
      nextItems.map((item) => item.id),
      Object.fromEntries(nextItems.map((item) => [item.id, item.label])),
    );
  }

  function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    const temp = next[index];
    const swap = next[target];
    if (!temp || !swap) return;
    next[index] = swap;
    next[target] = temp;
    emit(next);
  }

  return (
    <div className={`${editorPanelClassName} space-y-2`}>
      <p className={editorHintClassName}>Arrange steps in the correct order (top to bottom).</p>
      <ul className="space-y-2">
        {items.map((item, index) => (
          <li
            key={item.id}
            className="flex items-center gap-2 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-2 motion-safe:transition-transform motion-safe:duration-200"
          >
            <span className="w-6 text-center text-xs font-bold text-[var(--admin-on-surface-variant)]">
              {index + 1}
            </span>
            <input
              type="text"
              value={item.label}
              onChange={(event) => {
                emit(
                  items.map((entry) =>
                    entry.id === item.id ? { ...entry, label: event.target.value } : entry,
                  ),
                );
              }}
              className={`${editorInputClassName} flex-1`}
            />
              <button type="button" aria-label="Move up" disabled={index === 0} onClick={() => { move(index, -1); }} className="rounded p-1 hover:bg-[var(--admin-surface-high)] disabled:opacity-30">
              <ArrowUp className="h-4 w-4" aria-hidden="true" />
            </button>
            <button type="button" aria-label="Move down" disabled={index === items.length - 1} onClick={() => { move(index, 1); }} className="rounded p-1 hover:bg-[var(--admin-surface-high)] disabled:opacity-30">
              <ArrowDown className="h-4 w-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              aria-label="Remove step"
              disabled={items.length <= 2}
              onClick={() => {
                emit(items.filter((entry) => entry.id !== item.id));
              }}
              className="rounded p-1 hover:text-[var(--admin-danger)] disabled:opacity-30"
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={() => {
          emit([...items, { id: createId("step"), label: "" }]);
        }}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--admin-primary)]"
      >
        <Plus className="h-4 w-4" aria-hidden="true" />
        Add step
      </button>
    </div>
  );
}

function readMatchingMeta(value: Record<string, unknown>): {
  leftItems: LabeledId[];
  rightItems: LabeledId[];
} {
  const leftRaw = value["leftItems"];
  const rightRaw = value["rightItems"];
  const pairs =
    value["pairs"] && typeof value["pairs"] === "object" && !Array.isArray(value["pairs"])
      ? (value["pairs"] as Record<string, string>)
      : {};

  const leftItems =
    leftRaw && typeof leftRaw === "object" && !Array.isArray(leftRaw)
      ? Object.entries(leftRaw as Record<string, string>).map(([id, label]) => ({ id, label }))
      : Object.keys(pairs).map((id) => ({ id, label: id }));

  const rightItems =
    rightRaw && typeof rightRaw === "object" && !Array.isArray(rightRaw)
      ? Object.entries(rightRaw as Record<string, string>).map(([id, label]) => ({ id, label }))
      : [...new Set(Object.values(pairs))].map((id) => ({ id, label: id }));

  if (leftItems.length === 0 && rightItems.length === 0) {
    return {
      leftItems: defaultLabeledItems("left", ["Term A", "Term B"]),
      rightItems: defaultLabeledItems("right", ["Definition 1", "Definition 2"]),
    };
  }

  return { leftItems, rightItems };
}

function MatchingKeyEditor({
  pairs,
  meta,
  onChange,
}: {
  pairs: Record<string, string>;
  meta: { leftItems: LabeledId[]; rightItems: LabeledId[] };
  onChange: (
    pairs: Record<string, string>,
    meta: { leftItems: Record<string, string>; rightItems: Record<string, string> },
  ) => void;
}) {
  const [leftItems, setLeftItems] = useState(meta.leftItems);
  const [rightItems, setRightItems] = useState(meta.rightItems);
  const [localPairs, setLocalPairs] = useState(pairs);

  function emitPairs(nextPairs: Record<string, string>) {
    setLocalPairs(nextPairs);
    onChange(nextPairs, {
      leftItems: Object.fromEntries(leftItems.map((item) => [item.id, item.label])),
      rightItems: Object.fromEntries(rightItems.map((item) => [item.id, item.label])),
    });
  }

  function emitMeta(nextLeft: LabeledId[], nextRight: LabeledId[], nextPairs = localPairs) {
    setLeftItems(nextLeft);
    setRightItems(nextRight);
    setLocalPairs(nextPairs);
    onChange(nextPairs, {
      leftItems: Object.fromEntries(nextLeft.map((item) => [item.id, item.label])),
      rightItems: Object.fromEntries(nextRight.map((item) => [item.id, item.label])),
    });
  }

  function removeLeft(itemId: string) {
    if (leftItems.length <= 2) return;
    const nextLeft = leftItems.filter((entry) => entry.id !== itemId);
    const nextPairs = Object.fromEntries(
      Object.entries(localPairs).filter(([leftId]) => leftId !== itemId),
    );
    emitMeta(nextLeft, rightItems, nextPairs);
  }

  function removeRight(itemId: string) {
    if (rightItems.length <= 2) return;
    const nextRight = rightItems.filter((entry) => entry.id !== itemId);
    const nextPairs = Object.fromEntries(
      Object.entries(localPairs).filter(([, rightId]) => rightId !== itemId),
    );
    emitMeta(leftItems, nextRight, nextPairs);
  }

  return (
    <div className={`${editorPanelClassName} space-y-4`}>
      <p className={editorHintClassName}>Define prompts and matches, then pick the correct pairing for each prompt.</p>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--admin-on-surface-variant)]">Prompts</p>
          {leftItems.map((item) => (
            <div key={item.id} className="flex gap-2">
              <input
                type="text"
                value={item.label}
                placeholder="Term or prompt"
                onChange={(event) => {
                  emitMeta(
                    leftItems.map((entry) =>
                      entry.id === item.id ? { ...entry, label: event.target.value } : entry,
                    ),
                    rightItems,
                  );
                }}
                className={`${editorInputClassName} flex-1`}
              />
              <button
                type="button"
                aria-label="Remove prompt"
                disabled={leftItems.length <= 2}
                onClick={() => {
                  removeLeft(item.id);
                }}
                className="rounded-lg border border-[var(--admin-border)] px-2 text-[var(--admin-on-surface-variant)] hover:text-[var(--admin-danger)] disabled:opacity-40"
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => {
              emitMeta([...leftItems, { id: createId("left"), label: "" }], rightItems);
            }}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--admin-primary)]"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Add prompt
          </button>
        </div>
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--admin-on-surface-variant)]">Matches</p>
          {rightItems.map((item) => (
            <div key={item.id} className="flex gap-2">
              <input
                type="text"
                value={item.label}
                placeholder="Definition or match"
                onChange={(event) => {
                  emitMeta(
                    leftItems,
                    rightItems.map((entry) =>
                      entry.id === item.id ? { ...entry, label: event.target.value } : entry,
                    ),
                  );
                }}
                className={`${editorInputClassName} flex-1`}
              />
              <button
                type="button"
                aria-label="Remove match"
                disabled={rightItems.length <= 2}
                onClick={() => {
                  removeRight(item.id);
                }}
                className="rounded-lg border border-[var(--admin-border)] px-2 text-[var(--admin-on-surface-variant)] hover:text-[var(--admin-danger)] disabled:opacity-40"
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => {
              emitMeta(leftItems, [...rightItems, { id: createId("right"), label: "" }]);
            }}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--admin-primary)]"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Add match
          </button>
        </div>
      </div>
      <div className="space-y-2">
        {leftItems.map((left) => (
          <label key={left.id} className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
            <span className="min-w-0 flex-1 text-sm font-medium text-[var(--admin-on-surface)]">{left.label || left.id}</span>
            <select
              value={localPairs[left.id] ?? ""}
              onChange={(event) => {
                emitPairs({ ...localPairs, [left.id]: event.target.value });
              }}
              className={`${editorInputClassName} sm:max-w-xs`}
            >
              <option value="">Select match</option>
              {rightItems.map((right) => (
                <option key={right.id} value={right.id}>
                  {right.label || right.id}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
    </div>
  );
}
