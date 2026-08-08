"use client";

import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Ban,
  Bell,
  CalendarDays,
  Check,
  ChevronRight,
  Copy,
  History,
  Loader2,
  Pencil,
  RefreshCw,
  User,
  Wallet,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ClientApiError } from "../../../lib/client-api";
import {
  fetchPaymentInstalmentDetail,
  type PaymentInstalmentPlanDetail,
  type PaymentInstalmentScheduleItem,
} from "./admin-payments-roster-api";
import { AdminPaymentInstalmentCancelModal } from "./AdminPaymentInstalmentCancelModal";
import { AdminPaymentInstalmentRecordModal } from "./AdminPaymentInstalmentRecordModal";
import { PaymentsReportTabs } from "./PaymentsReportTabs";

type Props = {
  planId: string;
};

function formatMoney(cents: number, currency: string): string {
  return `${(cents / 100).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ${currency}`;
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

function shortPlanId(id: string): string {
  return id.replace(/-/g, "").slice(0, 4).toUpperCase();
}

function shortOrderId(id: string): string {
  return id.replace(/-/g, "").slice(0, 8).toUpperCase();
}

function relativeDueLabel(iso: string, now = new Date()): string | null {
  const due = new Date(iso);
  if (Number.isNaN(due.getTime())) return null;
  const days = Math.round((due.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
  if (days < 0) return `${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"} ago`;
  if (days === 0) return "Due today";
  return `In ${days} day${days === 1 ? "" : "s"}`;
}

function overdueDays(iso: string | null, now = new Date()): number | null {
  if (!iso) return null;
  const due = new Date(iso);
  if (Number.isNaN(due.getTime())) return null;
  const days = Math.floor((now.getTime() - due.getTime()) / (24 * 60 * 60 * 1000));
  return days > 0 ? days : null;
}

function isOverdueRow(item: PaymentInstalmentScheduleItem, now = new Date()): boolean {
  if (item.status === "overdue") return true;
  if (item.status !== "scheduled" && item.status !== "overdue") return false;
  return new Date(item.dueAt).getTime() < now.getTime();
}

function statusPill(status: string): { label: string; className: string } {
  const normalized = status.toLowerCase();
  if (normalized === "paid" || normalized === "completed" || normalized === "active") {
    return {
      label: status.toUpperCase(),
      className:
        "border-[color-mix(in_srgb,var(--admin-success)_30%,transparent)] bg-[color-mix(in_srgb,var(--admin-success)_12%,transparent)] text-[var(--admin-success)]",
    };
  }
  if (normalized === "overdue" || normalized === "cancelled") {
    return {
      label: status.toUpperCase(),
      className:
        "border-[color-mix(in_srgb,var(--admin-danger)_30%,transparent)] bg-[color-mix(in_srgb,var(--admin-danger)_12%,transparent)] text-[var(--admin-danger)]",
    };
  }
  return {
    label: status.toUpperCase(),
    className:
      "border-[var(--admin-border)] bg-[var(--admin-surface-variant)] text-[var(--admin-on-surface-variant)]",
  };
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

export function AdminPaymentsInstalmentPlanDetailPage({ planId }: Props) {
  const [detail, setDetail] = useState<PaymentInstalmentPlanDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [recordOpen, setRecordOpen] = useState(false);
  const [recordTarget, setRecordTarget] = useState<PaymentInstalmentScheduleItem | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchPaymentInstalmentDetail(planId);
      setDetail(response.data);
    } catch (err) {
      setDetail(null);
      setError(
        err instanceof ClientApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Couldn't load instalment plan.",
      );
    } finally {
      setLoading(false);
    }
  }, [planId]);

  useEffect(() => {
    void load();
  }, [load]);

  const plan = detail?.plan ?? null;
  const instalments = detail?.instalments ?? [];

  const nextPayable = useMemo(
    () =>
      instalments.find(
        (item) => item.status === "scheduled" || item.status === "overdue" || isOverdueRow(item),
      ) ?? null,
    [instalments],
  );

  const collectedCents = plan
    ? Math.max(0, plan.totalAmountCents - plan.remainingAmountCents)
    : 0;
  const progressPct =
    plan && plan.totalAmountCents > 0
      ? Math.min(100, Math.round((collectedCents / plan.totalAmountCents) * 100))
      : 0;

  const daysOverdue = plan?.overdueCount
    ? overdueDays(
        instalments.find((item) => isOverdueRow(item))?.dueAt ?? plan.nextDueAt,
      )
    : null;

  const canMutate = plan
    ? plan.status !== "cancelled" && plan.status !== "completed"
    : false;

  function openRecord(item?: PaymentInstalmentScheduleItem | null) {
    const target = item ?? nextPayable;
    if (!target) return;
    setRecordTarget(target);
    setRecordOpen(true);
  }

  async function copyMembershipId() {
    if (!plan) return;
    try {
      await navigator.clipboard.writeText(plan.membershipId);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-6">
      <PaymentsReportTabs active="instalment" />

      {loading ? (
        <div className="flex flex-col gap-6" aria-busy="true">
          <Shimmer className="h-8 w-64" />
          <Shimmer className="h-32 w-full" />
          <div className="grid gap-6 lg:grid-cols-3">
            <Shimmer className="h-80 lg:col-span-2" />
            <Shimmer className="h-80" />
          </div>
        </div>
      ) : null}

      {error ? (
        <div className="flex items-center justify-between gap-4 border border-[var(--admin-danger)] bg-[color-mix(in_srgb,var(--admin-danger)_12%,transparent)] p-4">
          <div className="flex items-center gap-3 text-[var(--admin-danger)]">
            <AlertTriangle className="h-5 w-5 shrink-0" aria-hidden="true" />
            <div>
              <p className="text-sm font-bold">Couldn&apos;t load plan</p>
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

      {!loading && plan ? (
        <>
          <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
            <div>
              <nav className="mb-4 flex flex-wrap items-center gap-2 font-mono text-xs text-[var(--admin-on-surface-variant)]">
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
                <Link
                  href="/admin/reports/payments/instalments"
                  className="hover:text-[var(--admin-primary)]"
                >
                  Instalments
                </Link>
                <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
                <span className="text-[var(--admin-on-surface)]">
                  Plan {shortPlanId(plan.id)}
                </span>
              </nav>

              <h1 className="mb-2 text-2xl font-bold tracking-tight text-[var(--admin-on-surface)] md:text-3xl">
                {plan.productTitle}
              </h1>
              <div className="mb-4 flex flex-wrap items-center gap-2 text-sm text-[var(--admin-on-surface-variant)]">
                <span>{plan.learnerName ?? "Learner"}</span>
                <span>·</span>
                {plan.email ? (
                  <a
                    href={`mailto:${plan.email}`}
                    className="hover:text-[var(--admin-primary)]"
                  >
                    {plan.email}
                  </a>
                ) : (
                  <span>—</span>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <span
                  className={`inline-flex items-center rounded border px-2 py-0.5 font-mono text-[10px] font-bold tracking-wide ${statusPill(plan.status).className}`}
                >
                  {statusPill(plan.status).label}
                </span>
                <span className="inline-flex items-center rounded border border-[var(--admin-border)] bg-[var(--admin-surface-variant)] px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wide text-[var(--admin-on-surface-variant)]">
                  {plan.instalmentCount} instalments
                </span>
                {daysOverdue != null ? (
                  <span className="inline-flex items-center rounded border border-[color-mix(in_srgb,var(--admin-danger)_30%,transparent)] bg-[color-mix(in_srgb,var(--admin-danger)_12%,transparent)] px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wide text-[var(--admin-danger)]">
                    {daysOverdue} day{daysOverdue === 1 ? "" : "s"} overdue
                  </span>
                ) : null}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 lg:mt-6">
              <button
                type="button"
                disabled
                title="Reminder delivery is not configured yet"
                className="inline-flex items-center gap-2 px-3 py-1.5 font-mono text-xs text-[var(--admin-on-surface-variant)] opacity-50"
              >
                <Bell className="h-4 w-4" aria-hidden="true" />
                Send reminder
              </button>
              <button
                type="button"
                disabled
                title="Schedule editing is not available yet"
                className="inline-flex items-center gap-2 px-3 py-1.5 font-mono text-xs text-[var(--admin-on-surface-variant)] opacity-50"
              >
                <Pencil className="h-4 w-4" aria-hidden="true" />
                Edit schedule
              </button>
              <button
                type="button"
                disabled={!canMutate}
                className="inline-flex items-center gap-2 border border-[var(--admin-danger)] px-3 py-1.5 font-mono text-xs text-[var(--admin-danger)] hover:bg-[color-mix(in_srgb,var(--admin-danger)_10%,transparent)] disabled:opacity-40"
                onClick={() => setCancelOpen(true)}
              >
                <Ban className="h-4 w-4" aria-hidden="true" />
                Cancel plan
              </button>
              <button
                type="button"
                disabled={!canMutate || !nextPayable}
                className="inline-flex items-center gap-2 rounded bg-[var(--admin-primary)] px-4 py-1.5 font-mono text-xs font-bold uppercase tracking-wide text-[var(--admin-on-primary)] disabled:opacity-40"
                onClick={() => openRecord()}
              >
                <Wallet className="h-4 w-4" aria-hidden="true" />
                Record next payment
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 divide-y divide-[var(--admin-border)] border border-[var(--admin-border)] bg-[var(--admin-surface)] md:grid-cols-4 md:divide-x md:divide-y-0">
            <div className="p-6 md:col-span-2">
              <p className="mb-2 font-mono text-[11px] font-bold uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
                Remaining
              </p>
              <p className="mb-4 text-[28px] font-bold text-[var(--admin-primary)]">
                {formatMoney(plan.remainingAmountCents, plan.currency)}
              </p>
              <div className="relative mb-2 h-1 w-full bg-[var(--admin-surface-variant)]">
                <div
                  className="absolute inset-y-0 left-0 bg-[var(--admin-primary)]"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <p className="text-right font-mono text-[11px] text-[var(--admin-on-surface-variant)]">
                {formatMoney(collectedCents, plan.currency)} of{" "}
                {formatMoney(plan.totalAmountCents, plan.currency)} collected
              </p>
            </div>
            <div className="flex flex-col justify-center p-6">
              <p className="mb-2 font-mono text-[11px] font-bold uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
                Next due
              </p>
              <p className="mb-4 text-base text-[var(--admin-on-surface)]">
                {formatDate(plan.nextDueAt)}
              </p>
              <p className="mb-2 font-mono text-[11px] font-bold uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
                Status
              </p>
              <p className="text-sm text-[var(--admin-on-surface)]">
                Instalments {plan.paidCount} of {plan.instalmentCount} paid
              </p>
            </div>
            <div className="flex flex-col justify-center p-6">
              <p className="mb-2 font-mono text-[11px] font-bold uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
                Created
              </p>
              <p className="mb-1 text-base text-[var(--admin-on-surface)]">
                {formatDate(plan.createdAt)}
              </p>
              <p className="text-sm text-[var(--admin-on-surface-variant)]">
                {plan.pricingPlanLabel ?? "Instalment plan"}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
            <div className="space-y-6 lg:col-span-2">
              <section className="border border-[var(--admin-border)] bg-[var(--admin-surface)]">
                <div className="flex items-center justify-between border-b border-[var(--admin-border)] bg-[var(--admin-surface-high)] p-4">
                  <h2 className="text-lg font-semibold text-[var(--admin-on-surface)]">
                    Payment Schedule
                  </h2>
                  <CalendarDays
                    className="h-5 w-5 text-[var(--admin-on-surface-variant)]"
                    aria-hidden="true"
                  />
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[720px] border-collapse text-left">
                    <thead>
                      <tr className="border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)]">
                        <th className="w-12 p-3 font-mono text-[11px] font-bold uppercase tracking-wide text-[var(--admin-on-surface-variant)]">
                          #
                        </th>
                        <th className="p-3 font-mono text-[11px] font-bold uppercase tracking-wide text-[var(--admin-on-surface-variant)]">
                          Amount
                        </th>
                        <th className="p-3 font-mono text-[11px] font-bold uppercase tracking-wide text-[var(--admin-on-surface-variant)]">
                          Due date
                        </th>
                        <th className="p-3 font-mono text-[11px] font-bold uppercase tracking-wide text-[var(--admin-on-surface-variant)]">
                          Paid date
                        </th>
                        <th className="p-3 font-mono text-[11px] font-bold uppercase tracking-wide text-[var(--admin-on-surface-variant)]">
                          Payment
                        </th>
                        <th className="p-3 font-mono text-[11px] font-bold uppercase tracking-wide text-[var(--admin-on-surface-variant)]">
                          Status
                        </th>
                        <th className="p-3 text-right font-mono text-[11px] font-bold uppercase tracking-wide text-[var(--admin-on-surface-variant)]">
                          Action
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {instalments.map((item) => {
                        const overdue = isOverdueRow(item);
                        const isNext = nextPayable?.id === item.id;
                        const pill = statusPill(
                          overdue && item.status !== "paid" ? "overdue" : item.status,
                        );
                        const dueHint =
                          item.status === "paid"
                            ? null
                            : relativeDueLabel(item.dueAt);
                        return (
                          <tr
                            key={item.id}
                            className={[
                              "border-b border-[var(--admin-border)]",
                              overdue
                                ? "border-l-2 border-l-[var(--admin-danger)] bg-[color-mix(in_srgb,var(--admin-danger)_5%,transparent)]"
                                : isNext
                                  ? "border-l-2 border-l-[var(--admin-primary)] bg-[color-mix(in_srgb,var(--admin-primary)_5%,transparent)]"
                                  : "",
                            ].join(" ")}
                          >
                            <td
                              className={[
                                "p-3 font-mono text-xs",
                                overdue
                                  ? "text-[var(--admin-danger)]"
                                  : "text-[var(--admin-on-surface-variant)]",
                              ].join(" ")}
                            >
                              {String(item.sequenceNo).padStart(2, "0")}
                            </td>
                            <td
                              className={[
                                "p-3 font-mono text-xs",
                                overdue ? "text-[var(--admin-danger)]" : "text-[var(--admin-on-surface)]",
                              ].join(" ")}
                            >
                              {formatMoney(item.amountCents, plan.currency)}
                            </td>
                            <td className="p-3">
                              <div
                                className={
                                  overdue
                                    ? "text-sm text-[var(--admin-danger)]"
                                    : "text-sm text-[var(--admin-on-surface)]"
                                }
                              >
                                {formatDate(item.dueAt)}
                              </div>
                              {dueHint ? (
                                <div
                                  className={[
                                    "mt-1 font-mono text-[10px] uppercase tracking-wider",
                                    overdue
                                      ? "text-[var(--admin-danger)]"
                                      : "text-[var(--admin-on-surface-variant)]",
                                  ].join(" ")}
                                >
                                  {dueHint}
                                </div>
                              ) : null}
                            </td>
                            <td className="p-3 text-sm text-[var(--admin-on-surface-variant)]">
                              {formatDate(item.paidAt)}
                            </td>
                            <td className="p-3">
                              {item.paymentOrderId ? (
                                <Link
                                  href={`/admin/reports/payments/transactions/${item.paymentOrderId}`}
                                  className="font-mono text-xs text-[var(--admin-primary)] hover:underline"
                                >
                                  {shortOrderId(item.paymentOrderId)}
                                </Link>
                              ) : (
                                <span className="text-[var(--admin-on-surface-variant)]">—</span>
                              )}
                            </td>
                            <td className="p-3">
                              <span
                                className={`inline-flex rounded border px-2 py-0.5 font-mono text-[10px] font-bold tracking-wide ${pill.className}`}
                              >
                                {pill.label}
                              </span>
                            </td>
                            <td className="p-3 text-right">
                              {canMutate &&
                              (item.status === "scheduled" ||
                                item.status === "overdue" ||
                                overdue) ? (
                                <button
                                  type="button"
                                  className="border border-[var(--admin-primary)] px-2 py-1 font-mono text-[10px] font-bold uppercase tracking-wider text-[var(--admin-primary)] hover:bg-[color-mix(in_srgb,var(--admin-primary)_10%,transparent)]"
                                  onClick={() => openRecord(item)}
                                >
                                  Record
                                </button>
                              ) : null}
                            </td>
                          </tr>
                        );
                      })}
                      <tr className="border-t-2 border-[var(--admin-border)] bg-[var(--admin-surface-low)]">
                        <td
                          colSpan={2}
                          className="p-3 text-right font-mono text-[11px] font-bold uppercase tracking-wide text-[var(--admin-on-surface-variant)]"
                        >
                          Total
                        </td>
                        <td colSpan={5} className="p-3 font-mono text-xs text-[var(--admin-on-surface)]">
                          {formatMoney(plan.totalAmountCents, plan.currency)}
                        </td>
                      </tr>
                      <tr className="bg-[var(--admin-surface-low)]">
                        <td
                          colSpan={2}
                          className="p-3 text-right font-mono text-[11px] font-bold uppercase tracking-wide text-[var(--admin-primary)]"
                        >
                          Collected
                        </td>
                        <td colSpan={5} className="p-3 font-mono text-xs text-[var(--admin-primary)]">
                          {formatMoney(collectedCents, plan.currency)}
                        </td>
                      </tr>
                      <tr className="bg-[var(--admin-surface-low)]">
                        <td
                          colSpan={2}
                          className="p-3 text-right font-mono text-[11px] font-bold uppercase tracking-wide text-[var(--admin-danger)]"
                        >
                          Remaining
                        </td>
                        <td colSpan={5} className="p-3 font-mono text-xs text-[var(--admin-danger)]">
                          {formatMoney(plan.remainingAmountCents, plan.currency)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </section>
            </div>

            <div className="space-y-6">
              <section className="relative overflow-hidden border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4">
                <User
                  className="pointer-events-none absolute -right-2 -top-2 h-28 w-28 text-[var(--admin-on-surface)] opacity-5"
                  aria-hidden="true"
                />
                <div className="relative z-10">
                  <h3 className="mb-1 text-base font-semibold text-[var(--admin-on-surface)]">
                    {plan.learnerName ?? "Learner"}
                  </h3>
                  <p className="mb-3 font-mono text-xs text-[var(--admin-on-surface-variant)]">
                    {plan.email ?? "—"}
                  </p>
                  <div className="mb-3 flex items-center justify-between border border-[var(--admin-border)] bg-[var(--admin-surface-high)] p-2">
                    <span className="truncate font-mono text-[11px] text-[var(--admin-on-surface)]">
                      {plan.membershipId}
                    </span>
                    <button
                      type="button"
                      className="shrink-0 text-[var(--admin-on-surface-variant)] hover:text-[var(--admin-primary)]"
                      onClick={() => void copyMembershipId()}
                      title="Copy membership ID"
                      aria-label="Copy membership ID"
                    >
                      {copied ? (
                        <Check className="h-3.5 w-3.5 text-[var(--admin-success)]" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </div>
                  <Link
                    href={`/admin/members/${plan.membershipId}`}
                    className="mb-3 inline-flex items-center gap-1 text-sm text-[var(--admin-primary)] hover:underline"
                  >
                    View member profile <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </Link>
                  <p className="border-t border-[var(--admin-border)] pt-3 font-mono text-[10px] text-[var(--admin-on-surface-variant)]">
                    Course access follows membership state — cancel revoke is recorded for ops
                    follow-up only.
                  </p>
                </div>
              </section>

              <section className="border border-[var(--admin-border)] bg-[var(--admin-surface)]">
                <div className="flex items-center justify-between border-b border-[var(--admin-border)] bg-[var(--admin-surface-high)] p-4">
                  <h3 className="flex items-center gap-2 text-base font-semibold text-[var(--admin-on-surface)]">
                    <Bell className="h-4 w-4" aria-hidden="true" />
                    Reminders
                  </h3>
                </div>
                <div className="p-4">
                  <p className="text-sm text-[var(--admin-on-surface-variant)]">
                    Automated instalment reminders aren&apos;t configured for this academy yet.
                    Manual reminder send is disabled until delivery is wired.
                  </p>
                </div>
              </section>

              <section className="border border-[var(--admin-border)] bg-[var(--admin-surface)]">
                <div className="border-b border-[var(--admin-border)] bg-[var(--admin-surface-high)] p-4">
                  <h3 className="flex items-center gap-2 text-base font-semibold text-[var(--admin-on-surface)]">
                    <History className="h-4 w-4" aria-hidden="true" />
                    Activity
                  </h3>
                </div>
                <div className="relative p-4 pl-6">
                  <div className="absolute bottom-6 left-[19px] top-6 w-px bg-[var(--admin-border)]" />
                  {(detail?.activity.length ?? 0) === 0 ? (
                    <p className="font-mono text-xs text-[var(--admin-on-surface-variant)]">
                      No derived activity yet.
                    </p>
                  ) : (
                    <ul className="relative space-y-5">
                      {detail?.activity.map((event) => (
                        <li key={event.id} className="flex items-start gap-3">
                          <div
                            className={[
                              "relative z-10 mt-1.5 h-[7px] w-[7px] shrink-0 -translate-x-[18px] rounded-full",
                              event.tone === "success"
                                ? "bg-[var(--admin-success)]"
                                : event.tone === "danger"
                                  ? "bg-[var(--admin-danger)]"
                                  : "bg-[var(--admin-on-surface-variant)]",
                            ].join(" ")}
                          />
                          <div className="-ml-3">
                            <div
                              className={[
                                "text-sm",
                                event.tone === "success"
                                  ? "text-[var(--admin-success)]"
                                  : event.tone === "danger"
                                    ? "text-[var(--admin-danger)]"
                                    : "text-[var(--admin-on-surface)]",
                              ].join(" ")}
                            >
                              {event.label}
                            </div>
                            {event.detail ? (
                              <div className="mt-0.5 font-mono text-xs text-[var(--admin-on-surface-variant)]">
                                {event.detail}
                              </div>
                            ) : null}
                            <div className="mt-1 font-mono text-[10px] text-[var(--admin-on-surface-variant)]">
                              {formatDateTime(event.occurredAt)}
                              {event.actorLabel ? ` · ${event.actorLabel}` : ""}
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                  <p className="mt-4 border-t border-[var(--admin-border)] pt-3 font-mono text-[10px] text-[var(--admin-on-surface-variant)]">
                    Derived from plan create, payments, and cancel events — not a full audit log.
                  </p>
                </div>
              </section>

              {detail?.cancel ? (
                <section className="border border-[color-mix(in_srgb,var(--admin-danger)_30%,transparent)] bg-[color-mix(in_srgb,var(--admin-danger)_6%,transparent)] p-4">
                  <p className="mb-1 font-mono text-[11px] font-bold uppercase tracking-wide text-[var(--admin-danger)]">
                    Cancelled
                  </p>
                  <p className="text-sm text-[var(--admin-on-surface)]">
                    {formatDateTime(detail.cancel.cancelledAt)} · {detail.cancel.reason}
                  </p>
                  {detail.cancel.accessNote ? (
                    <p className="mt-2 text-xs text-[var(--admin-on-surface-variant)]">
                      {detail.cancel.accessNote}
                    </p>
                  ) : null}
                </section>
              ) : null}
            </div>
          </div>

          {recordTarget ? (
            <AdminPaymentInstalmentRecordModal
              open={recordOpen}
              plan={plan}
              instalment={recordTarget}
              onClose={() => setRecordOpen(false)}
              onRecorded={() => void load()}
            />
          ) : null}
          <AdminPaymentInstalmentCancelModal
            open={cancelOpen}
            plan={plan}
            onClose={() => setCancelOpen(false)}
            onCancelled={() => void load()}
          />
        </>
      ) : null}

      {!loading && !error && !plan ? (
        <div className="flex min-h-[240px] items-center justify-center border border-[var(--admin-border)] bg-[var(--admin-surface)] p-8">
          <Loader2 className="h-5 w-5 animate-spin text-[var(--admin-on-surface-variant)]" />
        </div>
      ) : null}
    </div>
  );
}
