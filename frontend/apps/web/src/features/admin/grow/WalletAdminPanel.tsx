"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  BadgeCheck,
  ChevronLeft,
  Group,
  MoreVertical,
  Plus,
  Receipt,
  Search,
  SlidersHorizontal,
  StickyNote,
} from "lucide-react";
import { ClientApiError, clientApi, toast } from "../../../lib/client-api";
import { AdminSelectDropdown } from "../../readiness/components/AdminSelectDropdown";
import { generalSettingsBackLinkClassName } from "../general-settings/general-settings-shared";
import { formatMoney } from "./coupons-shared";
import { MESSENGER_WIZARD_FIELD_CLASS, MESSENGER_WIZARD_LABEL_CLASS } from "./push-wizard-chrome";
import {
  ADMIN_SALES_HREF,
  DEFAULT_WALLET_CONFIG,
  dollarsToCredits,
  formatWalletCreditsAsMoney,
  formatWalletDateTime,
  learnerInitials,
  learnerLabel,
  walletReasonLabel,
  type WalletAccount,
  type WalletConfig,
  type WalletDirection,
  type WalletTransaction,
} from "./wallet-shared";

const DASHBOARD_HREF = "/admin";

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

export function WalletAdminPanel() {
  const [config, setConfig] = useState<WalletConfig | null>(null);
  const [draft, setDraft] = useState<WalletConfig | null>(null);
  const [accounts, setAccounts] = useState<WalletAccount[]>([]);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [adjustDirection, setAdjustDirection] = useState<WalletDirection>("CREDIT");
  const [adjustDollars, setAdjustDollars] = useState("");
  const [adjustNote, setAdjustNote] = useState("");
  const [adjustBusy, setAdjustBusy] = useState(false);
  const [adjustOpen, setAdjustOpen] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedQuery(query.trim());
    }, 250);
    return () => {
      window.clearTimeout(timer);
    };
  }, [query]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "100" });
      if (debouncedQuery) params.set("q", debouncedQuery);
      const [configRes, accountsRes] = await Promise.all([
        clientApi.get<{ data: WalletConfig }>("/api/v1/sales/wallet/config"),
        clientApi.get<{ data: { items: WalletAccount[] } }>(
          `/api/v1/sales/wallet/accounts?${params.toString()}`,
        ),
      ]);
      setConfig(configRes.data);
      setDraft(configRes.data);
      setAccounts(accountsRes.data.items);
      setSelectedId((current) => {
        if (current && accountsRes.data.items.some((row) => row.membershipId === current)) {
          return current;
        }
        return accountsRes.data.items[0]?.membershipId ?? null;
      });
    } catch (caught) {
      toast.error(caught instanceof ClientApiError ? caught.message : "Could not load wallet.");
    } finally {
      setLoading(false);
    }
  }, [debouncedQuery]);

  useEffect(() => {
    void load();
  }, [load]);

  const loadDetail = useCallback(async (membershipId: string) => {
    setDetailLoading(true);
    try {
      const response = await clientApi.get<{
        data: { account: WalletAccount; transactions: WalletTransaction[] };
      }>(`/api/v1/sales/wallet/accounts/${membershipId}?limit=50`);
      setTransactions(response.data.transactions);
      setAccounts((prev) =>
        prev.map((row) => (row.membershipId === membershipId ? response.data.account : row)),
      );
    } catch (caught) {
      setTransactions([]);
      toast.error(
        caught instanceof ClientApiError ? caught.message : "Could not load wallet ledger.",
      );
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!selectedId) {
      setTransactions([]);
      return;
    }
    void loadDetail(selectedId);
  }, [selectedId, loadDetail]);

  const selected = useMemo(
    () => accounts.find((row) => row.membershipId === selectedId) ?? null,
    [accounts, selectedId],
  );

  const creditValue = draft?.creditValueCents ?? config?.creditValueCents ?? 100;
  const currency = draft?.currency ?? config?.currency ?? "USD";

  async function onSave() {
    if (!draft) return;
    setSaving(true);
    try {
      const response = await clientApi.put<{ data: WalletConfig }>(
        "/api/v1/sales/wallet/config",
        {
          enabled: draft.enabled,
          creditValueCents: draft.creditValueCents,
          currency: draft.currency,
          maxBalanceCredits: draft.maxBalanceCredits,
          maxCreditsPerOrder: draft.maxCreditsPerOrder,
        },
        "wallet-config-save",
        { successMessage: "Wallet settings saved." },
      );
      setConfig(response.data);
      setDraft(response.data);
    } catch (caught) {
      toast.error(caught instanceof ClientApiError ? caught.message : "Could not save wallet.");
    } finally {
      setSaving(false);
    }
  }

  function onRestoreDefaults() {
    setDraft({
      ...DEFAULT_WALLET_CONFIG,
      updatedAt: draft?.updatedAt ?? null,
    });
    toast.success("Defaults restored in the form. Save to apply.");
  }

  async function onAdjust() {
    if (!selected) {
      toast.error("Select a learner first.");
      return;
    }
    const credits = dollarsToCredits(adjustDollars, creditValue);
    if (credits == null) {
      toast.error("Enter a valid dollar amount.");
      return;
    }
    if (!adjustNote.trim()) {
      toast.error("A reason is required for the audit log.");
      return;
    }
    setAdjustBusy(true);
    try {
      const response = await clientApi.post<{ data: WalletAccount }>(
        "/api/v1/sales/wallet/adjust",
        {
          membershipId: selected.membershipId,
          direction: adjustDirection,
          credits,
          note: adjustNote.trim(),
        },
        "wallet-adjust",
        { successMessage: "Wallet adjusted." },
      );
      setAccounts((prev) =>
        prev.map((row) => (row.membershipId === response.data.membershipId ? response.data : row)),
      );
      setAdjustDollars("");
      setAdjustNote("");
      setAdjustOpen(false);
      await loadDetail(selected.membershipId);
    } catch (caught) {
      toast.error(caught instanceof ClientApiError ? caught.message : "Adjustment failed.");
    } finally {
      setAdjustBusy(false);
    }
  }

  function resetAdjust() {
    setAdjustDollars("");
    setAdjustNote("");
    setAdjustDirection("CREDIT");
  }

  if (loading && !draft) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 animate-pulse rounded-lg bg-[var(--admin-surface-high)]" />
        <div className="h-48 animate-pulse rounded-xl bg-[var(--admin-surface-high)]" />
      </div>
    );
  }

  if (!draft) return null;

  return (
    <div className="relative space-y-6">
      <div
        className="pointer-events-none absolute -right-8 -top-10 h-40 w-40 rounded-full bg-[color-mix(in_srgb,var(--admin-primary)_10%,transparent)] blur-3xl"
        aria-hidden="true"
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
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
          <span className="font-medium text-[var(--admin-on-surface)]">Wallet</span>
        </div>
        <button
          type="button"
          onClick={() => {
            setAdjustOpen(true);
            if (selected) setSelectedId(selected.membershipId);
          }}
          className="inline-flex items-center gap-2 rounded-lg bg-[var(--admin-primary)] px-4 py-2 text-sm font-semibold text-[var(--admin-on-primary)] transition-all hover:bg-[var(--admin-primary-strong)] active:scale-[0.98]"
        >
          <Plus className="h-4 w-4" />
          Apply adjustment
        </button>
      </div>

      <header>
        <h1 className="text-[28px] font-bold tracking-[-0.02em] text-[var(--admin-on-surface)] md:text-[32px]">
          Wallet
        </h1>
        <p className="mt-2 max-w-3xl text-[16px] text-[var(--admin-on-surface-variant)]">
          Enable reward credits, set conversion value, and manage learner balances. Wallet must be
          on before Referral Codes can grant credits. All financial activities are recorded in the
          ledger for compliance.
        </p>
      </header>

      <section className="rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-6">
        <div className="mb-6 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <SlidersHorizontal className="h-5 w-5 text-[var(--admin-primary)]" />
            <h2 className="text-lg font-semibold text-[var(--admin-on-surface)]">
              Global configuration
            </h2>
          </div>
          <button
            type="button"
            onClick={onRestoreDefaults}
            className="text-sm font-semibold text-[var(--admin-primary)] hover:underline"
          >
            Restore defaults
          </button>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <div className="flex items-center justify-between gap-4 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-high)] p-4">
            <div>
              <p className="text-sm font-semibold text-[var(--admin-on-surface)]">
                Enable learner wallets
              </p>
              <p className="text-[11px] text-[var(--admin-on-surface-variant)]">
                Allow credit accumulation
              </p>
            </div>
            <ToggleSwitch
              checked={draft.enabled}
              ariaLabel="Enable learner wallets"
              onChange={(next) => {
                setDraft({ ...draft, enabled: next });
              }}
            />
          </div>

          <div>
            <label className={MESSENGER_WIZARD_LABEL_CLASS}>Credit value (cents)</label>
            <div className="relative">
              <input
                type="number"
                min={1}
                value={draft.creditValueCents}
                onChange={(event) => {
                  setDraft({
                    ...draft,
                    creditValueCents: Number(event.target.value) || 1,
                  });
                }}
                className={`${MESSENGER_WIZARD_FIELD_CLASS} h-11 pr-16`}
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 font-mono text-xs text-[var(--admin-on-surface-variant)]">
                /credit
              </span>
            </div>
            <p className="mt-1 text-[11px] text-[var(--admin-on-surface-variant)]">
              {draft.creditValueCents} cents = {formatMoney(draft.creditValueCents, draft.currency)}{" "}
              value.
            </p>
          </div>

          <div>
            <label className={MESSENGER_WIZARD_LABEL_CLASS}>Base currency</label>
            <AdminSelectDropdown
              id="wallet-currency"
              label={null}
              ariaLabel="Base currency"
              value={draft.currency}
              options={[
                { value: "USD", label: "USD - United States Dollar" },
                { value: "EUR", label: "EUR - Euro" },
                { value: "GBP", label: "GBP - British Pound" },
                { value: "INR", label: "INR - Indian Rupee" },
              ]}
              onChange={(value) => {
                setDraft({ ...draft, currency: value });
              }}
            />
            <p className="mt-1 text-[11px] text-[var(--admin-on-surface-variant)]">
              Primary settlement currency.
            </p>
          </div>

          <div>
            <label className={MESSENGER_WIZARD_LABEL_CLASS}>Max balance cap</label>
            <input
              type="number"
              min={1}
              value={draft.maxBalanceCredits ?? ""}
              onChange={(event) => {
                setDraft({
                  ...draft,
                  maxBalanceCredits: event.target.value.trim() ? Number(event.target.value) : null,
                });
              }}
              className={`${MESSENGER_WIZARD_FIELD_CLASS} h-11`}
              placeholder="Unlimited"
            />
            <p className="mt-1 text-[11px] text-[var(--admin-on-surface-variant)]">
              Maximum credits a learner can hold.
            </p>
          </div>

          <div>
            <label className={MESSENGER_WIZARD_LABEL_CLASS}>Max credits per order</label>
            <input
              type="number"
              min={1}
              value={draft.maxCreditsPerOrder ?? ""}
              onChange={(event) => {
                setDraft({
                  ...draft,
                  maxCreditsPerOrder: event.target.value.trim() ? Number(event.target.value) : null,
                });
              }}
              className={`${MESSENGER_WIZARD_FIELD_CLASS} h-11`}
              placeholder="Unlimited"
            />
            <p className="mt-1 text-[11px] text-[var(--admin-on-surface-variant)]">
              Spend limit per transaction.
            </p>
          </div>

          <div className="flex items-end">
            <button
              type="button"
              disabled={saving}
              onClick={() => void onSave()}
              className="h-11 w-full rounded-lg bg-[var(--admin-primary)] text-sm font-semibold text-[var(--admin-on-primary)] shadow-sm transition-all hover:bg-[var(--admin-primary-strong)] active:scale-[0.98] disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save configuration"}
            </button>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="lg:col-span-7">
          <div className="flex h-[min(700px,70vh)] flex-col overflow-hidden rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)]">
            <div className="flex items-center justify-between gap-3 border-b border-[var(--admin-border)] bg-[var(--admin-surface)] p-4">
              <div className="flex items-center gap-2">
                <Group className="h-4 w-4 text-[var(--admin-on-surface-variant)]" />
                <span className="text-sm font-bold text-[var(--admin-on-surface)]">
                  Learner wallets
                </span>
              </div>
              <div className="relative">
                <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--admin-on-surface-variant)]" />
                <input
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value);
                  }}
                  placeholder="Search by name or email..."
                  className={`${MESSENGER_WIZARD_FIELD_CLASS} h-8 w-56 py-1 pl-8 text-[12px]`}
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="sticky top-0 z-10 bg-[var(--admin-surface-high)]">
                  <tr className="text-[11px] font-bold uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
                    <th className="px-6 py-3">Learner</th>
                    <th className="px-6 py-3 text-right">Balance</th>
                    <th className="px-6 py-3 text-right">Earned</th>
                    <th className="px-6 py-3 text-right">Used</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--admin-border)]">
                  {accounts.length === 0 ? (
                    <tr>
                      <td
                        colSpan={4}
                        className="px-6 py-16 text-center text-sm text-[var(--admin-on-surface-variant)]"
                      >
                        No wallet activity yet. Credits appear after referrals or admin adjustments.
                      </td>
                    </tr>
                  ) : (
                    accounts.map((row) => {
                      const active = row.membershipId === selectedId;
                      return (
                        <tr
                          key={row.membershipId}
                          onClick={() => {
                            setSelectedId(row.membershipId);
                          }}
                          className={[
                            "cursor-pointer transition-colors",
                            active
                              ? "border-l-4 border-[var(--admin-primary)] bg-[color-mix(in_srgb,var(--admin-primary)_6%,var(--admin-surface))]"
                              : "border-l-4 border-transparent hover:bg-[var(--admin-surface-high)]",
                          ].join(" ")}
                        >
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[var(--admin-surface-high)] text-xs font-bold text-[var(--admin-on-surface)]">
                                {learnerInitials(row.displayName, row.email)}
                              </span>
                              <div className="min-w-0">
                                <p className="truncate text-sm font-bold text-[var(--admin-on-surface)]">
                                  {learnerLabel(row)}
                                </p>
                                <p className="truncate text-[11px] text-[var(--admin-on-surface-variant)]">
                                  {row.email ?? row.membershipId.slice(0, 8)}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td
                            className={[
                              "px-6 py-4 text-right font-mono text-xs font-bold",
                              active
                                ? "text-[var(--admin-primary)]"
                                : "text-[var(--admin-on-surface)]",
                            ].join(" ")}
                          >
                            {formatWalletCreditsAsMoney(row.balanceCredits, creditValue, currency)}
                          </td>
                          <td className="px-6 py-4 text-right font-mono text-xs text-[var(--admin-success)]">
                            {formatWalletCreditsAsMoney(row.earnedCredits, creditValue, currency)}
                          </td>
                          <td className="px-6 py-4 text-right font-mono text-xs text-[var(--admin-warning)]">
                            {formatWalletCreditsAsMoney(row.usedCredits, creditValue, currency)}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="space-y-6 lg:col-span-5">
          <div className="rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-6 shadow-sm">
            {selected ? (
              <>
                <div className="mb-6 flex items-start justify-between gap-3">
                  <div className="flex items-center gap-4">
                    <span className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--admin-surface-high)] text-lg font-bold text-[var(--admin-primary)]">
                      {learnerInitials(selected.displayName, selected.email)}
                    </span>
                    <div>
                      <h3 className="text-lg font-semibold text-[var(--admin-on-surface)]">
                        {learnerLabel(selected)}
                      </h3>
                      <p className="font-mono text-[12px] text-[var(--admin-on-surface-variant)]">
                        {selected.membershipId.slice(0, 8)}…
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setAdjustOpen(true);
                    }}
                    className="rounded-lg p-2 text-[var(--admin-on-surface-variant)] hover:bg-[var(--admin-surface-high)]"
                    aria-label="Open adjustment"
                  >
                    <MoreVertical className="h-4 w-4" />
                  </button>
                </div>
                <div className="rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface-high)] p-6">
                  <p className="mb-1 text-xs font-semibold text-[var(--admin-on-surface-variant)]">
                    Current balance
                  </p>
                  <div className="flex flex-wrap items-baseline gap-2">
                    <span className="text-[32px] font-bold tracking-[-0.02em] text-[var(--admin-primary)]">
                      {formatWalletCreditsAsMoney(selected.balanceCredits, creditValue, currency)}
                    </span>
                    <span className="text-sm text-[var(--admin-on-surface-variant)]">
                      {selected.balanceCredits.toLocaleString()} credits
                    </span>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <div className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 py-2">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
                        Earned
                      </p>
                      <p className="text-sm font-bold text-[var(--admin-success)]">
                        {formatWalletCreditsAsMoney(selected.earnedCredits, creditValue, currency)}
                      </p>
                    </div>
                    <div className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 py-2">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
                        Used
                      </p>
                      <p className="text-sm font-bold text-[var(--admin-warning)]">
                        {formatWalletCreditsAsMoney(selected.usedCredits, creditValue, currency)}
                      </p>
                    </div>
                  </div>
                  <p className="mt-3 text-[11px] text-[var(--admin-on-surface-variant)]">
                    Updated {formatWalletDateTime(selected.updatedAt)}
                    {config?.enabled ? " · Wallets enabled" : " · Wallets disabled"}
                  </p>
                </div>
              </>
            ) : (
              <p className="py-10 text-center text-sm text-[var(--admin-on-surface-variant)]">
                Select a learner to view balance details.
              </p>
            )}
          </div>

          <div className="flex h-[420px] flex-col overflow-hidden rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-sm">
            <div className="flex items-center justify-between border-b border-[var(--admin-border)] px-6 py-4">
              <h4 className="text-xs font-bold uppercase tracking-widest text-[var(--admin-on-surface-variant)]">
                Transaction ledger
              </h4>
              <Receipt className="h-5 w-5 text-[var(--admin-primary)]" />
            </div>
            <div className="flex-1 overflow-y-auto">
              {detailLoading ? (
                <p className="px-6 py-10 text-center text-sm text-[var(--admin-on-surface-variant)]">
                  Loading ledger…
                </p>
              ) : !selected ? (
                <p className="px-6 py-10 text-center text-sm text-[var(--admin-on-surface-variant)]">
                  No learner selected.
                </p>
              ) : transactions.length === 0 ? (
                <p className="px-6 py-10 text-center text-sm text-[var(--admin-on-surface-variant)]">
                  No transactions recorded yet.
                </p>
              ) : (
                <table className="min-w-full text-left text-sm">
                  <thead className="sticky top-0 bg-[color-mix(in_srgb,var(--admin-surface-high)_70%,transparent)]">
                    <tr className="text-xs font-bold text-[var(--admin-on-surface-variant)]">
                      <th className="px-6 py-3">Reason</th>
                      <th className="px-6 py-3 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--admin-border)]">
                    {transactions.map((txn) => {
                      const money =
                        txn.moneyCents != null
                          ? formatMoney(txn.moneyCents, txn.currency || currency)
                          : formatWalletCreditsAsMoney(txn.credits, creditValue, currency);
                      const positive = txn.direction === "CREDIT";
                      return (
                        <tr
                          key={txn.id}
                          className="transition-colors hover:bg-[color-mix(in_srgb,var(--admin-surface-high)_50%,transparent)]"
                        >
                          <td className="px-6 py-4">
                            <p className="font-bold text-[var(--admin-on-surface)]">
                              {walletReasonLabel(txn.reason)}
                            </p>
                            <p className="text-[11px] text-[var(--admin-on-surface-variant)]">
                              {formatWalletDateTime(txn.createdAt)}
                            </p>
                            {txn.note ? (
                              <p className="mt-0.5 text-[10px] italic text-[var(--admin-on-surface-variant)]">
                                &ldquo;{txn.note}&rdquo;
                              </p>
                            ) : null}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <span
                              className={[
                                "inline-flex rounded-md px-2 py-1 font-mono text-[11px] font-bold",
                                positive
                                  ? "bg-[color-mix(in_srgb,var(--admin-success)_12%,var(--admin-surface))] text-[var(--admin-success)]"
                                  : "bg-[color-mix(in_srgb,var(--admin-warning)_12%,var(--admin-surface))] text-[var(--admin-warning)]",
                              ].join(" ")}
                            >
                              {positive ? "+" : "-"}
                              {money}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </div>

      <section
        id="wallet-adjustment-terminal"
        className="rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-6"
      >
        <div className="mb-6 flex items-center gap-3">
          <StickyNote className="h-5 w-5 text-[var(--admin-warning)]" />
          <h2 className="text-lg font-semibold text-[var(--admin-on-surface)]">
            Adjustment terminal
          </h2>
        </div>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-12">
          <div className="space-y-4 md:col-span-4">
            <div>
              <label className={MESSENGER_WIZARD_LABEL_CLASS}>Target learner</label>
              <input
                readOnly
                value={selected ? learnerLabel(selected) : ""}
                placeholder="Select a learner from the table"
                className={`${MESSENGER_WIZARD_FIELD_CLASS} h-11 bg-[var(--admin-surface-high)]`}
              />
            </div>
            <div>
              <label className={MESSENGER_WIZARD_LABEL_CLASS}>Adjustment type</label>
              <div className="flex overflow-hidden rounded-lg border border-[var(--admin-border)]">
                <button
                  type="button"
                  onClick={() => {
                    setAdjustDirection("CREDIT");
                  }}
                  className={[
                    "flex-1 py-2 text-xs font-bold transition-colors",
                    adjustDirection === "CREDIT"
                      ? "bg-[var(--admin-primary)] text-[var(--admin-on-primary)]"
                      : "bg-[var(--admin-surface-high)] text-[var(--admin-on-surface-variant)] hover:bg-[var(--admin-surface-variant)]",
                  ].join(" ")}
                >
                  Credit (+)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAdjustDirection("DEBIT");
                  }}
                  className={[
                    "flex-1 py-2 text-xs font-bold transition-colors",
                    adjustDirection === "DEBIT"
                      ? "bg-[var(--admin-primary)] text-[var(--admin-on-primary)]"
                      : "bg-[var(--admin-surface-high)] text-[var(--admin-on-surface-variant)] hover:bg-[var(--admin-surface-variant)]",
                  ].join(" ")}
                >
                  Debit (-)
                </button>
              </div>
            </div>
            <div>
              <label className={MESSENGER_WIZARD_LABEL_CLASS}>Amount ($)</label>
              <input
                type="number"
                min={0.01}
                step={0.01}
                value={adjustDollars}
                onChange={(event) => {
                  setAdjustDollars(event.target.value);
                }}
                placeholder="0.00"
                className={`${MESSENGER_WIZARD_FIELD_CLASS} h-11 font-mono`}
              />
              {dollarsToCredits(adjustDollars, creditValue) != null ? (
                <p className="mt-1 text-[11px] text-[var(--admin-on-surface-variant)]">
                  Converts to {dollarsToCredits(adjustDollars, creditValue)} credits at current
                  value.
                </p>
              ) : null}
            </div>
          </div>
          <div className="flex flex-col md:col-span-8">
            <label className={MESSENGER_WIZARD_LABEL_CLASS}>
              Reason for adjustment (internal audit log)
            </label>
            <textarea
              value={adjustNote}
              onChange={(event) => {
                setAdjustNote(event.target.value.slice(0, 500));
              }}
              maxLength={500}
              placeholder="Required: Provide a detailed explanation for this manual balance change for auditing purposes..."
              className={`${MESSENGER_WIZARD_FIELD_CLASS} min-h-[120px] flex-1 resize-none`}
            />
            <p className="mt-1 text-right text-[10px] text-[var(--admin-on-surface-variant)]">
              {adjustNote.length}/500 characters
            </p>
            <div className="mt-4 flex justify-end gap-3">
              <button
                type="button"
                onClick={resetAdjust}
                className="rounded-lg border border-[var(--admin-border)] px-6 py-2.5 text-sm font-semibold text-[var(--admin-on-surface-variant)] transition-colors hover:bg-[var(--admin-surface-high)]"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={adjustBusy || !selected}
                onClick={() => void onAdjust()}
                className="inline-flex items-center gap-2 rounded-lg bg-[var(--admin-primary)] px-8 py-2.5 text-sm font-semibold text-[var(--admin-on-primary)] shadow-md transition-all hover:bg-[var(--admin-primary-strong)] active:scale-95 disabled:opacity-50"
              >
                <BadgeCheck className="h-4 w-4" />
                {adjustBusy ? "Applying…" : "Apply adjustment"}
              </button>
            </div>
          </div>
        </div>
      </section>

      {adjustOpen ? (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-[color-mix(in_srgb,var(--admin-on-surface)_35%,transparent)] p-4 backdrop-blur-[2px]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="wallet-adjust-title"
        >
          <div className="w-full max-w-lg space-y-4 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5 shadow-lg">
            <h2
              id="wallet-adjust-title"
              className="text-lg font-semibold text-[var(--admin-on-surface)]"
            >
              Apply adjustment
            </h2>
            <p className="text-sm text-[var(--admin-on-surface-variant)]">
              {selected
                ? `Target: ${learnerLabel(selected)}`
                : "Select a learner from the table first."}
            </p>
            <div className="flex overflow-hidden rounded-lg border border-[var(--admin-border)]">
              <button
                type="button"
                onClick={() => {
                  setAdjustDirection("CREDIT");
                }}
                className={[
                  "flex-1 py-2 text-xs font-bold",
                  adjustDirection === "CREDIT"
                    ? "bg-[var(--admin-primary)] text-[var(--admin-on-primary)]"
                    : "bg-[var(--admin-surface-high)] text-[var(--admin-on-surface-variant)]",
                ].join(" ")}
              >
                Credit (+)
              </button>
              <button
                type="button"
                onClick={() => {
                  setAdjustDirection("DEBIT");
                }}
                className={[
                  "flex-1 py-2 text-xs font-bold",
                  adjustDirection === "DEBIT"
                    ? "bg-[var(--admin-primary)] text-[var(--admin-on-primary)]"
                    : "bg-[var(--admin-surface-high)] text-[var(--admin-on-surface-variant)]",
                ].join(" ")}
              >
                Debit (-)
              </button>
            </div>
            <div>
              <label className={MESSENGER_WIZARD_LABEL_CLASS}>Amount ($)</label>
              <input
                type="number"
                min={0.01}
                step={0.01}
                value={adjustDollars}
                onChange={(event) => {
                  setAdjustDollars(event.target.value);
                }}
                className={`${MESSENGER_WIZARD_FIELD_CLASS} h-11 font-mono`}
                placeholder="0.00"
              />
            </div>
            <div>
              <label className={MESSENGER_WIZARD_LABEL_CLASS}>Audit reason</label>
              <textarea
                value={adjustNote}
                onChange={(event) => {
                  setAdjustNote(event.target.value.slice(0, 500));
                }}
                maxLength={500}
                className={`${MESSENGER_WIZARD_FIELD_CLASS} min-h-[96px] resize-none`}
                placeholder="Required for the ledger audit trail"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="rounded-lg border border-[var(--admin-border)] px-4 py-2 text-sm font-semibold text-[var(--admin-on-surface-variant)]"
                onClick={() => {
                  setAdjustOpen(false);
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={adjustBusy || !selected}
                onClick={() => void onAdjust()}
                className="rounded-lg bg-[var(--admin-primary)] px-4 py-2 text-sm font-semibold text-[var(--admin-on-primary)] disabled:opacity-50"
              >
                {adjustBusy ? "Applying…" : "Apply"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
