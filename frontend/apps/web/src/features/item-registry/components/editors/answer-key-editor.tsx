"use client";

import {
  answerKeyToUiState,
  readAnswerKeyExplanation,
  withAnswerKeyExplanation,
  type ItemAnswerKeyUiState,
  uiStateToAnswerKey,
} from "@atlas/contracts/item-registry/answer-contracts";
import { countBlanks } from "@atlas/contracts/item-registry/answer-rules.contract";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { EditorOptionRow } from "../shared/item-options-builder";
import { answerKeyFromOptions, ItemOptionsBuilder } from "../shared/item-options-builder";
import { AnswerKeyExplanationEditor } from "../shared/answer-key-explanation-editor";
import {
  chipButtonClassName,
  editorHintClassName,
  editorInputClassName,
  editorLabelClassName,
  editorPanelClassName,
} from "../shared/editor-styles";
import { getItemTypeVisual } from "../item-type-config";

/** A small number box: the shared input style without its full width. */
const editorNumberInputClassName = `${editorInputClassName.replace("w-full ", "")} text-right tabular-nums`;

type AnswerKeyEditorProps = {
  itemTypeKey: string;
  value: Record<string, unknown>;
  onChange: (value: Record<string, unknown>) => void;
  options: EditorOptionRow[];
  onOptionsChange?: (options: EditorOptionRow[]) => void;
  /** The question, so a fill-in-the-blank can follow its blanks (____). */
  stem?: string;
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
  stem = "",
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
      <BlanksEditor
        blanks={uiState.blanks}
        blanksInStem={countBlanks(stem)}
        onChange={(blanks) => {
          commit({ type: "fill_blank", blanks });
        }}
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
  } else if (uiState.type === "short_answer") {
    typeEditor = (
      <div className="space-y-4">
        <KeywordsEditor
          keywords={uiState.keywords}
          required={uiState.keywordsRequired}
          onChange={(keywords, keywordsRequired) => {
            commit({ ...uiState, keywords, keywordsRequired });
          }}
        />
        <ManualRubricEditor
          rubric={uiState.rubric}
          modelAnswer={uiState.modelAnswer}
          onChange={(patch) => {
            commit({ ...uiState, ...patch });
          }}
          long={false}
          rubricHint={
            uiState.keywords.some((keyword) => keyword.trim())
              ? "Marked by its keywords; the rubric and model answer are shown with the result."
              : null
          }
        />
      </div>
    );
  } else if (uiState.type === "long_answer") {
    typeEditor = (
      <div className="space-y-4">
        <WordLimitEditor
          maxWords={uiState.maxWords}
          onChange={(maxWords) => {
            commit({ ...uiState, maxWords });
          }}
        />
        <ManualRubricEditor
          rubric={uiState.rubric}
          modelAnswer={uiState.modelAnswer}
          onChange={(patch) => {
            commit({ ...uiState, ...patch });
          }}
          long
        />
      </div>
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

/**
 * Accepted answers for each blank (QA review 1 M48: one blank only, and no
 * word on how it's marked). Follows the blanks written in the question.
 */
function BlanksEditor({
  blanks,
  blanksInStem,
  onChange,
}: {
  blanks: string[][];
  blanksInStem: number;
  onChange: (blanks: string[][]) => void;
}) {
  const count = Math.max(blanksInStem, blanks.length, 1);
  const shown = Array.from({ length: count }, (_, index) => blanks[index] ?? [""]);
  const several = count > 1;

  return (
    <div className="space-y-3">
      <p className={editorHintClassName}>
        Mark each blank in the question with ____ (three or more underscores).
        {blanksInStem > 0
          ? ` The question has ${String(blanksInStem)} ${blanksInStem === 1 ? "blank" : "blanks"}.`
          : " The question has no blank marked yet."}{" "}
        Every accepted answer counts as right; capitals and extra spaces are ignored.
        {several ? " Each right blank earns an equal share of the question's marks." : ""}
      </p>
      {shown.map((values, index) => (
        <div key={`blank-${String(index)}`} className="space-y-1.5">
          {several ? (
            <div className="flex items-center justify-between gap-2">
              <span className={editorLabelClassName}>Blank {index + 1}</span>
              {index >= blanksInStem && count > 1 ? (
                <button
                  type="button"
                  onClick={() => {
                    onChange(shown.filter((_, position) => position !== index));
                  }}
                  className="text-xs font-medium text-[var(--admin-danger)] hover:underline"
                >
                  Remove this blank
                </button>
              ) : null}
            </div>
          ) : null}
          <AcceptedValuesEditor
            values={values}
            onChange={(next) => {
              onChange(shown.map((entry, position) => (position === index ? next : entry)));
            }}
            addLabel="Add another accepted answer"
          />
        </div>
      ))}
    </div>
  );
}

/**
 * Keywords that mark a short answer automatically (QA review 1 m25). Empty:
 * a person marks it.
 */
function KeywordsEditor({
  keywords,
  required,
  onChange,
}: {
  keywords: string[];
  required: number | null;
  onChange: (keywords: string[], required: number | null) => void;
}) {
  const filled = keywords.filter((keyword) => keyword.trim()).length;
  const rows = keywords.length > 0 ? keywords : [""];
  const needed = required ?? filled;

  return (
    <div className={`${editorPanelClassName} space-y-3`}>
      <div>
        <span className={editorLabelClassName}>Keywords (optional)</span>
        <p className={editorHintClassName}>
          With keywords, the answer is marked automatically: full marks when it contains enough of
          them as whole words or phrases (capitals ignored), none otherwise. Leave empty to mark
          answers yourself.
        </p>
      </div>
      {rows.map((keyword, index) => (
        <div key={`keyword-${String(index)}`} className="flex gap-2">
          <input
            type="text"
            value={keyword}
            placeholder="Keyword or phrase, e.g. stop loss"
            aria-label={`Keyword ${String(index + 1)}`}
            onChange={(event) => {
              const next = [...rows];
              next[index] = event.target.value;
              onChange(next, required);
            }}
            className={editorInputClassName}
          />
          <button
            type="button"
            aria-label={`Remove keyword ${String(index + 1)}`}
            disabled={rows.length <= 1 && !keyword}
            onClick={() => {
              const next = rows.filter((_, position) => position !== index);
              onChange(next, required != null && required > next.length ? null : required);
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
          onChange([...rows, ""], required);
        }}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--admin-primary)]"
      >
        <Plus className="h-4 w-4" aria-hidden="true" />
        Add keyword
      </button>
      {filled > 1 ? (
        <label className="flex flex-wrap items-center gap-2 text-sm text-[var(--admin-on-surface)]">
          Full marks when the answer has at least
          <input
            type="number"
            min={1}
            max={filled}
            value={needed}
            onChange={(event) => {
              const value = Math.floor(Number(event.target.value));
              onChange(rows, Number.isFinite(value) && value >= 1 ? Math.min(value, filled) : null);
            }}
            className={`${editorNumberInputClassName} w-16`}
            aria-label="Keywords needed for full marks"
          />
          of the {filled} keywords.
        </label>
      ) : null}
    </div>
  );
}

/** A long answer's word limit (QA review 1 m25). Empty: no limit. */
function WordLimitEditor({
  maxWords,
  onChange,
}: {
  maxWords: number | null;
  onChange: (maxWords: number | null) => void;
}) {
  return (
    <div className={`${editorPanelClassName} space-y-2`}>
      <label className={editorLabelClassName} htmlFor="answer-key-word-limit">
        Word limit (optional)
      </label>
      <div className="flex items-center gap-2">
        <input
          id="answer-key-word-limit"
          type="number"
          min={1}
          max={5000}
          value={maxWords ?? ""}
          placeholder="None"
          onChange={(event) => {
            const raw = event.target.value.trim();
            const value = Math.floor(Number(raw));
            onChange(raw && Number.isFinite(value) && value >= 1 ? value : null);
          }}
          className={`${editorNumberInputClassName} w-28`}
        />
        <span className="text-sm text-[var(--admin-on-surface-variant)]">words</span>
      </div>
      <p className={editorHintClassName}>
        Learners see a word count as they write, and an answer over the limit isn&apos;t saved.
      </p>
    </div>
  );
}

function ManualRubricEditor({
  rubric,
  modelAnswer,
  onChange,
  long,
  modelAnswerLabel = "Model answer (optional)",
  rubricHint = null,
}: {
  rubric: string;
  modelAnswer: string;
  onChange: (patch: { rubric: string; modelAnswer: string }) => void;
  long: boolean;
  modelAnswerLabel?: string;
  rubricHint?: string | null;
}) {
  return (
    <div className={`${editorPanelClassName} space-y-4`}>
      {rubricHint ? <p className={editorHintClassName}>{rubricHint}</p> : null}
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
    // Empty steps with placeholders (QA review 1 m24), not values that could be saved by mistake.
    return defaultLabeledItems("step", ["", "", ""]);
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
              placeholder={`Step ${String(index + 1)}`}
              aria-label={`Step ${String(index + 1)}`}
              onChange={(event) => {
                emit(
                  items.map((entry) =>
                    entry.id === item.id ? { ...entry, label: event.target.value } : entry,
                  ),
                );
              }}
              className={`${editorInputClassName} flex-1`}
            />
            <button
              type="button"
              aria-label="Move up"
              disabled={index === 0}
              onClick={() => {
                move(index, -1);
              }}
              className="rounded p-1 hover:bg-[var(--admin-surface-high)] disabled:opacity-30"
            >
              <ArrowUp className="h-4 w-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              aria-label="Move down"
              disabled={index === items.length - 1}
              onClick={() => {
                move(index, 1);
              }}
              className="rounded p-1 hover:bg-[var(--admin-surface-high)] disabled:opacity-30"
            >
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
      leftItems: defaultLabeledItems("left", ["", ""]),
      rightItems: defaultLabeledItems("right", ["", ""]),
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
      <p className={editorHintClassName}>
        Define prompts and matches, then pick the correct pairing for each prompt.
      </p>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--admin-on-surface-variant)]">
            Prompts
          </p>
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
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--admin-on-surface-variant)]">
            Matches
          </p>
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
            <span className="min-w-0 flex-1 text-sm font-medium text-[var(--admin-on-surface)]">
              {left.label || left.id}
            </span>
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
