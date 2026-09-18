"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
  PartyPopper,
  QrCode,
  Save,
  Search,
  Settings2,
  Sparkles,
  Trophy,
  TriangleAlert,
  Users,
} from "lucide-react";
import { ClientApiError, clientApi, toast } from "../../../lib/client-api";
import { AdminSelectDropdown } from "../../readiness/components/AdminSelectDropdown";
import { generalSettingsBackLinkClassName } from "../general-settings/general-settings-shared";
import { MESSENGER_WIZARD_FIELD_CLASS, MESSENGER_WIZARD_LABEL_CLASS } from "./push-wizard-chrome";
import {
  ADMIN_SALES_HREF,
  REFERRAL_SORT_OPTIONS,
  WALLET_HREF,
  formatCredits,
  formatReferralDate,
  learnerInitials,
  learnerLabel,
  totalCreditsEarned,
  type ReferralConfig,
  type ReferralStatsItem,
  type ReferralStatsSort,
} from "./referral-shared";

const DASHBOARD_HREF = "/admin";
const PAGE_SIZE = 25;

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

function RankBadge({ rank }: { rank: number }) {
  const top = rank === 1;
  return (
    <span
      className={[
        "inline-flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold",
        top
          ? "bg-[var(--admin-primary-strong)] text-[var(--admin-on-primary)]"
          : "bg-[var(--admin-surface-high)] text-[var(--admin-on-surface)]",
      ].join(" ")}
    >
      {rank}
    </span>
  );
}

export function ReferralAdminPanel() {
  const [config, setConfig] = useState<ReferralConfig | null>(null);
  const [draft, setDraft] = useState<ReferralConfig | null>(null);
  const [stats, setStats] = useState<ReferralStatsItem[]>([]);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [sort, setSort] = useState<ReferralStatsSort>("successfulReferrals");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedQuery(query.trim());
      setPage(1);
    }, 250);
    return () => {
      window.clearTimeout(timer);
    };
  }, [query]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "100", sort });
      if (debouncedQuery) params.set("q", debouncedQuery);
      const [configRes, statsRes] = await Promise.all([
        clientApi.get<{ data: ReferralConfig }>("/api/v1/sales/referral/config"),
        clientApi.get<{ data: { items: ReferralStatsItem[] } }>(
          `/api/v1/sales/referral/stats?${params.toString()}`,
        ),
      ]);
      setConfig(configRes.data);
      setDraft(configRes.data);
      setStats(statsRes.data.items);
    } catch (caught) {
      toast.error(caught instanceof ClientApiError ? caught.message : "Could not load referrals.");
    } finally {
      setLoading(false);
    }
  }, [debouncedQuery, sort]);

  useEffect(() => {
    void load();
  }, [load]);

  const pageCount = Math.max(1, Math.ceil(stats.length / PAGE_SIZE));
  const pageItems = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return stats.slice(start, start + PAGE_SIZE);
  }, [stats, page]);

  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);

  async function onSave() {
    if (!draft) return;
    setSaving(true);
    try {
      const response = await clientApi.put<{ data: ReferralConfig }>(
        "/api/v1/sales/referral/config",
        {
          enabled: draft.enabled,
          referrerSignupCredits: draft.referrerSignupCredits,
          refereeSignupCredits: draft.refereeSignupCredits,
          referrerPurchaseCredits: draft.referrerPurchaseCredits,
          maxReferrals: draft.maxReferrals,
        },
        "referral-config-save",
        { successMessage: "Referral settings saved." },
      );
      setConfig(response.data);
      setDraft(response.data);
    } catch (caught) {
      toast.error(caught instanceof ClientApiError ? caught.message : "Could not save referrals.");
    } finally {
      setSaving(false);
    }
  }

  if (loading && !draft) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-56 animate-pulse rounded-lg bg-[var(--admin-surface-high)]" />
        <div className="h-48 animate-pulse rounded-xl bg-[var(--admin-surface-high)]" />
      </div>
    );
  }

  if (!draft || !config) return null;

  const unlimited = draft.maxReferrals == null;
  const enableDisabled = !config.walletEnabled && !draft.enabled;
  const rangeStart = stats.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(page * PAGE_SIZE, stats.length);

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
        <span className="font-medium text-[var(--admin-on-surface)]">Referral Code</span>
      </div>

      <header>
        <h1 className="text-[28px] font-bold tracking-[-0.02em] text-[var(--admin-on-surface)] md:text-[32px]">
          Referral Code
        </h1>
        <p className="mt-1 text-[16px] text-[var(--admin-on-surface-variant)]">
          Refer & Earn - reward learners and their invitees when a referral converts.
        </p>
      </header>

      {!config.walletEnabled ? (
        <div className="flex flex-col gap-3 rounded-xl border border-[color-mix(in_srgb,var(--admin-warning)_30%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-warning)_10%,var(--admin-surface))] p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3 sm:items-center">
            <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-[var(--admin-warning)]" />
            <p className="text-sm font-semibold text-[var(--admin-warning)]">
              Wallet must be enabled before Referral Codes can grant credits
            </p>
          </div>
          <Link
            href={WALLET_HREF}
            prefetch={false}
            className="inline-flex items-center justify-center rounded-lg bg-[var(--admin-warning)] px-4 py-1.5 text-xs font-bold text-[var(--admin-on-primary)] transition-opacity hover:opacity-90"
          >
            Enable Wallet
          </Link>
        </div>
      ) : null}

      <section className="rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-6 shadow-sm">
        <div className="mb-8 flex flex-col gap-4 border-b border-[var(--admin-border)] pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Settings2 className="h-5 w-5 text-[var(--admin-primary)]" />
            <h2 className="text-lg font-semibold text-[var(--admin-on-surface)]">
              Program configuration
            </h2>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold uppercase tracking-wide text-[var(--admin-on-surface-variant)]">
              Enable referral program
            </span>
            <ToggleSwitch
              checked={draft.enabled}
              disabled={enableDisabled}
              ariaLabel="Enable referral program"
              onChange={(next) => {
                setDraft({ ...draft, enabled: next });
              }}
            />
          </div>
        </div>

        <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-2">
          <div className="rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface-high)] p-5">
            <div className="mb-4 flex items-center gap-2">
              <PartyPopper className="h-4 w-4 text-[var(--admin-primary)]" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--admin-primary)]">
                The referrer wins
              </h3>
            </div>
            <div className="space-y-4">
              <div>
                <label className={MESSENGER_WIZARD_LABEL_CLASS}>Signup credits</label>
                <div className="relative">
                  <input
                    type="number"
                    min={0}
                    value={draft.referrerSignupCredits}
                    onChange={(event) => {
                      setDraft({
                        ...draft,
                        referrerSignupCredits: Math.max(0, Number(event.target.value) || 0),
                      });
                    }}
                    className={`${MESSENGER_WIZARD_FIELD_CLASS} h-11 pr-12`}
                  />
                  <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xs font-semibold text-[var(--admin-on-surface-variant)]">
                    CR
                  </span>
                </div>
              </div>
              <div>
                <label className={MESSENGER_WIZARD_LABEL_CLASS}>Purchase credits</label>
                <div className="relative">
                  <input
                    type="number"
                    min={0}
                    value={draft.referrerPurchaseCredits}
                    onChange={(event) => {
                      setDraft({
                        ...draft,
                        referrerPurchaseCredits: Math.max(0, Number(event.target.value) || 0),
                      });
                    }}
                    className={`${MESSENGER_WIZARD_FIELD_CLASS} h-11 pr-12`}
                  />
                  <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xs font-semibold text-[var(--admin-on-surface-variant)]">
                    CR
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface-high)] p-5">
            <div className="mb-4 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-[var(--admin-success)]" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--admin-success)]">
                The invitee wins
              </h3>
            </div>
            <div className="space-y-4">
              <div>
                <label className={MESSENGER_WIZARD_LABEL_CLASS}>Welcome credits</label>
                <div className="relative">
                  <input
                    type="number"
                    min={0}
                    value={draft.refereeSignupCredits}
                    onChange={(event) => {
                      setDraft({
                        ...draft,
                        refereeSignupCredits: Math.max(0, Number(event.target.value) || 0),
                      });
                    }}
                    className={`${MESSENGER_WIZARD_FIELD_CLASS} h-11 pr-12`}
                  />
                  <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xs font-semibold text-[var(--admin-on-surface-variant)]">
                    CR
                  </span>
                </div>
              </div>
              <p className="pt-2 text-[13px] italic text-[var(--admin-on-surface-variant)]">
                Reward is granted when a new account activates with a valid referral code.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:gap-8">
            <div className="w-full sm:w-48">
              <label className={MESSENGER_WIZARD_LABEL_CLASS}>Max referrals cap</label>
              <input
                type="number"
                min={1}
                disabled={unlimited}
                value={draft.maxReferrals ?? ""}
                onChange={(event) => {
                  setDraft({
                    ...draft,
                    maxReferrals: event.target.value.trim() ? Number(event.target.value) : null,
                  });
                }}
                className={`${MESSENGER_WIZARD_FIELD_CLASS} h-11 disabled:opacity-50`}
                placeholder="50"
              />
            </div>
            <label className="flex items-center gap-3 pb-2 text-sm text-[var(--admin-on-surface)]">
              <input
                type="checkbox"
                checked={unlimited}
                onChange={(event) => {
                  setDraft({
                    ...draft,
                    maxReferrals: event.target.checked ? null : (draft.maxReferrals ?? 50),
                  });
                }}
                className="rounded border-[var(--admin-outline)] text-[var(--admin-primary)] focus:ring-[var(--admin-primary)]"
              />
              Unlimited referrals
            </label>
          </div>
          <button
            type="button"
            disabled={saving}
            onClick={() => void onSave()}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--admin-primary)] px-8 py-3 text-sm font-bold text-[var(--admin-on-primary)] transition-all hover:bg-[var(--admin-primary-strong)] active:scale-[0.98] disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {saving ? "Saving…" : "Save configuration"}
          </button>
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-sm">
        <div className="flex flex-col gap-4 border-b border-[var(--admin-border)] p-6 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-[var(--admin-on-surface-variant)]" />
            <h2 className="text-lg font-semibold text-[var(--admin-on-surface)]">
              Referral leaderboard
            </h2>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--admin-on-surface-variant)]" />
              <input
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                }}
                placeholder="Search name/code/email..."
                className={`${MESSENGER_WIZARD_FIELD_CLASS} h-10 w-full pl-9 sm:w-64`}
              />
            </div>
            <div className="min-w-[180px]">
              <AdminSelectDropdown
                id="referral-sort"
                label={null}
                ariaLabel="Sort leaderboard"
                value={sort}
                options={[...REFERRAL_SORT_OPTIONS]}
                onChange={(value) => {
                  setSort(value as ReferralStatsSort);
                  setPage(1);
                }}
              />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--admin-border)] bg-[var(--admin-surface-high)]">
                <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
                  Rank
                </th>
                <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
                  Learner
                </th>
                <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
                  Referral code
                </th>
                <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
                  Successes
                </th>
                <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
                  Credits earned
                </th>
                <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
                  Joined date
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 4 }).map((_, index) => (
                  <tr key={`skel-${index}`} aria-hidden="true">
                    <td className="px-6 py-5" colSpan={6}>
                      <div className="h-10 animate-pulse rounded-lg bg-[var(--admin-surface-high)]" />
                    </td>
                  </tr>
                ))
              ) : pageItems.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-16">
                    <div className="mx-auto flex max-w-md flex-col items-center text-center">
                      <span className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--admin-surface-high)] text-[var(--admin-primary)]">
                        <QrCode className="h-7 w-7" />
                      </span>
                      <h3 className="text-lg font-semibold text-[var(--admin-on-surface)]">
                        No referral codes yet
                      </h3>
                      <p className="mt-2 text-sm text-[var(--admin-on-surface-variant)]">
                        Codes are created when learners open Invite & Earn in their dashboard.
                        Encourage students to share the platform.
                      </p>
                      <div className="mt-4 inline-flex items-center gap-2 text-xs font-semibold text-[var(--admin-on-surface-variant)]">
                        <Users className="h-3.5 w-3.5" />
                        Learner-generated codes appear here automatically
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                pageItems.map((row, index) => {
                  const rank = (page - 1) * PAGE_SIZE + index + 1;
                  const top = rank === 1;
                  const total = totalCreditsEarned(row);
                  return (
                    <tr
                      key={row.membershipId}
                      className={[
                        "border-b border-[var(--admin-border)] transition-colors",
                        top
                          ? "bg-[color-mix(in_srgb,var(--admin-primary)_8%,var(--admin-surface))] hover:bg-[color-mix(in_srgb,var(--admin-primary)_12%,var(--admin-surface))]"
                          : "hover:bg-[var(--admin-surface-high)]",
                      ].join(" ")}
                    >
                      <td className="px-6 py-4">
                        <RankBadge rank={rank} />
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <span className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[var(--admin-border)] bg-[var(--admin-surface)] text-xs font-bold text-[var(--admin-on-surface)]">
                            {learnerInitials(row.displayName, row.email)}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-[var(--admin-on-surface)]">
                              {learnerLabel(row)}
                            </p>
                            <p className="truncate text-xs text-[var(--admin-on-surface-variant)]">
                              {row.email ?? row.membershipId.slice(0, 8)}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={[
                            "inline-block rounded px-2 py-1 font-mono text-xs",
                            top
                              ? "bg-[color-mix(in_srgb,var(--admin-primary)_14%,var(--admin-surface))] text-[var(--admin-primary)]"
                              : "bg-[var(--admin-surface-high)] text-[var(--admin-on-surface-variant)]",
                          ].join(" ")}
                        >
                          {row.code}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-semibold text-[var(--admin-on-surface)]">
                        {formatCredits(row.successfulReferrals)}
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-bold text-[var(--admin-success)]">
                          {formatCredits(total)}
                        </span>
                        <span className="mt-0.5 block text-[11px] text-[var(--admin-on-surface-variant)]">
                          ({formatCredits(row.signupCreditsEarned)} signup /{" "}
                          {formatCredits(row.purchaseCreditsEarned)} purchase)
                        </span>
                      </td>
                      <td className="px-6 py-4 text-[var(--admin-on-surface-variant)]">
                        {formatReferralDate(row.createdAt)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col gap-3 border-t border-[var(--admin-border)] bg-[color-mix(in_srgb,var(--admin-surface-high)_40%,transparent)] px-6 py-4 text-sm text-[var(--admin-on-surface-variant)] sm:flex-row sm:items-center sm:justify-between">
          <p className="italic">
            Showing {rangeStart}-{rangeEnd} of {stats.length} referrers
            {stats.length >= 100 ? " (top 100 loaded)" : ""}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => {
                setPage((current) => Math.max(1, current - 1));
              }}
              className="inline-flex items-center gap-1 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] px-4 py-2 text-xs font-semibold transition-colors hover:bg-[var(--admin-surface-high)] disabled:opacity-40"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              Previous
            </button>
            <button
              type="button"
              disabled={page >= pageCount}
              onClick={() => {
                setPage((current) => Math.min(pageCount, current + 1));
              }}
              className="inline-flex items-center gap-1 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] px-4 py-2 text-xs font-semibold transition-colors hover:bg-[var(--admin-surface-high)] disabled:opacity-40"
            >
              Next
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
