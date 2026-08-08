"use client";

import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Copy,
  Download,
  ExternalLink,
  FileCode2,
  Link2,
  Minus,
  Plus,
  Printer,
  RefreshCw,
  Send,
  Ban,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { ClientApiError } from "../../../lib/client-api";
import {
  fetchPaymentInvoiceDetail,
  type PaymentInvoiceDetail,
} from "./admin-payments-roster-api";
import { AdminPaymentInvoiceVoidModal } from "./AdminPaymentInvoiceVoidModal";
import { PaymentsReportTabs } from "./PaymentsReportTabs";

type Props = {
  invoiceId: string;
};

function formatMoney(cents: number, currency: string): string {
  return `${(cents / 100).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ${currency}`;
}

function formatAmount(cents: number): string {
  return (cents / 100).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function currencyLabel(code: string): string {
  try {
    const name = new Intl.DisplayNames(["en"], { type: "currency" }).of(code);
    return name ? `${code} (${name})` : code;
  } catch {
    return code;
  }
}

function Shimmer({ className }: { className?: string }) {
  return (
    <div
      className={[
        "relative overflow-hidden rounded-sm bg-[var(--admin-surface-high)]",
        "after:absolute after:inset-0 after:-translate-x-full after:animate-[shimmer_1.8s_infinite]",
        "after:bg-gradient-to-r after:from-transparent after:via-[color-mix(in_srgb,var(--admin-on-surface)_8%,transparent)] after:to-transparent",
        className ?? "",
      ].join(" ")}
    />
  );
}

function downloadHtmlFile(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function AdminPaymentsInvoicePreviewPage({ invoiceId }: Props) {
  const [detail, setDetail] = useState<PaymentInvoiceDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [voidOpen, setVoidOpen] = useState(false);
  const [zoom, setZoom] = useState(100);
  const [copiedLink, setCopiedLink] = useState(false);
  const paperRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchPaymentInvoiceDetail(invoiceId);
      setDetail(response.data);
    } catch (err) {
      setDetail(null);
      setError(
        err instanceof ClientApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Couldn't load invoice.",
      );
    } finally {
      setLoading(false);
    }
  }, [invoiceId]);

  useEffect(() => {
    void load();
  }, [load]);

  function handleDownloadHtml() {
    if (!detail?.canDownload) return;
    setBusy(true);
    try {
      downloadHtmlFile(detail.filename, detail.content);
    } finally {
      setBusy(false);
    }
  }

  function handleOpenNewTab() {
    if (!detail) return;
    const blob = new Blob([detail.content], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank", "noopener,noreferrer");
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }

  function handlePrint() {
    if (!paperRef.current) return;
    const printWindow = window.open("", "_blank", "noopener,noreferrer");
    if (!printWindow || !detail) return;
    printWindow.document.write(detail.content);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  }

  async function handleCopyLink() {
    const url = `${window.location.origin}/admin/reports/payments/invoices/${invoiceId}`;
    await navigator.clipboard.writeText(url);
    setCopiedLink(true);
    window.setTimeout(() => setCopiedLink(false), 1600);
  }

  const isVoid = detail?.status === "void";

  return (
    <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-6">
      <PaymentsReportTabs active="invoices" />

      <nav className="flex flex-wrap items-center gap-2 font-mono text-xs text-[var(--admin-on-surface-variant)]">
        <Link href="/admin" className="hover:text-[var(--admin-primary)]">
          Admin
        </Link>
        <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
        <Link href="/admin/reports/enrollments" className="hover:text-[var(--admin-primary)]">
          Reports
        </Link>
        <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
        <Link href="/admin/reports/payments" className="hover:text-[var(--admin-primary)]">
          Payments
        </Link>
        <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
        <Link href="/admin/reports/payments/invoices" className="hover:text-[var(--admin-primary)]">
          Invoices
        </Link>
        {detail ? (
          <>
            <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="text-[var(--admin-on-surface)]">{detail.invoiceNumber}</span>
          </>
        ) : null}
      </nav>

      {error ? (
        <div className="flex items-center justify-between gap-4 border border-[var(--admin-danger)] bg-[color-mix(in_srgb,var(--admin-danger)_12%,transparent)] p-4">
          <div className="flex items-center gap-3 text-[var(--admin-danger)]">
            <AlertTriangle className="h-5 w-5 shrink-0" aria-hidden="true" />
            <div>
              <p className="text-sm font-bold">Couldn&apos;t load invoice</p>
              <p className="font-mono text-xs opacity-80">{error}</p>
            </div>
          </div>
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded border border-[var(--admin-danger)] px-3 py-1.5 font-mono text-xs font-bold uppercase tracking-wide text-[var(--admin-danger)]"
            onClick={() => void load()}
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
            Retry
          </button>
        </div>
      ) : null}

      {loading ? (
        <div className="flex flex-col gap-6 lg:flex-row" aria-busy="true">
          <div className="flex min-h-[640px] flex-1 flex-col gap-4 border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4">
            <Shimmer className="h-10 w-full" />
            <Shimmer className="min-h-[520px] w-full flex-1" />
          </div>
          <div className="flex w-full flex-col gap-4 lg:w-[42%]">
            <Shimmer className="h-48 w-full" />
            <Shimmer className="h-56 w-full" />
            <Shimmer className="h-64 w-full" />
          </div>
        </div>
      ) : null}

      {!loading && detail ? (
        <div className="flex flex-col gap-6 lg:flex-row">
          <section className="flex min-h-[720px] flex-col lg:w-[58%]">
            <div className="mb-4 flex shrink-0 items-center justify-between border border-[var(--admin-border)] bg-[var(--admin-surface)] p-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="border border-transparent bg-[var(--admin-surface-variant)] p-1 text-[var(--admin-on-surface-variant)] hover:border-[var(--admin-border)] hover:text-[var(--admin-primary)] disabled:opacity-40"
                  disabled={zoom <= 75}
                  onClick={() => setZoom((value) => Math.max(75, value - 10))}
                  aria-label="Zoom out"
                >
                  <Minus className="h-4 w-4" aria-hidden="true" />
                </button>
                <span className="px-2 font-mono text-xs text-[var(--admin-on-surface)]">{zoom}%</span>
                <button
                  type="button"
                  className="border border-transparent bg-[var(--admin-surface-variant)] p-1 text-[var(--admin-on-surface-variant)] hover:border-[var(--admin-border)] hover:text-[var(--admin-primary)] disabled:opacity-40"
                  disabled={zoom >= 140}
                  onClick={() => setZoom((value) => Math.min(140, value + 10))}
                  aria-label="Zoom in"
                >
                  <Plus className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
              <div className="font-mono text-xs text-[var(--admin-on-surface-variant)]">Page 1 / 1</div>
              <button
                type="button"
                className="inline-flex items-center gap-2 border border-[var(--admin-border)] bg-[var(--admin-surface-variant)] px-3 py-1 font-mono text-xs text-[var(--admin-on-surface)] hover:border-[var(--admin-primary)] hover:text-[var(--admin-primary)]"
                onClick={handleOpenNewTab}
              >
                <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                Open in new tab
              </button>
            </div>

            <div className="flex flex-1 justify-center overflow-auto border border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-6">
              <div
                style={{ transform: `scale(${zoom / 100})`, transformOrigin: "top center" }}
                className="w-full max-w-[800px]"
              >
                <div
                  ref={paperRef}
                  className={[
                    "relative flex aspect-[1/1.414] w-full flex-col bg-[#FFFDF8] p-10 text-[14px] text-[#0A0A0A] shadow-lg sm:p-12",
                    isVoid ? "opacity-90" : "",
                  ].join(" ")}
                >
                  <div
                    className={[
                      "pointer-events-none absolute top-20 right-12 rotate-12 border-4 px-4 py-2 text-2xl font-bold tracking-widest uppercase opacity-80",
                      isVoid ? "border-[#93000a] text-[#93000a]" : "border-[#008000] text-[#008000]",
                    ].join(" ")}
                  >
                    {isVoid ? "VOID" : "PAID IN FULL"}
                  </div>

                  <div className="mb-10 flex items-start justify-between gap-6">
                    <div className="flex items-center gap-4">
                      <div className="flex h-14 w-14 items-center justify-center rounded bg-[#1A1A1A] text-white">
                        <span className="text-lg font-bold">
                          {(detail.businessName ?? "A").slice(0, 1).toUpperCase()}
                        </span>
                      </div>
                      <div className="text-xl font-bold tracking-tight">
                        {detail.businessName ?? "Academy"}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="mb-2 text-2xl font-bold tracking-tight uppercase sm:text-3xl">
                        Tax Invoice
                      </div>
                      <div className="font-mono text-base text-[#666666]">{detail.invoiceNumber}</div>
                      <div className="mt-1 text-sm text-[#666666]">
                        Issue Date: {formatDate(detail.issuedAt ?? detail.paidAt)}
                      </div>
                    </div>
                  </div>

                  <div className="mb-10 flex flex-col gap-8 sm:flex-row">
                    <div className="flex-1">
                      <div className="mb-2 text-xs font-bold tracking-wider text-[#666666] uppercase">
                        Billed From
                      </div>
                      <div className="text-base font-bold">
                        {detail.businessName ?? "Academy"}
                      </div>
                      <div className="mt-1 text-sm leading-relaxed text-[#444444]">
                        Configured issuer for this academy.
                      </div>
                    </div>
                    <div className="flex-1">
                      <div className="mb-2 text-xs font-bold tracking-wider text-[#666666] uppercase">
                        Billed To
                      </div>
                      <div className="text-base font-bold">
                        {detail.billingName ?? detail.learnerName ?? "Learner"}
                      </div>
                      <div className="mt-1 text-sm leading-relaxed text-[#444444]">
                        {detail.email ? (
                          <>
                            {detail.email}
                            <br />
                          </>
                        ) : null}
                        {detail.billingNameDiffers ? (
                          <span className="text-[#9a6700]">Billing name differs from learner</span>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  <div className="mb-10 flex-1">
                    <table className="w-full border-collapse text-left">
                      <thead>
                        <tr className="border-b-2 border-[#E5E5E5]">
                          <th className="py-3 text-xs font-bold tracking-wider text-[#666666] uppercase">
                            Product / Description
                          </th>
                          <th className="py-3 text-right text-xs font-bold tracking-wider text-[#666666] uppercase">
                            Qty
                          </th>
                          <th className="py-3 text-right text-xs font-bold tracking-wider text-[#666666] uppercase">
                            Price
                          </th>
                          <th className="py-3 text-right text-xs font-bold tracking-wider text-[#666666] uppercase">
                            Tax
                          </th>
                          <th className="py-3 text-right text-xs font-bold tracking-wider text-[#666666] uppercase">
                            Amount
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-b border-[#E5E5E5]">
                          <td className="py-4">
                            <div className="font-bold">{detail.productTitle ?? "Purchase"}</div>
                          </td>
                          <td className="py-4 text-right font-mono">1</td>
                          <td className="py-4 text-right font-mono">
                            {formatMoney(detail.subtotalCents, detail.currency)}
                          </td>
                          <td className="py-4 text-right font-mono">
                            {formatMoney(detail.taxAmountCents ?? 0, detail.currency)}
                          </td>
                          <td className="py-4 text-right font-mono">
                            {formatMoney(detail.amountCents, detail.currency)}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  <div className="mb-10 flex justify-end">
                    <div className="w-64">
                      <div className="flex justify-between border-b border-[#E5E5E5] py-2">
                        <span className="text-[#666666]">Subtotal</span>
                        <span className="font-mono">{formatAmount(detail.subtotalCents)}</span>
                      </div>
                      <div className="flex justify-between border-b border-[#E5E5E5] py-2">
                        <span className="text-[#666666]">Discount</span>
                        <span className="font-mono">{formatAmount(detail.discountCents)}</span>
                      </div>
                      <div className="flex justify-between border-b border-[#E5E5E5] py-2">
                        <span className="text-[#666666]">
                          Tax
                          {detail.taxPercent != null ? ` (${detail.taxPercent}%)` : ""}
                        </span>
                        <span className="font-mono">
                          {formatAmount(detail.taxAmountCents ?? 0)}
                        </span>
                      </div>
                      <div className="flex justify-between border-b-2 border-[#E5E5E5] py-3 text-lg font-bold">
                        <span>Total</span>
                        <span className="font-mono">
                          {formatMoney(detail.amountCents, detail.currency)}
                        </span>
                      </div>
                      {!isVoid ? (
                        <>
                          <div className="flex justify-between border-b border-[#E5E5E5] py-2 text-[#008000]">
                            <span>Amount Paid</span>
                            <span className="font-mono">
                              -{formatAmount(detail.amountPaidCents)}
                            </span>
                          </div>
                          <div className="flex justify-between py-3 text-base font-bold">
                            <span>Balance Due</span>
                            <span className="font-mono">
                              {formatMoney(detail.balanceDueCents, detail.currency)}
                            </span>
                          </div>
                        </>
                      ) : (
                        <div className="flex justify-between py-3 text-base font-bold text-[#93000a]">
                          <span>Status</span>
                          <span className="font-mono">VOID</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="mt-auto flex justify-between border-t-2 border-[#E5E5E5] pt-4 text-xs text-[#666666]">
                    <div>Order {detail.displayId}</div>
                    <div>Thank you for your business.</div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="flex flex-col gap-6 lg:w-[42%]">
            <div className="flex flex-col gap-4 border border-[var(--admin-border)] bg-[var(--admin-surface)] p-6">
              <h2 className="mb-1 text-xl font-semibold text-[var(--admin-on-surface)]">
                Invoice Actions
              </h2>

              <button
                type="button"
                className="inline-flex w-full items-center justify-center gap-2 border border-[var(--admin-primary)] bg-[var(--admin-primary)] py-3 px-4 font-mono text-xs font-bold uppercase tracking-wide text-[var(--admin-on-primary)] transition-colors hover:bg-transparent hover:text-[var(--admin-primary)] disabled:opacity-50"
                disabled={busy || !detail.canDownload}
                onClick={handlePrint}
                title="Opens a print dialog — choose Save as PDF in the browser"
              >
                <Printer className="h-4 w-4" aria-hidden="true" />
                Print / Save PDF
              </button>

              <div className="grid grid-cols-2 gap-4">
                <button
                  type="button"
                  className="inline-flex items-center justify-center gap-2 border border-[var(--admin-border)] bg-[var(--admin-surface-variant)] py-2 px-3 font-mono text-xs text-[var(--admin-on-surface)] hover:border-[var(--admin-primary)] hover:text-[var(--admin-primary)] disabled:opacity-50"
                  disabled={busy || !detail.canDownload}
                  onClick={handleDownloadHtml}
                >
                  <FileCode2 className="h-4 w-4" aria-hidden="true" />
                  Download HTML
                </button>
                <button
                  type="button"
                  className="inline-flex items-center justify-center gap-2 border border-[var(--admin-border)] bg-[var(--admin-surface-variant)] py-2 px-3 font-mono text-xs text-[var(--admin-danger)] hover:border-[var(--admin-danger)] disabled:opacity-50"
                  disabled={!detail.canVoid || busy}
                  onClick={() => setVoidOpen(true)}
                  title={
                    detail.canVoid
                      ? "Void this invoice"
                      : "Invoice is already voided"
                  }
                >
                  <Ban className="h-4 w-4" aria-hidden="true" />
                  Void Invoice
                </button>
              </div>

              <div className="mt-2 flex flex-col gap-4 border-t border-[var(--admin-border)] pt-4">
                <div>
                  <button
                    type="button"
                    className="inline-flex w-full cursor-not-allowed items-center justify-center gap-2 border border-[var(--admin-border)] bg-transparent py-2 px-4 font-mono text-xs text-[var(--admin-on-surface-variant)] opacity-60"
                    disabled
                    title="Learner invoice email is not configured yet"
                  >
                    <Send className="h-4 w-4" aria-hidden="true" />
                    Resend to learner
                  </button>
                  <p className="mt-1 text-center font-mono text-[10px] text-[var(--admin-on-surface-variant)]">
                    Email delivery is not configured for invoices yet.
                  </p>
                </div>
                <div>
                  <button
                    type="button"
                    className="inline-flex w-full items-center justify-center gap-2 border border-[var(--admin-border)] bg-transparent py-2 px-4 font-mono text-xs text-[var(--admin-on-surface)] hover:border-[var(--admin-primary)] hover:text-[var(--admin-primary)]"
                    onClick={() => void handleCopyLink()}
                  >
                    {copiedLink ? (
                      <Copy className="h-4 w-4 text-[var(--admin-success)]" aria-hidden="true" />
                    ) : (
                      <Link2 className="h-4 w-4" aria-hidden="true" />
                    )}
                    {copiedLink ? "Link copied" : "Copy admin link"}
                  </button>
                  <div className="mt-2 truncate border border-[var(--admin-border)] bg-[var(--admin-surface-variant)] p-2 font-mono text-[10px] text-[var(--admin-on-surface-variant)]">
                    /admin/reports/payments/invoices/{detail.orderId.slice(0, 8)}…
                  </div>
                </div>
              </div>
            </div>

            <div className="border border-[var(--admin-border)] bg-[var(--admin-surface)] p-6">
              <h2 className="mb-4 border-b border-[var(--admin-border)] pb-2 text-xl font-semibold text-[var(--admin-on-surface)]">
                Invoice Details
              </h2>
              <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                <div className="flex flex-col">
                  <span className="mb-1 font-mono text-[11px] font-bold uppercase tracking-wide text-[var(--admin-on-surface-variant)]">
                    Status
                  </span>
                  {isVoid ? (
                    <span className="inline-flex w-max items-center gap-1 rounded-sm border border-[color-mix(in_srgb,var(--admin-danger)_35%,transparent)] bg-[color-mix(in_srgb,var(--admin-danger)_12%,transparent)] px-2 py-1 font-mono text-xs text-[var(--admin-danger)]">
                      <Ban className="h-3.5 w-3.5" aria-hidden="true" />
                      Void
                    </span>
                  ) : (
                    <span className="inline-flex w-max items-center gap-1 rounded-sm border border-[color-mix(in_srgb,var(--admin-success)_35%,transparent)] bg-[color-mix(in_srgb,var(--admin-success)_12%,transparent)] px-2 py-1 font-mono text-xs text-[var(--admin-success)]">
                      <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                      Paid
                    </span>
                  )}
                </div>
                <div className="flex flex-col">
                  <span className="mb-1 font-mono text-[11px] font-bold uppercase tracking-wide text-[var(--admin-on-surface-variant)]">
                    Order ID
                  </span>
                  <Link
                    href={`/admin/reports/payments/transactions/${detail.orderId}`}
                    className="font-mono text-xs text-[var(--admin-primary)] underline-offset-4 hover:underline"
                  >
                    {detail.displayId}
                  </Link>
                </div>
                <div className="flex flex-col">
                  <span className="mb-1 font-mono text-[11px] font-bold uppercase tracking-wide text-[var(--admin-on-surface-variant)]">
                    Gateway
                  </span>
                  <span className="inline-flex w-max items-center rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface-variant)] px-2 py-1 font-mono text-[10px] uppercase text-[var(--admin-on-surface)]">
                    {detail.gatewayKey ?? "—"}
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="mb-1 font-mono text-[11px] font-bold uppercase tracking-wide text-[var(--admin-on-surface-variant)]">
                    Currency
                  </span>
                  <span className="font-mono text-xs text-[var(--admin-on-surface)]">
                    {currencyLabel(detail.currency)}
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="mb-1 font-mono text-[11px] font-bold uppercase tracking-wide text-[var(--admin-on-surface-variant)]">
                    Tax
                  </span>
                  <span className="font-mono text-xs text-[var(--admin-on-surface)]">
                    {detail.taxPercent != null
                      ? `${detail.taxPercent}% · ${formatMoney(detail.taxAmountCents ?? 0, detail.currency)}`
                      : formatMoney(detail.taxAmountCents ?? 0, detail.currency)}
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="mb-1 font-mono text-[11px] font-bold uppercase tracking-wide text-[var(--admin-on-surface-variant)]">
                    Order status
                  </span>
                  <span className="font-mono text-xs text-[var(--admin-on-surface)]">
                    {detail.orderStatus}
                  </span>
                </div>
                <div className="col-span-2 mt-2 border-t border-[var(--admin-border)] pt-4">
                  <div className="flex justify-between gap-4">
                    <div className="flex flex-col">
                      <span className="mb-1 font-mono text-[11px] font-bold uppercase tracking-wide text-[var(--admin-on-surface-variant)]">
                        Issued By
                      </span>
                      <span className="font-mono text-xs text-[var(--admin-on-surface)]">
                        System (Auto-generated)
                      </span>
                    </div>
                    <div className="flex flex-col text-right">
                      <span className="mb-1 font-mono text-[11px] font-bold uppercase tracking-wide text-[var(--admin-on-surface-variant)]">
                        Issued At
                      </span>
                      <span className="font-mono text-xs text-[var(--admin-on-surface)]">
                        {formatDateTime(detail.issuedAt)}
                      </span>
                    </div>
                  </div>
                  {detail.membershipId ? (
                    <Link
                      href={`/admin/members/${detail.membershipId}`}
                      className="mt-3 inline-block font-mono text-xs text-[var(--admin-primary)] hover:underline"
                    >
                      View learner profile
                    </Link>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="min-h-[220px] flex-1 border border-[var(--admin-border)] bg-[var(--admin-surface)] p-6">
              <h2 className="mb-6 border-b border-[var(--admin-border)] pb-2 text-xl font-semibold text-[var(--admin-on-surface)]">
                Invoice History
              </h2>
              <div className="relative ml-2 flex flex-col gap-6 border-l border-[var(--admin-border)] pl-6">
                {[...detail.timeline].reverse().map((event) => (
                  <div key={event.key} className="relative">
                    <div
                      className={[
                        "absolute -left-[31px] top-1 h-3 w-3 border",
                        event.highlight
                          ? "border-[var(--admin-primary)] bg-[var(--admin-primary)] outline outline-1 outline-[var(--admin-primary)]"
                          : "border-[var(--admin-border)] bg-[var(--admin-surface-variant)]",
                      ].join(" ")}
                    />
                    <div
                      className={[
                        "font-mono text-xs",
                        event.highlight
                          ? "text-[var(--admin-on-surface)]"
                          : "text-[var(--admin-on-surface-variant)]",
                      ].join(" ")}
                    >
                      {event.label}
                    </div>
                    <div className="mt-1 font-mono text-[10px] text-[var(--admin-on-surface-variant)]">
                      {formatDateTime(event.occurredAt)}
                      {event.description ? ` · ${event.description}` : ""}
                    </div>
                  </div>
                ))}
              </div>
              <p className="mt-6 font-mono text-[10px] text-[var(--admin-on-surface-variant)]">
                Email open/view events are not tracked yet — only ledger events are shown.
              </p>
            </div>

            <Link
              href="/admin/reports/payments/invoices"
              className="inline-flex items-center gap-2 font-mono text-xs text-[var(--admin-on-surface-variant)] hover:text-[var(--admin-primary)]"
            >
              <Download className="h-3.5 w-3.5" aria-hidden="true" />
              Back to invoices ledger
            </Link>
          </section>
        </div>
      ) : null}

      {detail ? (
        <AdminPaymentInvoiceVoidModal
          open={voidOpen}
          detail={detail}
          onClose={() => setVoidOpen(false)}
          onVoided={() => void load()}
        />
      ) : null}
    </div>
  );
}
