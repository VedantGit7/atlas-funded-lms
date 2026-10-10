"use client";

import {
  paymentExportsApi,
  type PaymentExportDataset,
  type PaymentExportHistoryItem,
} from "./admin-payments-exports-api";
import { PaymentsNewExportModal } from "./PaymentsNewExportModal";
import { PaymentsReportTabs } from "./PaymentsReportTabs";
import { ReportExportsPage } from "./ReportExportsPage";
import { standardExportColumns, type ExportDatasetTone } from "./report-exports-kit";

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

export function AdminPaymentsExportsPage() {
  return (
    <ReportExportsPage
      api={paymentExportsApi}
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
