"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { ClientApiError } from "../../../lib/client-api";
import {
  downloadPaymentInvoice,
  fetchPaymentTransactionDetail,
  type PaymentTransactionDetail,
} from "./admin-payments-roster-api";
import { AdminPaymentRefundModal } from "./AdminPaymentRefundModal";
import { AdminPaymentTransactionDetailBody } from "./AdminPaymentTransactionDetailBody";
import { PaymentsReportTabs } from "./PaymentsReportTabs";

type Props = {
  orderId: string;
};

export function AdminPaymentTransactionDetailPage({ orderId }: Props) {
  const router = useRouter();
  const [detail, setDetail] = useState<PaymentTransactionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [refundOpen, setRefundOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchPaymentTransactionDetail(orderId);
      setDetail(response.data);
    } catch (err) {
      setDetail(null);
      setError(
        err instanceof ClientApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Failed to load transaction.",
      );
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleDownloadInvoice() {
    if (!detail?.canDownloadInvoice) return;
    setBusy(true);
    try {
      const response = await downloadPaymentInvoice(detail.id);
      const blob = new Blob([response.data.content], { type: response.data.contentType });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = response.data.filename;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(
        err instanceof ClientApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Invoice download failed.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleCopyId() {
    if (!detail) return;
    await navigator.clipboard.writeText(detail.id);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="space-y-6 text-[var(--admin-on-surface)]">
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2 font-mono text-xs text-[var(--admin-on-surface-variant)]">
          <Link href="/admin/reports/enrollments" className="hover:text-[var(--admin-primary)]">
            Reports
          </Link>
          <span>/</span>
          <Link href="/admin/reports/payments" className="hover:text-[var(--admin-primary)]">
            Payments
          </Link>
          <span>/</span>
          <Link
            href="/admin/reports/payments/transactions"
            className="hover:text-[var(--admin-primary)]"
          >
            Transactions
          </Link>
          <span>/</span>
          <span className="text-[var(--admin-on-surface)]">{detail?.displayId ?? "…"}</span>
          {copied ? (
            <span className="text-[var(--admin-success)]">Copied order UUID</span>
          ) : null}
        </div>
        <PaymentsReportTabs active="transactions" />
      </div>

      {loading ? (
        <div className="space-y-4">
          <div className="h-24 animate-pulse border border-[var(--admin-border)] bg-[var(--admin-surface)]" />
          <div className="h-64 animate-pulse border border-[var(--admin-border)] bg-[var(--admin-surface)]" />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div
                key={index}
                className="h-40 animate-pulse border border-[var(--admin-border)] bg-[var(--admin-surface)]"
              />
            ))}
          </div>
        </div>
      ) : error && !detail ? (
        <div className="flex flex-col items-start gap-4 border border-[var(--admin-danger)] bg-[color-mix(in_srgb,var(--admin-danger)_8%,transparent)] p-6">
          <div className="flex items-center gap-2 text-[var(--admin-danger)]">
            <AlertTriangle className="h-5 w-5" />
            <h2 className="text-lg font-semibold">Could not load transaction</h2>
          </div>
          <p className="font-mono text-sm text-[var(--admin-on-surface-variant)]">{error}</p>
          <div className="flex gap-3">
            <button
              type="button"
              className="inline-flex items-center gap-2 border border-[var(--admin-border)] px-4 py-2 font-mono text-xs font-bold uppercase tracking-wider hover:border-[var(--admin-primary)]"
              onClick={() => void load()}
            >
              <RefreshCw className="h-4 w-4" /> Retry
            </button>
            <button
              type="button"
              className="border border-[var(--admin-border)] px-4 py-2 font-mono text-xs font-bold uppercase tracking-wider"
              onClick={() => router.push("/admin/reports/payments/transactions")}
            >
              Back to ledger
            </button>
          </div>
        </div>
      ) : detail ? (
        <>
          {error ? (
            <div className="flex items-center gap-2 border border-[var(--admin-warning)] bg-[color-mix(in_srgb,var(--admin-warning)_10%,transparent)] px-4 py-2 font-mono text-xs text-[var(--admin-warning)]">
              <AlertTriangle className="h-4 w-4" />
              {error}
            </div>
          ) : null}
          <AdminPaymentTransactionDetailBody
            detail={detail}
            variant="page"
            busy={busy}
            onCopyId={() => void handleCopyId()}
            onDownloadInvoice={() => void handleDownloadInvoice()}
            onRefund={() => setRefundOpen(true)}
          />
          <AdminPaymentRefundModal
            open={refundOpen}
            detail={detail}
            onClose={() => setRefundOpen(false)}
            onRefunded={() => void load()}
          />
        </>
      ) : null}
    </div>
  );
}
