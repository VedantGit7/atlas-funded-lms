"use client";

import { useRouter } from "next/navigation";
import { Copy, Receipt, Undo2, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { ClientApiError } from "../../../lib/client-api";
import {
  downloadPaymentInvoice,
  fetchPaymentTransactionDetail,
  type PaymentTransactionDetail,
} from "./admin-payments-roster-api";
import { AdminPaymentRefundModal } from "./AdminPaymentRefundModal";
import { AdminPaymentTransactionDetailBody } from "./AdminPaymentTransactionDetailBody";
import { statusBadge } from "./payment-transaction-ui";

type Props = {
  orderId: string | null;
  onClose: () => void;
};

export function AdminPaymentTransactionDrawer({ orderId, onClose }: Props) {
  const router = useRouter();
  const [detail, setDetail] = useState<PaymentTransactionDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [refundOpen, setRefundOpen] = useState(false);

  const load = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchPaymentTransactionDetail(id);
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
  }, []);

  useEffect(() => {
    if (!orderId) {
      setDetail(null);
      setError(null);
      return;
    }
    void load(orderId);
  }, [orderId, load]);

  useEffect(() => {
    if (!orderId || refundOpen) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }, [orderId, refundOpen, onClose]);

  if (!orderId) return null;

  const badge = detail ? statusBadge(detail.status) : null;

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

  return (
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        className="absolute inset-0 bg-[color-mix(in_srgb,var(--admin-bg)_40%,#000)] backdrop-blur-[2px]"
        aria-label="Close transaction drawer"
        onClick={onClose}
      />
      <aside className="absolute inset-y-0 right-0 flex w-full max-w-[560px] flex-col border-l border-[var(--admin-outline)] bg-[var(--admin-bg)] shadow-2xl">
        <header className="flex shrink-0 items-center justify-between border-b border-[var(--admin-outline)] bg-[var(--admin-bg)] px-6 py-4">
          <div className="flex min-w-0 flex-col gap-1">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="truncate text-xl font-bold text-[var(--admin-on-surface)]">
                Order {detail?.displayId ?? "…"}
              </h2>
              {badge ? (
                <span
                  className={`border px-2 py-1 font-mono text-[11px] font-bold uppercase tracking-widest ${badge.className}`}
                >
                  {badge.label}
                </span>
              ) : null}
            </div>
            <div className="flex items-center gap-2 font-mono text-xs text-[var(--admin-on-surface-variant)]">
              <span
                className={[
                  "h-2 w-2 rounded-full",
                  detail?.environment === "live"
                    ? "bg-[var(--admin-success)]"
                    : detail?.environment === "test"
                      ? "bg-[var(--admin-warning)]"
                      : "bg-[var(--admin-on-surface-variant)]",
                ].join(" ")}
              />
              {detail?.environment === "live"
                ? "Live environment"
                : detail?.environment === "test"
                  ? "Test environment"
                  : "Environment unknown"}
            </div>
          </div>
          <button
            type="button"
            className="flex h-8 w-8 items-center justify-center border border-transparent bg-[var(--admin-surface)] text-[var(--admin-on-surface-variant)] hover:border-[color-mix(in_srgb,var(--admin-primary)_30%,transparent)] hover:text-[var(--admin-primary)]"
            aria-label="Close"
            onClick={onClose}
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <main className="flex-1 overflow-y-auto bg-[var(--admin-surface-low)] p-6">
          {loading ? (
            <div className="space-y-4">
              <div className="h-40 animate-pulse border border-[var(--admin-border)] bg-[var(--admin-surface)]" />
              <div className="h-16 animate-pulse border border-[var(--admin-border)] bg-[var(--admin-surface)]" />
              <div className="grid grid-cols-2 gap-4">
                <div className="h-36 animate-pulse border border-[var(--admin-border)] bg-[var(--admin-surface)]" />
                <div className="h-36 animate-pulse border border-[var(--admin-border)] bg-[var(--admin-surface)]" />
              </div>
            </div>
          ) : error && !detail ? (
            <div className="border border-[var(--admin-danger)] bg-[color-mix(in_srgb,var(--admin-danger)_8%,transparent)] p-4 font-mono text-sm text-[var(--admin-danger)]">
              {error}
            </div>
          ) : detail ? (
            <AdminPaymentTransactionDetailBody
              detail={detail}
              variant="drawer"
              busy={busy}
              onOpenFull={() => {
                onClose();
                router.push(`/admin/reports/payments/transactions/${detail.id}`);
              }}
            />
          ) : null}
        </main>

        {detail ? (
          <footer className="relative z-20 flex shrink-0 items-center justify-between gap-4 border-t border-[var(--admin-outline)] bg-[var(--admin-bg)] p-6">
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                className="inline-flex items-center gap-2 border border-[var(--admin-primary)] bg-[var(--admin-bg)] px-4 py-2 font-mono text-xs text-[var(--admin-primary)] hover:bg-[color-mix(in_srgb,var(--admin-primary)_10%,transparent)]"
                onClick={() => void navigator.clipboard.writeText(detail.id)}
              >
                <Copy className="h-4 w-4" /> Copy ID
              </button>
              <button
                type="button"
                disabled={busy || !detail.canDownloadInvoice}
                className="inline-flex items-center gap-2 border border-[var(--admin-primary)] bg-[var(--admin-bg)] px-4 py-2 font-mono text-xs text-[var(--admin-primary)] hover:bg-[color-mix(in_srgb,var(--admin-primary)_10%,transparent)] disabled:opacity-40"
                onClick={() => void handleDownloadInvoice()}
              >
                <Receipt className="h-4 w-4" /> Invoice
              </button>
            </div>
            <button
              type="button"
              disabled={busy || !detail.canRefund}
              className="inline-flex items-center gap-2 border border-[var(--admin-danger)] bg-[color-mix(in_srgb,var(--admin-danger)_12%,transparent)] px-4 py-2 font-mono text-xs text-[var(--admin-danger)] hover:bg-[color-mix(in_srgb,var(--admin-danger)_20%,transparent)] disabled:opacity-40"
              onClick={() => {
                setRefundOpen(true);
              }}
            >
              <Undo2 className="h-4 w-4" /> Refund
            </button>
          </footer>
        ) : null}
      </aside>

      {detail ? (
        <AdminPaymentRefundModal
          open={refundOpen}
          detail={detail}
          onClose={() => {
            setRefundOpen(false);
          }}
          onRefunded={() => void load(detail.id)}
        />
      ) : null}
    </div>
  );
}
