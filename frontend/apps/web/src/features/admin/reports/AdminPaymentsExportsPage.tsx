"use client";

import {
  paymentExportsApi,
  type PaymentExportDataset,
  type PaymentExportHistoryItem,
  type PaymentExportsPayload,
} from "./admin-payments-exports-api";
import { PaymentsNewExportModal } from "./PaymentsNewExportModal";
import { PaymentsReportTabs } from "./PaymentsReportTabs";
import { ReportExportsPage } from "./ReportExportsPage";
import { standardExportColumns, type ExportDatasetTone } from "./report-exports-kit";
import type { ReportInitialData } from "../../../lib/server/report-initial-data";

const DATASET_TONES: Record<PaymentExportDataset, ExportDatasetTone> = {
  transactions: "neutral",
  orders: "neutral",
  invoices: "neutral",
  instalments: "neutral",
  refunds: "warning",
  gateways: "success",
};

const COLUMNS = standardExportColumns<PaymentExportHistoryItem>({
  datasetTone: (dataset) => DATASET_TONES[dataset],
  expiredCaption: "Files expire after artifact TTL",
});

export function AdminPaymentsExportsPage({
  initialExports,
}: {
  /** The exports the server loaded, if it could. */
  initialExports?: ReportInitialData<PaymentExportsPayload> | null | undefined;
}) {
  return (
    <ReportExportsPage
      api={paymentExportsApi}
      initialExports={initialExports}
      breadcrumbs={[
        { label: "Admin", href: "/admin" },
        { label: "Payments", href: "/admin/reports/payments" },
      ]}
      description="Download payment data or schedule recurring delivery to finance."
      tabs={<PaymentsReportTabs active="exports" />}
      columns={COLUMNS}
      emptyHistoryText="No exports yet. Create one to download payment data."
      renderNewExport={(slot) => (
        <PaymentsNewExportModal
          open={slot.open}
          columns={slot.payload.columns}
          capabilities={slot.payload.capabilities}
          initialScheduleEnabled={slot.schedulePreset}
          onClose={slot.onClose}
          onCreated={slot.onCreated}
        />
      )}
    />
  );
}
