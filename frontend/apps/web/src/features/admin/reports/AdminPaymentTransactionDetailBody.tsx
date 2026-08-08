"use client";

import Link from "next/link";
import {
  ArrowRight,
  ChevronDown,
  Copy,
  CreditCard,
  Download,
  ExternalLink,
  History,
  Mail,
  Package,
  Receipt,
  RefreshCw,
  ShieldCheck,
  Undo2,
  User,
} from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import type { PaymentTransactionDetail } from "./admin-payments-roster-api";
import {
  formatAbsolute,
  formatClock,
  formatDayClock,
  formatMoney,
  statusBadge,
} from "./payment-transaction-ui";

type Variant = "page" | "drawer";

type Props = {
  detail: PaymentTransactionDetail;
  variant?: Variant;
  busy?: boolean;
  onCopyId?: () => void;
  onDownloadInvoice?: () => void;
  onRefund?: () => void;
  onOpenFull?: () => void;
};

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className="mb-0.5 font-mono text-[10px] uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
        {label}
      </p>
      <div className="text-sm text-[var(--admin-on-surface)]">{children}</div>
    </div>
  );
}

export function AdminPaymentTransactionDetailBody({
  detail,
  variant = "page",
  busy,
  onCopyId,
  onDownloadInvoice,
  onRefund,
  onOpenFull,
}: Props) {
  const [metaOpen, setMetaOpen] = useState(false);
  const badge = statusBadge(detail.status);
  const isDrawer = variant === "drawer";

  const metaJson = useMemo(
    () => (detail.metadata ? JSON.stringify(detail.metadata, null, 2) : null),
    [detail.metadata],
  );

  return (
    <div className={isDrawer ? "flex flex-col gap-6" : "space-y-6"}>
      {!isDrawer ? (
        <div className="flex flex-col justify-between gap-6 border-b border-[var(--admin-border)] pb-6 lg:flex-row lg:items-end">
          <div>
            <div className="mb-2 flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight text-[var(--admin-on-surface)] sm:text-3xl">
                Order {detail.displayId}
              </h1>
              <button
                type="button"
                title="Copy order ID"
                className="text-[var(--admin-on-surface-variant)] hover:text-[var(--admin-primary)]"
                onClick={onCopyId}
              >
                <Copy className="h-5 w-5" />
              </button>
              <span
                className={`border px-2 py-0.5 font-mono text-[11px] font-bold uppercase tracking-wider ${badge.className}`}
              >
                {badge.label}
              </span>
            </div>
            <p className="flex flex-wrap items-center gap-2 font-mono text-xs text-[var(--admin-on-surface-variant)]">
              <span className="border border-[var(--admin-border)] bg-[var(--admin-surface-variant)] px-1.5 py-0.5 text-[var(--admin-on-surface)]">
                {(detail.gatewayKey ?? "manual").toUpperCase()}
              </span>
              {detail.externalId ? (
                <>
                  <span>·</span>
                  <span className="text-[var(--admin-on-surface)]">{detail.externalId}</span>
                </>
              ) : null}
              <span>·</span>
              <span>{formatAbsolute(detail.paidAt ?? detail.createdAt)}</span>
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={busy || !detail.canDownloadInvoice}
              className="inline-flex items-center gap-2 border border-[var(--admin-border)] bg-[var(--admin-surface)] px-4 py-2 font-mono text-[11px] font-bold uppercase tracking-wider text-[var(--admin-on-surface)] hover:border-[var(--admin-primary)] hover:text-[var(--admin-primary)] disabled:opacity-40"
              onClick={onDownloadInvoice}
            >
              <Download className="h-4 w-4" />
              Download invoice
            </button>
            <button
              type="button"
              disabled
              title="Receipt email is not configured yet"
              className="inline-flex items-center gap-2 border border-[var(--admin-border)] bg-[var(--admin-surface)] px-4 py-2 font-mono text-[11px] font-bold uppercase tracking-wider text-[var(--admin-on-surface)] opacity-40"
            >
              <Mail className="h-4 w-4" />
              Resend receipt
            </button>
            <button
              type="button"
              disabled={busy || !detail.canRefund}
              className="inline-flex items-center gap-2 border border-[var(--admin-danger)] bg-transparent px-4 py-2 font-mono text-[11px] font-bold uppercase tracking-wider text-[var(--admin-danger)] hover:bg-[color-mix(in_srgb,var(--admin-danger)_12%,transparent)] disabled:opacity-40"
              onClick={onRefund}
            >
              <Undo2 className="h-4 w-4" />
              Refund
            </button>
          </div>
        </div>
      ) : null}

      {isDrawer ? (
        <section className="relative overflow-hidden border border-[var(--admin-border)] bg-[var(--admin-surface)] p-6">
          <div
            className="pointer-events-none absolute inset-0 opacity-40"
            style={{
              backgroundImage:
                "linear-gradient(color-mix(in srgb, var(--admin-border) 40%, transparent) 1px, transparent 1px), linear-gradient(90deg, color-mix(in srgb, var(--admin-border) 40%, transparent) 1px, transparent 1px)",
              backgroundSize: "16px 16px",
            }}
          />
          <div className="relative z-10 flex items-start justify-between gap-4">
            <div>
              <span className="mb-1 block font-mono text-[11px] font-bold uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
                Total gross
              </span>
              <div className="text-3xl font-extrabold tracking-tight text-[var(--admin-primary)] sm:text-4xl">
                {formatMoney(detail.amountCents, detail.currency).replace(
                  ` ${detail.currency.toUpperCase()}`,
                  "",
                )}{" "}
                <span className="text-lg font-normal text-[var(--admin-on-surface-variant)]">
                  {detail.currency.toUpperCase()}
                </span>
              </div>
            </div>
            <div className="text-right">
              <span className="mb-1 block font-mono text-[11px] font-bold uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
                Captured on
              </span>
              <div className="border border-[var(--admin-border)] bg-[var(--admin-surface-high)] px-2 py-1 font-mono text-xs text-[var(--admin-on-surface)]">
                {formatAbsolute(detail.paidAt ?? detail.createdAt)}
              </div>
            </div>
          </div>
          <div className="relative z-10 my-4 h-px w-full bg-[var(--admin-border)]" />
          <div className="relative z-10 grid grid-cols-3 gap-2 border border-[var(--admin-border)] bg-[var(--admin-bg)] p-4 font-mono text-xs">
            <div>
              <span className="text-[var(--admin-on-surface-variant)] uppercase tracking-wider">
                Net
              </span>
              <div className="mt-1 font-bold text-[var(--admin-on-surface)]">
                {detail.netSettledCents != null
                  ? formatMoney(detail.netSettledCents, detail.currency)
                  : formatMoney(detail.amountCents, detail.currency)}
              </div>
            </div>
            <div className="text-center">
              <span className="text-[var(--admin-on-surface-variant)] uppercase tracking-wider">
                Tax
              </span>
              <div className="mt-1 font-bold text-[var(--admin-on-surface)]">
                {detail.taxAmountCents != null
                  ? formatMoney(detail.taxAmountCents, detail.currency)
                  : "—"}
              </div>
            </div>
            <div className="text-right">
              <span className="text-[var(--admin-warning)] uppercase tracking-wider">
                Gateway fee
              </span>
              <div className="mt-1 font-bold text-[var(--admin-warning)]">
                {detail.gatewayFeeCents != null
                  ? `-${formatMoney(detail.gatewayFeeCents, detail.currency)}`
                  : "—"}
              </div>
            </div>
          </div>
        </section>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="border border-[var(--admin-border)] bg-[var(--admin-bg)] p-6 lg:col-span-8">
            <div className="flex flex-col gap-8 md:flex-row">
              <div className="flex-1 border-[var(--admin-border)] md:border-r md:border-dashed md:pr-8">
                <h3 className="mb-6 font-mono text-[11px] font-bold uppercase tracking-widest text-[var(--admin-on-surface-variant)]">
                  Amount settled
                </h3>
                <div className="mb-8 text-4xl font-extrabold tracking-tighter text-[var(--admin-on-surface)] sm:text-5xl">
                  {formatMoney(detail.amountCents, detail.currency).replace(
                    ` ${detail.currency.toUpperCase()}`,
                    "",
                  )}{" "}
                  <span className="text-xl font-semibold text-[var(--admin-on-surface-variant)]">
                    {detail.currency.toUpperCase()}
                  </span>
                </div>
                <div className="w-full space-y-3 font-mono text-xs">
                  <div className="flex justify-between border-b border-[color-mix(in_srgb,var(--admin-border)_50%,transparent)] pb-1 text-[var(--admin-on-surface-variant)]">
                    <span>Subtotal</span>
                    <span className="text-[var(--admin-on-surface)]">
                      {formatMoney(detail.subtotalCents, detail.currency)}
                    </span>
                  </div>
                  {detail.couponAmountCents != null && detail.couponAmountCents > 0 ? (
                    <div className="flex justify-between border-b border-[color-mix(in_srgb,var(--admin-danger)_20%,transparent)] pb-1 text-[var(--admin-danger)]">
                      <span className="flex items-center gap-2">
                        Coupon
                        {detail.couponCode ? (
                          <span className="border border-[color-mix(in_srgb,var(--admin-danger)_40%,transparent)] bg-[color-mix(in_srgb,var(--admin-danger)_10%,transparent)] px-1 text-[10px]">
                            {detail.couponCode}
                          </span>
                        ) : null}
                      </span>
                      <span>-{formatMoney(detail.couponAmountCents, detail.currency)}</span>
                    </div>
                  ) : null}
                  {detail.taxAmountCents != null ? (
                    <div className="flex justify-between border-b border-[color-mix(in_srgb,var(--admin-border)_50%,transparent)] pb-1 text-[var(--admin-on-surface-variant)]">
                      <span>Tax</span>
                      <span className="text-[var(--admin-on-surface)]">
                        {formatMoney(detail.taxAmountCents, detail.currency)}
                      </span>
                    </div>
                  ) : null}
                  {detail.gatewayFeeCents != null ? (
                    <div className="flex justify-between border-b border-[color-mix(in_srgb,var(--admin-border)_50%,transparent)] pb-1 text-[var(--admin-on-surface-variant)]">
                      <span>Gateway fee</span>
                      <span className="text-[var(--admin-on-surface)]">
                        -{formatMoney(detail.gatewayFeeCents, detail.currency)}
                      </span>
                    </div>
                  ) : null}
                  {detail.netSettledCents != null ? (
                    <div className="flex justify-between pt-2 text-sm font-bold text-[var(--admin-primary)]">
                      <span>Net settled</span>
                      <span>{formatMoney(detail.netSettledCents, detail.currency)}</span>
                    </div>
                  ) : null}
                  {detail.refundedAmountCents > 0 ? (
                    <div className="flex justify-between pt-1 text-[var(--admin-warning)]">
                      <span>Refunded to date</span>
                      <span>{formatMoney(detail.refundedAmountCents, detail.currency)}</span>
                    </div>
                  ) : null}
                </div>
              </div>
              <div className="flex w-full flex-col justify-center md:w-[200px]">
                <h3 className="mb-6 font-mono text-[11px] font-bold uppercase tracking-widest text-[var(--admin-on-surface-variant)]">
                  Flow status
                </h3>
                <div className="relative space-y-6 border-l border-[var(--admin-border)] pl-6">
                  {detail.flow.map((step) => {
                    const active = step.status === "complete" || step.status === "current";
                    return (
                      <div key={step.key} className="relative">
                        <div
                          className={[
                            "absolute -left-[29px] top-1 h-2 w-2",
                            active
                              ? "bg-[var(--admin-primary)]"
                              : "border border-[var(--admin-border)] bg-[var(--admin-surface-variant)]",
                          ].join(" ")}
                        />
                        {step.status === "current" ? (
                          <div className="absolute -left-[35px] top-0 -z-10 h-5 w-5 animate-pulse border border-[color-mix(in_srgb,var(--admin-primary)_30%,transparent)] bg-[color-mix(in_srgb,var(--admin-primary)_10%,transparent)]" />
                        ) : null}
                        <p
                          className={[
                            "font-mono text-xs",
                            step.status === "current"
                              ? "font-bold text-[var(--admin-primary)]"
                              : "text-[var(--admin-on-surface)]",
                            step.status === "pending" || step.status === "skipped"
                              ? "opacity-50"
                              : "",
                          ].join(" ")}
                        >
                          {step.label}
                        </p>
                        <p
                          className={[
                            "font-mono text-[10px]",
                            step.status === "current"
                              ? "text-[var(--admin-primary)]"
                              : "text-[var(--admin-on-surface-variant)]",
                          ].join(" ")}
                        >
                          {step.occurredAt ? formatClock(step.occurredAt) : "—"}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          <div className="relative flex flex-col justify-between overflow-hidden border border-[color-mix(in_srgb,var(--admin-primary)_30%,transparent)] bg-[var(--admin-surface)] p-6 lg:col-span-4">
            <div className="pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full bg-[color-mix(in_srgb,var(--admin-primary)_8%,transparent)] blur-2xl" />
            <div>
              <div className="mb-4 flex items-center gap-2 text-[var(--admin-primary)]">
                <ShieldCheck className="h-5 w-5" />
                <h3 className="font-mono text-[11px] font-bold uppercase tracking-widest">
                  Risk evaluation
                </h3>
              </div>
              {detail.risk ? (
                <>
                  <p className="mb-4 text-sm text-[var(--admin-on-surface-variant)]">
                    {detail.risk.summary ??
                      "Risk metadata was recorded with this payment order."}
                  </p>
                  <div className="inline-flex items-center gap-2 border border-[var(--admin-border)] bg-[var(--admin-bg)] px-3 py-1 font-mono text-xs text-[var(--admin-primary)]">
                    <span>Score:</span>
                    <span className="font-bold text-[var(--admin-on-surface)]">
                      {detail.risk.label}
                      {detail.risk.score != null ? ` (${detail.risk.score})` : ""}
                    </span>
                  </div>
                </>
              ) : (
                <p className="text-sm text-[var(--admin-on-surface-variant)]">
                  No gateway risk score was stored on this order. Add risk fields to payment
                  metadata to surface them here.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {isDrawer ? (
        <section className="border border-[var(--admin-border)] bg-[var(--admin-surface)] px-6 py-4">
          <div className="relative flex items-center justify-between">
            <div className="absolute left-4 right-4 top-1/2 z-0 h-0.5 -translate-y-1/2 bg-[var(--admin-border)]" />
            <div
              className="absolute left-4 top-1/2 z-0 h-0.5 -translate-y-1/2 bg-[var(--admin-primary)]"
              style={{
                width: `${Math.max(
                  8,
                  (detail.flow.filter((s) => s.status === "complete" || s.status === "current")
                    .length /
                    Math.max(1, detail.flow.length)) *
                    100,
                )}%`,
              }}
            />
            {detail.flow.map((step) => {
              const done = step.status === "complete" || step.status === "current";
              return (
                <div
                  key={step.key}
                  className={`z-10 flex flex-col items-center gap-2 bg-[var(--admin-surface)] px-2 ${
                    step.status === "pending" || step.status === "skipped" ? "opacity-50" : ""
                  }`}
                >
                  <div
                    className={[
                      "h-4 w-4 rounded-full border-2 border-[var(--admin-surface)]",
                      done ? "bg-[var(--admin-primary)]" : "bg-[var(--admin-surface-high)]",
                    ].join(" ")}
                  />
                  <span
                    className={[
                      "font-mono text-[10px] font-bold uppercase tracking-wider",
                      done ? "text-[var(--admin-primary)]" : "text-[var(--admin-on-surface-variant)]",
                    ].join(" ")}
                  >
                    {step.label}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      <div
        className={
          isDrawer
            ? "grid grid-cols-1 gap-4 sm:grid-cols-2"
            : "grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4"
        }
      >
        <DetailCard
          icon={<User className="h-4 w-4" />}
          title={isDrawer ? "Learner info" : "Learner"}
        >
          <Field label="Name">
            <span className="font-semibold">{detail.learner.name ?? "—"}</span>
          </Field>
          <Field label="Email">
            <span className="font-mono text-xs">{detail.learner.email ?? "—"}</span>
          </Field>
          <Field label="Membership ID">
            <span className="font-mono text-xs">
              {detail.learner.membershipId ?? "—"}
            </span>
          </Field>
          {detail.learner.membershipId ? (
            <Link
              href={`/admin/members/${detail.learner.membershipId}`}
              className="mt-auto inline-flex items-center gap-1 pt-2 font-mono text-[10px] font-bold uppercase tracking-wider text-[var(--admin-primary)] hover:underline"
            >
              View profile <ExternalLink className="h-3 w-3" />
            </Link>
          ) : null}
        </DetailCard>

        <DetailCard
          icon={<Package className="h-4 w-4" />}
          title={isDrawer ? "Product detail" : "Product"}
        >
          {detail.product.type ? (
            <span className="mb-1 inline-block border border-[var(--admin-border)] bg-[var(--admin-surface-variant)] px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-[var(--admin-on-surface)]">
              {detail.product.type}
            </span>
          ) : null}
          <p className="font-semibold leading-tight text-[var(--admin-on-surface)]">
            {detail.product.title ?? "—"}
          </p>
          <Field label="SKU">{detail.product.sku ?? "—"}</Field>
          <Field label="Access status">
            <span className="text-[var(--admin-primary)]">
              {detail.product.accessStatus ?? "—"}
            </span>
          </Field>
        </DetailCard>

        <DetailCard
          icon={<Receipt className="h-4 w-4" />}
          title={isDrawer ? "Billing method" : "Billing"}
        >
          {isDrawer && (detail.gateway.brand || detail.gateway.last4) ? (
            <div className="mb-2 flex items-center gap-3 border border-[var(--admin-border)] bg-[var(--admin-surface-high)] p-2">
              <div className="flex h-6 w-8 items-center justify-center border border-[var(--admin-border)] bg-[var(--admin-surface-variant)]">
                <span className="text-[10px] font-bold">
                  {(detail.gateway.brand ?? "CARD").slice(0, 4).toUpperCase()}
                </span>
              </div>
              <div>
                <div className="font-bold">
                  {detail.gateway.last4 ? `•••• ${detail.gateway.last4}` : detail.gateway.methodLabel}
                </div>
              </div>
            </div>
          ) : null}
          <Field label="Address">
            {detail.billing.addressLines.length > 0 ? (
              <span className="leading-snug">
                {detail.billing.addressLines.map((line) => (
                  <span key={line} className="block">
                    {line}
                  </span>
                ))}
              </span>
            ) : (
              detail.billing.name ?? "—"
            )}
          </Field>
          <Field label="GSTIN / Tax ID">{detail.billing.taxId ?? "—"}</Field>
        </DetailCard>

        <DetailCard
          icon={<CreditCard className="h-4 w-4" />}
          title={isDrawer ? "Gateway data" : "Gateway"}
        >
          <Field label="Provider">
            <span className="inline-block border border-[var(--admin-border)] bg-[var(--admin-bg)] px-2 py-1 font-semibold tracking-wider">
              {(detail.gateway.provider ?? "manual").toUpperCase()}
            </span>
          </Field>
          {!isDrawer ? (
            <Field label="Method">
              <span className="inline-flex items-center gap-2 font-mono text-xs">
                <CreditCard className="h-4 w-4" />
                {detail.gateway.methodLabel ?? "—"}
              </span>
            </Field>
          ) : null}
          <Field label="Network ref">
            <span className="block truncate font-mono text-xs" title={detail.gateway.networkRef ?? ""}>
              {detail.gateway.networkRef ?? "—"}
            </span>
          </Field>
          {isDrawer && detail.risk ? (
            <Field label="Risk">
              <span className="inline-block border border-[color-mix(in_srgb,var(--admin-primary)_20%,transparent)] bg-[color-mix(in_srgb,var(--admin-primary)_10%,transparent)] px-2 py-0.5 text-[11px] text-[var(--admin-primary)]">
                {detail.risk.label}
                {detail.risk.score != null ? ` (Score: ${detail.risk.score})` : ""}
              </span>
            </Field>
          ) : null}
        </DetailCard>
      </div>

      <div className={isDrawer ? "flex flex-col" : "grid grid-cols-1 gap-6 lg:grid-cols-2"}>
        <section className="border border-[var(--admin-border)] bg-[var(--admin-surface)]">
          <div
            className={
              isDrawer
                ? "flex items-center justify-between border-b border-[var(--admin-border)] bg-[color-mix(in_srgb,var(--admin-surface-high)_50%,transparent)] p-4"
                : "mb-6 flex items-center gap-2 p-6 pb-0 font-mono text-[11px] font-bold uppercase tracking-widest text-[var(--admin-on-surface-variant)]"
            }
          >
            <h3 className="flex items-center gap-2 font-mono text-[11px] font-bold uppercase tracking-widest text-[var(--admin-on-surface-variant)]">
              <History className="h-4 w-4" /> Event {isDrawer ? "log" : "history"}
            </h3>
            {isDrawer && metaJson ? (
              <button
                type="button"
                className="inline-flex items-center gap-1 font-mono text-xs text-[var(--admin-primary)] hover:underline"
                onClick={() => setMetaOpen((v) => !v)}
              >
                View raw JSON <ChevronDown className={`h-3.5 w-3.5 ${metaOpen ? "rotate-180" : ""}`} />
              </button>
            ) : null}
          </div>
          <div className={isDrawer ? "p-6 pl-8" : "p-6 pt-6"}>
            <div className="relative space-y-6 border-l border-[var(--admin-border)] pl-6">
              {detail.events.map((event) => {
                const stamp = formatDayClock(event.occurredAt);
                return (
                  <div key={event.id} className="relative">
                    <div
                      className={[
                        "absolute -left-[29px] top-1 h-2 w-2",
                        event.highlight
                          ? "bg-[var(--admin-primary)]"
                          : "border border-[var(--admin-border)] bg-[var(--admin-surface-variant)]",
                      ].join(" ")}
                    />
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p
                          className={[
                            "text-sm font-medium",
                            event.highlight
                              ? "text-[var(--admin-primary)]"
                              : "text-[var(--admin-on-surface)]",
                          ].join(" ")}
                        >
                          {event.label}
                        </p>
                        <p className="mt-0.5 font-mono text-xs text-[var(--admin-on-surface-variant)]">
                          {event.description}
                        </p>
                      </div>
                      <p className="shrink-0 text-right font-mono text-[10px] text-[var(--admin-on-surface-variant)]">
                        {stamp.day}
                        <br />
                        {stamp.time}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          {isDrawer && metaOpen && metaJson ? (
            <pre className="max-h-64 overflow-auto border-t border-[var(--admin-border)] bg-[var(--admin-bg)] p-4 font-mono text-[11px] leading-relaxed text-[var(--admin-on-surface-variant)]">
              {metaJson}
            </pre>
          ) : null}
        </section>

        {!isDrawer ? (
          <section className="flex flex-col border border-[var(--admin-border)] bg-[var(--admin-bg)] p-4 transition-colors hover:border-[var(--admin-outline)]">
            <button
              type="button"
              className="mb-4 flex cursor-pointer items-center justify-between border-b border-[color-mix(in_srgb,var(--admin-border)_50%,transparent)] pb-2"
              onClick={() => setMetaOpen((v) => !v)}
            >
              <h3 className="flex items-center gap-2 font-mono text-[11px] font-bold uppercase tracking-widest text-[var(--admin-on-surface-variant)]">
                <RefreshCw className="h-4 w-4" /> Order metadata
              </h3>
              <ChevronDown
                className={`h-4 w-4 text-[var(--admin-on-surface-variant)] transition-transform ${
                  metaOpen ? "rotate-180" : ""
                }`}
              />
            </button>
            {metaOpen && metaJson ? (
              <pre className="flex-1 overflow-auto font-mono text-[11px] leading-relaxed text-[var(--admin-on-surface-variant)]">
                {metaJson}
              </pre>
            ) : (
              <button
                type="button"
                className="py-4 text-center font-mono text-xs text-[var(--admin-on-surface-variant)] transition-colors hover:text-[var(--admin-primary)]"
                onClick={() => setMetaOpen(true)}
              >
                {metaJson ? "Click to view raw payload" : "No metadata stored on this order"}
              </button>
            )}
          </section>
        ) : null}
      </div>

      {isDrawer && onOpenFull ? (
        <button
          type="button"
          className="inline-flex items-center justify-between border-t border-[var(--admin-border)] pt-4 font-mono text-[11px] font-bold uppercase tracking-wider text-[var(--admin-on-surface-variant)] hover:text-[var(--admin-primary)]"
          onClick={onOpenFull}
        >
          Open full transaction page <ArrowRight className="h-4 w-4" />
        </button>
      ) : null}
    </div>
  );
}

function DetailCard({
  icon,
  title,
  children,
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4 transition-colors hover:border-[var(--admin-outline)]">
      <h3 className="mb-4 flex items-center gap-2 border-b border-[color-mix(in_srgb,var(--admin-border)_50%,transparent)] pb-2 font-mono text-[11px] font-bold uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
        <span className="text-[var(--admin-primary)]">{icon}</span> {title}
      </h3>
      <div className="flex flex-1 flex-col gap-3">{children}</div>
    </div>
  );
}
