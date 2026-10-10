"use client";

import {
  pollsExportsApi,
  type PollExportDataset,
  type PollExportHistoryItem,
} from "./admin-polls-exports-api";
import { PollsNewExportModal } from "./PollsNewExportModal";
import { PollsReportTabs } from "./PollsReportTabs";
import { ReportExportsPage } from "./ReportExportsPage";
import {
  EXPORT_LINK_EXPIRY_NOTE,
  ExportBuildProgress,
  ExportDatasetChip,
  ExportFileName,
  exportRowCount,
  formatExportRelative,
  type ExportDatasetTone,
  type ExportHistoryColumn,
} from "./report-exports-kit";

const DATASET_TONES: Record<PollExportDataset, ExportDatasetTone> = {
  poll_summary: "primary",
  option_tallies: "success",
  respondents: "warning",
  non_respondents: "danger",
};

/** Anonymous polls leave out their respondents, so a respondents file says how many it skipped. */
function anonymousExcluded(item: PollExportHistoryItem): number | null {
  return item.dataset === "respondents" && item.anonymousExcludedCount
    ? item.anonymousExcludedCount
    : null;
}

const COLUMNS: Array<ExportHistoryColumn<PollExportHistoryItem>> = [
  {
    heading: "File",
    className: "px-4 py-3 whitespace-nowrap",
    render: (item) => (
      <>
        <ExportFileName item={item} />
        <div className="mt-1 font-mono text-[11px] text-[var(--admin-on-surface-variant)]">
          {item.sizeLabel ? `${item.sizeLabel} · ` : ""}
          {formatExportRelative(item.createdAt)}
        </div>
        <ExportBuildProgress item={item} />
      </>
    ),
  },
  {
    heading: "Dataset",
    className: "px-4 py-3",
    render: (item) => (
      <ExportDatasetChip label={item.datasetLabel} tone={DATASET_TONES[item.dataset]} />
    ),
  },
  {
    heading: "Scope",
    className: "max-w-[180px] px-4 py-3",
    render: (item) => (
      <p className="truncate text-sm text-[var(--admin-on-surface-variant)]">{item.scopeLabel}</p>
    ),
  },
  {
    heading: "Rows",
    className: "px-4 py-3 whitespace-nowrap",
    render: (item) => {
      const excluded = anonymousExcluded(item);
      return (
        <>
          <div className="font-mono text-[13px] text-[var(--admin-on-surface)]">
            {exportRowCount(item)}
          </div>
          {excluded ? (
            <p className="mt-1 text-[11px] text-[var(--admin-on-surface-variant)]">
              {excluded} anonymous poll{excluded === 1 ? "" : "s"} excluded
            </p>
          ) : null}
        </>
      );
    },
  },
];

export function AdminPollsExportsPage() {
  return (
    <ReportExportsPage
      api={pollsExportsApi}
      breadcrumbs={[{ label: "Polls", href: "/admin/reports/polls" }]}
      description="Download poll results or schedule recurring delivery."
      tabs={<PollsReportTabs active="exports" />}
      columns={COLUMNS}
      emptyHistoryText="No exports yet. Create one to download poll results."
      pageSize={25}
      historyNote="Files are deleted after 7 days"
      footnote={EXPORT_LINK_EXPIRY_NOTE}
      renderNewExport={(slot) => (
        <PollsNewExportModal
          open={slot.open}
          schedulePreset={slot.schedulePreset}
          payload={slot.payload}
          onClose={slot.onClose}
          onCreated={({ run, schedule }) => {
            slot.onCreated(run, schedule);
          }}
        />
      )}
    />
  );
}
