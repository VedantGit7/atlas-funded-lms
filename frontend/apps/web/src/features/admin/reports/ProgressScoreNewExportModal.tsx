"use client";

import { useEffect, useMemo, useState } from "react";
import { Select } from "@atlas/design-system";
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
import {
  dateInputToEndIso,
  dateInputToStartIso,
  fetchProgressProducts,
  fetchScoreProducts,
  fetchScoreQuizzes,
  type ScoreProductType,
} from "./admin-progress-score-roster-api";
import {
  ExportColumnChecklist,
  ExportDatasetPills,
  ExportDeliverySection,
  ExportDialogFrame,
  ExportDialogNote,
  ExportDialogSection,
  ExportField,
  ExportFiltersSection,
  ExportFormatSection,
  ExportScheduleSection,
  defaultScheduleName,
  exportInputClassName,
  exportSelectTriggerClassName,
} from "./export-dialog-kit";
import { useNewExportForm } from "./use-new-export-form";

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
  const form = useNewExportForm<
    ProgressScoreExportFormat,
    ProgressScoreExportDelivery,
    ProgressScoreExportCadence
  >({
    open,
    onClose,
    initialScheduleEnabled,
    defaults: {
      format: "csv",
      delivery: "download",
      cadence: "monthly",
      time: "06:00",
      timezone: "Asia/Kolkata",
    },
  });
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
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [useCurrentFilters, setUseCurrentFilters] = useState(true);

  const scoreLike = isScoreLikeDataset(dataset);
  const columns = scoreLike ? scoreColumns : progressColumns;

  const productTypeOptions = useMemo(
    () => (scoreLike ? SCORE_PRODUCT_TYPES : PROGRESS_PRODUCT_TYPES),
    [scoreLike],
  );

  const effectiveProductType = scoreLike ? scoreProductType : productType;

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
    setDateFrom("");
    setDateTo("");
    setUseCurrentFilters(true);
  }, [open, progressColumns]);

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

  function toggleColumn(key: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
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
    if (dateFrom && dateTo) parts.push(`${dateFrom} - ${dateTo}`);
    else if (dateFrom) parts.push(`From ${dateFrom}`);
    else if (dateTo) parts.push(`Until ${dateTo}`);
    else parts.push("All time");
    return parts.join(" · ");
  }

  async function onSubmit() {
    if (selected.size === 0) return form.fail("Select at least one column.");
    if (form.delivery === "recipients" && form.recipients.length === 0) {
      return form.fail("Add at least one recipient email.");
    }

    const body: CreateProgressScoreExportBody = {
      dataset,
      columns: [...selected],
      format: form.format,
      useCurrentFilters,
      delivery: form.delivery,
      scheduleEnabled: form.scheduleEnabled,
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

    if (form.delivery === "recipients") {
      body.recipients = form.recipients;
      if (form.webhookUrl.trim()) body.webhookUrl = form.webhookUrl.trim();
    }

    if (form.scheduleEnabled) {
      const datasetLabel =
        DATASET_OPTIONS.find((item) => item.value === dataset)?.label ?? "Progress & score";
      body.scheduleName = defaultScheduleName(form.cadence, datasetLabel);
      body.cadence = form.cadence;
      body.time = form.time;
      body.timezone = form.timezone;
    }

    return form.submit(() => progressScoreExportsApi.create(body), onCreated);
  }

  return (
    <ExportDialogFrame
      saving={form.saving}
      error={form.error}
      onClose={onClose}
      onSubmit={() => void onSubmit()}
    >
      <ExportDatasetPills
        options={DATASET_OPTIONS.filter((option) => capabilities.datasets.includes(option.value))}
        value={dataset}
        onChange={setDataset}
      />

      <ExportDialogSection title="Scope">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <ExportField label="Product type">
            <Select
              value={effectiveProductType}
              onValueChange={(value) => {
                if (scoreLike) setScoreProductType(value as ScoreProductType);
                else setProductType(value as ProgressScoreExportProductType);
                setProductId("");
                setAssessmentId("");
              }}
              options={[...productTypeOptions]}
              className={exportSelectTriggerClassName}
            />
          </ExportField>
          <ExportField label="Product (optional)">
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
              className={exportSelectTriggerClassName}
            />
          </ExportField>
          {scoreLike ? (
            <ExportField label="Assessment (optional)" className="sm:col-span-2">
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
                className={exportSelectTriggerClassName}
              />
            </ExportField>
          ) : null}
        </div>
        <p className="mt-2 text-xs text-[var(--admin-on-surface-variant)]">{scopeSummary()}</p>
      </ExportDialogSection>

      <ExportColumnChecklist
        columns={columns}
        selected={selected}
        onToggle={toggleColumn}
        onSelectAll={() => {
          setSelected(new Set(columns.map((column) => column.key)));
        }}
        badgeFor={(key) =>
          key === "email"
            ? "pii"
            : columns.find((column) => column.key === key)?.sensitive
              ? "sensitive"
              : null
        }
        warning={
          selected.has("email")
            ? "Email is learner PII. Handle exported files according to your data retention policy."
            : null
        }
      />

      <ExportFiltersSection
        summary={filterSummary()}
        useCurrentFilters={useCurrentFilters}
        onUseCurrentFiltersChange={setUseCurrentFilters}
      >
        {useCurrentFilters ? (
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <ExportField label="From">
              <input
                type="date"
                value={dateFrom}
                onChange={(event) => {
                  setDateFrom(event.target.value);
                }}
                className={exportInputClassName}
              />
            </ExportField>
            <ExportField label="To">
              <input
                type="date"
                value={dateTo}
                onChange={(event) => {
                  setDateTo(event.target.value);
                }}
                className={exportInputClassName}
              />
            </ExportField>
          </div>
        ) : null}
      </ExportFiltersSection>

      <ExportFormatSection
        formats={capabilities.formats}
        value={form.format}
        onChange={form.setFormat}
      />

      <ExportDeliverySection form={form} webhook />

      {capabilities.canSchedule ? <ExportScheduleSection form={form} /> : null}

      <ExportDialogNote>{capabilities.note}</ExportDialogNote>
    </ExportDialogFrame>
  );
}
