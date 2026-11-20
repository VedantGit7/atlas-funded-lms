"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Copy,
  Download,
  Eye,
  FileSpreadsheet,
  Loader2,
  RotateCcw,
  Upload,
  XCircle,
} from "lucide-react";
import {
  checkImportTemplate,
  ITEM_IMPORT_EXTRA_TAGS_MAX,
  itemImportBatchSummary,
} from "@atlas/contracts/item-registry/item-import-api.contract";
import {
  ITEM_IMPORT_MAX_ROWS,
  ITEM_IMPORT_TAG_MAX_LENGTH,
  ITEM_IMPORT_TYPE_NAMES,
  isImportableItemType,
} from "@atlas/contracts/item-registry/item-import.contract";
import type { ValidatedItemTypeKey } from "@atlas/contracts/item-registry/item-definition.contract";
import { createClientUuid } from "../../../lib/api/client";
import {
  catalogFilterButtonClassName,
  outlineButtonClassName,
  primaryButtonClassName,
} from "../../studio/courses/courses-catalog-shared";
import {
  formatItemRegistryApiError,
  itemImportApi,
  itemRegistryApi,
  type ItemTypeDto,
} from "../api";
import { getItemTypeVisual } from "../components/item-type-config";
import { runBulkStatus } from "../bulk-status";
import { announceImportsChanged } from "./import-history";
import { downloadErrorReport } from "./error-report";
import { ImportFileError, readImportFile, type ImportFile } from "./read-import-file";
import {
  previewImport,
  runImport,
  type ImportOutcome,
  type ImportProgress,
  type PreviewRow,
} from "./run-import";

type Step =
  | { kind: "choose" }
  | { kind: "reading"; fileName: string }
  | { kind: "checking"; file: ImportFile; progress: ImportProgress }
  | { kind: "preview"; file: ImportFile; rows: PreviewRow[] }
  | { kind: "importing"; file: ImportFile; rows: PreviewRow[]; progress: ImportProgress }
  | { kind: "done"; outcome: ImportOutcome };

type Filter = "all" | "invalid" | "duplicate" | "ready";

const PAGE = 100;

const cardClass =
  "space-y-4 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5 shadow-sm";
const stepLabelClass =
  "text-xs font-semibold uppercase tracking-wide text-[var(--admin-on-surface-variant)]";
const errorBannerClass =
  "flex items-start gap-2 rounded-lg border border-[color-mix(in_srgb,var(--admin-danger)_30%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-danger)_10%,var(--admin-surface))] px-3 py-2.5 text-sm text-[var(--admin-danger)]";
const inputClass =
  "w-full rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-3 py-2 text-sm text-[var(--admin-on-surface)] placeholder:text-[var(--admin-on-surface-variant)] focus:border-[var(--admin-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--admin-primary)]/30";

const tone = {
  ready: {
    text: "text-[var(--admin-success)]",
    badge:
      "bg-[color-mix(in_srgb,var(--admin-success)_14%,var(--admin-surface))] text-[var(--admin-success)]",
    label: "Ready",
  },
  duplicate: {
    text: "text-[var(--admin-warning)]",
    badge:
      "bg-[color-mix(in_srgb,var(--admin-warning)_16%,var(--admin-surface))] text-[var(--admin-warning)]",
    label: "Duplicate",
  },
  invalid: {
    text: "text-[var(--admin-danger)]",
    badge:
      "bg-[color-mix(in_srgb,var(--admin-danger)_12%,var(--admin-surface))] text-[var(--admin-danger)]",
    label: "Error",
  },
} as const;

function count(rows: PreviewRow[], status: PreviewRow["status"]) {
  return rows.filter((row) => row.status === status).length;
}

function plural(n: number, one: string, many: string) {
  return `${n.toLocaleString("en")} ${n === 1 ? one : many}`;
}

function describeRow(row: PreviewRow): string {
  if (row.status === "invalid") return row.issues.map((issue) => issue.message).join(" ");
  if (row.duplicate?.in === "file") {
    return row.duplicate.reason === "question"
      ? `Same question as row ${String(row.duplicate.rowNumber)}.`
      : `Same reference as row ${String(row.duplicate.rowNumber)}.`;
  }
  if (row.duplicate?.in === "bank") {
    return row.duplicate.reason === "question"
      ? "Already in the item bank."
      : "A question with this reference is already in the item bank.";
  }
  return "";
}

function questionText(file: ImportFile, rowNumber: number): string {
  const value = file.rows.find((row) => row.rowNumber === rowNumber)?.cells["question"];
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return value ? value.date : "";
}

function parseTags(value: string): string[] {
  const tags: string[] = [];
  for (const part of value.split(/[,;\n]/)) {
    const tag = part.trim();
    if (tag && !tags.some((other) => other.toLowerCase() === tag.toLowerCase())) tags.push(tag);
  }
  return tags;
}

function ProgressBar({ progress, label }: { progress: ImportProgress; label: string }) {
  const percent = progress.total === 0 ? 100 : Math.round((progress.done / progress.total) * 100);
  return (
    <div className="space-y-2" role="status" aria-live="polite">
      <div className="flex items-center justify-between text-sm">
        <span className="inline-flex items-center gap-2 font-medium text-[var(--admin-on-surface)]">
          <Loader2 className="h-4 w-4 motion-safe:animate-spin" aria-hidden="true" />
          {label}
        </span>
        <span className="tabular-nums text-[var(--admin-on-surface-variant)]">
          {progress.done.toLocaleString("en")} of {progress.total.toLocaleString("en")}
        </span>
      </div>
      <div
        className="h-2 overflow-hidden rounded-full bg-[var(--admin-surface-high)]"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
      >
        <div
          className="h-full rounded-full bg-[var(--admin-primary)] transition-[width] duration-300"
          style={{ width: `${String(percent)}%` }}
        />
      </div>
    </div>
  );
}

export function ItemImportWizard({
  itemTypes,
  initialType,
}: {
  itemTypes: ItemTypeDto[];
  initialType: string | null;
}) {
  const importable = useMemo(
    () => itemTypes.filter((type) => isImportableItemType(type.key)),
    [itemTypes],
  );
  const [type, setType] = useState<ValidatedItemTypeKey>(() => {
    if (initialType && isImportableItemType(initialType)) return initialType;
    const first = importable[0]?.key;
    return first && isImportableItemType(first) ? first : "mcq_single";
  });
  const [step, setStep] = useState<Step>({ kind: "choose" });
  const [error, setError] = useState<string | null>(null);
  const [templatePending, setTemplatePending] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [shown, setShown] = useState(PAGE);
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [tagsText, setTagsText] = useState("");
  const [reportPending, setReportPending] = useState(false);
  const [publish, setPublish] = useState<
    | { kind: "idle" }
    | { kind: "working"; done: number }
    | { kind: "done"; count: number }
    | { kind: "failed" }
  >({ kind: "idle" });
  const importKey = useRef(createClientUuid());
  const inputRef = useRef<HTMLInputElement>(null);

  const busy = step.kind === "reading" || step.kind === "checking" || step.kind === "importing";

  // Leaving mid-import would stop it part way; the browser asks first.
  useEffect(() => {
    if (step.kind !== "importing") return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => {
      window.removeEventListener("beforeunload", warn);
    };
  }, [step.kind]);

  function reset() {
    setStep({ kind: "choose" });
    setError(null);
    setPublish({ kind: "idle" });
    setFilter("all");
    setShown(PAGE);
    importKey.current = createClientUuid();
    if (inputRef.current) inputRef.current.value = "";
  }

  /** Publishes every question this import added that is still a Draft. */
  async function publishImported(batchId: string) {
    setPublish({ kind: "working", done: 0 });
    try {
      const outcome = await runBulkStatus(
        { status: "PUBLISHED", filter: { importBatchId: batchId, status: "DRAFT" } },
        (done) => {
          setPublish({ kind: "working", done });
        },
      );
      setPublish({ kind: "done", count: outcome.updated });
      announceImportsChanged();
    } catch {
      setPublish({ kind: "failed" });
    }
  }

  async function onDownloadTemplate() {
    setTemplatePending(true);
    setError(null);
    try {
      await itemRegistryApi.downloadItemImportTemplate(type);
    } catch (err) {
      setError(formatItemRegistryApiError(err));
    } finally {
      setTemplatePending(false);
    }
  }

  async function onFile(fileToRead: File | undefined) {
    if (!fileToRead || busy) return;
    setError(null);
    setFilter("all");
    setShown(PAGE);
    importKey.current = createClientUuid();
    setStep({ kind: "reading", fileName: fileToRead.name });
    try {
      const file = await readImportFile(fileToRead);
      // The format, version and type are known from the file alone; the
      // server checks the columns against the academy's dimensions.
      const dimensions = file.identity.columns
        .filter((key) => key.startsWith("weight:"))
        .map((key) => ({ id: key.slice("weight:".length), name: "" }));
      const template = checkImportTemplate(file.identity, type, dimensions);
      if (!template.ok) throw new ImportFileError(template.message);

      setStep({ kind: "checking", file, progress: { done: 0, total: file.rows.length } });
      const rows = await previewImport(file, itemImportApi, (progress) => {
        setStep({ kind: "checking", file, progress });
      });
      setStep({ kind: "preview", file, rows });
    } catch (err) {
      setStep({ kind: "choose" });
      setError(err instanceof ImportFileError ? err.message : formatItemRegistryApiError(err));
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function onImport(file: ImportFile, rows: PreviewRow[]) {
    setError(null);
    const total = rows.filter(
      (row) => row.status === "ready" || (row.status === "duplicate" && !skipDuplicates),
    ).length;
    setStep({ kind: "importing", file, rows, progress: { done: 0, total } });
    try {
      const outcome = await runImport(
        file,
        rows,
        { skipDuplicates, extraTags: parseTags(tagsText), importKey: importKey.current },
        itemImportApi,
        (progress) => {
          setStep({ kind: "importing", file, rows, progress });
        },
      );
      setStep({ kind: "done", outcome });
      announceImportsChanged();
    } catch (err) {
      // Rows already imported stay imported, and sending them again never
      // duplicates them, so Import picks up where this stopped.
      setStep({ kind: "preview", file, rows });
      setError(
        `${formatItemRegistryApiError(err)} The import stopped part way. Select Import again to finish it: questions already imported are not added twice.`,
      );
    }
  }

  async function onReport(file: ImportFile, rows: PreviewRow[]) {
    setReportPending(true);
    try {
      await downloadErrorReport(file, rows);
    } catch {
      setError("Could not create the report. Try again.");
    } finally {
      setReportPending(false);
    }
  }

  function onDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setDragging(false);
    void onFile(event.dataTransfer.files[0]);
  }

  const typeName = ITEM_IMPORT_TYPE_NAMES[type];
  const tags = parseTags(tagsText);
  const tagProblem =
    tags.length > ITEM_IMPORT_EXTRA_TAGS_MAX
      ? `Add at most ${String(ITEM_IMPORT_EXTRA_TAGS_MAX)} tags.`
      : tags.find((tag) => tag.length > ITEM_IMPORT_TAG_MAX_LENGTH)
        ? `Each tag can be up to ${String(ITEM_IMPORT_TAG_MAX_LENGTH)} characters.`
        : null;

  if (step.kind === "done") {
    const batchId = step.outcome.batch.id;
    const summary = itemImportBatchSummary(step.outcome.batch);
    return (
      <section
        className={`${cardClass} motion-safe:animate-[admin-dropdown-in_0.22s_cubic-bezier(0.16,1,0.3,1)]`}
      >
        <div className="flex items-start gap-3">
          <CheckCircle2
            className="mt-0.5 h-6 w-6 shrink-0 text-[var(--admin-success)]"
            aria-hidden="true"
          />
          <div className="space-y-1">
            <h2 className="text-lg font-semibold text-[var(--admin-on-surface)]">
              {plural(summary.imported, "question", "questions")} imported
            </h2>
            <p className="text-sm text-[var(--admin-on-surface-variant)]" aria-live="polite">
              {publish.kind === "done"
                ? `${plural(publish.count, "question is", "questions are")} now published, so learners can see them in decks, practice and assessments.`
                : "They are Drafts in the item bank, so learners see none of them until you publish them."}
            </p>
          </div>
        </div>
        <dl className="grid gap-3 sm:grid-cols-3">
          {[
            { label: "Imported", value: summary.imported, className: tone.ready.text },
            {
              label: "Duplicates skipped",
              value: summary.duplicatesSkipped,
              className: tone.duplicate.text,
            },
            {
              label: "Not imported (errors)",
              value: summary.notImported,
              className: tone.invalid.text,
            },
          ].map((stat) => (
            <div
              key={stat.label}
              className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-4 py-3"
            >
              <dt className="text-xs text-[var(--admin-on-surface-variant)]">{stat.label}</dt>
              <dd className={`mt-1 text-2xl font-semibold tabular-nums ${stat.className}`}>
                {stat.value.toLocaleString("en")}
              </dd>
            </div>
          ))}
        </dl>
        {publish.kind === "failed" ? (
          <div role="alert" className={errorBannerClass}>
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>
              Not every question could be published. Check your connection and select Publish all
              again; questions already published stay published.
            </span>
          </div>
        ) : null}
        <div className="flex flex-col gap-2 sm:flex-row">
          {summary.imported > 0 && publish.kind !== "done" ? (
            <button
              type="button"
              disabled={publish.kind === "working"}
              onClick={() => {
                void publishImported(batchId);
              }}
              className={`${primaryButtonClassName} inline-flex items-center justify-center gap-1.5 py-2.5 disabled:cursor-wait disabled:opacity-70`}
            >
              {publish.kind === "working" ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Eye className="h-4 w-4" aria-hidden="true" />
              )}
              {publish.kind === "working"
                ? `Publishing ${publish.done.toLocaleString("en")} of ${summary.imported.toLocaleString("en")}`
                : `Publish all ${plural(summary.imported, "question", "questions")}`}
            </button>
          ) : null}
          <Link
            href={`/studio/items?batch=${encodeURIComponent(batchId)}`}
            className={`${outlineButtonClassName} inline-flex items-center justify-center gap-1.5 px-4 py-2.5`}
          >
            Review the imported questions
          </Link>
          <button
            type="button"
            onClick={reset}
            className={`${outlineButtonClassName} inline-flex items-center justify-center gap-1.5 px-4 py-2.5`}
          >
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            Import another file
          </button>
        </div>
      </section>
    );
  }

  const preview = step.kind === "preview" || step.kind === "importing" ? step : null;

  return (
    <div className="space-y-4">
      {error ? (
        <div role="alert" className={errorBannerClass}>
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </div>
      ) : null}

      {!preview ? (
        <>
          <section className={cardClass} aria-labelledby="import-step-type">
            <p id="import-step-type" className={stepLabelClass}>
              Step 1 of 3 · Question type
            </p>
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Question type">
              {importable.map((itemType) => {
                const visual = getItemTypeVisual(itemType.key);
                const Icon = visual.icon;
                const selected = itemType.key === type;
                return (
                  <button
                    key={itemType.key}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    disabled={busy}
                    onClick={() => {
                      if (isImportableItemType(itemType.key)) setType(itemType.key);
                    }}
                    className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-colors motion-safe:active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 ${
                      selected
                        ? visual.chipClassName
                        : "border-[var(--admin-border)] bg-[var(--admin-surface-low)] text-[var(--admin-on-surface-variant)] hover:bg-[var(--admin-surface-high)]"
                    }`}
                  >
                    <Icon className="h-4 w-4" aria-hidden="true" />
                    {isImportableItemType(itemType.key)
                      ? ITEM_IMPORT_TYPE_NAMES[itemType.key]
                      : itemType.name}
                  </button>
                );
              })}
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
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
                  ? "Preparing template..."
                  : `Download Excel template for ${typeName}`}
              </button>
              <span className="text-xs text-[var(--admin-on-surface-variant)]">
                One question per row, up to {ITEM_IMPORT_MAX_ROWS.toLocaleString("en")} per file.
              </span>
            </div>
          </section>

          <section className={cardClass} aria-labelledby="import-step-file">
            <p id="import-step-file" className={stepLabelClass}>
              Step 2 of 3 · Upload the filled-in template
            </p>
            {step.kind === "choose" ? (
              <label
                htmlFor="item-import-file"
                onDragOver={(event) => {
                  event.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => {
                  setDragging(false);
                }}
                onDrop={onDrop}
                className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors focus-within:ring-2 focus-within:ring-[var(--admin-primary)]/40 ${
                  dragging
                    ? "border-[var(--admin-primary)] bg-[color-mix(in_srgb,var(--admin-primary-container)_35%,var(--admin-surface))]"
                    : "border-[var(--admin-border)] bg-[var(--admin-surface-low)] hover:bg-[var(--admin-surface-high)]"
                }`}
              >
                <Upload className="h-6 w-6 text-[var(--admin-primary)]" aria-hidden="true" />
                <span className="text-sm font-medium text-[var(--admin-on-surface)]">
                  Drop the {typeName} template here, or choose a file
                </span>
                <span className="text-xs text-[var(--admin-on-surface-variant)]">
                  Excel workbook (.xlsx). Nothing is added until you review it and select Import.
                </span>
                <input
                  ref={inputRef}
                  id="item-import-file"
                  type="file"
                  accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  className="sr-only"
                  onChange={(event) => {
                    void onFile(event.target.files?.[0]);
                  }}
                />
              </label>
            ) : step.kind === "reading" ? (
              <p
                className="inline-flex items-center gap-2 text-sm text-[var(--admin-on-surface)]"
                role="status"
              >
                <Loader2 className="h-4 w-4 motion-safe:animate-spin" aria-hidden="true" />
                Reading {step.fileName}...
              </p>
            ) : step.kind === "checking" ? (
              <ProgressBar progress={step.progress} label={`Checking ${step.file.fileName}`} />
            ) : null}
          </section>
        </>
      ) : (
        <PreviewPanel
          file={preview.file}
          rows={preview.rows}
          importing={step.kind === "importing" ? step.progress : null}
          filter={filter}
          onFilter={(next) => {
            setFilter(next);
            setShown(PAGE);
          }}
          shown={shown}
          onShowMore={() => {
            setShown((current) => current + PAGE);
          }}
          skipDuplicates={skipDuplicates}
          onSkipDuplicates={setSkipDuplicates}
          tagsText={tagsText}
          onTagsText={setTagsText}
          tagProblem={tagProblem}
          reportPending={reportPending}
          onReport={() => {
            void onReport(preview.file, preview.rows);
          }}
          onImport={() => {
            void onImport(preview.file, preview.rows);
          }}
          onReset={reset}
        />
      )}
    </div>
  );
}

function PreviewPanel(props: {
  file: ImportFile;
  rows: PreviewRow[];
  importing: ImportProgress | null;
  filter: Filter;
  onFilter: (filter: Filter) => void;
  shown: number;
  onShowMore: () => void;
  skipDuplicates: boolean;
  onSkipDuplicates: (value: boolean) => void;
  tagsText: string;
  onTagsText: (value: string) => void;
  tagProblem: string | null;
  reportPending: boolean;
  onReport: () => void;
  onImport: () => void;
  onReset: () => void;
}) {
  const { file, rows, importing } = props;
  const ready = count(rows, "ready");
  const duplicates = count(rows, "duplicate");
  const invalid = count(rows, "invalid");
  const toImport = ready + (props.skipDuplicates ? 0 : duplicates);
  const visible = rows.filter((row) => props.filter === "all" || row.status === props.filter);

  const filters: Array<{ key: Filter; label: string; value: number }> = [
    { key: "all", label: "All rows", value: rows.length },
    { key: "invalid", label: "Errors", value: invalid },
    { key: "duplicate", label: "Duplicates", value: duplicates },
    { key: "ready", label: "Ready", value: ready },
  ];

  return (
    <section
      className={`${cardClass} motion-safe:animate-[admin-dropdown-in_0.22s_cubic-bezier(0.16,1,0.3,1)]`}
      aria-labelledby="import-step-review"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p id="import-step-review" className={stepLabelClass}>
            Step 3 of 3 · Review and import
          </p>
          <h2 className="mt-1 break-all text-lg font-semibold text-[var(--admin-on-surface)]">
            {file.fileName}
          </h2>
          <p className="text-sm text-[var(--admin-on-surface-variant)]">
            {ITEM_IMPORT_TYPE_NAMES[file.identity.itemTypeKey]} ·{" "}
            {plural(rows.length, "question", "questions")}
          </p>
        </div>
        {importing ? null : (
          <button
            type="button"
            onClick={props.onReset}
            className={`${catalogFilterButtonClassName} py-2`}
          >
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            Choose another file
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Show rows">
        {filters.map((entry) => {
          const active = props.filter === entry.key;
          return (
            <button
              key={entry.key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => {
                props.onFilter(entry.key);
              }}
              className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
                active
                  ? "border-[var(--admin-primary)] bg-[color-mix(in_srgb,var(--admin-primary-container)_45%,var(--admin-surface))] text-[var(--admin-primary)]"
                  : "border-[var(--admin-border)] bg-[var(--admin-surface-low)] text-[var(--admin-on-surface-variant)] hover:bg-[var(--admin-surface-high)]"
              }`}
            >
              {entry.label}
              <span className="tabular-nums">{entry.value.toLocaleString("en")}</span>
            </button>
          );
        })}
      </div>

      <div className="overflow-x-auto rounded-lg border border-[var(--admin-border)]">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="bg-[var(--admin-surface-low)] text-xs text-[var(--admin-on-surface-variant)]">
            <tr>
              <th scope="col" className="w-16 px-3 py-2 font-medium">
                Row
              </th>
              <th scope="col" className="w-28 px-3 py-2 font-medium">
                Status
              </th>
              <th scope="col" className="px-3 py-2 font-medium">
                Question
              </th>
              <th scope="col" className="px-3 py-2 font-medium">
                Details
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--admin-border)]">
            {visible.slice(0, props.shown).map((row) => {
              const look = tone[row.status];
              return (
                <tr key={row.rowNumber} className="align-top">
                  <td className="px-3 py-2 tabular-nums text-[var(--admin-on-surface-variant)]">
                    {row.rowNumber}
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${look.badge}`}
                    >
                      {row.status === "ready" ? (
                        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                      ) : row.status === "duplicate" ? (
                        <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                      ) : (
                        <XCircle className="h-3.5 w-3.5" aria-hidden="true" />
                      )}
                      {look.label}
                    </span>
                  </td>
                  <td className="max-w-[28rem] px-3 py-2 text-[var(--admin-on-surface)]">
                    <span className="line-clamp-2">
                      {questionText(file, row.rowNumber) || "(empty)"}
                    </span>
                  </td>
                  <td className={`px-3 py-2 ${row.status === "ready" ? "" : look.text}`}>
                    {row.status === "invalid" ? (
                      <ul className="space-y-0.5">
                        {row.issues.map((issue) => (
                          <li key={`${issue.columns.join(",")}:${issue.message}`}>
                            {issue.message}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      describeRow(row)
                    )}
                  </td>
                </tr>
              );
            })}
            {visible.length === 0 ? (
              <tr>
                <td
                  colSpan={4}
                  className="px-3 py-6 text-center text-[var(--admin-on-surface-variant)]"
                >
                  No rows here.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      {visible.length > props.shown ? (
        <button
          type="button"
          onClick={props.onShowMore}
          className="text-sm font-medium text-[var(--admin-primary)] underline-offset-4 hover:underline"
        >
          Show {Math.min(PAGE, visible.length - props.shown).toLocaleString("en")} more of{" "}
          {(visible.length - props.shown).toLocaleString("en")}
        </button>
      ) : null}

      <div className="grid gap-4 border-t border-[var(--admin-border)] pt-4 md:grid-cols-2">
        <label className="flex items-start gap-2 text-sm text-[var(--admin-on-surface)]">
          <input
            type="checkbox"
            checked={props.skipDuplicates}
            disabled={importing !== null}
            onChange={(event) => {
              props.onSkipDuplicates(event.target.checked);
            }}
            className="mt-0.5 h-4 w-4 rounded border-[var(--admin-border)] accent-[var(--admin-primary)]"
          />
          <span>
            Skip duplicates
            <span className="block text-xs text-[var(--admin-on-surface-variant)]">
              Questions already in the bank, or repeated in this file, with the same wording or
              reference.
            </span>
          </span>
        </label>
        <div>
          <label
            htmlFor="item-import-tags"
            className="mb-1 block text-sm font-medium text-[var(--admin-on-surface)]"
          >
            Add tags to every imported question
            <span className="ml-1 text-xs font-normal text-[var(--admin-on-surface-variant)]">
              (optional, separated by commas)
            </span>
          </label>
          <input
            id="item-import-tags"
            value={props.tagsText}
            disabled={importing !== null}
            onChange={(event) => {
              props.onTagsText(event.target.value);
            }}
            placeholder="for example: imported, week-1"
            className={inputClass}
            aria-invalid={props.tagProblem !== null}
            aria-describedby={props.tagProblem ? "item-import-tags-error" : undefined}
          />
          {props.tagProblem ? (
            <p id="item-import-tags-error" className="mt-1 text-xs text-[var(--admin-danger)]">
              {props.tagProblem}
            </p>
          ) : null}
        </div>
      </div>

      {importing ? (
        <ProgressBar progress={importing} label="Importing questions" />
      ) : (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <button
            type="button"
            disabled={toImport === 0 || props.tagProblem !== null}
            onClick={props.onImport}
            className={`${primaryButtonClassName} inline-flex items-center justify-center gap-1.5 py-2.5 motion-safe:active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50`}
          >
            <Upload className="h-4 w-4" aria-hidden="true" />
            {toImport === 0
              ? "No questions to import"
              : `Import ${plural(toImport, "question", "questions")} as Drafts`}
          </button>
          {invalid + duplicates > 0 ? (
            <button
              type="button"
              disabled={props.reportPending}
              onClick={props.onReport}
              className={`${outlineButtonClassName} inline-flex items-center justify-center gap-1.5 px-4 py-2.5 disabled:cursor-wait disabled:opacity-60`}
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              Download rows to fix
            </button>
          ) : null}
          {invalid > 0 ? (
            <p className="text-xs text-[var(--admin-on-surface-variant)] sm:ml-2">
              {plural(invalid, "row has", "rows have")} errors and will not be imported. Fix them in
              your file and upload it again{toImport > 0 ? ", or import the rest now" : ""}.
            </p>
          ) : null}
        </div>
      )}
    </section>
  );
}
