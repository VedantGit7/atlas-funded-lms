"use client";

import { useCallback, useEffect, useMemo, useState, type SyntheticEvent } from "react";
import { platformApi } from "../platform-api";
import { usePlatformReason } from "./PlatformReasonProvider";
import { PlatformReasonGate } from "./PlatformReasonDialog";

/**
 * P9 -- per-tenant cost attribution (DoD item 8).
 *
 * What each tenant cost the platform to serve in a month: its own metered usage
 * priced at the supplier rate card, plus its share of the fixed monthly bills.
 * The figures are USD because that is what the suppliers invoice in; converting
 * would bake an exchange rate into a number used to set prices.
 */

type DriverKey =
  | "storage_gb_month"
  | "active_member"
  | "email_sent"
  | "custom_domain"
  | "api_million_requests";

type AllocationKey = "api_requests" | "active_members" | "member_days" | "storage_gb" | "equal";

type Usage = {
  activeMembers: number;
  memberDays: number;
  apiRequests: number;
  apiServerMs: number;
  storageGb: number;
  emailsSent: number;
  customDomains: number;
};

export type CostReportView = {
  month: string;
  isPartialMonth: boolean;
  snapshotAt: string;
  tenants: Array<{
    tenantId: string;
    slug: string;
    displayName: string;
    state: string;
    usage: Usage;
    variableCostUsd: number;
    fixedCostUsd: number;
    totalCostUsd: number;
    costPerActiveMemberUsd: number | null;
    shareOfTotal: number;
  }>;
  drivers: Array<{
    key: DriverKey;
    label: string;
    unit: string;
    rate: { unitCostUsd: number; effectiveFrom: string } | null;
    totalQuantity: number;
    totalCostUsd: number | null;
  }>;
  fixedCosts: Array<{
    id: string;
    label: string;
    monthlyCostUsd: number;
    allocationKey: AllocationKey;
    fellBackToEqualSplit: boolean;
    allocated: boolean;
  }>;
  totals: {
    variableCostUsd: number;
    fixedCostUsd: number;
    unallocatedFixedCostUsd: number;
    totalCostUsd: number;
    activeMembers: number;
    costPerActiveMemberUsd: number | null;
  };
  unpricedDrivers: DriverKey[];
  notMetered: Array<{ key: string; label: string; why: string }>;
};

export type CostRateCardView = {
  drivers: Array<{
    key: DriverKey;
    label: string;
    unit: string;
    current: { unitCostUsd: number; effectiveFrom: string } | null;
    suggestion: { unitCostUsd: number; source: string } | null;
  }>;
  allocationKeys: Array<{ key: AllocationKey; label: string }>;
  rateHistory: Array<{
    id: string;
    driver: DriverKey;
    unitCostUsd: number;
    effectiveFrom: string;
    reason: string;
    createdAt: string;
  }>;
  fixedCosts: Array<{
    id: string;
    label: string;
    monthlyCostUsd: number;
    allocationKey: AllocationKey;
    effectiveFrom: string;
    effectiveUntil: string | null;
    reason: string;
  }>;
};

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const integer = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const decimal = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });

/** Sub-cent amounts are real here (a per-member cost), so they keep precision. */
function formatUsd(value: number): string {
  if (value !== 0 && Math.abs(value) < 0.01) {
    return `$${value.toPrecision(2)}`;
  }
  return usd.format(value);
}

const perUnit = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 4,
});

/**
 * Cost per member is the figure a per-learner price is set from, so it keeps
 * four decimals: rounding $0.041 to $0.04 would understate it by 2.5%.
 */
function formatPerMember(value: number): string {
  return perUnit.format(value);
}

const rateFormat = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 6,
});

/** Unit rates go to the micro-dollar ($0.0001 an email) but read as money: $0.10, not $0.1. */
function formatRate(value: number): string {
  return rateFormat.format(value);
}

function currentMonth(): string {
  const now = new Date();
  return `${String(now.getUTCFullYear())}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

function formatMonth(month: string): string {
  const [year, monthNumber] = month.split("-").map(Number);
  if (!year || !monthNumber) return month;
  return new Date(Date.UTC(year, monthNumber - 1, 1)).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

// ---------------------------------------------------------------------------
// Shared styles (semantic tokens only -- light and dark come from globals.css)
// ---------------------------------------------------------------------------

const card = "rounded-lg border border-border bg-card text-card-foreground";
const input =
  "min-h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const primaryButton =
  "inline-flex min-h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium " +
  "text-primary-foreground hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 " +
  "focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";
const quietButton =
  "inline-flex min-h-9 items-center justify-center rounded-md border border-border px-3 text-sm " +
  "text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 " +
  "focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";
const th = "px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground";
const thNum = `${th} text-right`;
const td = "px-3 py-2 align-top";
const tdNum = `${td} whitespace-nowrap text-right tabular-nums`;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PlatformCostAttribution({ canManage }: { canManage: boolean }) {
  const { reason, isValid } = usePlatformReason();
  const [month, setMonth] = useState(currentMonth);
  const [report, setReport] = useState<CostReportView | null>(null);
  const [rateCard, setRateCard] = useState<CostRateCardView | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!reason) return;
    setLoading(true);
    setError(null);
    try {
      const [reportResponse, rateResponse] = await Promise.all([
        platformApi.get<{ data: CostReportView }>(
          `/api/v1/platform/costs?month=${encodeURIComponent(month)}`,
          reason,
        ),
        platformApi.get<{ data: CostRateCardView }>("/api/v1/platform/costs/rates", reason),
      ]);
      setReport(reportResponse.data);
      setRateCard(rateResponse.data);
    } catch (err) {
      setError(errorMessage(err, "Could not load platform costs."));
    } finally {
      setLoading(false);
    }
  }, [month, reason]);

  useEffect(() => {
    if (!isValid) return;
    void load();
  }, [isValid, load]);

  return (
    <PlatformReasonGate ready={isValid}>
      <section className="space-y-6" aria-labelledby="costs-heading">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div className="space-y-1">
            <h1 id="costs-heading" className="text-2xl font-semibold text-foreground">
              Costs
            </h1>
            <p className="max-w-2xl text-sm text-muted-foreground">
              What each tenant cost to serve: its own usage at supplier rates, plus its share of
              fixed bills. Use it to set plan prices. Amounts are USD, as suppliers invoice.
            </p>
          </div>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted-foreground">Month</span>
            <input
              type="month"
              className={input}
              value={month}
              max={currentMonth()}
              onChange={(event) => {
                if (event.target.value) setMonth(event.target.value);
              }}
            />
          </label>
        </header>

        {error ? (
          <p
            role="alert"
            className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive-text"
          >
            {error}
          </p>
        ) : null}

        {loading && !report ? (
          <p role="status" className="text-sm text-muted-foreground">
            Loading costs…
          </p>
        ) : null}

        {report ? <CostReport report={report} /> : null}

        {rateCard ? (
          <RateCardSection
            rateCard={rateCard}
            canManage={canManage}
            reason={reason ?? ""}
            onChanged={load}
          />
        ) : null}
      </section>
    </PlatformReasonGate>
  );
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

/** Presentational; exported so it can be rendered without the API in tests. */
export function CostReport({ report }: { report: CostReportView }) {
  const unpricedLabels = report.drivers
    .filter((driver) => report.unpricedDrivers.includes(driver.key))
    .map((driver) => driver.label);
  const equalSplitLines = report.fixedCosts.filter((line) => line.fellBackToEqualSplit);

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        {report.isPartialMonth ? (
          <Notice tone="info">
            {formatMonth(report.month)} is still running. Usage so far is shown, while fixed costs
            are for the whole month, so cost per member will fall as the month fills in.
          </Notice>
        ) : null}
        {unpricedLabels.length > 0 ? (
          <Notice tone="warning">
            No rate set for {unpricedLabels.join(", ")}. That usage was measured but is not in the
            totals below. Set a rate in the rate card to include it.
          </Notice>
        ) : null}
        {equalSplitLines.length > 0 ? (
          <Notice tone="warning">
            {equalSplitLines.map((line) => line.label).join(", ")} split equally: no tenant had any
            usage of its allocation key this month.
          </Notice>
        ) : null}
        {report.totals.unallocatedFixedCostUsd > 0 ? (
          <Notice tone="warning">
            {formatUsd(report.totals.unallocatedFixedCostUsd)} of fixed costs had no tenant to
            charge.
          </Notice>
        ) : null}
      </div>

      <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Total cost" value={formatUsd(report.totals.totalCostUsd)} emphasis />
        <Stat
          label="Usage-based"
          value={formatUsd(report.totals.variableCostUsd)}
          hint="Priced per unit"
        />
        <Stat label="Fixed" value={formatUsd(report.totals.fixedCostUsd)} hint="Shared bills" />
        <Stat
          label="Per active member"
          value={
            report.totals.costPerActiveMemberUsd === null
              ? "—"
              : formatPerMember(report.totals.costPerActiveMemberUsd)
          }
          hint={`${integer.format(report.totals.activeMembers)} active members`}
        />
      </dl>

      <div className={`${card} overflow-hidden`}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[56rem] border-collapse text-sm">
            <caption className="sr-only">
              Cost per tenant for {formatMonth(report.month)}, most expensive first
            </caption>
            <thead className="border-b border-border bg-muted/50">
              <tr>
                <th scope="col" className={th}>
                  Tenant
                </th>
                <th scope="col" className={thNum}>
                  Active members
                </th>
                <th scope="col" className={thNum}>
                  API requests
                </th>
                <th scope="col" className={thNum}>
                  Storage
                </th>
                <th scope="col" className={thNum}>
                  Emails
                </th>
                <th scope="col" className={thNum}>
                  Usage-based
                </th>
                <th scope="col" className={thNum}>
                  Fixed share
                </th>
                <th scope="col" className={thNum}>
                  Total
                </th>
                <th scope="col" className={thNum}>
                  Per member
                </th>
                <th scope="col" className={th}>
                  Share
                </th>
              </tr>
            </thead>
            <tbody>
              {report.tenants.length === 0 ? (
                <tr>
                  <td colSpan={10} className={`${td} py-8 text-center text-muted-foreground`}>
                    No tenants existed in {formatMonth(report.month)}.
                  </td>
                </tr>
              ) : null}
              {report.tenants.map((tenant) => (
                <tr key={tenant.tenantId} className="border-b border-border last:border-b-0">
                  <th scope="row" className={`${td} text-left font-medium`}>
                    <span className="block text-foreground">{tenant.displayName}</span>
                    <span className="block text-xs font-normal text-muted-foreground">
                      {tenant.slug}
                      {tenant.state !== "ACTIVE" ? ` · ${tenant.state.toLowerCase()}` : ""}
                    </span>
                  </th>
                  <td className={tdNum}>{integer.format(tenant.usage.activeMembers)}</td>
                  <td className={tdNum}>{integer.format(tenant.usage.apiRequests)}</td>
                  <td className={tdNum}>{decimal.format(tenant.usage.storageGb)} GB</td>
                  <td className={tdNum}>{integer.format(tenant.usage.emailsSent)}</td>
                  <td className={tdNum}>{formatUsd(tenant.variableCostUsd)}</td>
                  <td className={tdNum}>{formatUsd(tenant.fixedCostUsd)}</td>
                  <td className={`${tdNum} font-semibold text-foreground`}>
                    {formatUsd(tenant.totalCostUsd)}
                  </td>
                  <td className={tdNum}>
                    {tenant.costPerActiveMemberUsd === null
                      ? "—"
                      : formatPerMember(tenant.costPerActiveMemberUsd)}
                  </td>
                  <td className={td}>
                    <ShareBar share={tenant.shareOfTotal} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <details className={`${card} px-4 py-3 text-sm`}>
        <summary className="cursor-pointer font-medium text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          Not included in these totals
        </summary>
        <ul className="mt-3 space-y-2 text-muted-foreground">
          {report.notMetered.map((entry) => (
            <li key={entry.key}>
              <span className="font-medium text-foreground">{entry.label}.</span> {entry.why}
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-muted-foreground">
          Storage and domains are measured at{" "}
          {new Date(report.snapshotAt).toLocaleString("en-US", { timeZone: "UTC" })} UTC. Months are
          calendar months in UTC.
        </p>
      </details>
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
  emphasis = false,
}: {
  label: string;
  value: string;
  hint?: string;
  emphasis?: boolean;
}) {
  return (
    <div className={`${card} px-4 py-3`}>
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd
        className={`mt-1 tabular-nums ${emphasis ? "text-2xl font-semibold" : "text-xl font-medium"} text-foreground`}
      >
        {value}
      </dd>
      {hint ? <dd className="mt-0.5 text-xs text-muted-foreground">{hint}</dd> : null}
    </div>
  );
}

function ShareBar({ share }: { share: number }) {
  const percent = Math.round(Math.max(0, Math.min(100, share * 100)) * 100) / 100;
  return (
    <div className="flex min-w-24 items-center gap-2">
      <div
        className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted"
        role="img"
        aria-label={`${decimal.format(percent)}% of total cost`}
      >
        <div className="h-full rounded-full bg-primary" style={{ width: `${String(percent)}%` }} />
      </div>
      <span className="w-12 text-right text-xs tabular-nums text-muted-foreground">
        {decimal.format(percent)}%
      </span>
    </div>
  );
}

function Notice({ tone, children }: { tone: "info" | "warning"; children: React.ReactNode }) {
  const toneClass =
    tone === "warning"
      ? "border-warning/40 bg-warning/10 text-foreground"
      : "border-border bg-muted/60 text-muted-foreground";
  return (
    <p role="status" className={`rounded-md border px-4 py-2.5 text-sm ${toneClass}`}>
      {children}
    </p>
  );
}

// ---------------------------------------------------------------------------
// Rate card and fixed costs
// ---------------------------------------------------------------------------

/** Presentational; exported so it can be rendered without the API in tests. */
export function RateCardSection({
  rateCard,
  canManage,
  reason,
  onChanged,
}: {
  rateCard: CostRateCardView;
  canManage: boolean;
  reason: string;
  onChanged: () => Promise<void>;
}) {
  const allocationLabel = useMemo(
    () => new Map(rateCard.allocationKeys.map((entry) => [entry.key, entry.label])),
    [rateCard.allocationKeys],
  );

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className={`${card} p-4`} aria-labelledby="rates-heading">
        <h2 id="rates-heading" className="text-base font-semibold text-foreground">
          Unit rates
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          What one unit costs the platform. Rates are never edited: a new rate applies from its
          month, and setting a month again corrects it. History is kept.
        </p>
        <ul className="mt-4 divide-y divide-border">
          {rateCard.drivers.map((driver) => (
            <RateRow
              key={driver.key}
              driver={driver}
              canManage={canManage}
              reason={reason}
              onChanged={onChanged}
            />
          ))}
        </ul>
      </section>

      <section className={`${card} p-4`} aria-labelledby="fixed-heading">
        <h2 id="fixed-heading" className="text-base font-semibold text-foreground">
          Fixed monthly costs
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Flat bills (servers, database plan), each shared out by what actually uses it.
        </p>
        <ul className="mt-4 divide-y divide-border">
          {rateCard.fixedCosts.length === 0 ? (
            <li className="py-3 text-sm text-muted-foreground">No fixed costs recorded yet.</li>
          ) : null}
          {rateCard.fixedCosts.map((line) => (
            <FixedCostRow
              key={line.id}
              line={line}
              allocationLabel={allocationLabel.get(line.allocationKey) ?? line.allocationKey}
              canManage={canManage}
              reason={reason}
              onChanged={onChanged}
            />
          ))}
        </ul>
        {canManage ? (
          <AddFixedCostForm
            allocationKeys={rateCard.allocationKeys}
            reason={reason}
            onChanged={onChanged}
          />
        ) : null}
      </section>
    </div>
  );
}

function RateRow({
  driver,
  canManage,
  reason,
  onChanged,
}: {
  driver: CostRateCardView["drivers"][number];
  canManage: boolean;
  reason: string;
  onChanged: () => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const [from, setFrom] = useState(currentMonth);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: SyntheticEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await platformApi.post(
        "/api/v1/platform/costs/rates",
        { driver: driver.key, unitCostUsd: value.trim(), effectiveFrom: from, reason: note.trim() },
        reason,
        "platform-cost-rate",
      );
      setEditing(false);
      setValue("");
      setNote("");
      await onChanged();
    } catch (err) {
      setError(errorMessage(err, "Could not save the rate."));
    } finally {
      setSaving(false);
    }
  }

  const fieldId = `rate-${driver.key}`;

  return (
    <li className="py-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-foreground">{driver.label}</p>
          <p className="text-xs text-muted-foreground">per {driver.unit}</p>
        </div>
        <div className="text-right">
          {driver.current ? (
            <>
              <p className="text-sm tabular-nums text-foreground">
                {formatRate(driver.current.unitCostUsd)}
              </p>
              <p className="text-xs text-muted-foreground">
                since {formatMonth(driver.current.effectiveFrom)}
              </p>
            </>
          ) : (
            // Warning is a tint, not the text colour: the warning token on a light
            // card is about 3:1, below the 4.5:1 small text needs.
            <p className="inline-flex rounded-md bg-warning/10 px-2 py-0.5 text-xs font-medium text-foreground">
              Not set
            </p>
          )}
        </div>
      </div>

      {canManage && !editing ? (
        <button
          type="button"
          className={`${quietButton} mt-2`}
          onClick={() => {
            setEditing(true);
            setValue(
              driver.suggestion && !driver.current ? String(driver.suggestion.unitCostUsd) : "",
            );
            if (driver.suggestion && !driver.current) setNote(driver.suggestion.source);
          }}
        >
          {driver.current ? "Change rate" : "Set rate"}
        </button>
      ) : null}

      {editing ? (
        <form className="mt-3 space-y-3" onSubmit={(event) => void submit(event)}>
          {driver.suggestion ? (
            <p className="text-xs text-muted-foreground">
              Suggested {formatRate(driver.suggestion.unitCostUsd)}: {driver.suggestion.source}{" "}
              Check it against your own invoice before saving.
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              No suggestion: on a fixed-price server this costs nothing extra per unit. Record the
              server as a fixed cost shared by API requests instead.
            </p>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm" htmlFor={`${fieldId}-value`}>
              <span className="text-muted-foreground">USD per {driver.unit}</span>
              <input
                id={`${fieldId}-value`}
                className={input}
                inputMode="decimal"
                required
                pattern="\d{1,8}(\.\d{1,6})?"
                value={value}
                onChange={(event) => {
                  setValue(event.target.value);
                }}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm" htmlFor={`${fieldId}-from`}>
              <span className="text-muted-foreground">Applies from</span>
              <input
                id={`${fieldId}-from`}
                type="month"
                className={input}
                required
                value={from}
                onChange={(event) => {
                  setFrom(event.target.value);
                }}
              />
            </label>
          </div>
          <label className="flex flex-col gap-1 text-sm" htmlFor={`${fieldId}-note`}>
            <span className="text-muted-foreground">Source (invoice, price page)</span>
            <input
              id={`${fieldId}-note`}
              className={input}
              required
              minLength={10}
              maxLength={1000}
              value={note}
              onChange={(event) => {
                setNote(event.target.value);
              }}
            />
          </label>
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
          <div className="flex gap-2">
            <button type="submit" className={primaryButton} disabled={saving}>
              {saving ? "Saving…" : "Save rate"}
            </button>
            <button
              type="button"
              className={quietButton}
              onClick={() => {
                setEditing(false);
                setError(null);
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      ) : null}
    </li>
  );
}

function FixedCostRow({
  line,
  allocationLabel,
  canManage,
  reason,
  onChanged,
}: {
  line: CostRateCardView["fixedCosts"][number];
  allocationLabel: string;
  canManage: boolean;
  reason: string;
  onChanged: () => Promise<void>;
}) {
  const [ending, setEnding] = useState(false);
  const [until, setUntil] = useState(currentMonth);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: SyntheticEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await platformApi.post(
        `/api/v1/platform/costs/fixed/${line.id}/end`,
        { effectiveUntil: until, reason: note.trim() },
        reason,
        "platform-fixed-cost-end",
      );
      setEnding(false);
      await onChanged();
    } catch (err) {
      setError(errorMessage(err, "Could not end this cost."));
    } finally {
      setSaving(false);
    }
  }

  const ended = line.effectiveUntil !== null;

  return (
    <li className="py-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p
            className={`text-sm font-medium ${ended ? "text-muted-foreground" : "text-foreground"}`}
          >
            {line.label}
          </p>
          <p className="text-xs text-muted-foreground">
            Shared by {allocationLabel.toLowerCase()} · {formatMonth(line.effectiveFrom)}
            {ended && line.effectiveUntil ? ` to ${formatMonth(line.effectiveUntil)}` : " onwards"}
          </p>
        </div>
        <p className="text-sm tabular-nums text-foreground">
          {formatUsd(line.monthlyCostUsd)}
          <span className="text-xs text-muted-foreground"> /mo</span>
        </p>
      </div>
      {canManage && !ended && !ending ? (
        <button
          type="button"
          className={`${quietButton} mt-2`}
          onClick={() => {
            setEnding(true);
          }}
        >
          End this cost
        </button>
      ) : null}
      {ending ? (
        <form className="mt-3 space-y-3" onSubmit={(event) => void submit(event)}>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm" htmlFor={`end-${line.id}-until`}>
              <span className="text-muted-foreground">Last month it applies to</span>
              <input
                id={`end-${line.id}-until`}
                type="month"
                className={input}
                required
                min={line.effectiveFrom}
                value={until}
                onChange={(event) => {
                  setUntil(event.target.value);
                }}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm" htmlFor={`end-${line.id}-note`}>
              <span className="text-muted-foreground">Why</span>
              <input
                id={`end-${line.id}-note`}
                className={input}
                required
                minLength={10}
                value={note}
                onChange={(event) => {
                  setNote(event.target.value);
                }}
              />
            </label>
          </div>
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
          <div className="flex gap-2">
            <button type="submit" className={primaryButton} disabled={saving}>
              {saving ? "Saving…" : "End cost"}
            </button>
            <button
              type="button"
              className={quietButton}
              onClick={() => {
                setEnding(false);
                setError(null);
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      ) : null}
    </li>
  );
}

function AddFixedCostForm({
  allocationKeys,
  reason,
  onChanged,
}: {
  allocationKeys: CostRateCardView["allocationKeys"];
  reason: string;
  onChanged: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState("");
  const [allocationKey, setAllocationKey] = useState<AllocationKey>("api_requests");
  const [from, setFrom] = useState(currentMonth);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: SyntheticEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await platformApi.post(
        "/api/v1/platform/costs/fixed",
        {
          label: label.trim(),
          monthlyCostUsd: amount.trim(),
          allocationKey,
          effectiveFrom: from,
          reason: note.trim(),
        },
        reason,
        "platform-fixed-cost-create",
      );
      setOpen(false);
      setLabel("");
      setAmount("");
      setNote("");
      await onChanged();
    } catch (err) {
      setError(errorMessage(err, "Could not add the cost."));
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        className={`${quietButton} mt-3`}
        onClick={() => {
          setOpen(true);
        }}
      >
        Add fixed cost
      </button>
    );
  }

  return (
    <form
      className="mt-4 space-y-3 border-t border-border pt-4"
      onSubmit={(event) => void submit(event)}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm" htmlFor="fixed-label">
          <span className="text-muted-foreground">Name</span>
          <input
            id="fixed-label"
            className={input}
            required
            minLength={2}
            maxLength={120}
            placeholder="e.g. App server"
            value={label}
            onChange={(event) => {
              setLabel(event.target.value);
            }}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm" htmlFor="fixed-amount">
          <span className="text-muted-foreground">USD per month</span>
          <input
            id="fixed-amount"
            className={input}
            inputMode="decimal"
            required
            pattern="\d{1,10}(\.\d{1,2})?"
            value={amount}
            onChange={(event) => {
              setAmount(event.target.value);
            }}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm" htmlFor="fixed-key">
          <span className="text-muted-foreground">Share it by</span>
          <select
            id="fixed-key"
            className={input}
            value={allocationKey}
            onChange={(event) => {
              setAllocationKey(event.target.value as AllocationKey);
            }}
          >
            {allocationKeys.map((entry) => (
              <option key={entry.key} value={entry.key}>
                {entry.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm" htmlFor="fixed-from">
          <span className="text-muted-foreground">Applies from</span>
          <input
            id="fixed-from"
            type="month"
            className={input}
            required
            value={from}
            onChange={(event) => {
              setFrom(event.target.value);
            }}
          />
        </label>
      </div>
      <label className="flex flex-col gap-1 text-sm" htmlFor="fixed-note">
        <span className="text-muted-foreground">Source (invoice, plan name)</span>
        <input
          id="fixed-note"
          className={input}
          required
          minLength={10}
          maxLength={1000}
          value={note}
          onChange={(event) => {
            setNote(event.target.value);
          }}
        />
      </label>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <div className="flex gap-2">
        <button type="submit" className={primaryButton} disabled={saving}>
          {saving ? "Saving…" : "Add cost"}
        </button>
        <button
          type="button"
          className={quietButton}
          onClick={() => {
            setOpen(false);
            setError(null);
          }}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
