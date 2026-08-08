"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  MoreVertical,
  Plus,
  Search,
  Tag,
  Ticket,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { DropdownMenu, type DropdownMenuItem } from "@atlas/design-system";
import { ClientApiError, clientApi, toast } from "../../../lib/client-api";
import { AdminSelectDropdown } from "../../readiness/components/AdminSelectDropdown";
import { generalSettingsBackLinkClassName } from "../general-settings/general-settings-shared";
import { MESSENGER_WIZARD_FIELD_CLASS } from "./push-wizard-chrome";
import {
  ADMIN_SALES_HREF,
  COUPONS_CREATE_HREF,
  EMPTY_COUPONS_SUMMARY,
  couponHref,
  couponScopeLabel,
  couponStatusLabel,
  couponUsageLabel,
  formatCouponCount,
  formatCouponDate,
  formatCouponDiscount,
  formatMoney,
  type CouponDto,
  type CouponPerformanceItem,
  type CouponStatus,
  type CouponsListSummary,
} from "./coupons-shared";

const DASHBOARD_HREF = "/admin";
type StatusTab = "ALL" | CouponStatus;

const PAGE_SIZE_OPTIONS = [
  { value: "10", label: "10" },
  { value: "25", label: "25" },
  { value: "50", label: "50" },
] as const;

const TABS: ReadonlyArray<{ id: StatusTab; label: string }> = [
  { id: "ALL", label: "All" },
  { id: "ACTIVE", label: "Active" },
  { id: "DRAFT", label: "Draft" },
  { id: "INACTIVE", label: "Inactive" },
];

type ListResponse = {
  data: {
    items: CouponDto[];
    summary: CouponsListSummary;
  };
};

type CouponResponse = { data: CouponDto };
type PerformanceResponse = { data: { items: CouponPerformanceItem[] } };

function statusTone(status: CouponStatus): "success" | "warning" | "neutral" {
  if (status === "ACTIVE") return "success";
  if (status === "DRAFT") return "warning";
  return "neutral";
}

function StatusPill({ status }: { status: CouponStatus }) {
  const tone = statusTone(status);
  return (
    <span
      className={[
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold",
        tone === "success"
          ? "bg-[color-mix(in_srgb,var(--admin-success)_12%,var(--admin-surface))] text-[var(--admin-success)]"
          : tone === "warning"
            ? "bg-[color-mix(in_srgb,var(--admin-warning)_12%,var(--admin-surface))] text-[var(--admin-warning)]"
            : "bg-[var(--admin-surface-high)] text-[var(--admin-on-surface-variant)]",
      ].join(" ")}
    >
      {couponStatusLabel(status)}
    </span>
  );
}

function CouponCode({ code }: { code: string }) {
  return (
    <span className="inline-flex rounded-md bg-[var(--admin-surface-high)] px-1.5 py-0.5 font-mono text-[13px] font-medium text-[var(--admin-on-primary-container)]">
      {code}
    </span>
  );
}

export function CouponsListPanel() {
  const router = useRouter();
  const [tab, setTab] = useState<StatusTab>("ALL");
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [items, setItems] = useState<CouponDto[]>([]);
  const [summary, setSummary] = useState<CouponsListSummary>(EMPTY_COUPONS_SUMMARY);
  const [performance, setPerformance] = useState<CouponPerformanceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [deleteRow, setDeleteRow] = useState<CouponDto | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [actionBusy, setActionBusy] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedQuery(query.trim());
      setPage(1);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [query]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("status", tab);
      params.set("limit", "100");
      if (debouncedQuery) params.set("q", debouncedQuery);
      const [listResponse, perfResponse] = await Promise.all([
        clientApi.get<ListResponse>(`/api/v1/sales/coupons?${params.toString()}`),
        clientApi.get<PerformanceResponse>("/api/v1/sales/coupons/performance?limit=20"),
      ]);
      setItems(listResponse.data.items);
      setSummary(listResponse.data.summary ?? EMPTY_COUPONS_SUMMARY);
      setPerformance(perfResponse.data.items);
    } catch (caught) {
      setItems([]);
      setSummary(EMPTY_COUPONS_SUMMARY);
      setPerformance([]);
      toast.error(caught instanceof ClientApiError ? caught.message : "Could not load coupons.");
    } finally {
      setLoading(false);
    }
  }, [tab, debouncedQuery]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [tab]);

  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
  const pageItems = useMemo(() => {
    const start = (page - 1) * pageSize;
    return items.slice(start, start + pageSize);
  }, [items, page, pageSize]);

  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);

  async function runAction(id: string, path: string, successMessage: string) {
    setActionBusy(id);
    try {
      await clientApi.post<CouponResponse>(
        `/api/v1/sales/coupons/${id}/${path}`,
        {},
        `coupon-${path}`,
        { successMessage },
      );
      await load();
    } catch (caught) {
      toast.error(caught instanceof ClientApiError ? caught.message : "Action failed.");
    } finally {
      setActionBusy(null);
    }
  }

  function rowActions(row: CouponDto): DropdownMenuItem[] {
    const actions: DropdownMenuItem[] = [
      {
        key: "edit",
        label: "Edit",
        onSelect: () => {
          router.push(couponHref(row.id));
        },
      },
    ];
    if (row.status === "ACTIVE") {
      actions.push({
        key: "deactivate",
        label: "Deactivate",
        disabled: actionBusy === row.id,
        onSelect: () => {
          void runAction(row.id, "deactivate", "Coupon deactivated.");
        },
      });
    } else {
      actions.push({
        key: "activate",
        label: "Activate",
        disabled: actionBusy === row.id,
        onSelect: () => {
          void runAction(row.id, "activate", "Coupon activated.");
        },
      });
    }
    actions.push({
      key: "delete",
      label: "Delete",
      destructive: true,
      disabled: row.status === "ACTIVE",
      onSelect: () => {
        setDeleteRow(row);
        setDeleteConfirm("");
      },
    });
    return actions;
  }

  async function onDelete() {
    if (!deleteRow) return;
    if (deleteConfirm.trim() !== deleteRow.name.trim()) {
      toast.error("Type the coupon name to confirm delete.");
      return;
    }
    setDeleteBusy(true);
    try {
      await clientApi.post(
        `/api/v1/sales/coupons/${deleteRow.id}/delete`,
        { nameConfirmation: deleteConfirm.trim() },
        "coupon-delete",
        { successMessage: "Coupon deleted." },
      );
      setDeleteRow(null);
      setDeleteConfirm("");
      await load();
    } catch (caught) {
      toast.error(caught instanceof ClientApiError ? caught.message : "Could not delete coupon.");
    } finally {
      setDeleteBusy(false);
    }
  }

  const deleteMatches =
    Boolean(deleteRow) && deleteConfirm.trim() === (deleteRow?.name.trim() ?? "");

  const perfTotals = useMemo(() => {
    return performance.reduce(
      (acc, row) => {
        acc.redemptions += row.redemptionCount;
        acc.discount += row.totalDiscountCents;
        acc.revenue += row.totalRevenueCents;
        return acc;
      },
      { redemptions: 0, discount: 0, revenue: 0 },
    );
  }, [performance]);

  const rangeStart = items.length === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = Math.min(page * pageSize, items.length);

  return (
    <div className="relative space-y-6">
      <div
        className="pointer-events-none absolute -right-8 -top-10 h-40 w-40 rounded-full bg-[color-mix(in_srgb,var(--admin-primary)_10%,transparent)] blur-3xl"
        aria-hidden="true"
      />

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Link href={DASHBOARD_HREF} className={generalSettingsBackLinkClassName}>
          <ChevronLeft className="h-4 w-4" />
          Dashboard
        </Link>
        <span className="text-[var(--admin-on-surface-variant)]">/</span>
        <Link href={ADMIN_SALES_HREF} className={generalSettingsBackLinkClassName}>
          Sales
        </Link>
        <span className="text-[var(--admin-on-surface-variant)]">/</span>
        <span className="font-medium text-[var(--admin-on-surface)]">Coupons</span>
      </div>

      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-[28px] font-bold tracking-[-0.02em] text-[var(--admin-on-surface)] md:text-[32px]">
            Coupons
          </h1>
          <p className="mt-1 text-[16px] text-[var(--admin-on-surface-variant)]">
            Manage discount codes and promotional campaigns across your platform.
          </p>
        </div>
        <Link
          href={COUPONS_CREATE_HREF}
          prefetch={false}
          className="inline-flex items-center gap-2 rounded-lg bg-[var(--admin-primary)] px-5 py-2.5 text-sm font-semibold text-[var(--admin-on-primary)] transition-all hover:bg-[var(--admin-primary-strong)] active:scale-[0.98]"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Create coupon
        </Link>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
              Active
            </span>
            <Ticket className="h-4 w-4 text-[var(--admin-on-surface-variant)]" />
          </div>
          <p className="text-[28px] font-bold tracking-[-0.02em] text-[var(--admin-on-surface)]">
            {formatCouponCount(summary.activeCount)}
          </p>
          <p className="mt-2 text-[12px] text-[var(--admin-on-surface-variant)]">
            {formatCouponCount(summary.totalCount)} total
          </p>
        </div>
        <div className="rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
              Drafts
            </span>
            <Tag className="h-4 w-4 text-[var(--admin-on-surface-variant)]" />
          </div>
          <p className="text-[28px] font-bold tracking-[-0.02em] text-[var(--admin-on-surface)]">
            {formatCouponCount(summary.draftCount)}
          </p>
          <p className="mt-2 text-[12px] text-[var(--admin-on-surface-variant)]">
            {formatCouponCount(summary.inactiveCount)} inactive
          </p>
        </div>
        <div className="rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
              Redemptions
            </span>
            <TrendingUp className="h-4 w-4 text-[var(--admin-on-surface-variant)]" />
          </div>
          <p className="text-[28px] font-bold tracking-[-0.02em] text-[var(--admin-on-surface)]">
            {formatCouponCount(summary.totalRedemptions)}
          </p>
          <p className="mt-2 text-[12px] text-[var(--admin-on-surface-variant)]">
            Across all coupons
          </p>
        </div>
        <div className="rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
              Revenue
            </span>
            <Wallet className="h-4 w-4 text-[var(--admin-on-surface-variant)]" />
          </div>
          <p className="text-[28px] font-bold tracking-[-0.02em] text-[var(--admin-on-surface)]">
            {formatMoney(summary.totalRevenueCents, "USD")}
          </p>
          <p className="mt-2 text-[12px] text-[var(--admin-on-surface-variant)]">
            {formatMoney(summary.totalDiscountCents, "USD")} discounted
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-4 border-b border-[var(--admin-border)] pb-1 sm:flex-row sm:items-center sm:justify-between">
        <div role="tablist" className="flex gap-6 overflow-x-auto">
          {TABS.map((entry) => {
            const active = tab === entry.id;
            return (
              <button
                key={entry.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setTab(entry.id)}
                className={[
                  "relative -mb-px pb-3 text-sm font-semibold transition-colors",
                  active
                    ? "text-[var(--admin-primary)]"
                    : "text-[var(--admin-on-surface-variant)] hover:text-[var(--admin-on-surface)]",
                ].join(" ")}
              >
                {entry.label}
                {active ? (
                  <span className="absolute inset-x-0 bottom-0 h-0.5 bg-[var(--admin-primary)]" />
                ) : null}
              </button>
            );
          })}
        </div>
        <div className="relative mb-2 max-w-sm flex-1 sm:ml-auto">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--admin-on-surface-variant)]" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by code or name"
            className={`${MESSENGER_WIZARD_FIELD_CLASS} h-10 pl-10`}
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-[var(--admin-border)] bg-[var(--admin-surface-high)]">
              <tr className="text-[12px] font-semibold text-[var(--admin-on-surface-variant)]">
                <th className="px-6 py-4">Code</th>
                <th className="px-6 py-4">Name</th>
                <th className="px-6 py-4">Discount</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Usage</th>
                <th className="px-6 py-4">Expires</th>
                <th className="px-6 py-4">Scope</th>
                <th className="px-6 py-4" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--admin-border)]">
              {loading
                ? Array.from({ length: 4 }).map((_, index) => (
                    <tr key={`skel-${index}`} aria-hidden="true">
                      <td className="px-6 py-5" colSpan={8}>
                        <div className="h-10 animate-pulse rounded-lg bg-[var(--admin-surface-high)]" />
                      </td>
                    </tr>
                  ))
                : null}
              {!loading && pageItems.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-16 text-center">
                    <p className="text-lg font-semibold text-[var(--admin-on-surface)]">
                      No coupons yet
                    </p>
                    <p className="mt-1 text-sm text-[var(--admin-on-surface-variant)]">
                      Create a discount code to start tracking redemptions.
                    </p>
                    <Link
                      href={COUPONS_CREATE_HREF}
                      prefetch={false}
                      className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[var(--admin-primary)] px-4 py-2 text-sm font-semibold text-[var(--admin-on-primary)]"
                    >
                      <Plus className="h-4 w-4" /> Create coupon
                    </Link>
                  </td>
                </tr>
              ) : null}
              {!loading
                ? pageItems.map((row) => (
                    <tr
                      key={row.id}
                      className="group transition-colors hover:bg-[color-mix(in_srgb,var(--admin-primary)_4%,var(--admin-surface))]"
                    >
                      <td className="px-6 py-4">
                        <Link href={couponHref(row.id)} prefetch={false}>
                          <CouponCode code={row.code} />
                        </Link>
                      </td>
                      <td className="px-6 py-4">
                        <p className="font-medium text-[var(--admin-on-surface)]">{row.name}</p>
                      </td>
                      <td className="px-6 py-4 text-[var(--admin-on-surface)]">
                        {formatCouponDiscount(row)}
                      </td>
                      <td className="px-6 py-4">
                        <StatusPill status={row.status} />
                      </td>
                      <td className="px-6 py-4 text-[var(--admin-on-surface-variant)]">
                        {couponUsageLabel(row)}
                      </td>
                      <td className="px-6 py-4 text-[var(--admin-on-surface-variant)]">
                        {formatCouponDate(row.endsAt)}
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex rounded border border-[var(--admin-border)] bg-[var(--admin-surface-high)] px-2 py-0.5 text-xs text-[var(--admin-on-surface-variant)]">
                          {couponScopeLabel(row)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <DropdownMenu
                          label={`Actions for ${row.code}`}
                          align="end"
                          trigger={<MoreVertical className="h-4 w-4" aria-hidden="true" />}
                          triggerClassName="rounded-md p-1 text-[var(--admin-on-surface-variant)] hover:bg-[var(--admin-surface-high)] hover:text-[var(--admin-on-surface)]"
                          items={rowActions(row)}
                        />
                      </td>
                    </tr>
                  ))
                : null}
            </tbody>
          </table>
        </div>
        <div className="flex flex-col gap-3 border-t border-[var(--admin-border)] bg-[var(--admin-surface)] px-6 py-3 text-sm text-[var(--admin-on-surface-variant)] sm:flex-row sm:items-center sm:justify-between">
          <span>
            Showing {rangeStart}-{rangeEnd} of {items.length} coupons
          </span>
          <div className="flex items-center gap-3">
            <AdminSelectDropdown
              id="coupons-page-size"
              label={null}
              ariaLabel="Rows per page"
              value={String(pageSize)}
              options={[...PAGE_SIZE_OPTIONS]}
              onChange={(value) => {
                setPageSize(Number(value));
                setPage(1);
              }}
            />
            <div className="flex gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                className="inline-flex items-center gap-1 rounded-lg border border-[var(--admin-border)] px-3 py-1 transition-colors hover:bg-[var(--admin-surface-high)] disabled:opacity-40"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                Previous
              </button>
              <button
                type="button"
                disabled={page >= pageCount}
                onClick={() => setPage((current) => Math.min(pageCount, current + 1))}
                className="inline-flex items-center gap-1 rounded-lg border border-[var(--admin-border)] px-3 py-1 transition-colors hover:bg-[var(--admin-surface-high)] disabled:opacity-40"
              >
                Next
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {performance.length > 0 ? (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-[var(--admin-on-surface)]">
              Redemption performance
            </h2>
            <p className="text-sm text-[var(--admin-on-surface-variant)]">
              Based on recorded checkout redemptions
            </p>
          </div>
          <div className="overflow-hidden rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-sm">
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-[var(--admin-border)] bg-[var(--admin-surface-high)]">
                  <tr className="text-[12px] font-semibold text-[var(--admin-on-surface-variant)]">
                    <th className="px-6 py-4">Code</th>
                    <th className="px-6 py-4">Redemptions</th>
                    <th className="px-6 py-4 text-right">Discount given</th>
                    <th className="px-6 py-4 text-right">Revenue generated</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--admin-border)]">
                  {performance.map((row) => (
                    <tr key={row.couponId}>
                      <td className="px-6 py-4 font-medium text-[var(--admin-on-surface)]">
                        {row.code}
                      </td>
                      <td className="px-6 py-4 text-[var(--admin-on-surface)]">
                        {row.redemptionCount} {row.redemptionCount === 1 ? "user" : "users"}
                      </td>
                      <td className="px-6 py-4 text-right text-[var(--admin-danger)]">
                        {formatMoney(row.totalDiscountCents, row.currency)}
                      </td>
                      <td className="px-6 py-4 text-right font-semibold text-[var(--admin-on-surface)]">
                        {formatMoney(row.totalRevenueCents, row.currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-[color-mix(in_srgb,var(--admin-surface-high)_50%,transparent)]">
                  <tr>
                    <td className="px-6 py-4 font-bold text-[var(--admin-on-surface)]">Totals</td>
                    <td className="px-6 py-4 font-bold text-[var(--admin-on-surface)]">
                      {perfTotals.redemptions} users
                    </td>
                    <td className="px-6 py-4 text-right font-bold text-[var(--admin-danger)]">
                      {formatMoney(perfTotals.discount, "USD")}
                    </td>
                    <td className="px-6 py-4 text-right font-bold text-[var(--admin-on-surface)]">
                      {formatMoney(perfTotals.revenue, "USD")}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </section>
      ) : null}

      {deleteRow ? (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-[color-mix(in_srgb,var(--admin-on-surface)_35%,transparent)] p-4 backdrop-blur-[2px]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-coupon-title"
        >
          <div className="w-full max-w-md space-y-4 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5 shadow-lg">
            <h2 id="delete-coupon-title" className="text-lg font-semibold text-[var(--admin-on-surface)]">
              Delete coupon
            </h2>
            <p className="text-sm text-[var(--admin-on-surface-variant)]">
              Type{" "}
              <span className="font-semibold text-[var(--admin-on-surface)]">{deleteRow.name}</span>{" "}
              to confirm. Active coupons must be deactivated first.
            </p>
            <input
              value={deleteConfirm}
              onChange={(event) => setDeleteConfirm(event.target.value)}
              className={MESSENGER_WIZARD_FIELD_CLASS}
              placeholder="Coupon name"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="rounded-lg border border-[var(--admin-border)] px-4 py-2 text-sm font-semibold text-[var(--admin-on-surface-variant)] hover:bg-[var(--admin-surface-high)]"
                onClick={() => setDeleteRow(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleteBusy || !deleteMatches}
                onClick={() => void onDelete()}
                className="rounded-lg bg-[var(--admin-danger)] px-4 py-2 text-sm font-semibold text-[var(--admin-on-primary)] disabled:opacity-50"
              >
                {deleteBusy ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
