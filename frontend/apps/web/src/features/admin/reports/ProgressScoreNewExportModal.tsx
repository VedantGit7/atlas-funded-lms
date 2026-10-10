"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { AlertTriangle, Download, Info, Loader2, X } from "lucide-react";
import { Select } from "@atlas/design-system";
import {
  ghostButtonClassName,
  primaryButtonClassName,
} from "../../analytics/analytics-admin-shared";
import { ClientApiError } from "../../../lib/client-api";
import {
  progressScoreExportsApi,
  isScoreLikeDataset,
  type CreateProgressScoreExportBody,
  type ProgressScoreExportCadence,
  type ProgressScoreExportColumn,
  type ProgressScoreExportDataset,
  type ProgressScoreExportDelivery,
  type ProgressScoreExportFormat,
  type ProgressScoreExportHistoryItem,
  type ProgressScoreExportProductType,
  type ProgressScoreExportScheduleItem,
  type ProgressScoreExportsPayload,
} from "./admin-progress-score-exports-api";
import { PolicyToggle } from "./report-exports-kit";
import {
  dateInputToEndIso,
  dateInputToStartIso,
  fetchProgressProducts,
  fetchScoreProducts,
  fetchScoreQuizzes,
  type ScoreProductType,
} from "./admin-progress-score-roster-api";

const selectTriggerClassName =
  "h-10 w-full rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface)] text-[var(--admin-on-surface)] hover:border-[var(--admin-outline)] focus-visible:border-[var(--admin-primary)] focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30";

const DATASET_OPTIONS: Array<{ value: ProgressScoreExportDataset; label: string }> = [
  { value: "progress", label: "Progress" },
  { value: "scores", label: "Scores" },
  { value: "attempts", label: "Attempts" },
  { value: "item_analysis", label: "Item analysis" },
];

const PROGRESS_PRODUCT_TYPES: Array<{ value: ProgressScoreExportProductType; label: string }> = [
  { value: "course", label: "Course" },
  { value: "test_series", label: "Test series" },
  { value: "bundle", label: "Bundle" },
  { value: "subscription", label: "Subscription" },
  { value: "mock_test", label: "Mock test" },
];

const SCORE_PRODUCT_TYPES: Array<{ value: ScoreProductType; label: string }> = [
  { value: "course", label: "Course" },
  { value: "test_series", label: "Test series" },
  { value: "bundle", label: "Bundle" },
  { value: "mock_test", label: "Mock test" },
];

export function ProgressScoreNewExportModal({
  open,
  progressColumns,
  scoreColumns,
  capabilities,
  initialScheduleEnabled,
  onClose,
  onCreated,
}: {
  open: boolean;
  progressColumns: ProgressScoreExportColumn[];
  scoreColumns: ProgressScoreExportColumn[];
  capabilities: ProgressScoreExportsPayload["capabilities"];
  initialScheduleEnabled: boolean;
  onClose: () => void;
  onCreated: (
    run: ProgressScoreExportHistoryItem,
    schedule: ProgressScoreExportScheduleItem | null,
  ) => void;
}) {
  const titleId = useId();
  const [dataset, setDataset] = useState<ProgressScoreExportDataset>("progress");
  const [productType, setProductType] = useState<ProgressScoreExportProductType>("course");
  const [scoreProductType, setScoreProductType] = useState<ScoreProductType>("course");
  const [products, setProducts] = useState<Array<{ id: string; title: string }>>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [productId, setProductId] = useState("");
  const [quizzes, setQuizzes] = useState<Array<{ id: string; title: string }>>([]);
  const [quizzesLoading, setQuizzesLoading] = useState(false);
  const [assessmentId, setAssessmentId] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [format, setFormat] = useState<ProgressScoreExportFormat>("csv");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [useCurrentFilters, setUseCurrentFilters] = useState(true);
  const [delivery, setDelivery] = useState<ProgressScoreExportDelivery>("download");
  const [recipientInput, setRecipientInput] = useState("");
  const [recipients, setRecipients] = useState<string[]>([]);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [cadence, setCadence] = useState<ProgressScoreExportCadence>("monthly");
  const [time, setTime] = useState("06:00");
  const [timezone, setTimezone] = useState("Asia/Kolkata");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scoreLike = isScoreLikeDataset(dataset);
  const columns = scoreLike ? scoreColumns : progressColumns;

  const productTypeOptions = useMemo(
    () => (scoreLike ? SCORE_PRODUCT_TYPES : PROGRESS_PRODUCT_TYPES),
    [scoreLike],
  );

  const effectiveProductType = scoreLike ? scoreProductType : productType;

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    setDataset("progress");
    setProductType("course");
    setScoreProductType("course");
    setProductId("");
    setAssessmentId("");
    setSelected(
      new Set(
        progressColumns.filter((column) => column.defaultSelected).map((column) => column.key),
      ),
    );
    setFormat("csv");
    setDateFrom("");
    setDateTo("");
    setUseCurrentFilters(true);
    setDelivery("download");
    setRecipientInput("");
    setRecipients([]);
    setWebhookUrl("");
    setScheduleEnabled(initialScheduleEnabled);
    setCadence("monthly");
    setTime("06:00");
    setTimezone("Asia/Kolkata");
    setError(null);
  }, [open, progressColumns, initialScheduleEnabled]);

  useEffect(() => {
    if (!open) return;
    setSelected(
      new Set(columns.filter((column) => column.defaultSelected).map((column) => column.key)),
    );
    setProductId("");
    setAssessmentId("");
  }, [open, dataset, columns]);

  useEffect(() => {
    if (!open) return;
    setProductsLoading(true);
    void (async () => {
      try {
        if (scoreLike) {
          const response = await fetchScoreProducts(scoreProductType, { page: 1, limit: 100 });
          setProducts(response.data.items.map((item) => ({ id: item.id, title: item.title })));
        } else {
          const response = await fetchProgressProducts(productType, {
            page: 1,
            limit: 100,
          });
          setProducts(response.data.items.map((item) => ({ id: item.id, title: item.title })));
        }
      } catch {
        setProducts([]);
      } finally {
        setProductsLoading(false);
      }
    })();
  }, [open, scoreLike, productType, scoreProductType]);

  useEffect(() => {
    if (!open || !scoreLike || !productId) {
      setQuizzes([]);
      return;
    }
    setQuizzesLoading(true);
    void (async () => {
      try {
        const response = await fetchScoreQuizzes(scoreProductType, productId, {
          page: 1,
          limit: 100,
        });
        setQuizzes(
          response.data.items.map((item) => ({ id: item.assessmentId, title: item.title })),
        );
      } catch {
        setQuizzes([]);
      } finally {
        setQuizzesLoading(false);
      }
    })();
  }, [open, scoreLike, scoreProductType, productId]);

  if (!open) return null;

  const hasEmailSelected = selected.has("email");

  function toggleColumn(key: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function addRecipient() {
    const email = recipientInput.trim();
    if (!email || !email.includes("@")) return;
    setRecipients((current) => (current.includes(email) ? current : [...current, email]));
    setRecipientInput("");
  }

  function scopeSummary(): string {
    const parts: string[] = [];
    if (productId) {
      const product = products.find((item) => item.id === productId);
      parts.push(product?.title ?? "Selected product");
      if (scoreLike && assessmentId) {
        const quiz = quizzes.find((item) => item.id === assessmentId);
        if (quiz) parts.push(quiz.title);
      }
    } else {
      parts.push("All products");
    }
    return parts.join(" · ");
  }

  function filterSummary(): string {
    const parts: string[] = [scopeSummary()];
    if (dateFrom && dateTo) parts.push(`${dateFrom} – ${dateTo}`);
    else if (dateFrom) parts.push(`From ${dateFrom}`);
    else if (dateTo) parts.push(`Until ${dateTo}`);
    else parts.push("All time");
    return parts.join(" · ");
  }

  async function onSubmit() {
    if (selected.size === 0) {
      setError("Select at least one column.");
      return;
    }
    if (delivery === "recipients" && recipients.length === 0) {
      setError("Add at least one recipient email.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const body: CreateProgressScoreExportBody = {
        dataset,
        columns: [...selected],
        format,
        useCurrentFilters,
        delivery,
        scheduleEnabled,
      };

      if (productId) {
        body.productType = effectiveProductType;
        body.productId = productId;
        if (effectiveProductType === "course") body.courseId = productId;
      }

      if (scoreLike && assessmentId) {
        body.assessmentId = assessmentId;
      }

      if (useCurrentFilters) {
        const fromIso = dateInputToStartIso(dateFrom);
        const toIso = dateInputToEndIso(dateTo);
        if (fromIso) body.dateFrom = fromIso;
        if (toIso) body.dateTo = toIso;
      }

      if (delivery === "recipients") {
        body.recipients = recipients;
        if (webhookUrl.trim()) body.webhookUrl = webhookUrl.trim();
      }

      if (scheduleEnabled) {
        const datasetLabel =
          DATASET_OPTIONS.find((item) => item.value === dataset)?.label ?? "Progress & score";
        body.scheduleName = `${cadence === "daily" ? "Daily" : cadence === "weekly" ? "Weekly" : "Monthly"} ${datasetLabel} export`;
        body.cadence = cadence;
        body.time = time;
        body.timezone = timezone;
      }

      const response = await progressScoreExportsApi.create(body);
      onCreated(response.data.run, response.data.schedule);
      onClose();
    } catch (caught) {
      setError(caught instanceof ClientApiError ? caught.message : "Could not create export.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[color-mix(in_srgb,var(--admin-on-surface)_40%,transparent)] p-4 backdrop-blur-[2px]">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="flex max-h-[90vh] w-full max-w-[800px] flex-col rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface)]"
      >
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-[var(--admin-border)] px-6">
          <h2
            id={titleId}
            className="text-2xl font-semibold tracking-tight text-[var(--admin-on-surface)]"
          >
            New export
          </h2>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-sm text-[var(--admin-on-surface-variant)] hover:bg-[var(--admin-surface-high)]"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </header>

        <div className="flex-1 space-y-8 overflow-y-auto p-6">
          <section>
            <h3 className="mb-4 text-base font-semibold text-[var(--admin-on-surface)]">Dataset</h3>
            <div className="flex flex-wrap gap-2">
              {DATASET_OPTIONS.filter((option) => capabilities.datasets.includes(option.value)).map(
                (option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => {
                      setDataset(option.value);
                    }}
                    className={`rounded-sm border px-4 py-2 text-sm font-medium transition-colors ${
                      dataset === option.value
                        ? "border-[var(--admin-primary)] bg-[color-mix(in_srgb,var(--admin-primary)_12%,var(--admin-surface))] text-[var(--admin-primary)]"
                        : "border-[var(--admin-border)] bg-[var(--admin-surface-low)] text-[var(--admin-on-surface-variant)] hover:border-[var(--admin-outline)]"
                    }`}
                  >
                    {option.label}
                  </button>
                ),
              )}
            </div>
          </section>

          <section>
            <h3 className="mb-4 text-base font-semibold text-[var(--admin-on-surface)]">Scope</h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-2">
                <span className="text-[12px] font-semibold tracking-[0.06em] text-[var(--admin-on-surface-variant)] uppercase">
                  Product type
                </span>
                <Select
                  value={effectiveProductType}
                  onValueChange={(value) => {
                    if (scoreLike) setScoreProductType(value as ScoreProductType);
                    else setProductType(value as ProgressScoreExportProductType);
                    setProductId("");
                    setAssessmentId("");
                  }}
                  options={[...productTypeOptions]}
                  className={selectTriggerClassName}
                />
              </label>
              <label className="flex flex-col gap-2">
                <span className="text-[12px] font-semibold tracking-[0.06em] text-[var(--admin-on-surface-variant)] uppercase">
                  Product (optional)
                </span>
                <Select
                  value={productId}
                  onValueChange={(value) => {
                    setProductId(value);
                    setAssessmentId("");
                  }}
                  disabled={productsLoading}
                  options={[
                    { value: "", label: productsLoading ? "Loading products…" : "All products" },
                    ...products.map((product) => ({ value: product.id, label: product.title })),
                  ]}
                  className={selectTriggerClassName}
                />
              </label>
              {scoreLike ? (
                <label className="flex flex-col gap-2 sm:col-span-2">
                  <span className="text-[12px] font-semibold tracking-[0.06em] text-[var(--admin-on-surface-variant)] uppercase">
                    Assessment (optional)
                  </span>
                  <Select
                    value={assessmentId}
                    onValueChange={setAssessmentId}
                    disabled={!productId || quizzesLoading}
                    options={[
                      {
                        value: "",
                        label: !productId
                          ? "Select a product first"
                          : quizzesLoading
                            ? "Loading assessments…"
                            : "All assessments",
                      },
                      ...quizzes.map((quiz) => ({ value: quiz.id, label: quiz.title })),
                    ]}
                    className={selectTriggerClassName}
                  />
                </label>
              ) : null}
            </div>
            <p className="mt-2 text-xs text-[var(--admin-on-surface-variant)]">{scopeSummary()}</p>
          </section>

          <section>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-base font-semibold text-[var(--admin-on-surface)]">Columns</h3>
              <button
                type="button"
                className="text-sm text-[var(--admin-primary)] hover:underline"
                onClick={() => {
                  setSelected(new Set(columns.map((column) => column.key)));
                }}
              >
                Select all
              </button>
            </div>
            {hasEmailSelected ? (
              <div className="mb-3 flex items-start gap-2 rounded-sm border border-[color-mix(in_srgb,var(--admin-warning)_35%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-warning)_10%,var(--admin-surface))] px-3 py-2 text-sm text-[var(--admin-warning)]">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <span>
                  Email is learner PII. Handle exported files according to your data retention
                  policy.
                </span>
              </div>
            ) : null}
            <div className="grid grid-cols-1 gap-x-8 gap-y-3 rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-4 sm:grid-cols-2">
              {columns.map((column) => (
                <label
                  key={column.key}
                  className="group flex cursor-pointer items-start justify-between gap-3"
                >
                  <span className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={selected.has(column.key)}
                      onChange={() => {
                        toggleColumn(column.key);
                      }}
                      className="h-4 w-4 rounded-sm border-[var(--admin-outline)] text-[var(--admin-primary)] focus:ring-[var(--admin-primary)]"
                    />
                    <span className="text-sm text-[var(--admin-on-surface)] group-hover:text-[var(--admin-primary)]">
                      {column.label}
                    </span>
                  </span>
                  {column.key === "email" ? (
                    <span className="inline-flex items-center gap-1 rounded-sm bg-[color-mix(in_srgb,var(--admin-danger)_12%,var(--admin-surface))] px-2 py-0.5 text-[11px] font-semibold tracking-wide text-[var(--admin-danger)] uppercase">
                      Email PII
                    </span>
                  ) : column.sensitive ? (
                    <span className="inline-flex items-center gap-1 rounded-sm bg-[color-mix(in_srgb,var(--admin-danger)_12%,var(--admin-surface))] px-2 py-0.5 text-[11px] font-semibold tracking-wide text-[var(--admin-danger)] uppercase">
                      <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
                      Sensitive
                    </span>
                  ) : null}
                </label>
              ))}
            </div>
          </section>

          <section>
            <h3 className="mb-4 text-base font-semibold text-[var(--admin-on-surface)]">Filters</h3>
            <div className="flex flex-col gap-4 rounded-sm border border-[var(--admin-border)] p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="font-mono text-[13px] text-[var(--admin-on-surface)]">
                  {filterSummary()}
                </div>
                <p className="mt-1 text-xs text-[var(--admin-on-surface-variant)]">
                  Export will be scoped to these filters when enabled.
                </p>
              </div>
              <label className="flex items-center gap-3">
                <span className="text-sm text-[var(--admin-on-surface)]">Use current filters</span>
                <PolicyToggle
                  checked={useCurrentFilters}
                  onChange={setUseCurrentFilters}
                  label="Use current filters"
                />
              </label>
            </div>
            {useCurrentFilters ? (
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="flex flex-col gap-2">
                  <span className="text-[12px] font-semibold tracking-[0.06em] text-[var(--admin-on-surface-variant)] uppercase">
                    From
                  </span>
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(event) => {
                      setDateFrom(event.target.value);
                    }}
                    className="h-10 rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-3 font-mono text-[13px] text-[var(--admin-on-surface)] outline-none focus:border-[var(--admin-primary)]"
                  />
                </label>
                <label className="flex flex-col gap-2">
                  <span className="text-[12px] font-semibold tracking-[0.06em] text-[var(--admin-on-surface-variant)] uppercase">
                    To
                  </span>
                  <input
                    type="date"
                    value={dateTo}
                    onChange={(event) => {
                      setDateTo(event.target.value);
                    }}
                    className="h-10 rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-3 font-mono text-[13px] text-[var(--admin-on-surface)] outline-none focus:border-[var(--admin-primary)]"
                  />
                </label>
              </div>
            ) : null}
          </section>

          <section>
            <h3 className="mb-4 text-base font-semibold text-[var(--admin-on-surface)]">Format</h3>
            <div className="inline-flex rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-1">
              {capabilities.formats.map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => {
                    setFormat(value);
                  }}
                  className={`rounded-sm px-6 py-2 text-[12px] font-semibold tracking-[0.06em] uppercase transition-all ${
                    format === value
                      ? "bg-[var(--admin-surface)] text-[var(--admin-primary)] shadow-sm"
                      : "text-[var(--admin-on-surface-variant)]"
                  }`}
                >
                  {value}
                </button>
              ))}
            </div>
          </section>

          <section>
            <h3 className="mb-4 text-base font-semibold text-[var(--admin-on-surface)]">
              Delivery
            </h3>
            <div className="space-y-3">
              {(
                [
                  ["download", "Download now"],
                  ["email_me", "Email me when ready"],
                  ["recipients", "Send to recipients"],
                ] as const
              ).map(([value, label]) => (
                <label key={value} className="flex cursor-pointer items-center gap-3">
                  <input
                    type="radio"
                    name="progress-score-delivery"
                    checked={delivery === value}
                    onChange={() => {
                      setDelivery(value);
                    }}
                    className="h-4 w-4 border-[var(--admin-outline)] text-[var(--admin-primary)] focus:ring-[var(--admin-primary)]"
                  />
                  <span className="text-sm text-[var(--admin-on-surface)]">{label}</span>
                </label>
              ))}
              {delivery === "recipients" ? (
                <div className="space-y-4 pt-2 pl-7">
                  <div>
                    <label className="mb-2 block text-[12px] font-semibold tracking-[0.06em] text-[var(--admin-on-surface-variant)] uppercase">
                      Recipients
                    </label>
                    <div className="flex min-h-10 flex-wrap items-center gap-2 rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-2 focus-within:border-[var(--admin-primary)]">
                      {recipients.map((email) => (
                        <span
                          key={email}
                          className="inline-flex items-center rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface)] px-2 py-1 text-xs text-[var(--admin-on-surface)]"
                        >
                          {email}
                          <button
                            type="button"
                            className="ml-2 text-[var(--admin-on-surface-variant)] hover:text-[var(--admin-danger)]"
                            onClick={() => {
                              setRecipients((current) => current.filter((item) => item !== email));
                            }}
                          >
                            <X className="h-3.5 w-3.5" aria-hidden="true" />
                          </button>
                        </span>
                      ))}
                      <input
                        value={recipientInput}
                        onChange={(event) => {
                          setRecipientInput(event.target.value);
                        }}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            addRecipient();
                          }
                        }}
                        onBlur={addRecipient}
                        placeholder="Add email…"
                        className="min-w-[120px] flex-1 border-none bg-transparent p-0 text-sm text-[var(--admin-on-surface)] outline-none"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="mb-2 block text-[12px] font-semibold tracking-[0.06em] text-[var(--admin-on-surface-variant)] uppercase">
                      Webhook URL (optional)
                    </label>
                    <input
                      value={webhookUrl}
                      onChange={(event) => {
                        setWebhookUrl(event.target.value);
                      }}
                      placeholder="https://"
                      className="h-10 w-full rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-3 font-mono text-[13px] text-[var(--admin-on-surface)] outline-none focus:border-[var(--admin-primary)]"
                    />
                  </div>
                </div>
              ) : null}
            </div>
          </section>

          {capabilities.canSchedule ? (
            <section>
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-base font-semibold text-[var(--admin-on-surface)]">Schedule</h3>
                <label className="flex items-center gap-3">
                  <span className="text-sm text-[var(--admin-on-surface-variant)]">
                    Schedule this export
                  </span>
                  <PolicyToggle
                    checked={scheduleEnabled}
                    onChange={setScheduleEnabled}
                    label="Schedule this export"
                  />
                </label>
              </div>
              {scheduleEnabled ? (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <label className="flex flex-col gap-2">
                    <span className="text-[12px] font-semibold tracking-[0.06em] text-[var(--admin-on-surface-variant)] uppercase">
                      Cadence
                    </span>
                    <Select
                      value={cadence}
                      onValueChange={(value) => {
                        setCadence(value as ProgressScoreExportCadence);
                      }}
                      options={[
                        { value: "daily", label: "Daily" },
                        { value: "weekly", label: "Weekly" },
                        { value: "monthly", label: "Monthly" },
                      ]}
                      className={selectTriggerClassName}
                    />
                  </label>
                  <label className="flex flex-col gap-2">
                    <span className="text-[12px] font-semibold tracking-[0.06em] text-[var(--admin-on-surface-variant)] uppercase">
                      Time
                    </span>
                    <input
                      type="time"
                      value={time}
                      onChange={(event) => {
                        setTime(event.target.value);
                      }}
                      className="h-10 rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-3 font-mono text-[13px] text-[var(--admin-on-surface)] outline-none focus:border-[var(--admin-primary)]"
                    />
                  </label>
                  <label className="flex flex-col gap-2">
                    <span className="text-[12px] font-semibold tracking-[0.06em] text-[var(--admin-on-surface-variant)] uppercase">
                      Timezone
                    </span>
                    <Select
                      value={timezone}
                      onValueChange={setTimezone}
                      options={[
                        { value: "UTC", label: "UTC" },
                        { value: "Asia/Kolkata", label: "Asia/Kolkata" },
                        { value: "America/New_York", label: "America/New_York" },
                        { value: "America/Los_Angeles", label: "America/Los_Angeles" },
                        { value: "Europe/London", label: "Europe/London" },
                      ]}
                      className={selectTriggerClassName}
                    />
                  </label>
                </div>
              ) : null}
            </section>
          ) : null}

          <div className="flex items-start gap-2 rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-4 py-3 text-sm text-[var(--admin-on-surface-variant)]">
            <Info
              className="mt-0.5 h-4 w-4 shrink-0 text-[var(--admin-primary)]"
              aria-hidden="true"
            />
            <span>{capabilities.note}</span>
          </div>

          {error ? (
            <p className="text-sm text-[var(--admin-danger)]" role="alert">
              {error}
            </p>
          ) : null}
        </div>

        <footer className="flex h-[72px] shrink-0 items-center justify-end gap-4 border-t border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-6">
          <button type="button" onClick={onClose} className={`${ghostButtonClassName} h-10`}>
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void onSubmit()}
            disabled={saving}
            className={`${primaryButtonClassName} h-10 gap-2`}
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <Download className="h-4 w-4" aria-hidden="true" />
            )}
            Create export
          </button>
        </footer>
      </div>
    </div>
  );
}
