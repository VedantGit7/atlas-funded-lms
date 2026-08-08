"use client";

import { useState } from "react";
import { AlertCircle, CheckCircle2, Coins, Loader2 } from "lucide-react";
import { cn } from "@atlas/design-system";
import { ClientApiError, clientApi } from "../../../lib/client-api";
import type { RewardType } from "@atlas/contracts/gamification/rewards.schemas";
import { formatXp, humanizeKey, rewardTypeMeta } from "../gamification-view";

type Balance = {
  currencyKey: string;
  currencyName: string;
  symbol: string | null;
  balance: number;
};

type CatalogItem = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  costCurrencyKey: string;
  costAmount: number;
  rewardType: RewardType;
  stock: number | null;
};

type RedemptionHistoryItem = {
  id: string;
  rewardName: string;
  rewardType: string;
  costAmount: number;
  status: string;
  redeemedAt: string;
};

type RewardsCatalogProps = {
  balances: Balance[];
  items: CatalogItem[];
  redemptions: RedemptionHistoryItem[];
};

export function RewardsCatalog({ balances, items, redemptions }: RewardsCatalogProps) {
  const [balanceState, setBalanceState] = useState(balances);
  const [itemState, setItemState] = useState(items);
  const [history, setHistory] = useState(redemptions);
  const [confirming, setConfirming] = useState<CatalogItem | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (itemState.length === 0 && balanceState.length === 0) {
    return null;
  }

  const primaryBalance = balanceState[0] ?? null;

  function balanceFor(currencyKey: string): number {
    return balanceState.find((entry) => entry.currencyKey === currencyKey)?.balance ?? 0;
  }

  function currencyLabel(currencyKey: string): string {
    return (
      balanceState.find((entry) => entry.currencyKey === currencyKey)?.currencyName ??
      humanizeKey(currencyKey)
    );
  }

  async function redeem(item: CatalogItem) {
    setBusy(true);
    setMessage(null);
    setError(null);
    try {
      const response = await clientApi.post<{
        data: { redemptionId: string; status: string; balance: number; code: string | null };
      }>(
        "/api/v1/me/rewards/redeem",
        { rewardItemId: item.id },
        `reward-redeem-${item.id}-${Date.now().toString()}`,
      );

      setBalanceState((current) =>
        current.map((entry) =>
          entry.currencyKey === item.costCurrencyKey
            ? { ...entry, balance: response.data.balance }
            : entry,
        ),
      );
      setItemState((current) =>
        current.map((entry) =>
          entry.id === item.id && entry.stock != null
            ? { ...entry, stock: entry.stock - 1 }
            : entry,
        ),
      );
      setHistory((current) => [
        {
          id: response.data.redemptionId,
          rewardName: item.name,
          rewardType: item.rewardType,
          costAmount: item.costAmount,
          status: response.data.status,
          redeemedAt: new Date().toISOString(),
        },
        ...current,
      ]);
      setMessage(
        response.data.code
          ? `Redeemed. Your code: ${response.data.code}`
          : response.data.status === "fulfilled"
            ? "Redeemed."
            : "Redeemed. The team will fulfill this shortly.",
      );
    } catch (caught) {
      setError(caught instanceof ClientApiError ? caught.message : "Failed to redeem reward.");
    } finally {
      setBusy(false);
      setConfirming(null);
    }
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className="flex items-center justify-between gap-3 border-b border-border bg-muted/40 px-5 py-4">
        <h2 className="text-lg font-semibold text-foreground">Rewards shop</h2>
        {primaryBalance ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-sm font-bold text-primary tabular-nums">
            <Coins className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
            {primaryBalance.symbol ?? ""}
            {formatXp(primaryBalance.balance)}
          </span>
        ) : null}
      </div>

      <div className="space-y-4 p-4">
        {message ? (
          <p
            className="flex items-start gap-2 rounded-lg bg-[color-mix(in_srgb,var(--success)_12%,transparent)] px-3 py-2 text-sm text-[color-mix(in_srgb,var(--success)_74%,var(--foreground))]"
            role="status"
          >
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2} aria-hidden="true" />
            {message}
          </p>
        ) : null}
        {error ? (
          <p
            className="flex items-start gap-2 rounded-lg bg-[color-mix(in_srgb,var(--destructive)_12%,transparent)] px-3 py-2 text-sm text-[color-mix(in_srgb,var(--destructive)_74%,var(--foreground))]"
            role="alert"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2} aria-hidden="true" />
            {error}
          </p>
        ) : null}

        {itemState.length > 0 ? (
          <ul className="space-y-3">
            {itemState.map((item) => {
              const affordable = balanceFor(item.costCurrencyKey) >= item.costAmount;
              const soldOut = item.stock != null && item.stock <= 0;
              const meta = rewardTypeMeta(item.rewardType);
              const RewardIcon = meta.icon;
              const disabled = busy || !affordable || soldOut;

              return (
                <li
                  key={item.id}
                  className={cn(
                    "rounded-xl border border-border bg-card p-3",
                    (soldOut || !affordable) && "opacity-75",
                  )}
                >
                  <div className="flex items-start gap-3">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <RewardIcon className="h-5 w-5" strokeWidth={2} aria-hidden="true" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-sm font-semibold text-foreground">{item.name}</h3>
                      {item.description ? (
                        <p className="mt-0.5 text-xs text-muted-foreground">{item.description}</p>
                      ) : (
                        <p className="mt-0.5 text-xs text-muted-foreground">{meta.label}</p>
                      )}
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-between gap-2">
                    <span
                      className={cn(
                        "text-xs font-bold tabular-nums",
                        affordable ? "text-foreground" : "text-destructive",
                      )}
                    >
                      {formatXp(item.costAmount)} {currencyLabel(item.costCurrencyKey)}
                      {item.stock != null ? (
                        <span className="ml-1 font-medium text-muted-foreground">
                          · {item.stock} left
                        </span>
                      ) : null}
                    </span>
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => {
                        setConfirming(item);
                      }}
                      className={cn(
                        "rounded-lg px-3 py-1.5 text-xs font-semibold transition-[filter]",
                        soldOut || !affordable
                          ? "cursor-not-allowed bg-muted text-muted-foreground"
                          : "bg-primary text-primary-foreground hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      )}
                    >
                      {soldOut ? "Sold out" : affordable ? "Redeem" : "Insufficient"}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="rounded-lg border border-dashed border-border bg-muted/40 px-4 py-6 text-center text-sm text-muted-foreground">
            No rewards available yet.
          </p>
        )}

        {confirming ? (
          <div
            className="rounded-xl border border-border bg-muted/50 p-3"
            role="dialog"
            aria-label="Confirm redemption"
          >
            <p className="text-sm text-foreground">
              Redeem <strong className="font-semibold">{confirming.name}</strong> for{" "}
              {formatXp(confirming.costAmount)} {currencyLabel(confirming.costCurrencyKey)}?
            </p>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  void redeem(confirming);
                }}
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition-[filter] hover:brightness-110 disabled:opacity-60"
              >
                {busy ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                    Redeeming
                  </>
                ) : (
                  "Confirm"
                )}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setConfirming(null);
                }}
                className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-muted"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : null}

        {history.length > 0 ? (
          <div className="border-t border-border pt-4">
            <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Recently redeemed
            </h3>
            <ul className="mt-2 space-y-1.5">
              {history.slice(0, 5).map((entry) => (
                <li
                  key={entry.id}
                  className="flex items-center justify-between gap-2 text-xs text-muted-foreground"
                >
                  <span className="truncate text-foreground">{entry.rewardName}</span>
                  <span className="shrink-0 tabular-nums">
                    {entry.status === "fulfilled" ? "Fulfilled" : "Pending"} ·{" "}
                    {new Date(entry.redeemedAt).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </section>
  );
}
