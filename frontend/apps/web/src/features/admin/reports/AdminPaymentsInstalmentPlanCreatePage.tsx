"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  AlertTriangle,
  CheckCircle2,
  Info,
  Loader2,
  Plus,
  Search,
  Trash2,
  User,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ClientApiError, clientApi } from "../../../lib/client-api";
import {
  createPaymentInstalmentPlan,
  fetchPaymentInstalments,
  type PaymentInstalmentPlanItem,
} from "./admin-payments-roster-api";
import { PaymentsReportTabs } from "./PaymentsReportTabs";

type MemberOption = {
  id: string;
  label: string;
  email: string | null;
};

type CourseOption = {
  id: string;
  title: string;
  priceCents: number | null;
  currency: string | null;
  status?: string;
};

type ScheduleRow = {
  key: string;
  amountMajor: string;
  dueDate: string;
};

type CountPreset = 2 | 3 | 6 | "custom";

function formatMoney(cents: number, currency: string): string {
  return `${(cents / 100).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ${currency}`;
}

function parseMajorToCents(value: string): number | null {
  const cleaned = value.replace(/,/g, "").trim();
  if (!cleaned) return null;
  const num = Number(cleaned);
  if (!Number.isFinite(num) || num <= 0) return null;
  return Math.round(num * 100);
}

function centsToMajorInput(cents: number): string {
  return (cents / 100).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function addMonthsIsoDate(base: Date, months: number): string {
  const d = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate()));
  d.setUTCMonth(d.getUTCMonth() + months);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${String(y)}-${m}-${day}`;
}

function todayIsoDate(): string {
  return addMonthsIsoDate(new Date(), 0);
}

function dateInputToIso(value: string): string {
  return new Date(`${value}T00:00:00.000Z`).toISOString();
}

function splitEvenly(totalCents: number, count: number): number[] {
  const base = Math.floor(totalCents / count);
  const parts = Array.from({ length: count }, () => base);
  let remainder = totalCents - base * count;
  for (let i = parts.length - 1; i >= 0 && remainder > 0; i -= 1) {
    const cur = parts[i];
    if (cur !== undefined) {
      parts[i] = cur + 1;
    }
    remainder -= 1;
  }
  return parts;
}

function newRowKey(): string {
  return `row-${Math.random().toString(36).slice(2, 10)}`;
}

function buildSchedule(count: number, totalCents: number, startDate: string): ScheduleRow[] {
  const amounts = splitEvenly(totalCents, count);
  const start = startDate ? new Date(`${startDate}T00:00:00.000Z`) : new Date();
  return amounts.map((cents, index) => ({
    key: newRowKey(),
    amountMajor: centsToMajorInput(cents),
    dueDate: addMonthsIsoDate(start, index),
  }));
}

function Toggle({
  checked,
  onChange,
  disabled,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  label: string;
  hint: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4">
      <div>
        <p className="text-sm font-medium text-[var(--admin-on-surface)]">{label}</p>
        <p className="font-mono text-xs text-[var(--admin-on-surface-variant)]">{hint}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => {
          onChange(!checked);
        }}
        className={[
          "relative h-5 w-10 shrink-0 border transition-colors disabled:opacity-40",
          checked
            ? "border-[var(--admin-primary)] bg-[color-mix(in_srgb,var(--admin-primary)_20%,transparent)]"
            : "border-[var(--admin-border)] bg-[var(--admin-surface-variant)]",
        ].join(" ")}
      >
        <span
          className={[
            "absolute top-0.5 h-3.5 w-3.5 transition-all",
            checked
              ? "right-0.5 bg-[var(--admin-primary)]"
              : "left-0.5 bg-[var(--admin-on-surface-variant)]",
          ].join(" ")}
        />
      </button>
    </div>
  );
}

export function AdminPaymentsInstalmentPlanCreatePage() {
  const router = useRouter();
  const [memberQuery, setMemberQuery] = useState("");
  const [memberResults, setMemberResults] = useState<MemberOption[]>([]);
  const [memberSearching, setMemberSearching] = useState(false);
  const [learner, setLearner] = useState<MemberOption | null>(null);
  const [existingPlanCount, setExistingPlanCount] = useState<number | null>(null);

  const [courses, setCourses] = useState<CourseOption[]>([]);
  const [coursesLoading, setCoursesLoading] = useState(true);
  const [productId, setProductId] = useState("");
  const [productTitle, setProductTitle] = useState("");
  const [productType, setProductType] = useState("course");
  const [currency, setCurrency] = useState("USD");
  const [totalMajor, setTotalMajor] = useState("");
  const [listPriceCents, setListPriceCents] = useState<number | null>(null);

  const [countPreset, setCountPreset] = useState<CountPreset>(3);
  const [schedule, setSchedule] = useState<ScheduleRow[]>(() =>
    buildSchedule(3, 0, todayIsoDate()),
  );

  const [accessPolicy, setAccessPolicy] = useState<"immediate" | "after_first_payment">(
    "after_first_payment",
  );
  const [automatedReminders, setAutomatedReminders] = useState(false);
  const [autoRevokeOnDefault, setAutoRevokeOnDefault] = useState(false);
  const [sendConfirmationEmail, setSendConfirmationEmail] = useState(true);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<PaymentInstalmentPlanItem | null>(null);

  const totalCents = parseMajorToCents(totalMajor) ?? 0;
  const scheduledCents = useMemo(
    () =>
      schedule.reduce((sum, row) => {
        const cents = parseMajorToCents(row.amountMajor);
        return sum + (cents ?? 0);
      }, 0),
    [schedule],
  );
  const deltaCents = totalCents - scheduledCents;
  const scheduleValid = totalCents > 0 && schedule.length >= 2 && deltaCents === 0;
  const datesValid = schedule.every((row) => Boolean(row.dueDate));
  const canSubmit =
    Boolean(learner) && Boolean(productTitle.trim()) && scheduleValid && datesValid && !busy;

  useEffect(() => {
    let cancelled = false;
    setCoursesLoading(true);
    void clientApi
      .get<{ data: { items: CourseOption[] } }>("/api/v1/courses?view=studio&limit=100")
      .then((response) => {
        if (cancelled) return;
        setCourses(response.data.items);
      })
      .catch(() => {
        if (!cancelled) setCourses([]);
      })
      .finally(() => {
        if (!cancelled) setCoursesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!learner) {
      setExistingPlanCount(null);
      return;
    }
    let cancelled = false;
    void fetchPaymentInstalments({
      q: learner.email ?? learner.label,
      status: "active",
      limit: 25,
    })
      .then((response) => {
        if (cancelled) return;
        const count = response.data.items.filter((item) => item.membershipId === learner.id).length;
        setExistingPlanCount(count);
      })
      .catch(() => {
        if (!cancelled) setExistingPlanCount(null);
      });
    return () => {
      cancelled = true;
    };
  }, [learner]);

  const searchMembers = useCallback(async (term: string) => {
    setMemberQuery(term);
    if (!term.trim()) {
      setMemberResults([]);
      return;
    }
    setMemberSearching(true);
    try {
      const response = await clientApi.get<{
        data: {
          items: Array<{
            id: string;
            invitedEmail: string | null;
            accountEmail?: string | null;
            profile: { displayName: string | null } | null;
          }>;
        };
      }>(`/api/v1/members?search=${encodeURIComponent(term.trim())}&limit=10&status=ACTIVE`);
      setMemberResults(
        response.data.items.map((member) => ({
          id: member.id,
          label:
            member.profile?.displayName ?? member.invitedEmail ?? member.accountEmail ?? member.id,
          email: member.accountEmail ?? member.invitedEmail,
        })),
      );
    } catch {
      setMemberResults([]);
    } finally {
      setMemberSearching(false);
    }
  }, []);

  function applyPreset(preset: CountPreset) {
    setCountPreset(preset);
    const count = preset === "custom" ? Math.max(schedule.length, 2) : preset;
    const start = schedule[0]?.dueDate || todayIsoDate();
    if (totalCents > 0) {
      setSchedule(buildSchedule(count, totalCents, start));
    } else {
      setSchedule(
        Array.from({ length: count }, (_, index) => ({
          key: newRowKey(),
          amountMajor: "",
          dueDate: addMonthsIsoDate(new Date(`${start}T00:00:00.000Z`), index),
        })),
      );
    }
  }

  function redistribute() {
    if (totalCents <= 0 || schedule.length < 2) return;
    const start = schedule[0]?.dueDate || todayIsoDate();
    setSchedule(buildSchedule(schedule.length, totalCents, start));
    setCountPreset(
      schedule.length === 2 || schedule.length === 3 || schedule.length === 6
        ? schedule.length
        : "custom",
    );
  }

  function onSelectCourse(id: string) {
    setProductId(id);
    const course = courses.find((item) => item.id === id);
    if (!course) return;
    setProductTitle(course.title);
    setProductType("course");
    if (course.currency) setCurrency(course.currency.toUpperCase());
    if (course.priceCents != null && course.priceCents > 0) {
      setListPriceCents(course.priceCents);
      setTotalMajor(centsToMajorInput(course.priceCents));
      const count = countPreset === "custom" ? Math.max(schedule.length, 2) : countPreset;
      const start = schedule[0]?.dueDate || todayIsoDate();
      setSchedule(buildSchedule(count, course.priceCents, start));
    } else {
      setListPriceCents(null);
    }
  }

  function onTotalBlur() {
    if (totalCents <= 0 || schedule.length < 2) return;
    const start = schedule[0]?.dueDate || todayIsoDate();
    setSchedule(buildSchedule(schedule.length, totalCents, start));
  }

  async function handleCreate() {
    if (!learner || !canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      const instalments = schedule.map((row) => {
        const amountCents = parseMajorToCents(row.amountMajor);
        if (!amountCents || !row.dueDate) {
          throw new Error("Each instalment needs a valid amount and due date.");
        }
        return { amountCents, dueAt: dateInputToIso(row.dueDate) };
      });
      const count = instalments.length;
      const response = await createPaymentInstalmentPlan({
        membershipId: learner.id,
        productTitle: productTitle.trim(),
        productType,
        productId: productId || undefined,
        pricingPlanLabel: `${String(count)} instalments`,
        totalAmountCents: totalCents,
        currency,
        instalments,
        accessPolicy,
        automatedReminders,
        autoRevokeOnDefault,
        sendConfirmationEmail,
      });
      setCreated(response.data);
    } catch (err) {
      setError(
        err instanceof ClientApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Unable to create instalment plan.",
      );
    } finally {
      setBusy(false);
    }
  }

  function resetForm() {
    setCreated(null);
    setLearner(null);
    setMemberQuery("");
    setMemberResults([]);
    setExistingPlanCount(null);
    setProductId("");
    setProductTitle("");
    setProductType("course");
    setCurrency("USD");
    setTotalMajor("");
    setListPriceCents(null);
    setCountPreset(3);
    setSchedule(buildSchedule(3, 0, todayIsoDate()));
    setAccessPolicy("after_first_payment");
    setAutomatedReminders(false);
    setAutoRevokeOnDefault(false);
    setSendConfirmationEmail(true);
    setError(null);
  }

  if (created) {
    return (
      <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-6">
        <PaymentsReportTabs active="instalment" />
        <div className="flex min-h-[60vh] items-center justify-center p-4">
          <div className="relative w-full max-w-md border border-[var(--admin-primary)] bg-[var(--admin-surface)] p-6 shadow-[0_0_40px_color-mix(in_srgb,var(--admin-primary)_12%,transparent)] md:p-8">
            <div className="mb-6 flex h-12 w-12 items-center justify-center border border-[var(--admin-primary)] bg-[color-mix(in_srgb,var(--admin-primary)_12%,transparent)]">
              <CheckCircle2 className="h-7 w-7 text-[var(--admin-primary)]" aria-hidden="true" />
            </div>
            <h1 className="mb-6 text-center text-2xl font-bold tracking-tight text-[var(--admin-on-surface)]">
              Instalment plan created
            </h1>
            <div className="mb-8 flex flex-col gap-3 border border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-4">
              <div className="flex justify-between gap-3 border-b border-[var(--admin-border)] pb-2">
                <span className="font-mono text-[11px] font-bold uppercase tracking-wide text-[var(--admin-on-surface-variant)]">
                  Learner
                </span>
                <span className="text-sm text-[var(--admin-on-surface)]">
                  {created.learnerName ?? learner?.label ?? "—"}
                </span>
              </div>
              <div className="flex justify-between gap-3 border-b border-[var(--admin-border)] pb-2">
                <span className="font-mono text-[11px] font-bold uppercase tracking-wide text-[var(--admin-on-surface-variant)]">
                  Product
                </span>
                <span className="text-right text-sm text-[var(--admin-on-surface)]">
                  {created.productTitle}
                </span>
              </div>
              <div className="flex justify-between gap-3 border-b border-[var(--admin-border)] pb-2">
                <span className="font-mono text-[11px] font-bold uppercase tracking-wide text-[var(--admin-on-surface-variant)]">
                  Total
                </span>
                <span className="font-mono text-sm text-[var(--admin-primary)]">
                  {formatMoney(created.totalAmountCents, created.currency)}
                </span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="font-mono text-[11px] font-bold uppercase tracking-wide text-[var(--admin-on-surface-variant)]">
                  Plan ID
                </span>
                <span className="font-mono text-xs text-[var(--admin-on-surface)]">
                  {created.id.slice(0, 8).toUpperCase()}
                </span>
              </div>
            </div>
            <div className="flex flex-col gap-3">
              <Link
                href={`/admin/reports/payments/instalments/${created.id}`}
                className="inline-flex h-12 items-center justify-center gap-2 bg-[var(--admin-primary)] font-mono text-xs font-bold uppercase tracking-wide text-[var(--admin-on-primary)]"
              >
                View plan
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <button
                type="button"
                className="inline-flex h-12 items-center justify-center gap-2 border border-[var(--admin-primary)] font-mono text-xs font-bold uppercase tracking-wide text-[var(--admin-primary)] hover:bg-[color-mix(in_srgb,var(--admin-primary)_8%,transparent)]"
                onClick={resetForm}
              >
                Create another
                <Plus className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const firstDue = schedule[0]?.dueDate || "—";
  const lastDue = schedule[schedule.length - 1]?.dueDate || "—";

  return (
    <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-6 pb-28 xl:pb-8">
      <PaymentsReportTabs active="instalment" />

      <div className="flex flex-col gap-2">
        <Link
          href="/admin/reports/payments/instalments"
          className="inline-flex w-fit items-center gap-1 font-mono text-xs text-[var(--admin-on-surface-variant)] hover:text-[var(--admin-primary)]"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          Back to plans
        </Link>
        <h1 className="text-2xl font-bold tracking-tight text-[var(--admin-on-surface)] md:text-3xl">
          New Instalment Plan
        </h1>
        <p className="font-mono text-xs text-[var(--admin-on-surface-variant)]">
          /admin/reports/payments/instalments/new
        </p>
      </div>

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_280px]">
        <div className="flex flex-col gap-8">
          {/* 1. Learner */}
          <section className="relative border border-[var(--admin-border)] bg-[var(--admin-surface)] p-6">
            <div className="absolute -top-3 left-4 bg-[var(--admin-surface)] px-2 font-mono text-[11px] font-bold uppercase tracking-wide text-[var(--admin-on-surface-variant)]">
              1. Learner
            </div>
            {learner ? (
              <div className="flex items-center justify-between gap-4 border border-[color-mix(in_srgb,var(--admin-primary)_30%,transparent)] bg-[var(--admin-surface-high)] p-4">
                <div className="flex items-center gap-4">
                  <div className="flex h-10 w-10 items-center justify-center border border-[var(--admin-border)] bg-[var(--admin-surface-variant)]">
                    <User className="h-5 w-5 text-[var(--admin-on-surface-variant)]" />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-baseline gap-2">
                      <h3 className="text-base font-semibold text-[var(--admin-on-surface)]">
                        {learner.label}
                      </h3>
                      <span className="font-mono text-xs text-[var(--admin-on-surface-variant)]">
                        {learner.id.slice(0, 8).toUpperCase()}
                      </span>
                    </div>
                    <p className="font-mono text-xs text-[var(--admin-on-surface-variant)]">
                      {learner.email ?? "—"}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  className="border border-[var(--admin-border)] px-3 py-1.5 font-mono text-[11px] font-bold uppercase tracking-wide hover:border-[var(--admin-primary)]"
                  onClick={() => {
                    setLearner(null);
                    setMemberQuery("");
                    setExistingPlanCount(null);
                  }}
                >
                  Change
                </button>
              </div>
            ) : (
              <div className="relative">
                <Search className="pointer-events-none absolute left-0 bottom-2 h-4 w-4 text-[var(--admin-on-surface-variant)]" />
                <input
                  className="w-full border-b border-[var(--admin-border)] bg-transparent py-2 pl-6 font-mono text-xs outline-none focus:border-[var(--admin-primary)]"
                  placeholder="Search by name or email…"
                  value={memberQuery}
                  onChange={(event) => void searchMembers(event.target.value)}
                />
                {memberSearching ? (
                  <p className="mt-2 font-mono text-xs text-[var(--admin-on-surface-variant)]">
                    Searching…
                  </p>
                ) : null}
                {memberResults.length > 0 ? (
                  <ul className="mt-2 max-h-48 overflow-y-auto border border-[var(--admin-border)] bg-[var(--admin-surface-high)]">
                    {memberResults.map((member) => (
                      <li key={member.id}>
                        <button
                          type="button"
                          className="flex w-full flex-col px-3 py-2 text-left hover:bg-[var(--admin-surface)]"
                          onClick={() => {
                            setLearner(member);
                            setMemberQuery(member.label);
                            setMemberResults([]);
                          }}
                        >
                          <span className="text-sm font-medium text-[var(--admin-on-surface)]">
                            {member.label}
                          </span>
                          {member.email ? (
                            <span className="font-mono text-xs text-[var(--admin-on-surface-variant)]">
                              {member.email}
                            </span>
                          ) : null}
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            )}
            {learner ? (
              <div className="mt-3 flex items-center gap-2 text-[var(--admin-on-surface-variant)]">
                <Info className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span className="font-mono text-xs">
                  {existingPlanCount == null
                    ? "Checking existing plans…"
                    : existingPlanCount === 0
                      ? "No existing active plans found for this learner."
                      : `${String(existingPlanCount)} active plan${existingPlanCount === 1 ? "" : "s"} already on this learner.`}
                </span>
              </div>
            ) : null}
          </section>

          {/* 2. Product & amount */}
          <section className="relative border border-[var(--admin-border)] bg-[var(--admin-surface)] p-6">
            <div className="absolute -top-3 left-4 bg-[var(--admin-surface)] px-2 font-mono text-[11px] font-bold uppercase tracking-wide text-[var(--admin-on-surface-variant)]">
              2. Product &amp; amount
            </div>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <div>
                <label className="mb-2 block font-mono text-[11px] font-bold uppercase tracking-wide text-[var(--admin-on-surface-variant)]">
                  Selected product
                </label>
                <select
                  className="mb-3 w-full border-b border-[var(--admin-border)] bg-transparent py-2 font-mono text-xs outline-none focus:border-[var(--admin-primary)]"
                  value={productId}
                  disabled={coursesLoading}
                  onChange={(event) => {
                    onSelectCourse(event.target.value);
                  }}
                >
                  <option value="">
                    {coursesLoading ? "Loading courses…" : "Choose a course or enter manually"}
                  </option>
                  {courses.map((course) => (
                    <option key={course.id} value={course.id}>
                      {course.title}
                      {course.priceCents != null
                        ? ` · ${formatMoney(course.priceCents, (course.currency ?? "USD").toUpperCase())}`
                        : ""}
                    </option>
                  ))}
                </select>
                <input
                  className="w-full border-b border-[var(--admin-border)] bg-transparent py-2 font-mono text-xs outline-none focus:border-[var(--admin-primary)]"
                  placeholder="Product title"
                  value={productTitle}
                  onChange={(event) => {
                    setProductTitle(event.target.value);
                    if (productId) setProductId("");
                  }}
                />
                {productTitle ? (
                  <span className="mt-2 inline-block border border-[var(--admin-border)] bg-[var(--admin-surface-variant)] px-2 py-1 font-mono text-[10px] font-bold uppercase tracking-wide text-[var(--admin-on-surface-variant)]">
                    {productType}
                  </span>
                ) : null}
              </div>
              <div>
                <label className="mb-2 block font-mono text-[11px] font-bold uppercase tracking-wide text-[var(--admin-on-surface-variant)]">
                  Total amount ({currency})
                </label>
                <div className="flex items-center border-b border-[var(--admin-border)] bg-[var(--admin-surface-high)] focus-within:border-[var(--admin-primary)]">
                  <input
                    className="w-full bg-transparent px-3 py-3 text-right font-mono text-sm text-[var(--admin-primary)] outline-none"
                    value={totalMajor}
                    onChange={(event) => {
                      setTotalMajor(event.target.value);
                    }}
                    onBlur={onTotalBlur}
                    placeholder="0.00"
                  />
                </div>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <select
                    className="bg-transparent font-mono text-xs text-[var(--admin-on-surface-variant)] outline-none"
                    value={currency}
                    onChange={(event) => {
                      setCurrency(event.target.value.toUpperCase());
                    }}
                  >
                    {["USD", "INR", "EUR", "GBP", "AUD", "CAD"].map((code) => (
                      <option key={code} value={code}>
                        {code}
                      </option>
                    ))}
                  </select>
                  <span className="font-mono text-xs text-[var(--admin-on-surface-variant)]">
                    Divided into {schedule.length} instalments
                  </span>
                </div>
                {listPriceCents != null && totalCents > 0 && listPriceCents !== totalCents ? (
                  <p className="mt-2 font-mono text-[11px] text-[var(--admin-warning,var(--admin-on-surface-variant))]">
                    Differs from course list price ({formatMoney(listPriceCents, currency)}).
                  </p>
                ) : null}
              </div>
            </div>
          </section>

          {/* 3. Schedule */}
          <section
            className={[
              "relative border bg-[var(--admin-surface)] p-6",
              totalCents > 0 && !scheduleValid
                ? "border-[var(--admin-danger)] shadow-[0_0_15px_color-mix(in_srgb,var(--admin-danger)_10%,transparent)]"
                : "border-[var(--admin-border)]",
            ].join(" ")}
          >
            <div className="absolute -top-3 left-4 bg-[var(--admin-surface)] px-2 font-mono text-[11px] font-bold uppercase tracking-wide text-[var(--admin-on-surface-variant)]">
              3. Schedule
            </div>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex w-fit border border-[var(--admin-border)] bg-[var(--admin-surface-variant)] p-1">
                {([2, 3, 6] as const).map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    className={[
                      "px-4 py-1 font-mono text-[11px] font-bold uppercase tracking-wide",
                      countPreset === preset
                        ? "border border-[color-mix(in_srgb,var(--admin-primary)_50%,transparent)] bg-[color-mix(in_srgb,var(--admin-primary)_10%,transparent)] text-[var(--admin-primary)]"
                        : "text-[var(--admin-on-surface-variant)] hover:text-[var(--admin-on-surface)]",
                    ].join(" ")}
                    onClick={() => {
                      applyPreset(preset);
                    }}
                  >
                    {preset}
                  </button>
                ))}
                <button
                  type="button"
                  className={[
                    "ml-1 border-l border-[var(--admin-border)] px-4 py-1 font-mono text-[11px] font-bold uppercase tracking-wide",
                    countPreset === "custom"
                      ? "text-[var(--admin-primary)]"
                      : "text-[var(--admin-on-surface-variant)] hover:text-[var(--admin-on-surface)]",
                  ].join(" ")}
                  onClick={() => {
                    applyPreset("custom");
                  }}
                >
                  Custom
                </button>
              </div>
              <button
                type="button"
                className="border border-[var(--admin-border)] px-2 py-1 font-mono text-xs text-[var(--admin-on-surface-variant)] hover:border-[var(--admin-primary)] hover:text-[var(--admin-primary)]"
                onClick={redistribute}
              >
                Auto-distribute
              </button>
            </div>

            <div className="overflow-x-auto border border-[var(--admin-border)]">
              <table className="w-full min-w-[560px] text-left">
                <thead className="border-b border-[var(--admin-border)] bg-[var(--admin-surface-high)]">
                  <tr>
                    <th className="w-16 px-4 py-2 font-mono text-[11px] font-bold uppercase tracking-wide text-[var(--admin-on-surface-variant)]">
                      #
                    </th>
                    <th className="px-4 py-2 font-mono text-[11px] font-bold uppercase tracking-wide text-[var(--admin-on-surface-variant)]">
                      Amount ({currency})
                    </th>
                    <th className="px-4 py-2 font-mono text-[11px] font-bold uppercase tracking-wide text-[var(--admin-on-surface-variant)]">
                      Due date
                    </th>
                    <th className="w-20 px-4 py-2 text-center font-mono text-[11px] font-bold uppercase tracking-wide text-[var(--admin-on-surface-variant)]">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--admin-border)] bg-[var(--admin-surface-low)]">
                  {schedule.map((row, index) => (
                    <tr key={row.key} className="hover:bg-[var(--admin-surface)]">
                      <td className="px-4 py-3 font-mono text-xs text-[var(--admin-on-surface-variant)]">
                        {index + 1}
                      </td>
                      <td className="px-4 py-3">
                        <input
                          className={[
                            "w-32 border-b bg-transparent py-1 font-mono text-xs outline-none",
                            totalCents > 0 && !scheduleValid
                              ? "border-[var(--admin-danger)] text-[var(--admin-danger)]"
                              : "border-[var(--admin-border)] text-[var(--admin-on-surface)] focus:border-[var(--admin-primary)]",
                          ].join(" ")}
                          value={row.amountMajor}
                          onChange={(event) => {
                            const value = event.target.value;
                            setSchedule((current) =>
                              current.map((item) =>
                                item.key === row.key ? { ...item, amountMajor: value } : item,
                              ),
                            );
                            setCountPreset("custom");
                          }}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="date"
                          className="w-36 border-b border-[var(--admin-border)] bg-transparent py-1 font-mono text-xs outline-none focus:border-[var(--admin-primary)]"
                          value={row.dueDate}
                          onChange={(event) => {
                            const value = event.target.value;
                            setSchedule((current) =>
                              current.map((item) =>
                                item.key === row.key ? { ...item, dueDate: value } : item,
                              ),
                            );
                          }}
                        />
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          type="button"
                          className="text-[var(--admin-on-surface-variant)] hover:text-[var(--admin-danger)] disabled:opacity-30"
                          disabled={schedule.length <= 2}
                          onClick={() => {
                            setSchedule((current) =>
                              current.filter((item) => item.key !== row.key),
                            );
                            setCountPreset("custom");
                          }}
                          aria-label={`Remove instalment ${String(index + 1)}`}
                        >
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalCents > 0 && scheduleValid ? (
              <div className="flex items-center gap-2 border border-t-0 border-[color-mix(in_srgb,var(--admin-primary)_50%,transparent)] bg-[color-mix(in_srgb,var(--admin-primary)_10%,transparent)] p-3 text-[var(--admin-primary)]">
                <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span className="font-mono text-xs font-bold">
                  Instalments total {formatMoney(scheduledCents, currency)} — matches plan total.
                </span>
              </div>
            ) : null}

            {totalCents > 0 && !scheduleValid ? (
              <div className="flex items-start gap-3 border-l-4 border-[var(--admin-danger)] bg-[color-mix(in_srgb,var(--admin-danger)_12%,transparent)] p-4">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--admin-danger)]" />
                <div>
                  <h4 className="mb-1 font-mono text-[11px] font-bold uppercase tracking-wide text-[var(--admin-danger)]">
                    Schedule mismatch
                  </h4>
                  <p className="text-sm text-[var(--admin-danger)]">
                    Instalments total{" "}
                    <span className="font-mono font-bold">
                      {formatMoney(scheduledCents, currency)}
                    </span>{" "}
                    —{" "}
                    <span className="font-mono font-bold">
                      {formatMoney(Math.abs(deltaCents), currency)}
                    </span>{" "}
                    {deltaCents > 0 ? "short of" : "over"} the plan total.
                  </p>
                </div>
              </div>
            ) : null}

            <button
              type="button"
              className="mt-4 flex w-full items-center justify-center gap-2 border border-dashed border-[var(--admin-border)] py-2 font-mono text-xs text-[var(--admin-on-surface-variant)] hover:border-[var(--admin-primary)] hover:text-[var(--admin-primary)]"
              onClick={() => {
                setSchedule((current) => [
                  ...current,
                  {
                    key: newRowKey(),
                    amountMajor: "",
                    dueDate: addMonthsIsoDate(
                      new Date(
                        `${current[current.length - 1]?.dueDate || todayIsoDate()}T00:00:00.000Z`,
                      ),
                      1,
                    ),
                  },
                ]);
                setCountPreset("custom");
              }}
            >
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              Add instalment
            </button>
          </section>

          {/* 4. Access */}
          <section className="relative border border-[var(--admin-border)] bg-[var(--admin-surface)] p-6">
            <div className="absolute -top-3 left-4 bg-[var(--admin-surface)] px-2 font-mono text-[11px] font-bold uppercase tracking-wide text-[var(--admin-on-surface-variant)]">
              4. Access &amp; automation
            </div>
            <div className="mb-6 space-y-3">
              <p className="font-mono text-[11px] font-bold uppercase tracking-wide text-[var(--admin-on-surface-variant)]">
                Course access policy
              </p>
              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="radio"
                  name="access"
                  checked={accessPolicy === "immediate"}
                  onChange={() => {
                    setAccessPolicy("immediate");
                  }}
                  className="mt-1 accent-[var(--admin-primary)]"
                />
                <span>
                  <span className="block text-sm font-medium text-[var(--admin-on-surface)]">
                    Grant course access immediately
                  </span>
                  <span className="mt-1 block font-mono text-xs text-[var(--admin-on-surface-variant)]">
                    Intent is stored on the plan. Enrollment is not granted automatically yet.
                  </span>
                </span>
              </label>
              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="radio"
                  name="access"
                  checked={accessPolicy === "after_first_payment"}
                  onChange={() => {
                    setAccessPolicy("after_first_payment");
                  }}
                  className="mt-1 accent-[var(--admin-primary)]"
                />
                <span>
                  <span className="block text-sm font-medium text-[var(--admin-on-surface)]">
                    Grant access after first payment
                  </span>
                  <span className="mt-1 block font-mono text-xs text-[var(--admin-on-surface-variant)]">
                    Preferred ops default — still recorded as intent only until entitlements are
                    wired.
                  </span>
                </span>
              </label>
            </div>
            <hr className="mb-6 border-[var(--admin-border)]" />
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Toggle
                checked={automatedReminders}
                onChange={setAutomatedReminders}
                label="Automated reminders"
                hint="Preference only — reminder delivery is not configured yet."
              />
              <Toggle
                checked={autoRevokeOnDefault}
                onChange={setAutoRevokeOnDefault}
                label="Auto-revoke on default"
                hint="Preference only — overdue revoke is not automated yet."
              />
              <div className="md:col-span-2">
                <Toggle
                  checked={sendConfirmationEmail}
                  onChange={setSendConfirmationEmail}
                  label="Send confirmation email"
                  hint={
                    learner?.email
                      ? `Preference stored for ${learner.email} — email is not queued yet.`
                      : "Preference stored — email delivery is not configured yet."
                  }
                />
              </div>
            </div>
          </section>

          {error ? (
            <div className="border border-[var(--admin-danger)] bg-[color-mix(in_srgb,var(--admin-danger)_10%,transparent)] p-4 font-mono text-xs text-[var(--admin-danger)]">
              {error}
            </div>
          ) : null}
        </div>

        {/* Sticky summary */}
        <aside className="border border-[var(--admin-border)] bg-[var(--admin-surface)] xl:sticky xl:top-6">
          <div className="border-b border-[var(--admin-border)] bg-[var(--admin-surface-high)] p-4">
            <h3 className="font-mono text-[11px] font-bold uppercase tracking-wide text-[var(--admin-on-surface-variant)]">
              Plan summary
            </h3>
          </div>
          <div className="space-y-4 p-4">
            <div>
              <span className="mb-1 block font-mono text-xs text-[var(--admin-on-surface-variant)]">
                Learner
              </span>
              <span className="block text-sm font-medium text-[var(--admin-on-surface)]">
                {learner?.label ?? "—"}
              </span>
            </div>
            <div>
              <span className="mb-1 block font-mono text-xs text-[var(--admin-on-surface-variant)]">
                Product
              </span>
              <span className="block truncate text-sm font-medium text-[var(--admin-on-surface)]">
                {productTitle || "—"}
              </span>
            </div>
            <hr className="border-[var(--admin-border)]" />
            <div>
              <span className="mb-1 block font-mono text-xs text-[var(--admin-on-surface-variant)]">
                Total plan value
              </span>
              <span className="block font-mono text-xl font-bold text-[var(--admin-primary)]">
                {totalCents > 0 ? formatMoney(totalCents, currency) : `0.00 ${currency}`}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="border border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-2">
                <span className="mb-1 block font-mono text-[10px] text-[var(--admin-on-surface-variant)]">
                  Instalments
                </span>
                <span className="font-mono text-xs text-[var(--admin-on-surface)]">
                  {schedule.length}
                </span>
              </div>
              <div className="border border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-2">
                <span className="mb-1 block font-mono text-[10px] text-[var(--admin-on-surface-variant)]">
                  Interval
                </span>
                <span className="font-mono text-xs text-[var(--admin-on-surface)]">Monthly</span>
              </div>
            </div>
            <div className="space-y-2 pt-2">
              <div className="flex justify-between font-mono text-xs">
                <span className="text-[var(--admin-on-surface-variant)]">1st due</span>
                <span className="text-[var(--admin-on-surface)]">{firstDue}</span>
              </div>
              <div className="flex justify-between font-mono text-xs">
                <span className="text-[var(--admin-on-surface-variant)]">Last due</span>
                <span className="text-[var(--admin-on-surface)]">{lastDue}</span>
              </div>
              {!scheduleValid && totalCents > 0 ? (
                <div className="flex justify-between font-mono text-xs text-[var(--admin-danger)]">
                  <span>Scheduled</span>
                  <span>{formatMoney(scheduledCents, currency)}</span>
                </div>
              ) : null}
            </div>
          </div>
          <div className="space-y-3 border-t border-[var(--admin-border)] bg-[var(--admin-surface-high)] p-4">
            <button
              type="button"
              disabled={!canSubmit}
              className="flex w-full items-center justify-center gap-2 bg-[var(--admin-primary)] py-3 font-mono text-xs font-bold uppercase tracking-wide text-[var(--admin-on-primary)] disabled:cursor-not-allowed disabled:opacity-40"
              onClick={() => void handleCreate()}
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Create plan
            </button>
            <button
              type="button"
              disabled
              title="Drafts are not supported yet — plans are created as active."
              className="w-full border border-[var(--admin-border)] py-3 font-mono text-xs font-bold uppercase tracking-wide text-[var(--admin-on-surface-variant)] opacity-50"
            >
              Save as draft
            </button>
            <button
              type="button"
              className="w-full py-2 font-mono text-xs text-[var(--admin-on-surface-variant)] hover:text-[var(--admin-on-surface)]"
              onClick={() => {
                router.push("/admin/reports/payments/instalments");
              }}
            >
              Cancel
            </button>
          </div>
        </aside>
      </div>

      {/* Mobile sticky footer */}
      <footer className="fixed bottom-0 left-0 right-0 z-20 flex items-center justify-between gap-4 border-t border-[var(--admin-border)] bg-[var(--admin-surface-high)] px-4 py-3 xl:hidden">
        <div>
          <span className="block font-mono text-[10px] uppercase text-[var(--admin-on-surface-variant)]">
            Plan total
          </span>
          <span className="font-mono text-sm text-[var(--admin-on-surface)]">
            {totalCents > 0 ? formatMoney(totalCents, currency) : `0.00 ${currency}`}
          </span>
        </div>
        <button
          type="button"
          disabled={!canSubmit}
          className="bg-[var(--admin-primary)] px-5 py-2.5 font-mono text-xs font-bold uppercase tracking-wide text-[var(--admin-on-primary)] disabled:opacity-40"
          onClick={() => void handleCreate()}
        >
          Create plan
        </button>
      </footer>
    </div>
  );
}
