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
import {
  ITEM_IMPORT_MAX_ROWS,
  ITEM_IMPORT_TYPE_NAMES,
  isImportableItemType,
} from "@atlas/contracts/item-registry/item-import.contract";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AlertCircle, Eye, FileSpreadsheet, Info, Save, Scale, Trash2, X } from "lucide-react";
import { AdminConfirmDialog } from "../../../components/shells/admin/AdminConfirmDialog";
import {
  catalogFilterButtonClassName,
  outlineButtonClassName,
  primaryButtonClassName,
} from "../../studio/courses/courses-catalog-shared";
import { itemRegistryApi, type ItemDto, type ItemTypeDto } from "../api";
import { AnswerKeyEditor } from "./editors/answer-key-editor";
import { ItemPreviewModal } from "./item-preview-modal";
import { getItemTypeVisual } from "./item-type-config";
import { AdvancedJsonPanel } from "./shared/advanced-json-panel";
import {
  editorOptionsFromSaved,
  editorOptionsToPayload,
  type EditorOptionRow,
} from "./shared/item-options-builder";

type DimensionWeight = {
  id: string;
  dimensionId: string;
  weight: string;
};

type CompetencyDimension = {
  id: string;
  key: string;
  name: string;
};

type Props = {
  itemId: string | null;
  item: ItemDto | null;
  itemTypes: ItemTypeDto[];
  dimensionWeights: DimensionWeight[];
  competencyDimensions: CompetencyDimension[];
};

const inputClass =
  "w-full rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-3 py-2 text-sm text-[var(--admin-on-surface)] placeholder:text-[var(--admin-on-surface-variant)] focus:border-[var(--admin-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--admin-primary)]/30 disabled:cursor-not-allowed disabled:bg-[var(--admin-surface-high)] disabled:opacity-60";

const labelClass = "mb-1 block text-sm font-medium text-[var(--admin-on-surface)]";

const errorBannerClassName =
  "flex items-start gap-2 rounded-lg border border-[color-mix(in_srgb,var(--admin-danger)_30%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-danger)_10%,var(--admin-surface))] px-3 py-2.5 text-sm text-[var(--admin-danger)]";

const infoBannerClassName =
  "flex items-start gap-2 rounded-lg border border-[var(--admin-border)] bg-[color-mix(in_srgb,var(--admin-surface-high)_40%,var(--admin-surface))] px-3 py-2.5 text-sm text-[var(--admin-on-surface-variant)]";

export function ItemEditorForm({
  itemId,
  item,
  itemTypes,
  dimensionWeights,
  competencyDimensions,
}: Props) {
  const [itemTypeKey, setItemTypeKey] = useState(item?.itemTypeKey ?? itemTypes[0]?.key ?? "");
  const [stem, setStem] = useState(
    typeof item?.contentJson === "object" &&
      item.contentJson !== null &&
      "stem" in item.contentJson &&
      typeof item.contentJson.stem === "string"
      ? item.contentJson.stem
      : "",
  );
  const [tags, setTags] = useState((item?.tags ?? []).join(", "));
  const [answerKeyJson, setAnswerKeyJson] = useState<Record<string, unknown>>(
    () =>
      (item?.answerKeyJson as Record<string, unknown> | undefined) ??
      defaultAnswerKeyForType(item?.itemTypeKey ?? itemTypes[0]?.key ?? "mcq_single"),
  );
  const [options, setOptions] = useState<EditorOptionRow[]>(() =>
    editorOptionsFromSaved(item?.options),
  );
  const [weights, setWeights] = useState(
    dimensionWeights.map((entry) => ({
      dimensionId: entry.dimensionId,
      weight: entry.weight,
    })),
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletePending, setDeletePending] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [weightsPending, setWeightsPending] = useState(false);
  const [weightsMessage, setWeightsMessage] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [typeSwitchToken, setTypeSwitchToken] = useState(0);
  const [templatePending, setTemplatePending] = useState(false);
  const [templateError, setTemplateError] = useState<string | null>(null);

  async function onDownloadTemplate() {
    setTemplatePending(true);
    setTemplateError(null);
    try {
      await itemRegistryApi.downloadItemImportTemplate(itemTypeKey);
    } catch (err) {
      setTemplateError(
        err instanceof Error ? err.message : "Could not download the template. Try again.",
      );
    } finally {
      setTemplatePending(false);
    }
  }

  const requiresOptions = itemTypeKey === "mcq_single" || itemTypeKey === "mcq_multi";
  const answerKeyText = useMemo(() => JSON.stringify(answerKeyJson, null, 2), [answerKeyJson]);
  const previewSavedOptions = useMemo(() => {
    if (requiresOptions) {
      return options.map((option, index) => ({
        id: option.id,
        optionJson: { label: option.label },
        isCorrect: option.isCorrect,
        position: index + 1,
      }));
    }
    if (!item?.options) return null;
    return item.options.map((option) => ({
      id: option.id,
      optionJson: option.optionJson ?? { label: "" },
      isCorrect: option.isCorrect,
      position: option.position,
    }));
  }, [requiresOptions, options, item?.options]);

  useEffect(() => {
    if (!requiresOptions) return;
    setOptions((current) => (current.length > 0 ? current : editorOptionsFromSaved()));
  }, [requiresOptions, itemTypeKey]);

  useEffect(() => {
    setWeights(
      dimensionWeights.map((entry) => ({
        dimensionId: entry.dimensionId,
        weight: entry.weight,
      })),
    );
  }, [dimensionWeights]);

  const dimensionNameById = new Map(
    competencyDimensions.map((dimension) => [dimension.id, dimension.name]),
  );

  /** Deletes the question; the server refuses one that is in use. */
  async function onDelete() {
    if (!itemId) return;
    setDeletePending(true);
    setDeleteError(null);
    try {
      await itemRegistryApi.deleteItem(itemId);
      window.location.href = "/studio/items";
    } catch (err) {
      setDeleteError(
        err instanceof Error ? err.message : "The question could not be deleted. Try again.",
      );
      setDeletePending(false);
    }
  }

  async function onSubmit() {
    setPending(true);
    setError(null);

    try {
      const parsedKey = parseAnswerKeyJson(itemTypeKey, answerKeyJson);
      if (!parsedKey.ok) {
        setError(parsedKey.error);
        setPending(false);
        return;
      }

      const body = {
        itemTypeKey,
        contentJson: { stem },
        answerKeyJson: parsedKey.value,
        tags: tags
          .split(",")
          .map((tag: string) => tag.trim())
          .filter(Boolean),
        options: requiresOptions ? editorOptionsToPayload(options) : [],
      };

      // The same rules the server applies, so the author sees what to fix
      // before saving instead of after.
      const checked = validateItemDefinition({
        itemTypeKey,
        stem,
        answerKeyJson: body.answerKeyJson,
        options: body.options,
      });
      if (!checked.ok) {
        setError(describeItemDefinitionIssues(checked.issues));
        setPending(false);
        return;
      }

      if (itemId) {
        await itemRegistryApi.updateItem(itemId, {
          contentJson: body.contentJson,
          answerKeyJson: body.answerKeyJson,
          tags: body.tags,
          options: body.options,
        });
      } else {
        await itemRegistryApi.createItem(body);
      }

      window.location.href = "/studio/items";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save item");
    } finally {
      setPending(false);
    }
  }

  async function onSaveWeights() {
    if (!itemId) return;

    setWeightsPending(true);
    setWeightsMessage(null);

    try {
      const response = await itemRegistryApi.putDimensionWeights(itemId, {
        weights: weights.map((entry) => ({
          dimensionId: entry.dimensionId,
          weight: Number(entry.weight),
        })),
      });
      setWeights(
        response.data.map((entry) => ({
          dimensionId: entry.dimensionId,
          weight: entry.weight,
        })),
      );
    } catch (err) {
      setWeightsMessage(err instanceof Error ? err.message : "Unable to save dimension weights");
    } finally {
      setWeightsPending(false);
    }
  }

  function addWeightRow() {
    const unused = competencyDimensions.find(
      (dimension) => !weights.some((entry) => entry.dimensionId === dimension.id),
    );
    if (!unused) return;
    setWeights((current) => [...current, { dimensionId: unused.id, weight: "0" }]);
  }

  const parsedTags = tags
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);

  const selectedTypeName = itemTypes.find((type) => type.key === itemTypeKey)?.name ?? itemTypeKey;

  return (
    <>
      <section className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-5 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5 shadow-sm">
          {error ? (
            <div role="alert" className={errorBannerClassName}>
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              {error}
            </div>
          ) : null}

          <div>
            <span className={labelClass}>Item type</span>
            {Boolean(itemId) && (
              <p className="mb-2 text-xs text-[var(--admin-on-surface-variant)]">
                Cannot be changed after creation
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              {itemTypes.map((type) => {
                const visual = getItemTypeVisual(type.key);
                const Icon = visual.icon;
                const isSelected = itemTypeKey === type.key;
                const isDisabled = Boolean(itemId);
                return (
                  <button
                    key={type.key}
                    type="button"
                    disabled={isDisabled}
                    onClick={() => {
                      if (isDisabled) return;
                      setItemTypeKey(type.key);
                      setAnswerKeyJson((current) =>
                        withAnswerKeyExplanation(
                          defaultAnswerKeyForType(type.key),
                          readAnswerKeyExplanation(current),
                        ),
                      );
                      if (type.key === "mcq_single" || type.key === "mcq_multi") {
                        setOptions(editorOptionsFromSaved());
                      }
                      setTypeSwitchToken((current) => current + 1);
                    }}
                    className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-colors motion-safe:active:scale-[0.98] ${
                      isSelected
                        ? visual.chipClassName
                        : "border-[var(--admin-border)] bg-[var(--admin-surface-low)] text-[var(--admin-on-surface-variant)] hover:bg-[var(--admin-surface-high)]"
                    } disabled:cursor-not-allowed disabled:opacity-50`}
                  >
                    <Icon className="h-4 w-4" aria-hidden="true" />
                    {type.name || type.key}
                  </button>
                );
              })}
            </div>
            {!itemId && isImportableItemType(itemTypeKey) ? (
              <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                <button
                  type="button"
                  disabled={templatePending}
                  onClick={() => {
                    void onDownloadTemplate();
                  }}
                  className="inline-flex items-center gap-1.5 rounded-md font-medium text-[var(--admin-primary)] underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/40 disabled:cursor-wait disabled:opacity-60"
                >
                  <FileSpreadsheet className="h-4 w-4" aria-hidden="true" />
                  {templatePending
                    ? "Preparing template…"
                    : `Download Excel template for ${ITEM_IMPORT_TYPE_NAMES[itemTypeKey]}`}
                </button>
                <span className="text-xs text-[var(--admin-on-surface-variant)]">
                  Add many questions of this type at once, up to{" "}
                  {ITEM_IMPORT_MAX_ROWS.toLocaleString("en")} per file, then{" "}
                  <Link
                    href={`/studio/items/import?type=${encodeURIComponent(itemTypeKey)}`}
                    className="font-medium text-[var(--admin-primary)] underline-offset-4 hover:underline"
                  >
                    upload it here
                  </Link>
                  .
                </span>
                {templateError ? (
                  <span role="alert" className="w-full text-xs text-[var(--admin-danger)]">
                    {templateError}
                  </span>
                ) : null}
              </div>
            ) : null}
          </div>

          <div>
            <label className={labelClass} htmlFor="item-stem">
              Stem / Prompt{" "}
              <span className="text-[var(--admin-danger)]" aria-hidden="true">
                *
              </span>
            </label>
            <p className="mb-1.5 text-xs text-[var(--admin-on-surface-variant)]">
              Write the question exactly as learners will see it.
            </p>
            <textarea
              id="item-stem"
              value={stem}
              onChange={(event) => {
                setStem(event.target.value);
              }}
              rows={8}
              className={`${inputClass} resize-y leading-relaxed`}
              placeholder="e.g. What candlestick pattern signals a potential reversal at a key support level?"
            />
            <p className="mt-1 text-right text-[11px] text-[var(--admin-on-surface-variant)]">
              {stem.length} characters
            </p>
          </div>

          <div
            key={`${itemTypeKey}-${String(typeSwitchToken)}`}
            className="space-y-3 motion-safe:animate-[admin-dropdown-in_0.22s_cubic-bezier(0.16,1,0.3,1)]"
          >
            <div>
              <span className={labelClass}>Answer key</span>
              <p className="mb-1.5 text-xs text-[var(--admin-on-surface-variant)]">
                Configure scoring visually. Each item type uses its own answer shape.
              </p>
            </div>

            <AnswerKeyEditor
              itemTypeKey={itemTypeKey}
              value={answerKeyJson}
              onChange={setAnswerKeyJson}
              options={options}
              {...(requiresOptions ? { onOptionsChange: setOptions } : {})}
            />

            <AdvancedJsonPanel
              label="Advanced answer key JSON"
              value={answerKeyJson}
              onChange={setAnswerKeyJson}
            />
          </div>

          <div>
            <label className={labelClass} htmlFor="item-tags">
              Tags
              <span className="ml-1 text-xs font-normal text-[var(--admin-on-surface-variant)]">
                (optional)
              </span>
            </label>
            <input
              id="item-tags"
              value={tags}
              onChange={(event) => {
                setTags(event.target.value);
              }}
              className={inputClass}
              placeholder="price-action, candlesticks, beginner"
            />
            <p className="mt-1 text-xs text-[var(--admin-on-surface-variant)]">
              Separate tags with commas. Used for filtering and collections.
            </p>
            {parsedTags.length > 0 ? (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {parsedTags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full bg-[var(--admin-surface-high)] px-2 py-0.5 text-[11px] font-medium text-[var(--admin-on-surface-variant)]"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            ) : null}
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={() => {
                setPreviewOpen(true);
              }}
              className={`${catalogFilterButtonClassName} inline-flex flex-1 items-center justify-center gap-1.5 py-2.5 motion-safe:active:scale-[0.98]`}
            >
              <Eye className="h-4 w-4" aria-hidden="true" />
              Preview as learner
            </button>
            <button
              type="button"
              onClick={() => {
                void onSubmit();
              }}
              disabled={pending}
              className={`${primaryButtonClassName} inline-flex flex-1 items-center justify-center py-2.5 motion-safe:active:scale-[0.98]`}
            >
              <Save className="h-4 w-4" aria-hidden="true" />
              {pending ? "Saving..." : itemId ? "Save changes" : "Save item"}
            </button>
          </div>
          {itemId ? (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setDeleteError(null);
                  setDeleteOpen(true);
                }}
                className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-medium text-[var(--admin-danger)] transition-colors hover:bg-[color-mix(in_srgb,var(--admin-danger)_8%,var(--admin-surface))]"
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
                Delete question
              </button>
            </div>
          ) : null}
          <AdminConfirmDialog
            open={deleteOpen}
            title="Delete this question?"
            description="It is removed from the item bank and learners stop seeing it. If a deck, collection or assessment uses it, or learners have answered it, it cannot be deleted; archive it instead."
            confirmLabel="Delete question"
            busyLabel="Deleting"
            tone="danger"
            icon={Trash2}
            busy={deletePending}
            error={deleteError}
            onConfirm={() => {
              void onDelete();
            }}
            onCancel={() => {
              if (deletePending) return;
              setDeleteOpen(false);
            }}
          />
        </div>

        <aside className="space-y-4 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--admin-on-surface-variant)]">
              Dimension weights
            </h2>
            {itemId && competencyDimensions.length > weights.length ? (
              <button
                type="button"
                onClick={addWeightRow}
                className="text-xs font-semibold text-[var(--admin-primary)] transition-colors hover:text-[var(--admin-primary-strong)]"
              >
                + Add dimension
              </button>
            ) : null}
          </div>

          {!itemId ? (
            <div className={infoBannerClassName}>
              <Info
                className="mt-0.5 h-4 w-4 shrink-0 text-[var(--admin-on-surface-variant)]"
                aria-hidden="true"
              />
              Save the item first to configure dimension weights.
            </div>
          ) : competencyDimensions.length === 0 ? (
            <div className={infoBannerClassName}>
              <Info
                className="mt-0.5 h-4 w-4 shrink-0 text-[var(--admin-on-surface-variant)]"
                aria-hidden="true"
              />
              No competency dimensions configured for this academy.
            </div>
          ) : weights.length === 0 ? (
            <div className="space-y-3">
              <p className="text-sm text-[var(--admin-on-surface-variant)]">
                No dimension weights configured yet.
              </p>
              <button
                type="button"
                onClick={addWeightRow}
                className={`${outlineButtonClassName} w-full px-3 py-2 motion-safe:active:scale-[0.98]`}
              >
                + Add first dimension
              </button>
            </div>
          ) : (
            <ul className="space-y-2">
              {weights.map((entry, index) => {
                const numericWeight = Number(entry.weight);
                const clampedWeight = Number.isFinite(numericWeight)
                  ? Math.min(1, Math.max(0, numericWeight))
                  : 0;

                return (
                  <li
                    key={`${entry.dimensionId}-${String(index)}`}
                    className="rounded-lg border border-[var(--admin-border)] bg-[color-mix(in_srgb,var(--admin-surface-high)_30%,var(--admin-surface))] px-3 py-2.5"
                  >
                    <div className="mb-1.5 flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-[var(--admin-on-surface)]">
                        {dimensionNameById.get(entry.dimensionId) ?? entry.dimensionId}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-bold text-[var(--admin-primary)]">
                          {clampedWeight.toFixed(2)}
                        </span>
                        <button
                          type="button"
                          aria-label={`Remove ${dimensionNameById.get(entry.dimensionId) ?? entry.dimensionId}`}
                          onClick={() => {
                            setWeights((current) =>
                              current.filter((_, rowIndex) => rowIndex !== index),
                            );
                          }}
                          className="rounded p-0.5 text-[var(--admin-on-surface-variant)] transition-colors hover:bg-[color-mix(in_srgb,var(--admin-danger)_12%,var(--admin-surface))] hover:text-[var(--admin-danger)]"
                        >
                          <X className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                    <div
                      className="mb-2 h-1.5 overflow-hidden rounded-full bg-[var(--admin-surface-high)]"
                      aria-hidden="true"
                    >
                      <div
                        className="h-full rounded-full bg-[var(--admin-primary)] transition-[width] duration-150"
                        style={{ width: `${String(clampedWeight * 100)}%` }}
                      />
                    </div>
                    <input
                      type="number"
                      min={0}
                      max={1}
                      step={0.01}
                      value={entry.weight}
                      onChange={(event) => {
                        const value = event.target.value;
                        setWeights((current) =>
                          current.map((row, rowIndex) =>
                            rowIndex === index ? { ...row, weight: value } : row,
                          ),
                        );
                      }}
                      className={`${inputClass} py-1.5`}
                      aria-label={`Weight for ${dimensionNameById.get(entry.dimensionId) ?? entry.dimensionId}`}
                    />
                  </li>
                );
              })}
            </ul>
          )}

          {itemId && weights.length > 0 ? (
            <button
              type="button"
              className={`${outlineButtonClassName} inline-flex w-full items-center justify-center gap-1.5 px-3 py-2 motion-safe:active:scale-[0.98]`}
              disabled={weightsPending}
              onClick={() => {
                void onSaveWeights();
              }}
            >
              <Scale className="h-4 w-4" aria-hidden="true" />
              {weightsPending ? "Saving weights..." : "Save dimension weights"}
            </button>
          ) : null}

          {weightsMessage ? (
            <p className="flex items-center gap-1.5 text-sm text-[var(--admin-danger)]">
              <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
              {weightsMessage}
            </p>
          ) : null}
        </aside>
      </section>

      <ItemPreviewModal
        open={previewOpen}
        onClose={() => {
          setPreviewOpen(false);
        }}
        itemTypeKey={itemTypeKey}
        typeName={selectedTypeName}
        stem={stem}
        answerKeyText={answerKeyText}
        answerKeyJson={answerKeyJson}
        {...(previewSavedOptions ? { savedOptions: previewSavedOptions } : {})}
      />
    </>
  );
}
