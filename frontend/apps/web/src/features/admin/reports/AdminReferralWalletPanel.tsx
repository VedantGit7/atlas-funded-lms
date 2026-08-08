"use client";

import {
  AlertTriangle,
  CalendarDays,
  Copy,
  Download,
  ExternalLink,
  Gift,
  Mail,
  Minus,
  RefreshCw,
  Search,
  Settings,
  TrendingDown,
  TrendingUp,
  Users,
  Wallet,
  X,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type MouseEvent } from "react";
import { Select } from "@atlas/design-system";
import { ClientApiError } from "../../../lib/client-api";
import { REFERRAL_HREF } from "../grow/referral-shared";
import {
  createSalesMarketingGroup,
  dateInputToEndIso,
  dateInputToStartIso,
  exportSalesMarketingReport,
  fetchReferralWallet,
  fetchReferredLearners,
  sendSalesMarketingMessage,
  type ReferralWalletItem,
  type ReferralWalletPayload,
  type ReferralWalletSummary,
  type ReferredLearnerItem,
  type ReferredLearnersPayload,
} from "./admin-sales-marketing-roster-api";
import { downloadReportExport, pollReportRunUntilComplete } from "./admin-reports-api";

function defined<T>(value: T, message = "Expected value to be defined"): NonNullable<T> {
  if (value == null) {
    throw new Error(message);
  }
  return value;
}

type CohortTab = "group" | "message";
type MembershipMode = "static" | "live";

type ReferralSortBy =
  | "successful_referrals"
  | "credit_earned"
  | "wallet_balance"
  | "referred_revenue_cents"
  | "signed_up_at"
  | "learner_name";

const SORT_OPTIONS: Array<{ value: ReferralSortBy; label: string }> = [
  { value: "successful_referrals", label: "Successful referrals" },
  { value: "credit_earned", label: "Credit earned" },
  { value: "wallet_balance", label: "Wallet balance" },
  { value: "referred_revenue_cents", label: "Revenue attributed" },
  { value: "signed_up_at", label: "Signed up" },
  { value: "learner_name", label: "Learner name" },
];

function defaultActivityRange(days = 30): { from: string; to: string } {
  const to = new Date();
  const from = new Date(to.getTime() - days * 24 * 60 * 60 * 1000);
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
}

function formatMoneyAmount(cents: number): string {
  return (cents / 100).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatCredits(value: number): string {
  return value.toLocaleString();
}

function formatShortDate(iso: string | null): string {
  if (!iso) return "—";
  const date = new Date(iso.includes("T") ? iso : `${iso}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function initials(name: string | null, email: string | null): string {
  const source = (name?.trim() || email?.trim() || "?").replace(/\s+/g, " ");
  const parts = source.split(" ").filter(Boolean);
  if (parts.length >= 2) {
    return `${defined(parts[0])[0] ?? ""}${defined(parts[1])[0] ?? ""}`.toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
}

function referralStatusPillClass(status: ReferredLearnerItem["status"]): string {
  if (status === "QUALIFIED") {
    return "bg-[color-mix(in_srgb,var(--admin-success)_12%,transparent)] text-[var(--admin-success)]";
  }
  if (status === "PENDING") {
    return "bg-[color-mix(in_srgb,var(--admin-warning)_12%,transparent)] text-[var(--admin-warning)]";
  }
  return "bg-[color-mix(in_srgb,var(--admin-danger)_12%,transparent)] text-[var(--admin-danger)]";
}

function referralStatusLabel(status: ReferredLearnerItem["status"]): string {
  return status.charAt(0) + status.slice(1).toLowerCase();
}

async function copyToClipboard(value: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    return false;
  }
}

function Shimmer({ className }: { className?: string }) {
  return (
    <div
      className={[
        "relative overflow-hidden rounded bg-[var(--admin-surface-high)]",
        "after:absolute after:inset-0 after:-translate-x-full after:animate-[shimmer_1.8s_infinite]",
        "after:bg-gradient-to-r after:from-transparent after:via-[color-mix(in_srgb,var(--admin-on-surface)_8%,transparent)] after:to-transparent",
        className ?? "",
      ].join(" ")}
    />
  );
}

function ChangePill({ value, windowLabel }: { value: number | null; windowLabel?: string }) {
  if (value == null) {
    return (
      <span className="inline-flex items-center gap-0.5 rounded bg-[var(--admin-surface-high)] px-1.5 py-0.5 font-mono text-[11px] text-[var(--admin-on-surface-variant)]">
        <Minus className="h-3 w-3" aria-hidden="true" />—
        {windowLabel ? <span className="sr-only"> vs previous {windowLabel}</span> : null}
      </span>
    );
  }
  const up = value >= 0;
  return (
    <span
      className={[
        "inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 font-mono text-[11px] font-medium",
        up
          ? "bg-[color-mix(in_srgb,var(--admin-success)_12%,transparent)] text-[var(--admin-success)]"
          : "bg-[color-mix(in_srgb,var(--admin-danger)_12%,transparent)] text-[var(--admin-danger)]",
      ].join(" ")}
      title={windowLabel ? `vs previous ${windowLabel}` : undefined}
    >
      {up ? (
        <TrendingUp className="h-3 w-3" aria-hidden="true" />
      ) : (
        <TrendingDown className="h-3 w-3" aria-hidden="true" />
      )}
      {up ? "+" : ""}
      {value}%
    </span>
  );
}

function ReferralWalletSkeleton() {
  return (
    <div
      className="flex flex-col gap-6"
      aria-busy="true"
      aria-label="Loading referral and wallet data"
    >
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
        <div className="space-y-2">
          <Shimmer className="h-8 w-52" />
          <Shimmer className="h-4 w-96 max-w-full" />
        </div>
        <div className="flex flex-wrap gap-2">
          <Shimmer className="h-9 w-44" />
          <Shimmer className="h-9 w-28" />
          <Shimmer className="h-9 w-32" />
          <Shimmer className="h-9 w-32" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-border)] sm:grid-cols-3 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, index) => (
          <div
            key={index}
            className={[
              "bg-[var(--admin-surface)] p-4",
              index === 0 ? "col-span-2 sm:col-span-1 lg:col-span-2" : "",
            ].join(" ")}
          >
            <Shimmer className="mb-3 h-3 w-24" />
            <Shimmer className="h-8 w-28" />
            <Shimmer className="mt-2 h-3 w-32" />
          </div>
        ))}
      </div>
      <div className="overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)]">
        <div className="flex flex-wrap gap-3 border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-4">
          <Shimmer className="h-9 w-48" />
          <Shimmer className="h-9 w-36" />
          <Shimmer className="h-9 w-36" />
          <Shimmer className="h-9 w-40" />
          <Shimmer className="h-9 w-20" />
        </div>
        <div className="divide-y divide-[var(--admin-border)]">
          {Array.from({ length: 8 }).map((_, index) => (
            <div key={index} className="flex h-11 items-center gap-4 px-4">
              <Shimmer className="h-4 w-4" />
              <Shimmer className="h-7 w-7 rounded-full" />
              <Shimmer className="h-4 flex-1" />
              <Shimmer className="h-4 w-20" />
              <Shimmer className="h-4 w-16" />
              <Shimmer className="h-4 w-24" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function AdminReferralWalletPanel() {
  const initialRange = useMemo(() => defaultActivityRange(30), []);

  const [payload, setPayload] = useState<ReferralWalletPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [activityFrom, setActivityFrom] = useState(initialRange.from);
  const [activityTo, setActivityTo] = useState(initialRange.to);

  const [searchQ, setSearchQ] = useState("");
  const [draftQ, setDraftQ] = useState("");
  const [signedUpFrom, setSignedUpFrom] = useState("");
  const [signedUpTo, setSignedUpTo] = useState("");
  const [draftSignedUpFrom, setDraftSignedUpFrom] = useState("");
  const [draftSignedUpTo, setDraftSignedUpTo] = useState("");
  const [sortBy, setSortBy] = useState<ReferralSortBy>("successful_referrals");
  const [draftSortBy, setDraftSortBy] = useState<ReferralSortBy>("successful_referrals");
  const [page, setPage] = useState(1);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [cohortDrawerOpen, setCohortDrawerOpen] = useState(false);
  const [cohortTab, setCohortTab] = useState<CohortTab>("group");
  const [groupName, setGroupName] = useState("");
  const [groupDescription, setGroupDescription] = useState("");
  const [membershipMode, setMembershipMode] = useState<MembershipMode>("static");
  const [messageSubject, setMessageSubject] = useState("");
  const [messageBody, setMessageBody] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);

  const [copiedCodeId, setCopiedCodeId] = useState<string | null>(null);

  const [referralsDrawerOpen, setReferralsDrawerOpen] = useState(false);
  const [activeReferrerId, setActiveReferrerId] = useState<string | null>(null);
  const [referredPayload, setReferredPayload] = useState<ReferredLearnersPayload | null>(null);
  const [referredLoading, setReferredLoading] = useState(false);
  const [referredError, setReferredError] = useState<string | null>(null);
  const [referredPage, setReferredPage] = useState(1);

  const filtersActive = Boolean(searchQ.trim()) || Boolean(signedUpFrom) || Boolean(signedUpTo);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchReferralWallet({
        q: searchQ.trim() || undefined,
        signedUpFrom: dateInputToStartIso(signedUpFrom),
        signedUpTo: dateInputToEndIso(signedUpTo),
        activityFrom: dateInputToStartIso(activityFrom),
        activityTo: dateInputToEndIso(activityTo),
        sortBy,
        sortDir: "desc",
        page,
        limit: 25,
      });
      setPayload(response.data);
    } catch (loadError) {
      setPayload(null);
      setError(
        loadError instanceof ClientApiError
          ? loadError.message
          : loadError instanceof Error
            ? loadError.message
            : "Couldn't load referral and wallet data.",
      );
    } finally {
      setLoading(false);
    }
  }, [activityFrom, activityTo, page, searchQ, signedUpFrom, signedUpTo, sortBy]);

  const loadReferred = useCallback(async (membershipId: string, referredPageNum: number) => {
    setReferredLoading(true);
    setReferredError(null);
    try {
      const response = await fetchReferredLearners(membershipId, {
        page: referredPageNum,
        limit: 25,
      });
      setReferredPayload(response.data);
    } catch (loadError) {
      setReferredPayload(null);
      setReferredError(
        loadError instanceof ClientApiError
          ? loadError.message
          : loadError instanceof Error
            ? loadError.message
            : "Couldn't load referred learners.",
      );
    } finally {
      setReferredLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!cohortDrawerOpen) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setCohortDrawerOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }, [cohortDrawerOpen]);

  useEffect(() => {
    if (!referralsDrawerOpen) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setReferralsDrawerOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }, [referralsDrawerOpen]);

  useEffect(() => {
    if (!cohortDrawerOpen || !payload) return;
    setGroupName(`Referrers — ${payload.summary.windowLabel}`);
    setGroupDescription("");
    setMembershipMode("static");
    setMessageSubject("");
    setMessageBody("");
    setActionError(null);
    setCohortTab("group");
  }, [cohortDrawerOpen, payload]);

  useEffect(() => {
    if (!referralsDrawerOpen || !activeReferrerId) return;
    void loadReferred(activeReferrerId, referredPage);
  }, [activeReferrerId, loadReferred, referredPage, referralsDrawerOpen]);

  function applyFilters() {
    setSearchQ(draftQ);
    setSignedUpFrom(draftSignedUpFrom);
    setSignedUpTo(draftSignedUpTo);
    setSortBy(draftSortBy);
    setPage(1);
    setSelectedIds(new Set());
  }

  function clearAllFilters() {
    setDraftQ("");
    setDraftSignedUpFrom("");
    setDraftSignedUpTo("");
    setDraftSortBy("successful_referrals");
    setSearchQ("");
    setSignedUpFrom("");
    setSignedUpTo("");
    setSortBy("successful_referrals");
    setPage(1);
    setSelectedIds(new Set());
  }

  function openReferralsDrawer(item: ReferralWalletItem, event?: MouseEvent) {
    event?.stopPropagation();
    setActiveReferrerId(item.membershipId);
    setReferredPage(1);
    setReferredPayload(null);
    setReferredError(null);
    setReferralsDrawerOpen(true);
  }

  function openCohortDrawer(tab: CohortTab) {
    setCohortTab(tab);
    setCohortDrawerOpen(true);
  }

  function toggleSelectAllOnPage(items: ReferralWalletItem[]) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      const allSelected = items.length > 0 && items.every((item) => next.has(item.membershipId));
      if (allSelected) {
        for (const item of items) next.delete(item.membershipId);
      } else {
        for (const item of items) next.add(item.membershipId);
      }
      return next;
    });
  }

  function toggleRow(membershipId: string, event?: MouseEvent) {
    event?.stopPropagation();
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(membershipId)) next.delete(membershipId);
      else next.add(membershipId);
      return next;
    });
  }

  async function handleCopyCode(item: ReferralWalletItem, event: MouseEvent) {
    event.stopPropagation();
    const code = item.referralCode?.trim();
    if (!code) return;
    const ok = await copyToClipboard(code);
    if (ok) {
      setCopiedCodeId(item.membershipId);
      window.setTimeout(() => {
        setCopiedCodeId((current) => (current === item.membershipId ? null : current));
      }, 1500);
    }
  }

  async function handleExport() {
    setBusy(true);
    setError(null);
    try {
      const response = await exportSalesMarketingReport({
        section: "referral-wallet",
        q: searchQ.trim() || undefined,
        signedUpFrom: dateInputToStartIso(signedUpFrom),
        signedUpTo: dateInputToEndIso(signedUpTo),
        activityFrom: dateInputToStartIso(activityFrom),
        activityTo: dateInputToEndIso(activityTo),
        sortBy,
        sortDir: "desc",
        emailDownloadLink: true,
      });
      const completed = await pollReportRunUntilComplete(response.data.runId);
      if (completed.status === "failed") {
        throw new Error(completed.errorMessage ?? "Export failed.");
      }
      if (completed.status === "completed") {
        await downloadReportExport(completed.id, "csv");
      }
    } catch (exportError) {
      setError(
        exportError instanceof ClientApiError
          ? exportError.message
          : exportError instanceof Error
            ? exportError.message
            : "Unable to export report.",
      );
    } finally {
      setBusy(false);
    }
  }

  function cohortFilterBody() {
    const selected = [...selectedIds];
    if (selected.length > 0) {
      return { membershipIds: selected };
    }
    return {
      ...(searchQ.trim() ? { q: searchQ.trim() } : {}),
      signedUpFrom: dateInputToStartIso(signedUpFrom),
      signedUpTo: dateInputToEndIso(signedUpTo),
      activityFrom: dateInputToStartIso(activityFrom),
      activityTo: dateInputToEndIso(activityTo),
    };
  }

  async function handleCreateGroup() {
    if (!payload || !groupName.trim() || membershipMode === "live") return;
    setBusy(true);
    setActionError(null);
    try {
      await createSalesMarketingGroup({
        title: groupName.trim(),
        ...(groupDescription.trim() ? { description: groupDescription.trim() } : {}),
        ...cohortFilterBody(),
      });
      setCohortDrawerOpen(false);
    } catch (groupError) {
      setActionError(
        groupError instanceof ClientApiError
          ? groupError.message
          : groupError instanceof Error
            ? groupError.message
            : "Unable to create group.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleSendMessage() {
    if (!messageSubject.trim() || !messageBody.trim()) return;
    setBusy(true);
    setActionError(null);
    try {
      await sendSalesMarketingMessage({
        subject: messageSubject.trim(),
        message: messageBody.trim(),
        ...cohortFilterBody(),
      });
      setCohortDrawerOpen(false);
    } catch (messageError) {
      setActionError(
        messageError instanceof ClientApiError
          ? messageError.message
          : messageError instanceof Error
            ? messageError.message
            : "Unable to send message.",
      );
    } finally {
      setBusy(false);
    }
  }

  const summary: ReferralWalletSummary | null = payload?.summary ?? null;
  const items = payload?.items ?? [];
  const pageInfo = payload?.pageInfo;
  const isEmpty =
    !loading && !error && payload != null && pageInfo != null && pageInfo.totalCount === 0;
  const isTrulyEmpty = isEmpty && !filtersActive && (summary?.referrerCount ?? 0) === 0;
  const isFilteredEmpty = isEmpty && (filtersActive || (summary?.referrerCount ?? 0) > 0);
  const allOnPageSelected =
    items.length > 0 && items.every((item) => selectedIds.has(item.membershipId));
  const selectedCount = selectedIds.size;
  const matchCount = selectedCount > 0 ? selectedCount : (pageInfo?.totalCount ?? 0);

  const filterChips = useMemo(() => {
    const chips: string[] = [];
    if (activityFrom || activityTo) {
      chips.push(`Activity: ${activityFrom || "…"} – ${activityTo || "…"}`);
    }
    if (signedUpFrom || signedUpTo) {
      chips.push(`Signed up: ${signedUpFrom || "…"} – ${signedUpTo || "…"}`);
    }
    if (searchQ.trim()) chips.push(`Search: ${searchQ.trim()}`);
    return chips;
  }, [activityFrom, activityTo, searchQ, signedUpFrom, signedUpTo]);

  if (loading && !payload) {
    return <ReferralWalletSkeleton />;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-[-0.01em] text-[var(--admin-on-surface)]">
            Referral &amp; wallet
          </h1>
          <p className="mt-1 max-w-2xl text-xs text-[var(--admin-on-surface-variant)]">
            Referrer performance, wallet credit earned and outstanding, and revenue attributed to
            referral codes in the selected activity window.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="inline-flex h-9 items-center gap-2 rounded border border-[var(--admin-outline)] bg-[var(--admin-surface)] px-3 text-xs text-[var(--admin-on-surface)] transition-colors hover:bg-[var(--admin-surface-high)]">
            <CalendarDays
              className="h-4 w-4 text-[var(--admin-on-surface-variant)]"
              aria-hidden="true"
            />
            <span className="sr-only">Activity from</span>
            <input
              type="date"
              value={activityFrom}
              onChange={(event) => {
                setActivityFrom(event.target.value);
                setPage(1);
              }}
              className="bg-transparent outline-none"
            />
            <span className="text-[var(--admin-on-surface-variant)]">–</span>
            <span className="sr-only">Activity to</span>
            <input
              type="date"
              value={activityTo}
              onChange={(event) => {
                setActivityTo(event.target.value);
                setPage(1);
              }}
              className="bg-transparent outline-none"
            />
          </label>

          <button
            type="button"
            className="inline-flex h-9 items-center gap-2 rounded border border-[var(--admin-outline)] bg-[var(--admin-surface)] px-3 text-xs font-medium text-[var(--admin-on-surface)] transition-colors hover:bg-[var(--admin-surface-high)] active:translate-y-px disabled:opacity-50"
            onClick={() => void handleExport()}
            disabled={busy || loading || Boolean(error)}
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            Export CSV
          </button>

          <Link
            href={REFERRAL_HREF}
            className="inline-flex h-9 items-center gap-2 rounded border border-[var(--admin-outline)] bg-[var(--admin-surface)] px-3 text-xs font-medium text-[var(--admin-on-surface)] transition-colors hover:bg-[var(--admin-surface-high)] active:translate-y-px"
          >
            <Settings className="h-4 w-4" aria-hidden="true" />
            Referral settings
          </Link>

          <button
            type="button"
            className="inline-flex h-9 items-center gap-2 rounded bg-[var(--admin-primary-strong)] px-4 text-xs font-medium text-[var(--admin-on-primary)] transition-colors hover:bg-[var(--admin-primary)] active:translate-y-px disabled:opacity-50"
            onClick={() => {
              openCohortDrawer("group");
            }}
            disabled={!payload || Boolean(error)}
          >
            <Users className="h-4 w-4" aria-hidden="true" />
            Cohort actions
          </button>
        </div>
      </div>

      {error ? (
        <div
          className="flex flex-col gap-4 rounded border border-[color-mix(in_srgb,var(--admin-danger)_30%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-danger)_10%,var(--admin-surface))] p-4 sm:flex-row sm:items-center sm:justify-between"
          role="alert"
        >
          <div className="flex items-start gap-3">
            <AlertTriangle
              className="mt-0.5 h-5 w-5 shrink-0 text-[var(--admin-danger)]"
              aria-hidden="true"
            />
            <div>
              <h2 className="text-base font-semibold text-[var(--admin-danger)]">
                Couldn&apos;t load referral and wallet data.
              </h2>
              <p className="mt-0.5 text-sm text-[color-mix(in_srgb,var(--admin-danger)_80%,var(--admin-on-surface))]">
                {error}
              </p>
            </div>
          </div>
          <button
            type="button"
            className="inline-flex h-9 shrink-0 items-center gap-2 rounded border border-[var(--admin-danger)] px-4 text-xs font-medium text-[var(--admin-danger)] transition-colors hover:bg-[color-mix(in_srgb,var(--admin-danger)_8%,transparent)] active:translate-y-px"
            onClick={() => void load()}
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Retry
          </button>
        </div>
      ) : null}

      {error ? (
        <div className="pointer-events-none opacity-30">
          <ReferralWalletSkeleton />
        </div>
      ) : null}

      {!error && summary ? (
        <>
          <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-border)] sm:grid-cols-3 lg:grid-cols-5">
            <div className="col-span-2 bg-[var(--admin-surface)] p-4 sm:col-span-1 lg:col-span-2">
              <p className="mb-1 text-xs text-[var(--admin-on-surface-variant)]">
                Successful referrals
              </p>
              <div className="flex flex-wrap items-end gap-2">
                <p className="font-mono text-[28px] font-semibold leading-tight tracking-tight text-[var(--admin-on-surface)]">
                  {summary.successfulReferrals.toLocaleString()}
                </p>
                <ChangePill value={summary.changePercent} windowLabel={summary.windowLabel} />
              </div>
              <p className="mt-2 text-[11px] text-[var(--admin-on-surface-variant)]">
                {summary.previousSuccessfulReferrals.toLocaleString()} in previous{" "}
                {summary.windowLabel}
              </p>
            </div>

            <div className="bg-[var(--admin-surface)] p-4">
              <p className="mb-1 text-xs text-[var(--admin-on-surface-variant)]">Credit earned</p>
              <p className="font-mono text-2xl font-semibold text-[var(--admin-on-surface)]">
                {formatCredits(summary.creditEarned)}
                <span className="ml-1.5 text-sm font-normal text-[var(--admin-on-surface-variant)]">
                  credits
                </span>
              </p>
              <p className="mt-2 text-[11px] text-[var(--admin-on-surface-variant)]">
                wallet credit, not cash
              </p>
            </div>

            <div className="border-l-4 border-[var(--admin-warning)] bg-[var(--admin-surface)] p-4 pl-3">
              <p className="mb-1 text-xs text-[var(--admin-on-surface-variant)]">
                Credit outstanding
              </p>
              <p className="font-mono text-2xl font-semibold text-[var(--admin-warning)]">
                {formatCredits(summary.creditOutstanding)}
                <span className="ml-1.5 text-sm font-normal text-[var(--admin-on-surface-variant)]">
                  credits
                </span>
              </p>
              <p className="mt-2 text-[11px] text-[var(--admin-on-surface-variant)]">
                held in {summary.walletsWithBalance.toLocaleString()} wallet
                {summary.walletsWithBalance === 1 ? "" : "s"}
              </p>
            </div>

            <div className="col-span-2 bg-[var(--admin-surface)] p-4 sm:col-span-1 lg:col-span-1">
              <p className="mb-1 text-xs text-[var(--admin-on-surface-variant)]">
                Referred revenue
              </p>
              <p className="font-mono text-2xl font-semibold text-[var(--admin-on-surface)]">
                {formatMoneyAmount(summary.referredRevenueCents)}
                <span className="ml-1.5 text-sm font-normal text-[var(--admin-on-surface-variant)]">
                  {summary.currency}
                </span>
              </p>
              <p className="mt-2 text-[11px] text-[var(--admin-on-surface-variant)]">
                {summary.referrerCount.toLocaleString()} of {summary.totalLearners.toLocaleString()}{" "}
                learners
              </p>
            </div>
          </div>

          <div className="overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-sm">
            <div className="flex flex-col gap-3 border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-4 md:flex-row md:flex-wrap md:items-end md:justify-between">
              <div className="flex flex-wrap gap-3">
                <label className="relative flex flex-col gap-1.5">
                  <span className="text-xs text-[var(--admin-on-surface-variant)]">Search</span>
                  <span className="relative">
                    <Search
                      className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--admin-on-surface-variant)]"
                      aria-hidden="true"
                    />
                    <input
                      value={draftQ}
                      onChange={(event) => {
                        setDraftQ(event.target.value);
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") applyFilters();
                      }}
                      placeholder="Name, email, or code…"
                      className="h-9 w-56 rounded border border-[var(--admin-outline)] bg-[var(--admin-surface)] pl-8 pr-3 text-sm text-[var(--admin-on-surface)] outline-none placeholder:text-[var(--admin-on-surface-variant)] focus:border-[var(--admin-primary)] focus:ring-1 focus:ring-[var(--admin-primary)]"
                    />
                  </span>
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs text-[var(--admin-on-surface-variant)]">
                    Signed up from
                  </span>
                  <input
                    type="date"
                    value={draftSignedUpFrom}
                    onChange={(event) => {
                      setDraftSignedUpFrom(event.target.value);
                    }}
                    className="h-9 rounded border border-[var(--admin-outline)] bg-[var(--admin-surface)] px-3 text-sm text-[var(--admin-on-surface)] outline-none focus:border-[var(--admin-primary)] focus:ring-1 focus:ring-[var(--admin-primary)]"
                  />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs text-[var(--admin-on-surface-variant)]">
                    Signed up to
                  </span>
                  <input
                    type="date"
                    value={draftSignedUpTo}
                    onChange={(event) => {
                      setDraftSignedUpTo(event.target.value);
                    }}
                    className="h-9 rounded border border-[var(--admin-outline)] bg-[var(--admin-surface)] px-3 text-sm text-[var(--admin-on-surface)] outline-none focus:border-[var(--admin-primary)] focus:ring-1 focus:ring-[var(--admin-primary)]"
                  />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs text-[var(--admin-on-surface-variant)]">Sort by</span>
                  <Select
                    value={draftSortBy}
                    onValueChange={(value) => {
                      setDraftSortBy(value as ReferralSortBy);
                    }}
                    options={SORT_OPTIONS}
                    ariaLabel="Sort referrers"
                    className="h-9 min-w-[180px]"
                  />
                </label>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="inline-flex h-9 items-center rounded bg-[var(--admin-primary-strong)] px-4 text-xs font-medium text-[var(--admin-on-primary)] transition-colors hover:bg-[var(--admin-primary)] active:translate-y-px"
                  onClick={applyFilters}
                >
                  Apply
                </button>
                <button
                  type="button"
                  className="inline-flex h-9 w-9 items-center justify-center rounded border border-[var(--admin-outline)] text-[var(--admin-on-surface-variant)] transition-colors hover:bg-[var(--admin-surface-high)] active:translate-y-px"
                  title="Refresh"
                  onClick={() => void load()}
                >
                  <RefreshCw className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            </div>

            {selectedCount > 0 ? (
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--admin-border)] bg-[color-mix(in_srgb,var(--admin-primary)_6%,var(--admin-surface))] px-4 py-2.5">
                <p className="text-sm text-[var(--admin-on-surface)]">
                  <span className="font-mono font-semibold">{selectedCount}</span> selected
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="inline-flex h-8 items-center gap-1.5 rounded border border-[var(--admin-outline)] px-3 text-xs text-[var(--admin-on-surface)] transition-colors hover:bg-[var(--admin-surface-high)] active:translate-y-px"
                    onClick={() => {
                      openCohortDrawer("message");
                    }}
                  >
                    <Mail className="h-3.5 w-3.5" aria-hidden="true" />
                    Email
                  </button>
                  <button
                    type="button"
                    className="inline-flex h-8 items-center gap-1.5 rounded border border-[var(--admin-outline)] px-3 text-xs text-[var(--admin-on-surface)] transition-colors hover:bg-[var(--admin-surface-high)] active:translate-y-px"
                    onClick={() => {
                      openCohortDrawer("group");
                    }}
                  >
                    <Users className="h-3.5 w-3.5" aria-hidden="true" />
                    Create group
                  </button>
                  <button
                    type="button"
                    className="inline-flex h-8 items-center rounded border border-[var(--admin-outline)] px-3 text-xs text-[var(--admin-on-surface)] transition-colors hover:bg-[var(--admin-surface-high)] active:translate-y-px"
                    onClick={() => {
                      setSelectedIds(new Set());
                    }}
                  >
                    Clear
                  </button>
                </div>
              </div>
            ) : null}

            {isTrulyEmpty ? (
              <div className="flex min-h-[360px] flex-col items-center justify-center px-6 py-12 text-center">
                <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full border border-[var(--admin-border)] bg-[var(--admin-surface-low)] shadow-sm">
                  <Gift
                    className="h-8 w-8 text-[var(--admin-on-surface-variant)]"
                    strokeWidth={1.5}
                    aria-hidden="true"
                  />
                </div>
                <h2 className="text-base font-semibold text-[var(--admin-on-surface)]">
                  No referral activity in this window
                </h2>
                <p className="mt-2 max-w-md text-sm text-[var(--admin-on-surface-variant)]">
                  Referrers and wallet credit will appear here once learners start sharing codes and
                  earning credit. Configure referral rewards to get started.
                </p>
                <Link
                  href={REFERRAL_HREF}
                  className="mt-8 inline-flex h-10 items-center gap-2 rounded bg-[var(--admin-primary-strong)] px-5 text-sm font-medium text-[var(--admin-on-primary)] transition-colors hover:bg-[var(--admin-primary)] active:translate-y-px"
                >
                  <ExternalLink className="h-4 w-4" aria-hidden="true" />
                  Referral settings
                </Link>
              </div>
            ) : isFilteredEmpty ? (
              <div className="flex min-h-[360px] flex-col items-center justify-center px-6 py-12 text-center">
                <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full border border-[var(--admin-border)] bg-[var(--admin-surface-low)] shadow-sm">
                  <Search
                    className="h-8 w-8 text-[var(--admin-on-surface-variant)]"
                    strokeWidth={1.5}
                    aria-hidden="true"
                  />
                </div>
                <h2 className="text-base font-semibold text-[var(--admin-on-surface)]">
                  No referrers matched these filters
                </h2>
                <p className="mt-2 max-w-md text-sm text-[var(--admin-on-surface-variant)]">
                  Try clearing filters or widening the activity date range.
                </p>
                <button
                  type="button"
                  className="mt-8 inline-flex h-10 items-center gap-2 rounded bg-[var(--admin-primary-strong)] px-5 text-sm font-medium text-[var(--admin-on-primary)] transition-colors hover:bg-[var(--admin-primary)] active:translate-y-px"
                  onClick={clearAllFilters}
                >
                  Clear all filters
                </button>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-left">
                    <thead className="sticky top-0 z-10 border-b border-[var(--admin-border)] bg-[var(--admin-surface)]">
                      <tr>
                        <th className="w-10 px-4 py-3">
                          <input
                            type="checkbox"
                            className="h-4 w-4 accent-[var(--admin-primary)]"
                            checked={allOnPageSelected}
                            onChange={() => {
                              toggleSelectAllOnPage(items);
                            }}
                            aria-label="Select all on page"
                          />
                        </th>
                        <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]">
                          Learner
                        </th>
                        <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]">
                          Code
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]">
                          Successful
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]">
                          Credit earned
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]">
                          Wallet balance
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]">
                          Revenue attributed
                        </th>
                        <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]">
                          Signed up
                        </th>
                        <th className="w-28 px-4 py-3" />
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((item) => {
                        const selected = selectedIds.has(item.membershipId);
                        return (
                          <tr
                            key={item.membershipId}
                            className={[
                              "group cursor-pointer border-b border-[var(--admin-border)] transition-colors last:border-b-0",
                              selected
                                ? "bg-[color-mix(in_srgb,var(--admin-primary)_6%,var(--admin-surface))]"
                                : "hover:bg-[color-mix(in_srgb,var(--admin-surface-low)_70%,transparent)]",
                            ].join(" ")}
                            onClick={() => {
                              openReferralsDrawer(item);
                            }}
                          >
                            <td
                              className="h-11 px-4"
                              onClick={(event) => {
                                event.stopPropagation();
                              }}
                            >
                              <input
                                type="checkbox"
                                className="h-4 w-4 accent-[var(--admin-primary)]"
                                checked={selected}
                                onChange={() => {
                                  toggleRow(item.membershipId);
                                }}
                                aria-label={`Select ${item.learnerName ?? item.email ?? "referrer"}`}
                              />
                            </td>
                            <td className="h-11 px-4">
                              <div className="flex min-w-0 items-center gap-3">
                                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--admin-surface-high)] font-mono text-[10px] font-semibold text-[var(--admin-on-surface-variant)]">
                                  {initials(item.learnerName, item.email)}
                                </div>
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-medium text-[var(--admin-primary)]">
                                    {item.learnerName ?? "—"}
                                  </p>
                                  {item.email ? (
                                    <p className="truncate text-[11px] text-[var(--admin-on-surface-variant)]">
                                      {item.email}
                                    </p>
                                  ) : null}
                                </div>
                              </div>
                            </td>
                            <td className="h-11 px-4">
                              <div className="flex items-center gap-1.5">
                                <span className="font-mono text-xs uppercase text-[var(--admin-on-surface)]">
                                  {item.referralCode ?? "—"}
                                </span>
                                {item.referralCode ? (
                                  <button
                                    type="button"
                                    className="rounded p-0.5 text-[var(--admin-on-surface-variant)] opacity-0 transition-opacity hover:text-[var(--admin-primary)] group-hover:opacity-100"
                                    title={
                                      copiedCodeId === item.membershipId ? "Copied" : "Copy code"
                                    }
                                    onClick={(event) => void handleCopyCode(item, event)}
                                  >
                                    <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                                  </button>
                                ) : null}
                              </div>
                            </td>
                            <td className="h-11 px-4 text-right">
                              <button
                                type="button"
                                className="font-mono text-sm font-medium text-[var(--admin-primary)] underline-offset-2 hover:underline"
                                onClick={(event) => {
                                  openReferralsDrawer(item, event);
                                }}
                              >
                                {item.successfulReferrals.toLocaleString()}
                              </button>
                            </td>
                            <td className="h-11 px-4 text-right font-mono text-sm text-[var(--admin-on-surface)]">
                              {formatCredits(item.creditEarned)}
                            </td>
                            <td className="h-11 px-4 text-right font-mono text-sm text-[var(--admin-on-surface)]">
                              {formatCredits(item.walletBalance)}
                            </td>
                            <td className="h-11 px-4 text-right font-mono text-sm text-[var(--admin-on-surface)]">
                              {formatMoneyAmount(item.referredRevenueCents)}
                              <span className="ml-1 text-[10px] text-[var(--admin-on-surface-variant)]">
                                {summary.currency}
                              </span>
                            </td>
                            <td className="h-11 px-4 text-sm text-[var(--admin-on-surface-variant)]">
                              {formatShortDate(item.signedUpAt)}
                            </td>
                            <td className="h-11 px-4">
                              <button
                                type="button"
                                className="text-xs font-medium text-[var(--admin-primary)] opacity-0 transition-opacity group-hover:opacity-100"
                                onClick={(event) => {
                                  openReferralsDrawer(item, event);
                                }}
                              >
                                View referrals
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {pageInfo && pageInfo.totalPages > 0 ? (
                  <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-4 py-3 text-sm text-[var(--admin-on-surface-variant)]">
                    <p>
                      Showing {(pageInfo.page - 1) * pageInfo.pageSize + 1}–
                      {Math.min(pageInfo.page * pageInfo.pageSize, pageInfo.totalCount)} of{" "}
                      {pageInfo.totalCount} referrers
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        className="rounded border border-[var(--admin-outline)] px-3 py-1 transition-colors hover:bg-[var(--admin-surface-high)] active:translate-y-px disabled:opacity-50"
                        disabled={!pageInfo.hasPreviousPage || loading}
                        onClick={() => {
                          setPage((current) => Math.max(1, current - 1));
                        }}
                      >
                        Previous
                      </button>
                      <span className="font-mono text-xs">
                        {pageInfo.page} / {pageInfo.totalPages}
                      </span>
                      <button
                        type="button"
                        className="rounded border border-[var(--admin-outline)] px-3 py-1 transition-colors hover:bg-[var(--admin-surface-high)] active:translate-y-px disabled:opacity-50"
                        disabled={!pageInfo.hasNextPage || loading}
                        onClick={() => {
                          setPage((current) => current + 1);
                        }}
                      >
                        Next
                      </button>
                    </div>
                  </div>
                ) : null}
              </>
            )}
          </div>
        </>
      ) : null}

      {referralsDrawerOpen && activeReferrerId ? (
        <div className="fixed inset-0 z-50 flex justify-end">
          <button
            type="button"
            className="absolute inset-0 bg-[color-mix(in_srgb,var(--admin-on-surface)_35%,transparent)] backdrop-blur-[2px]"
            aria-label="Close referred learners drawer"
            onClick={() => {
              setReferralsDrawerOpen(false);
            }}
          />
          <aside
            className="relative flex h-full w-full max-w-[560px] flex-col border-l border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="referred-learners-drawer-title"
          >
            <div className="flex items-start justify-between gap-3 border-b border-[var(--admin-border)] px-5 py-4">
              <div className="min-w-0">
                <h2
                  id="referred-learners-drawer-title"
                  className="text-lg font-semibold tracking-tight text-[var(--admin-on-surface)]"
                >
                  Referred learners
                </h2>
                {referredPayload?.referrer ? (
                  <div className="mt-3 flex items-start gap-3 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--admin-surface-high)] font-mono text-xs font-semibold text-[var(--admin-on-surface-variant)]">
                      {initials(
                        referredPayload.referrer.learnerName,
                        referredPayload.referrer.email,
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-[var(--admin-on-surface)]">
                        {referredPayload.referrer.learnerName ?? "—"}
                      </p>
                      {referredPayload.referrer.email ? (
                        <p className="truncate text-xs text-[var(--admin-on-surface-variant)]">
                          {referredPayload.referrer.email}
                        </p>
                      ) : null}
                      {referredPayload.referrer.referralCode ? (
                        <p className="mt-1 font-mono text-[11px] uppercase text-[var(--admin-on-surface-variant)]">
                          {referredPayload.referrer.referralCode}
                        </p>
                      ) : null}
                    </div>
                  </div>
                ) : referredLoading ? (
                  <div className="mt-3 space-y-2">
                    <Shimmer className="h-16 w-full" />
                  </div>
                ) : null}
              </div>
              <button
                type="button"
                className="rounded p-1 text-[var(--admin-on-surface-variant)] hover:text-[var(--admin-on-surface)]"
                onClick={() => {
                  setReferralsDrawerOpen(false);
                }}
                aria-label="Close"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto">
              {referredError ? (
                <div className="mx-5 mt-4 flex items-center justify-between gap-3 rounded border border-[color-mix(in_srgb,var(--admin-danger)_30%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-danger)_8%,var(--admin-surface))] px-3 py-2 text-sm text-[var(--admin-danger)]">
                  <span>{referredError}</span>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 text-xs font-medium"
                    onClick={() => {
                      if (activeReferrerId) void loadReferred(activeReferrerId, referredPage);
                    }}
                  >
                    <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                    Retry
                  </button>
                </div>
              ) : null}

              {referredLoading && !referredPayload ? (
                <div className="divide-y divide-[var(--admin-border)] px-5 py-2">
                  {Array.from({ length: 6 }).map((_, index) => (
                    <div key={index} className="flex h-10 items-center gap-3 py-2">
                      <Shimmer className="h-4 flex-1" />
                      <Shimmer className="h-4 w-16" />
                      <Shimmer className="h-4 w-20" />
                    </div>
                  ))}
                </div>
              ) : referredPayload && referredPayload.items.length === 0 ? (
                <div className="flex min-h-[240px] flex-col items-center justify-center px-6 py-10 text-center">
                  <Wallet
                    className="mb-4 h-10 w-10 text-[var(--admin-on-surface-variant)]"
                    strokeWidth={1.5}
                    aria-hidden="true"
                  />
                  <p className="text-sm text-[var(--admin-on-surface-variant)]">
                    No referred learners for this referrer yet.
                  </p>
                </div>
              ) : referredPayload ? (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-left text-sm">
                    <thead className="sticky top-0 border-b border-[var(--admin-border)] bg-[var(--admin-surface)]">
                      <tr>
                        <th className="px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]">
                          Learner
                        </th>
                        <th className="px-3 py-2.5 text-xs font-semibold uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]">
                          Signed up
                        </th>
                        <th className="px-3 py-2.5 text-xs font-semibold uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]">
                          First purchase
                        </th>
                        <th className="px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]">
                          Revenue
                        </th>
                        <th className="px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]">
                          Credit
                        </th>
                        <th className="px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]">
                          Status
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {referredPayload.items.map((learner) => (
                        <tr
                          key={learner.membershipId}
                          className="border-b border-[var(--admin-border)] last:border-b-0"
                        >
                          <td className="px-5 py-2.5">
                            <div className="flex min-w-0 items-center gap-2">
                              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--admin-surface-high)] font-mono text-[9px] font-semibold text-[var(--admin-on-surface-variant)]">
                                {initials(learner.learnerName, learner.email)}
                              </div>
                              <div className="min-w-0">
                                <p className="truncate text-sm text-[var(--admin-on-surface)]">
                                  {learner.learnerName ?? "—"}
                                </p>
                                {learner.email ? (
                                  <p className="truncate text-[10px] text-[var(--admin-on-surface-variant)]">
                                    {learner.email}
                                  </p>
                                ) : null}
                              </div>
                            </div>
                          </td>
                          <td className="px-3 py-2.5 text-xs text-[var(--admin-on-surface-variant)]">
                            {formatShortDate(learner.signedUpAt)}
                          </td>
                          <td className="max-w-[120px] truncate px-3 py-2.5 text-xs text-[var(--admin-on-surface)]">
                            {learner.firstPurchaseTitle ?? "—"}
                          </td>
                          <td className="px-3 py-2.5 text-right font-mono text-xs text-[var(--admin-on-surface)]">
                            {formatMoneyAmount(learner.revenueAttributedCents)}
                          </td>
                          <td className="px-3 py-2.5 text-right font-mono text-xs text-[var(--admin-on-surface)]">
                            {formatCredits(learner.creditAwarded)}
                          </td>
                          <td className="px-5 py-2.5">
                            <span
                              className={[
                                "inline-flex rounded px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide",
                                referralStatusPillClass(learner.status),
                              ].join(" ")}
                            >
                              {referralStatusLabel(learner.status)}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}

              {referredPayload && referredPayload.pageInfo.totalPages > 1 ? (
                <div className="flex items-center justify-between gap-3 border-t border-[var(--admin-border)] px-5 py-3 text-xs text-[var(--admin-on-surface-variant)]">
                  <span>
                    Page {referredPayload.pageInfo.page} of {referredPayload.pageInfo.totalPages}
                  </span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="rounded border border-[var(--admin-outline)] px-2 py-1 disabled:opacity-50"
                      disabled={!referredPayload.pageInfo.hasPreviousPage || referredLoading}
                      onClick={() => {
                        setReferredPage((current) => Math.max(1, current - 1));
                      }}
                    >
                      Previous
                    </button>
                    <button
                      type="button"
                      className="rounded border border-[var(--admin-outline)] px-2 py-1 disabled:opacity-50"
                      disabled={!referredPayload.pageInfo.hasNextPage || referredLoading}
                      onClick={() => {
                        setReferredPage((current) => current + 1);
                      }}
                    >
                      Next
                    </button>
                  </div>
                </div>
              ) : null}
            </div>

            {referredPayload ? (
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-5 py-4 text-sm">
                <div className="text-[var(--admin-on-surface-variant)]">
                  <span className="font-mono font-semibold text-[var(--admin-on-surface)]">
                    {formatCredits(referredPayload.totalCreditAwarded)}
                  </span>{" "}
                  credits awarded ·{" "}
                  <span className="font-mono font-semibold text-[var(--admin-on-surface)]">
                    {formatMoneyAmount(referredPayload.totalRevenueCents)}
                  </span>{" "}
                  {referredPayload.currency} revenue
                </div>
              </div>
            ) : null}
          </aside>
        </div>
      ) : null}

      {cohortDrawerOpen && payload ? (
        <div className="fixed inset-0 z-50 flex justify-end">
          <button
            type="button"
            className="absolute inset-0 bg-[color-mix(in_srgb,var(--admin-on-surface)_35%,transparent)] backdrop-blur-[2px]"
            aria-label="Close cohort drawer"
            onClick={() => {
              setCohortDrawerOpen(false);
            }}
          />
          <aside
            className="relative flex h-full w-full max-w-[560px] flex-col border-l border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="cohort-drawer-title"
          >
            <div className="flex items-start justify-between gap-3 border-b border-[var(--admin-border)] px-5 py-4">
              <div>
                <h2
                  id="cohort-drawer-title"
                  className="font-mono text-lg font-semibold tracking-tight text-[var(--admin-on-surface)]"
                >
                  {matchCount.toLocaleString()} referrers match the current filters
                </h2>
                {filterChips.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {filterChips.map((chip) => (
                      <span
                        key={chip}
                        className="rounded bg-[var(--admin-surface-high)] px-2 py-0.5 text-[11px] text-[var(--admin-on-surface-variant)]"
                      >
                        {chip}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
              <button
                type="button"
                className="rounded p-1 text-[var(--admin-on-surface-variant)] hover:text-[var(--admin-on-surface)]"
                onClick={() => {
                  setCohortDrawerOpen(false);
                }}
                aria-label="Close"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            <div className="flex gap-1 border-b border-[var(--admin-border)] px-5 pt-3">
              {(
                [
                  ["group", "Create Group"],
                  ["message", "Send Message"],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  className={[
                    "border-b-2 px-3 pb-2.5 text-xs font-medium transition-colors",
                    cohortTab === key
                      ? "border-[var(--admin-primary)] text-[var(--admin-primary)]"
                      : "border-transparent text-[var(--admin-on-surface-variant)] hover:text-[var(--admin-on-surface)]",
                  ].join(" ")}
                  onClick={() => {
                    setCohortTab(key);
                  }}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4">
              {actionError ? (
                <div className="mb-4 rounded border border-[color-mix(in_srgb,var(--admin-danger)_30%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-danger)_8%,var(--admin-surface))] px-3 py-2 text-sm text-[var(--admin-danger)]">
                  {actionError}
                </div>
              ) : null}

              {cohortTab === "group" ? (
                <div className="space-y-4">
                  <label className="flex flex-col gap-1.5">
                    <span className="text-xs text-[var(--admin-on-surface-variant)]">
                      Group name
                    </span>
                    <input
                      value={groupName}
                      onChange={(event) => {
                        setGroupName(event.target.value);
                      }}
                      className="h-10 rounded border border-[var(--admin-outline)] bg-[var(--admin-surface-low)] px-3 text-sm text-[var(--admin-on-surface)] outline-none focus:border-[var(--admin-primary)] focus:ring-1 focus:ring-[var(--admin-primary)]"
                    />
                  </label>
                  <label className="flex flex-col gap-1.5">
                    <span className="text-xs text-[var(--admin-on-surface-variant)]">
                      Description (optional)
                    </span>
                    <textarea
                      value={groupDescription}
                      onChange={(event) => {
                        setGroupDescription(event.target.value);
                      }}
                      rows={3}
                      className="rounded border border-[var(--admin-outline)] bg-[var(--admin-surface-low)] px-3 py-2 text-sm text-[var(--admin-on-surface)] outline-none focus:border-[var(--admin-primary)] focus:ring-1 focus:ring-[var(--admin-primary)]"
                    />
                  </label>
                  <fieldset className="space-y-2">
                    <legend className="mb-1 text-xs text-[var(--admin-on-surface-variant)]">
                      Membership mode
                    </legend>
                    <label className="flex cursor-pointer items-start gap-2 rounded border border-[var(--admin-border)] p-3 hover:bg-[var(--admin-surface-low)]">
                      <input
                        type="radio"
                        name="referral-membership-mode"
                        className="mt-0.5 accent-[var(--admin-primary)]"
                        checked={membershipMode === "static"}
                        onChange={() => {
                          setMembershipMode("static");
                        }}
                      />
                      <span>
                        <span className="block text-sm font-medium text-[var(--admin-on-surface)]">
                          Static Snapshot
                        </span>
                        <span className="text-xs text-[var(--admin-on-surface-variant)]">
                          Capture the current matched referrers as group members.
                        </span>
                      </span>
                    </label>
                    <label className="flex cursor-pointer items-start gap-2 rounded border border-[var(--admin-border)] p-3 hover:bg-[var(--admin-surface-low)]">
                      <input
                        type="radio"
                        name="referral-membership-mode"
                        className="mt-0.5 accent-[var(--admin-primary)]"
                        checked={membershipMode === "live"}
                        onChange={() => {
                          setMembershipMode("live");
                        }}
                      />
                      <span>
                        <span className="block text-sm font-medium text-[var(--admin-on-surface)]">
                          Live Sync
                        </span>
                        <span className="text-xs text-[var(--admin-on-surface-variant)]">
                          Keep the group in sync with matching referrers over time.
                        </span>
                      </span>
                    </label>
                  </fieldset>
                  {membershipMode === "live" ? (
                    <p className="rounded border border-[color-mix(in_srgb,var(--admin-warning)_30%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-warning)_8%,var(--admin-surface))] px-3 py-2 text-xs text-[var(--admin-warning)]">
                      Live sync isn&apos;t available yet. Choose Static Snapshot to create a group
                      from the current selection or filters.
                    </p>
                  ) : null}
                </div>
              ) : (
                <div className="space-y-4">
                  <label className="flex flex-col gap-1.5">
                    <span className="text-xs text-[var(--admin-on-surface-variant)]">Subject</span>
                    <input
                      value={messageSubject}
                      onChange={(event) => {
                        setMessageSubject(event.target.value);
                      }}
                      className="h-10 rounded border border-[var(--admin-outline)] bg-[var(--admin-surface-low)] px-3 text-sm text-[var(--admin-on-surface)] outline-none focus:border-[var(--admin-primary)] focus:ring-1 focus:ring-[var(--admin-primary)]"
                    />
                  </label>
                  <label className="flex flex-col gap-1.5">
                    <span className="text-xs text-[var(--admin-on-surface-variant)]">Message</span>
                    <textarea
                      value={messageBody}
                      onChange={(event) => {
                        setMessageBody(event.target.value);
                      }}
                      rows={8}
                      className="rounded border border-[var(--admin-outline)] bg-[var(--admin-surface-low)] px-3 py-2 text-sm text-[var(--admin-on-surface)] outline-none focus:border-[var(--admin-primary)] focus:ring-1 focus:ring-[var(--admin-primary)]"
                    />
                  </label>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-[var(--admin-border)] px-5 py-4">
              <button
                type="button"
                className="inline-flex h-9 items-center rounded border border-[var(--admin-outline)] px-4 text-xs font-medium text-[var(--admin-on-surface)] transition-colors hover:bg-[var(--admin-surface-high)] active:translate-y-px"
                onClick={() => {
                  setCohortDrawerOpen(false);
                }}
                disabled={busy}
              >
                Cancel
              </button>
              {cohortTab === "group" ? (
                <button
                  type="button"
                  className="inline-flex h-9 items-center rounded bg-[var(--admin-primary-strong)] px-4 text-xs font-medium text-[var(--admin-on-primary)] transition-colors hover:bg-[var(--admin-primary)] active:translate-y-px disabled:opacity-50"
                  disabled={busy || !groupName.trim() || membershipMode === "live"}
                  onClick={() => void handleCreateGroup()}
                >
                  {busy ? "Creating…" : `Create group with ${matchCount.toLocaleString()} learners`}
                </button>
              ) : (
                <button
                  type="button"
                  className="inline-flex h-9 items-center rounded bg-[var(--admin-primary-strong)] px-4 text-xs font-medium text-[var(--admin-on-primary)] transition-colors hover:bg-[var(--admin-primary)] active:translate-y-px disabled:opacity-50"
                  disabled={busy || !messageSubject.trim() || !messageBody.trim()}
                  onClick={() => void handleSendMessage()}
                >
                  {busy ? "Sending…" : `Send to ${matchCount.toLocaleString()} learners`}
                </button>
              )}
            </div>
          </aside>
        </div>
      ) : null}
    </div>
  );
}
