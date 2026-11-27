"use client";

import {
  defaultAnswerKeyForType,
  parseAnswerKeyJson,
  readAnswerKeyExplanation,
  withAnswerKeyExplanation,
} from "@atlas/contracts/item-registry/answer-contracts";
import {
  describeItemDefinitionIssues,
  validateItemDefinition,
} from "@atlas/contracts/item-registry/item-definition.contract";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { AlertCircle, Eye, X } from "lucide-react";
import { primaryButtonClassName } from "../../../app/admin/branding/_components/branding-admin-shared";
import {
  inputClass,
  labelClass,
  secondaryButtonClassName,
} from "../../assessments/assessment-studio-shared";
import {
  formatItemRegistryApiError,
  itemRegistryApi,
  type ItemDto,
  type ItemTypeDto,
} from "../api";
import { AnswerKeyEditor } from "./editors/answer-key-editor";
import { ItemPreviewModal } from "./item-preview-modal";
import { getItemTypeVisual } from "./item-type-config";
import {
  editorOptionsFromSaved,
  editorOptionsToPayload,
  type EditorOptionRow,
} from "./shared/item-options-builder";

type QuestionComposerDialogProps = {
  open: boolean;
  /** Tags the new question starts with, e.g. the course's topic. */
  defaultTags?: string[];
  onCancel: () => void;
  /** The saved question, already in the question bank. */
  onCreated: (item: ItemDto) => void;
};

const CHOICE_TYPES = new Set(["mcq_single", "mcq_multi"]);

/**
 * Write a question without leaving the quiz (QA review 2 4.1: "can't write a
 * question inside the quiz"). It's saved to the question bank like any other,
 * so it can be reused, and the quiz adds it at the end.
 */
export function QuestionComposerDialog({
  open,
  defaultTags = [],
  onCancel,
  onCreated,
}: QuestionComposerDialogProps) {
  const titleId = useId();
  const stemId = useId();
  const tagsId = useId();
  const stemRef = useRef<HTMLTextAreaElement>(null);
  const [itemTypes, setItemTypes] = useState<ItemTypeDto[]>([]);
  const [itemTypeKey, setItemTypeKey] = useState("mcq_single");
  const [stem, setStem] = useState("");
  const [answerKeyJson, setAnswerKeyJson] = useState<Record<string, unknown>>(() =>
    defaultAnswerKeyForType("mcq_single"),
  );
  const [options, setOptions] = useState<EditorOptionRow[]>(() => editorOptionsFromSaved());
  const [tags, setTags] = useState(defaultTags.join(", "));
  const [typeSwitchToken, setTypeSwitchToken] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    setItemTypeKey("mcq_single");
    setStem("");
    setAnswerKeyJson(defaultAnswerKeyForType("mcq_single"));
    setOptions(editorOptionsFromSaved());
    setTags(defaultTags.join(", "));
    setError(null);
    window.setTimeout(() => stemRef.current?.focus(), 0);
    if (itemTypes.length === 0) {
      void itemRegistryApi
        .listItemTypes()
        .then((response) => {
          setItemTypes(response.data);
        })
        .catch((err: unknown) => {
          setError(formatItemRegistryApiError(err));
        });
    }
    // Reset only when the dialog opens.
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !saving && !previewOpen) onCancel();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, saving, previewOpen, onCancel]);

  const requiresOptions = CHOICE_TYPES.has(itemTypeKey);
  const answerKeyText = useMemo(() => JSON.stringify(answerKeyJson, null, 2), [answerKeyJson]);
  const previewOptions = requiresOptions
    ? options.map((option, index) => ({
        id: option.id,
        optionJson: { label: option.label },
        isCorrect: option.isCorrect,
        position: index + 1,
      }))
    : null;
  const typeName = itemTypes.find((type) => type.key === itemTypeKey)?.name ?? itemTypeKey;

  function chooseType(key: string) {
    setItemTypeKey(key);
    setAnswerKeyJson((current) =>
      withAnswerKeyExplanation(defaultAnswerKeyForType(key), readAnswerKeyExplanation(current)),
    );
    if (CHOICE_TYPES.has(key)) setOptions(editorOptionsFromSaved());
    setTypeSwitchToken((current) => current + 1);
  }

  async function save() {
    setError(null);
    const parsedKey = parseAnswerKeyJson(itemTypeKey, answerKeyJson);
    if (!parsedKey.ok) {
      setError(parsedKey.error);
      return;
    }
    const body = {
      itemTypeKey,
      contentJson: { stem },
      answerKeyJson: parsedKey.value,
      tags: tags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
      options: requiresOptions ? editorOptionsToPayload(options) : [],
    };
    const checked = validateItemDefinition({
      itemTypeKey,
      stem,
      answerKeyJson: body.answerKeyJson,
      options: body.options,
    });
    if (!checked.ok) {
      setError(describeItemDefinitionIssues(checked.issues));
      return;
    }

    setSaving(true);
    try {
      const response = await itemRegistryApi.createItem(body);
      onCreated(response.data);
    } catch (err) {
      setError(formatItemRegistryApiError(err));
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close"
        className="absolute inset-0 bg-[var(--admin-scrim)]"
        disabled={saving}
        onClick={() => {
          if (!saving) onCancel();
        }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative z-10 flex max-h-[min(48rem,calc(100dvh-2rem))] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-xl"
      >
        <header className="flex items-center justify-between gap-3 border-b border-[var(--admin-border)] px-5 py-4">
          <div>
            <h2 id={titleId} className="text-lg font-bold text-[var(--admin-on-surface)]">
              Write a question
            </h2>
            <p className="mt-0.5 text-xs text-[var(--admin-on-surface-variant)]">
              It&apos;s saved to the question bank too, so you can use it again.
            </p>
          </div>
          <button
            type="button"
            aria-label="Close"
            disabled={saving}
            onClick={onCancel}
            className="rounded-lg p-1.5 text-[var(--admin-on-surface-variant)] hover:bg-[var(--admin-surface-high)]"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </header>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-5">
          {error ? (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-lg border border-[color-mix(in_srgb,var(--admin-danger)_30%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-danger)_10%,var(--admin-surface))] px-3 py-2.5 text-sm text-[var(--admin-danger)]"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              {error}
            </div>
          ) : null}

          <fieldset>
            <legend className={labelClass}>Question type</legend>
            <div className="flex flex-wrap gap-2">
              {itemTypes.map((type) => {
                const visual = getItemTypeVisual(type.key);
                const Icon = visual.icon;
                const isSelected = itemTypeKey === type.key;
                return (
                  <button
                    key={type.key}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => {
                      chooseType(type.key);
                    }}
                    className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
                      isSelected
                        ? visual.chipClassName
                        : "border-[var(--admin-border)] bg-[var(--admin-surface-low)] text-[var(--admin-on-surface-variant)] hover:bg-[var(--admin-surface-high)]"
                    }`}
                  >
                    <Icon className="h-4 w-4" aria-hidden="true" />
                    {type.name || type.key}
                  </button>
                );
              })}
            </div>
          </fieldset>

          <div>
            <label className={labelClass} htmlFor={stemId}>
              Question
            </label>
            <textarea
              ref={stemRef}
              id={stemId}
              value={stem}
              rows={4}
              onChange={(event) => {
                setStem(event.target.value);
              }}
              className={`${inputClass} resize-y leading-relaxed`}
              placeholder="e.g. Your account is $10,000 and you risk 1% per trade. What's the most you can lose on one trade?"
            />
          </div>

          <div key={`${itemTypeKey}-${String(typeSwitchToken)}`} className="space-y-2">
            <span className={labelClass}>Answer</span>
            <AnswerKeyEditor
              itemTypeKey={itemTypeKey}
              value={answerKeyJson}
              onChange={setAnswerKeyJson}
              options={options}
              {...(requiresOptions ? { onOptionsChange: setOptions } : {})}
            />
          </div>

          <div>
            <label className={labelClass} htmlFor={tagsId}>
              Tags{" "}
              <span className="font-normal text-[var(--admin-on-surface-variant)]">(optional)</span>
            </label>
            <input
              id={tagsId}
              value={tags}
              onChange={(event) => {
                setTags(event.target.value);
              }}
              className={inputClass}
              placeholder="risk-management, position-sizing"
            />
            <p className="mt-1 text-xs text-[var(--admin-on-surface-variant)]">
              Separate tags with commas. Tags let you find it again and build random pools.
            </p>
          </div>
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--admin-border)] px-5 py-4">
          <button
            type="button"
            onClick={() => {
              setPreviewOpen(true);
            }}
            className={`${secondaryButtonClassName} inline-flex items-center gap-1.5`}
          >
            <Eye className="h-4 w-4" aria-hidden="true" />
            Preview as learner
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={saving}
              onClick={onCancel}
              className={secondaryButtonClassName}
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={saving || !stem.trim()}
              onClick={() => {
                void save();
              }}
              className={primaryButtonClassName}
            >
              {saving ? "Adding…" : "Add to quiz"}
            </button>
          </div>
        </footer>
      </div>

      <ItemPreviewModal
        open={previewOpen}
        onClose={() => {
          setPreviewOpen(false);
        }}
        itemTypeKey={itemTypeKey}
        typeName={typeName}
        stem={stem}
        answerKeyText={answerKeyText}
        answerKeyJson={answerKeyJson}
        {...(previewOptions ? { savedOptions: previewOptions } : {})}
      />
    </div>
  );
}
