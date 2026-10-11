"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { ClientApiError } from "../../../lib/client-api";
import {
  zoomInsightsExportsApi,
  type ZoomExportsConnectionMeta,
} from "./admin-zoom-insights-exports-api";
import { syncZoomConnectionNow } from "./admin-zoom-insights-roster-api";
import { INSIGHT_EXPORT_COLUMNS, formatInsightRelative } from "./insight-report-exports-kit";
import { InsightReportExportsPage } from "./InsightReportExportsPage";
import { ZoomInsightsNewExportModal } from "./ZoomInsightsNewExportModal";
import { ZoomInsightsReportTabs } from "./ZoomInsightsReportTabs";

const COLUMNS = [
  INSIGHT_EXPORT_COLUMNS.file,
  INSIGHT_EXPORT_COLUMNS.dataset,
  INSIGHT_EXPORT_COLUMNS.scope,
  INSIGHT_EXPORT_COLUMNS.rows,
  INSIGHT_EXPORT_COLUMNS.size,
];

/** Whether Zoom is connected and when it last synced, with a way to sync now. */
function ZoomConnectionBanner({
  connection,
  reload,
  showError,
}: {
  connection: ZoomExportsConnectionMeta;
  reload: () => Promise<void>;
  showError: (message: string) => void;
}) {
  const [syncing, setSyncing] = useState(false);
  const connected = connection.status === "connected";

  async function syncNow() {
    setSyncing(true);
    try {
      await syncZoomConnectionNow();
      await reload();
    } catch (caught) {
      showError(caught instanceof ClientApiError ? caught.message : "Could not sync Zoom.");
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-4 py-3">
      <div className="flex flex-wrap items-center gap-2 text-[12px] text-[var(--admin-on-surface-variant)]">
        <span
          className={`h-2 w-2 rounded-full ${
            connected ? "bg-[var(--admin-success)]" : "bg-[var(--admin-danger)]"
          }`}
          aria-hidden="true"
        />
        <span className="font-semibold text-[var(--admin-on-surface)]">
          {connected ? "Zoom connected" : "Zoom disconnected"}
        </span>
        <span aria-hidden="true">·</span>
        <span>last synced {formatInsightRelative(connection.lastSyncedAt)}</span>
        <span aria-hidden="true">·</span>
        <span>
          {connection.meetingsImportedToday} meeting
          {connection.meetingsImportedToday === 1 ? "" : "s"} imported today
        </span>
      </div>
      <button
        type="button"
        disabled={syncing || !connected}
        onClick={() => void syncNow()}
        className="inline-flex shrink-0 items-center gap-1 text-[12px] font-semibold text-[var(--admin-primary)] hover:underline disabled:opacity-50"
      >
        {syncing ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : null}
        Sync now
      </button>
    </div>
  );
}

export function AdminZoomInsightsExportsPage() {
  return (
    <InsightReportExportsPage
      api={zoomInsightsExportsApi}
      breadcrumbs={[{ label: "Zoom Insights", href: "/admin/reports/zoom-insights" }]}
      description="Download Zoom meeting and participant data, or schedule recurring delivery."
      tabs={<ZoomInsightsReportTabs active="exports" />}
      banner={(payload, actions) => (
        <ZoomConnectionBanner connection={payload.connection} {...actions} />
      )}
      columns={COLUMNS}
      emptyHistoryText="No exports yet. Create one to download Zoom data."
      historyNote={(payload) => payload.capabilities.note}
      renderNewExport={(slot) => (
        <ZoomInsightsNewExportModal
          open={slot.open}
          capabilities={slot.payload.capabilities}
          initialScheduleEnabled={slot.schedulePreset}
          onClose={slot.onClose}
          onCreated={slot.onCreated}
        />
      )}
    />
  );
}
