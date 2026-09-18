"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, Download, Info, Save, Tag, Trash2 } from "lucide-react";
import { ClientApiError, clientApi, toast } from "../../../lib/client-api";
import { generalSettingsBackLinkClassName } from "../general-settings/general-settings-shared";
import { MESSENGER_WIZARD_FIELD_CLASS } from "./push-wizard-chrome";
import { CouponFormFields } from "./CouponFormFields";
import {
  ADMIN_SALES_HREF,
  COUPONS_LIST_HREF,
  couponLiveSummary,
  couponStatusLabel,
  couponToForm,
  couponUsageLabel,
  formToPayload,
  formatCouponDate,
  formatCouponDateTime,
  formatCouponDiscount,
  formatMoney,
  type CouponDto,
  type CouponFormValues,
  type CouponRedemptionDto,
} from "./coupons-shared";
import { csvEscape } from "@/lib/export/csv";

type CourseOption = { id: string; title: string };

type CouponBuilderPanelProps = {
  couponId: string;
};

function ToggleSwitch(props: {
  checked: boolean;
  disabled?: boolean;
  onChange: (next: boolean) => void;
  ariaLabel: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={props.checked}
      aria-label={props.ariaLabel}
      disabled={props.disabled}
      onClick={() => {
        props.onChange(!props.checked);
      }}
      className={[
        "relative h-6 w-11 shrink-0 rounded-full transition-colors duration-200 disabled:opacity-50",
        props.checked ? "bg-[var(--admin-primary)]" : "bg-[var(--admin-outline)]",
      ].join(" ")}
    >
      <span
        className={[
          "absolute top-[2px] left-[2px] h-5 w-5 rounded-full bg-[var(--admin-surface)] transition-transform duration-200",
          props.checked ? "translate-x-5" : "translate-x-0",
        ].join(" ")}
        aria-hidden="true"
      />
    </button>
  );
}

function learnerInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return (parts[0] ?? "").slice(0, 2).toUpperCase();
  return `${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? ""}`.toUpperCase();
}

export function CouponBuilderPanel({ couponId }: CouponBuilderPanelProps) {
  const router = useRouter();
  const [coupon, setCoupon] = useState<CouponDto | null>(null);
  const [values, setValues] = useState<CouponFormValues | null>(null);
  const [courses, setCourses] = useState<CourseOption[]>([]);
  const [redemptions, setRedemptions] = useState<CouponRedemptionDto[]>([]);
  const [redemptionTotal, setRedemptionTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleteBusy, setDeleteBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [couponResponse, coursesResponse, redemptionsResponse] = await Promise.all([
        clientApi.get<{ data: CouponDto }>(`/api/v1/sales/coupons/${couponId}`),
        clientApi.get<{ data: { items: CourseOption[] } }>("/api/v1/courses?view=studio&limit=100"),
        clientApi.get<{ data: { items: CouponRedemptionDto[]; totalCount: number } }>(
          `/api/v1/sales/coupons/${couponId}/redemptions?limit=20`,
        ),
      ]);
      setCoupon(couponResponse.data);
      setValues(couponToForm(couponResponse.data));
      setCourses(coursesResponse.data.items);
      setRedemptions(redemptionsResponse.data.items);
      setRedemptionTotal(redemptionsResponse.data.totalCount);
    } catch (caught) {
      toast.error(caught instanceof ClientApiError ? caught.message : "Could not load coupon.");
    } finally {
      setLoading(false);
    }
  }, [couponId]);

  useEffect(() => {
    void load();
  }, [load]);

  const usagePct = useMemo(() => {
    if (!coupon || coupon.totalUsageLimit == null || coupon.totalUsageLimit <= 0) return 0;
    return Math.min(100, Math.round((coupon.redemptionCount / coupon.totalUsageLimit) * 100));
  }, [coupon]);

  async function onSave() {
    if (!values) return;
    setBusy(true);
    try {
      const response = await clientApi.patch<{ data: CouponDto }>(
        `/api/v1/sales/coupons/${couponId}`,
        formToPayload(values),
        "coupon-update",
        { successMessage: "Coupon saved." },
      );
      setCoupon(response.data);
      setValues(couponToForm(response.data));
    } catch (caught) {
      toast.error(caught instanceof ClientApiError ? caught.message : "Could not save coupon.");
    } finally {
      setBusy(false);
    }
  }

  async function runStatus(path: "activate" | "deactivate", message: string) {
    setActionBusy(true);
    try {
      const response = await clientApi.post<{ data: CouponDto }>(
        `/api/v1/sales/coupons/${couponId}/${path}`,
        {},
        `coupon-${path}`,
        { successMessage: message },
      );
      setCoupon(response.data);
      setValues(couponToForm(response.data));
    } catch (caught) {
      toast.error(caught instanceof ClientApiError ? caught.message : "Action failed.");
    } finally {
      setActionBusy(false);
    }
  }

  async function onToggleActive(next: boolean) {
    if (next) {
      await runStatus("activate", "Coupon activated.");
    } else {
      await runStatus("deactivate", "Coupon deactivated.");
    }
  }

  async function onDelete() {
    if (!coupon) return;
    if (deleteConfirm.trim() !== coupon.name.trim()) {
      toast.error("Type the coupon name to confirm delete.");
      return;
    }
    setDeleteBusy(true);
    try {
      await clientApi.post(
        `/api/v1/sales/coupons/${couponId}/delete`,
        { nameConfirmation: deleteConfirm.trim() },
        "coupon-delete",
        { successMessage: "Coupon deleted." },
      );
      router.push(COUPONS_LIST_HREF);
    } catch (caught) {
      toast.error(caught instanceof ClientApiError ? caught.message : "Could not delete coupon.");
    } finally {
      setDeleteBusy(false);
    }
  }

  function exportRedemptionsCsv() {
    if (redemptions.length === 0) {
      toast.error("No redemptions to export.");
      return;
    }
    const header = ["Learner", "Course", "Discount", "Original", "Final", "Currency", "Date"];
    const rows = redemptions.map((row) => [
      row.learnerName,
      row.courseTitle ?? "",
      String(row.discountCents / 100),
      String(row.originalAmountCents / 100),
      String(row.finalAmountCents / 100),
      row.currency,
      row.createdAt,
    ]);
    const csv = [header, ...rows]
      // Redemption exports carry learner-supplied names; csvEscape neutralises
      // formula prefixes as well as quoting (M1).
      .map((cols) => cols.map((cell) => csvEscape(cell)).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${coupon?.code ?? "coupon"}-redemptions.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  if (loading || !values || !coupon) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 animate-pulse rounded-lg bg-[var(--admin-surface-high)]" />
        <div className="h-40 animate-pulse rounded-xl bg-[var(--admin-surface-high)]" />
      </div>
    );
  }

  const deleteMatches = deleteConfirm.trim() === coupon.name.trim();
  const isActive = coupon.status === "ACTIVE";

  return (
    <div className="relative mx-auto max-w-[1200px] space-y-6 pb-28">
      <div
        className="pointer-events-none absolute -right-6 -top-8 h-36 w-36 rounded-full bg-[color-mix(in_srgb,var(--admin-primary)_10%,transparent)] blur-3xl"
        aria-hidden="true"
      />

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Link href="/admin" className={generalSettingsBackLinkClassName}>
          <ChevronLeft className="h-4 w-4" />
          Dashboard
        </Link>
        <span className="text-[var(--admin-on-surface-variant)]">/</span>
        <Link href={ADMIN_SALES_HREF} className={generalSettingsBackLinkClassName}>
          Sales
        </Link>
        <span className="text-[var(--admin-on-surface-variant)]">/</span>
        <Link href={COUPONS_LIST_HREF} className={generalSettingsBackLinkClassName}>
          Coupons
        </Link>
        <span className="text-[var(--admin-on-surface-variant)]">/</span>
        <span className="font-medium text-[var(--admin-on-surface)]">Editor</span>
      </div>

      <section className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-lg border border-[color-mix(in_srgb,var(--admin-primary)_25%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-primary)_6%,var(--admin-surface))] px-3 py-1 font-mono text-[24px] font-bold tracking-tight text-[var(--admin-primary)] md:text-[32px]">
              {coupon.code}
            </span>
            <span
              className={[
                "rounded-full px-3 py-1 text-xs font-bold",
                isActive
                  ? "bg-[color-mix(in_srgb,var(--admin-success)_12%,var(--admin-surface))] text-[var(--admin-success)]"
                  : coupon.status === "DRAFT"
                    ? "bg-[color-mix(in_srgb,var(--admin-warning)_12%,var(--admin-surface))] text-[var(--admin-warning)]"
                    : "bg-[var(--admin-surface-high)] text-[var(--admin-on-surface-variant)]",
              ].join(" ")}
            >
              {couponStatusLabel(coupon.status)}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-[22px] font-semibold tracking-[-0.01em] text-[var(--admin-on-surface)] md:text-[24px]">
              {values.name || coupon.name}
            </h1>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--admin-outline)] bg-[var(--admin-surface-high)] px-3 py-1 text-xs font-bold text-[var(--admin-on-surface)]">
              <Tag className="h-3.5 w-3.5 text-[var(--admin-primary)]" />
              {formatCouponDiscount({
                discountType: values.discountType,
                discountValue: values.discountValue,
                currency: values.currency,
                maxDiscountCents: values.maxDiscountCents,
              })}
            </span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-[var(--admin-on-surface-variant)]">
              Redemption rate
            </span>
            <div className="flex items-center gap-3">
              <div className="h-2 w-32 overflow-hidden rounded-full bg-[var(--admin-surface-high)]">
                <div
                  className="h-full rounded-full bg-[var(--admin-primary)] transition-all"
                  style={{ width: `${usagePct}%` }}
                />
              </div>
              <span className="font-mono text-[13px] font-bold text-[var(--admin-on-surface)]">
                {couponUsageLabel(coupon)}
              </span>
            </div>
            <p className="text-[12px] text-[var(--admin-on-surface-variant)]">
              Expires {formatCouponDate(values.endsAt || coupon.endsAt)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4 shadow-sm">
          <span className="text-xs font-bold text-[var(--admin-on-surface-variant)]">
            Coupon status
          </span>
          <ToggleSwitch
            checked={isActive}
            disabled={actionBusy}
            ariaLabel="Activate coupon"
            onChange={(next) => {
              void onToggleActive(next);
            }}
          />
          <span className="text-sm font-bold text-[var(--admin-primary)]">
            {isActive ? "Active" : "Activate"}
          </span>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-12">
        <div className="space-y-6 md:col-span-7">
          <div className="overflow-hidden rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)]">
            <div className="border-b border-[var(--admin-border)] bg-[color-mix(in_srgb,var(--admin-surface-high)_40%,transparent)] px-6 py-4">
              <h3 className="text-[16px] font-semibold text-[var(--admin-on-surface)]">
                Campaign identity
              </h3>
            </div>
            <div className="grid gap-4 p-6 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-[var(--admin-on-surface)]">
                  Coupon code
                </label>
                <input
                  value={values.code}
                  onChange={(event) => {
                    setValues({ ...values, code: event.target.value.toUpperCase() });
                  }}
                  className={`${MESSENGER_WIZARD_FIELD_CLASS} h-10 font-mono`}
                  maxLength={64}
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-[var(--admin-on-surface)]">
                  Internal name
                </label>
                <input
                  value={values.name}
                  onChange={(event) => {
                    setValues({ ...values, name: event.target.value });
                  }}
                  className={`${MESSENGER_WIZARD_FIELD_CLASS} h-10`}
                  maxLength={200}
                />
              </div>
            </div>
          </div>

          <CouponFormFields
            values={values}
            onChange={setValues}
            courses={courses}
            showIdentity={false}
            sections={["discount", "restrictions"]}
          />

          <div className="overflow-hidden rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)]">
            <div className="flex items-center justify-between gap-3 border-b border-[var(--admin-border)] bg-[color-mix(in_srgb,var(--admin-surface-high)_40%,transparent)] px-6 py-4">
              <h3 className="text-[16px] font-semibold text-[var(--admin-on-surface)]">
                Redemptions audit trail
              </h3>
              <button
                type="button"
                onClick={exportRedemptionsCsv}
                className="inline-flex items-center gap-1 text-xs font-bold text-[var(--admin-primary)] hover:underline"
              >
                <Download className="h-3.5 w-3.5" />
                Export CSV
              </button>
            </div>
            {redemptions.length === 0 ? (
              <p className="px-6 py-10 text-center text-sm text-[var(--admin-on-surface-variant)]">
                No redemptions recorded yet.
              </p>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left text-sm">
                    <thead className="border-b border-[var(--admin-border)] bg-[color-mix(in_srgb,var(--admin-surface-high)_50%,transparent)]">
                      <tr className="text-[11px] font-bold uppercase tracking-wide text-[var(--admin-on-surface-variant)]">
                        <th className="px-6 py-3">Learner</th>
                        <th className="px-6 py-3">Course</th>
                        <th className="px-6 py-3">Applied</th>
                        <th className="px-6 py-3 text-right">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--admin-border)]">
                      {redemptions.map((row) => (
                        <tr
                          key={row.id}
                          className="transition-colors hover:bg-[color-mix(in_srgb,var(--admin-surface-high)_35%,transparent)]"
                        >
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[var(--admin-surface-high)] text-xs font-bold text-[var(--admin-primary)]">
                                {learnerInitials(row.learnerName)}
                              </span>
                              <span className="font-semibold text-[var(--admin-on-surface)]">
                                {row.learnerName}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-[var(--admin-on-surface-variant)]">
                            <span className="line-clamp-1 max-w-[160px]">
                              {row.courseTitle ?? "Course"}
                            </span>
                          </td>
                          <td className="px-6 py-4 font-mono text-[13px] font-bold text-[var(--admin-success)]">
                            -{formatMoney(row.discountCents, row.currency)}
                          </td>
                          <td className="px-6 py-4 text-right text-[var(--admin-on-surface-variant)]">
                            {formatCouponDate(row.createdAt)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {redemptionTotal > redemptions.length ? (
                  <div className="border-t border-[var(--admin-border)] bg-[color-mix(in_srgb,var(--admin-surface-high)_30%,transparent)] p-4 text-center">
                    <p className="text-xs font-semibold text-[var(--admin-on-surface-variant)]">
                      Showing {redemptions.length} of {redemptionTotal} redemptions
                    </p>
                  </div>
                ) : null}
              </>
            )}
          </div>
        </div>

        <div className="space-y-6 md:col-span-5">
          <CouponFormFields
            values={values}
            onChange={setValues}
            courses={courses}
            showIdentity={false}
            sections={["schedule", "visibility"]}
          />

          <div className="space-y-4 rounded-xl bg-[var(--admin-on-surface)] p-6 text-[var(--admin-surface)] shadow-lg">
            <div className="flex items-center gap-2 opacity-70">
              <Info className="h-4 w-4" />
              <span className="text-xs font-semibold">Live preview summary</span>
            </div>
            <p className="text-[16px] leading-relaxed">{couponLiveSummary(values)}</p>
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div className="rounded-lg border border-[color-mix(in_srgb,var(--admin-surface)_12%,transparent)] bg-[color-mix(in_srgb,var(--admin-surface)_10%,transparent)] p-3">
                <span className="mb-1 block text-[10px] font-bold uppercase opacity-60">
                  Redemptions
                </span>
                <span className="font-mono text-lg font-semibold">{coupon.redemptionCount}</span>
              </div>
              <div className="rounded-lg border border-[color-mix(in_srgb,var(--admin-surface)_12%,transparent)] bg-[color-mix(in_srgb,var(--admin-surface)_10%,transparent)] p-3">
                <span className="mb-1 block text-[10px] font-bold uppercase opacity-60">
                  Updated
                </span>
                <span className="font-mono text-sm font-semibold">
                  {formatCouponDateTime(coupon.updatedAt)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <footer className="fixed bottom-0 left-0 right-0 z-40 border-t border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-[0_-4px_24px_color-mix(in_srgb,var(--admin-on-surface)_8%,transparent)] md:left-[var(--admin-sidebar-width,0px)]">
        <div className="mx-auto flex max-w-[1200px] items-center justify-between gap-4 px-4 py-4 sm:px-8">
          <button
            type="button"
            onClick={() => {
              setDeleteOpen(true);
              setDeleteConfirm("");
            }}
            disabled={isActive}
            className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-bold text-[var(--admin-danger)] transition-colors hover:bg-[color-mix(in_srgb,var(--admin-danger)_8%,transparent)] disabled:opacity-40"
            title={isActive ? "Deactivate before deleting" : "Delete coupon"}
          >
            <Trash2 className="h-4 w-4" />
            Delete coupon
          </button>
          <div className="flex items-center gap-3">
            <Link
              href={COUPONS_LIST_HREF}
              prefetch={false}
              className="rounded-lg border border-[var(--admin-border)] px-5 py-2 text-sm font-bold text-[var(--admin-on-surface-variant)] transition-colors hover:bg-[var(--admin-surface-high)]"
            >
              Discard changes
            </Link>
            <button
              type="button"
              disabled={busy}
              onClick={() => void onSave()}
              className="inline-flex items-center gap-2 rounded-lg bg-[var(--admin-primary)] px-6 py-2 text-sm font-bold text-[var(--admin-on-primary)] shadow-md transition-all hover:bg-[var(--admin-primary-strong)] active:scale-[0.98] disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              {busy ? "Saving…" : "Save changes"}
            </button>
          </div>
        </div>
      </footer>

      {deleteOpen ? (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-[color-mix(in_srgb,var(--admin-on-surface)_35%,transparent)] p-4 backdrop-blur-[2px]"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md space-y-4 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5 shadow-lg">
            <h2 className="text-lg font-semibold text-[var(--admin-on-surface)]">Delete coupon</h2>
            <p className="text-sm text-[var(--admin-on-surface-variant)]">
              Type{" "}
              <span className="font-semibold text-[var(--admin-on-surface)]">{coupon.name}</span> to
              confirm.
            </p>
            <input
              value={deleteConfirm}
              onChange={(event) => {
                setDeleteConfirm(event.target.value);
              }}
              className={MESSENGER_WIZARD_FIELD_CLASS}
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="rounded-lg border border-[var(--admin-border)] px-4 py-2 text-sm font-semibold text-[var(--admin-on-surface-variant)]"
                onClick={() => {
                  setDeleteOpen(false);
                }}
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
