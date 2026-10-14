"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Search } from "lucide-react";
import { Select } from "@atlas/design-system";
import {
  customFieldExportsApi,
  type CreateCustomFieldExportBody,
  type CustomFieldExportCadence,
  type CustomFieldExportColumn,
  type CustomFieldExportDataset,
  type CustomFieldExportDelivery,
  type CustomFieldExportEmptyValue,
  type CustomFieldExportFormat,
  type CustomFieldExportHistoryItem,
  type CustomFieldExportScheduleItem,
  type CustomFieldExportsPayload,
} from "./admin-custom-field-exports-api";
import {
  fetchCustomFieldSegments,
  type CustomFieldSegmentItem,
} from "./admin-custom-field-segments-api";
import {
  ExportDatasetPills,
  ExportDeliverySection,
  ExportDialogFrame,
  ExportDialogNote,
  ExportDialogSection,
  ExportField,
  ExportFormatSection,
  ExportScheduleSection,
  exportCheckboxClassName,
  exportSelectTriggerClassName,
} from "./export-dialog-kit";
import { useNewExportForm } from "./use-new-export-form";

const DATASET_OPTIONS: Array<{ value: CustomFieldExportDataset; label: string }> = [
  { value: "learner_roster", label: "Learners" },
  { value: "field_coverage", label: "Field coverage" },
  { value: "segment_members", label: "Segment members" },
];

function typeBadgeClass(badge: string | null) {
  if (badge === "bol") {
    return "border-[color-mix(in_srgb,var(--admin-success)_25%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-success)_10%,transparent)] text-[var(--admin-success)]";
  }
  if (badge === "num") {
    return "border-[color-mix(in_srgb,var(--admin-warning)_25%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-warning)_10%,transparent)] text-[var(--admin-warning)]";
  }
  return "border-[color-mix(in_srgb,var(--admin-primary)_25%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-primary)_10%,transparent)] text-[var(--admin-primary)]";
}

/** One group of columns with an All switch; learner fields show their PII flag, custom fields their type. */
function ColumnGroup({
  title,
  columns,
  selected,
  onToggle,
  onToggleAll,
  emptyText,
}: {
  title: string;
  columns: CustomFieldExportColumn[];
  selected: ReadonlySet<string>;
  onToggle: (key: string) => void;
  onToggleAll: (on: boolean) => void;
  emptyText?: string;
}) {
  const allOn = columns.length > 0 && columns.every((column) => selected.has(column.key));
  return (
    <div className="border-b border-[var(--admin-border)] last:border-b-0">
      <div className="flex items-center justify-between bg-[var(--admin-surface-high)] px-3 py-2">
        <span className="text-sm font-semibold text-[var(--admin-on-surface)]">{title}</span>
        <label className="flex cursor-pointer items-center gap-2 text-xs text-[var(--admin-on-surface-variant)]">
          <input
            type="checkbox"
            checked={allOn}
            onChange={(event) => {
              onToggleAll(event.target.checked);
            }}
            className={exportCheckboxClassName}
          />
          All
        </label>
      </div>
      {columns.length === 0 && emptyText ? (
        <p className="px-4 py-6 text-sm text-[var(--admin-on-surface-variant)]">{emptyText}</p>
      ) : (
        <div className="max-h-48 overflow-y-auto py-1">
          {columns.map((column) => (
            <label
              key={column.key}
              className="flex cursor-pointer items-start gap-3 px-4 py-2 hover:bg-[var(--admin-surface-high)]"
            >
              <input
                type="checkbox"
                className={`mt-0.5 ${exportCheckboxClassName}`}
                checked={selected.has(column.key)}
                onChange={() => {
                  onToggle(column.key);
                }}
              />
              <span className="flex flex-col">
                <span className="flex items-center gap-2 font-mono text-[13px] text-[var(--admin-on-surface)]">
                  {column.typeBadge ? (
                    <span
                      className={`rounded-sm border px-1.5 py-0.5 font-mono text-[11px] font-semibold uppercase ${typeBadgeClass(column.typeBadge)}`}
                    >
                      {column.typeBadge}
                    </span>
                  ) : null}
                  {column.key.replace(/^cf:/, "")}
                  {column.sensitive ? (
                    <AlertTriangle
                      className="h-3.5 w-3.5 text-[var(--admin-warning)]"
                      aria-label="Contains personal data"
                    />
                  ) : null}
                </span>
                {column.sensitive ? (
                  <span className="font-mono text-[10px] text-[var(--admin-warning)]">
                    Contains learner personal data (PII)
                  </span>
                ) : null}
              </span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

export function CustomFieldNewExportModal({
  open,
  learnerColumns,
  customFieldColumns,
  capabilities,
  initialScheduleEnabled,
  onClose,
  onCreated,
}: {
  open: boolean;
  learnerColumns: CustomFieldExportColumn[];
  customFieldColumns: CustomFieldExportColumn[];
  capabilities: CustomFieldExportsPayload["capabilities"];
  initialScheduleEnabled: boolean;
  onClose: () => void;
  onCreated: (
    run: CustomFieldExportHistoryItem,
    schedule: CustomFieldExportScheduleItem | null,
  ) => void;
}) {
  const form = useNewExportForm<
    CustomFieldExportFormat,
    CustomFieldExportDelivery,
    CustomFieldExportCadence
  >({
    open,
    onClose,
    initialScheduleEnabled,
    defaults: {
      format: "csv",
      delivery: "download",
      cadence: "weekly",
      time: "07:00",
      timezone: "Asia/Kolkata",
    },
  });
  const [dataset, setDataset] = useState<CustomFieldExportDataset>("learner_roster");
  const [columnQuery, setColumnQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [emptyValueMode, setEmptyValueMode] = useState<CustomFieldExportEmptyValue>("blank");
  const [segments, setSegments] = useState<CustomFieldSegmentItem[]>([]);
  const [segmentId, setSegmentId] = useState("");

  const matchesQuery = useMemo(() => {
    const q = columnQuery.trim().toLowerCase();
    return (column: CustomFieldExportColumn) =>
      !q || column.key.toLowerCase().includes(q) || column.label.toLowerCase().includes(q);
  }, [columnQuery]);
  const filteredLearner = useMemo(
    () => learnerColumns.filter(matchesQuery),
    [learnerColumns, matchesQuery],
  );
  const filteredCustom = useMemo(
    () => customFieldColumns.filter(matchesQuery),
    [customFieldColumns, matchesQuery],
  );

  const selectedSegment = segments.find((segment) => segment.id === segmentId) ?? null;

  useEffect(() => {
    if (!open) return;
    setDataset("learner_roster");
    setColumnQuery("");
    setSelected(
      new Set(
        learnerColumns.filter((column) => column.defaultSelected).map((column) => column.key),
      ),
    );
    setEmptyValueMode("blank");
    void fetchCustomFieldSegments()
      .then((response) => {
        setSegments(response.data.items);
        if (response.data.items[0]) setSegmentId(response.data.items[0].id);
      })
      .catch(() => {
        setSegments([]);
      });
  }, [open, learnerColumns]);

  if (!open) return null;

  function toggleColumn(key: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function toggleGroup(columns: CustomFieldExportColumn[], on: boolean) {
    setSelected((current) => {
      const next = new Set(current);
      for (const column of columns) {
        if (on) next.add(column.key);
        else next.delete(column.key);
      }
      return next;
    });
  }

  async function onSubmit() {
    if (selected.size === 0) return form.fail("Select at least one column.");
    if (dataset === "segment_members" && !segmentId) {
      return form.fail("Select a segment for segment member exports.");
    }
    if (form.delivery === "recipients" && form.recipients.length === 0) {
      return form.fail("Add at least one recipient email.");
    }

    const datasetLabel = DATASET_OPTIONS.find((option) => option.value === dataset)?.label;
    const body: CreateCustomFieldExportBody = {
      dataset,
      columns: [...selected],
      format: form.format,
      emptyValueMode,
      useCurrentFilters: true,
      delivery: form.delivery,
      scheduleEnabled: form.scheduleEnabled,
      ...(dataset === "segment_members" && segmentId
        ? {
            segmentId,
            ...(selectedSegment?.name ? { segmentName: selectedSegment.name } : {}),
          }
        : {}),
      ...(form.delivery === "recipients"
        ? { recipients: form.recipients.map((email) => email.toLowerCase()) }
        : {}),
      ...(form.webhookUrl.trim() ? { webhookUrl: form.webhookUrl.trim() } : {}),
      ...(form.scheduleEnabled
        ? {
            cadence: form.cadence,
            time: form.time,
            timezone: form.timezone,
            scheduleName: `${datasetLabel ?? "Custom field"} export`,
          }
        : {}),
    };

    return form.submit(() => customFieldExportsApi.create(body), onCreated);
  }

  return (
    <ExportDialogFrame
      submitLabel="Generate export"
      submitDisabled={selected.size === 0}
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
        <div className="space-y-4">
          {dataset === "segment_members" ? (
            <ExportField label="Segment">
              <Select
                value={segmentId}
                onValueChange={setSegmentId}
                options={
                  segments.length === 0
                    ? [{ value: "", label: "No segments yet" }]
                    : segments.map((segment) => ({
                        value: segment.id,
                        label: `${segment.name} (${(segment.matchedCount ?? 0).toLocaleString()})`,
                      }))
                }
                className={exportSelectTriggerClassName}
              />
            </ExportField>
          ) : null}
          <div className="rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-3 font-mono text-[13px] text-[var(--admin-on-surface)]">
            <div className="flex gap-2">
              <span className="text-[var(--admin-primary)]">WHERE</span>
              <span>
                {dataset === "segment_members" && selectedSegment
                  ? `segment = "${selectedSegment.name}"`
                  : "all matched learners"}
              </span>
            </div>
            <div className="mt-2 border-t border-[var(--admin-border)] pt-2 text-xs text-[var(--admin-on-surface-variant)]">
              Est. output rows:{" "}
              {dataset === "segment_members" && selectedSegment
                ? `~${(selectedSegment.matchedCount ?? 0).toLocaleString()}`
                : "depends on filters"}
            </div>
          </div>
        </div>
      </ExportDialogSection>

      <ExportDialogSection
        title="Columns"
        action={
          <span className="font-mono text-[13px] text-[var(--admin-primary)]">
            {selected.size} selected
          </span>
        }
      >
        <div className="relative mb-3">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[var(--admin-on-surface-variant)]"
            aria-hidden="true"
          />
          <input
            value={columnQuery}
            onChange={(event) => {
              setColumnQuery(event.target.value);
            }}
            aria-label="Search columns"
            placeholder="Search columns…"
            className="h-10 w-full rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface-low)] pr-3 pl-9 text-sm text-[var(--admin-on-surface)] outline-none focus:border-[var(--admin-primary)]"
          />
        </div>
        <div className="overflow-hidden rounded-sm border border-[var(--admin-border)]">
          <ColumnGroup
            title="Learner core data"
            columns={filteredLearner}
            selected={selected}
            onToggle={toggleColumn}
            onToggleAll={(on) => {
              toggleGroup(filteredLearner, on);
            }}
          />
          <ColumnGroup
            title="Custom fields"
            columns={filteredCustom}
            selected={selected}
            onToggle={toggleColumn}
            onToggleAll={(on) => {
              toggleGroup(filteredCustom, on);
            }}
            emptyText="No custom fields defined yet."
          />
        </div>
      </ExportDialogSection>

      <ExportDialogSection title="Empty values">
        <div className="space-y-3">
          {(
            [
              ["blank", "Leave blank (null)"],
              ["emdash", 'Use the literal string "—"'],
            ] as const
          ).map(([value, label]) => (
            <label key={value} className="flex cursor-pointer items-center gap-3">
              <input
                type="radio"
                name="custom-field-empty-values"
                checked={emptyValueMode === value}
                onChange={() => {
                  setEmptyValueMode(value);
                }}
                className="h-4 w-4 border-[var(--admin-outline)] text-[var(--admin-primary)] focus:ring-[var(--admin-primary)]"
              />
              <span className="text-sm text-[var(--admin-on-surface)]">{label}</span>
            </label>
          ))}
        </div>
      </ExportDialogSection>

      <ExportFormatSection
        formats={capabilities.formats}
        value={form.format}
        onChange={form.setFormat}
      />

      <ExportDeliverySection
        form={form}
        emailEnabled={capabilities.canEmailDelivery}
        webhook={capabilities.canWebhookDelivery}
      />

      {capabilities.canSchedule ? <ExportScheduleSection form={form} /> : null}

      <ExportDialogNote>{capabilities.note}</ExportDialogNote>
    </ExportDialogFrame>
  );
}
