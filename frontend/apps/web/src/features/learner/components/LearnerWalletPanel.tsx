"use client";

import { useEffect, useState } from "react";
import { ClientApiError, clientApi } from "../../../lib/client-api";
import { formatMoney } from "../../admin/grow/coupons-shared";
import { cancellationFlag } from "@/lib/effect-cancellation";

type WalletTransaction = {
  id: string;
  direction: "CREDIT" | "DEBIT";
  reason: string;
  credits: number;
  balanceAfter: number;
  moneyCents: number | null;
  currency: string | null;
  note: string | null;
  createdAt: string;
};

type MyWallet = {
  enabled: boolean;
  creditValueCents: number;
  currency: string;
  maxCreditsPerOrder: number | null;
  availableBalance: number;
  earnedCredits: number;
  usedCredits: number;
  transactions: WalletTransaction[];
};

export function LearnerWalletPanel() {
  const [wallet, setWallet] = useState<MyWallet | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const effect = cancellationFlag();
    void (async () => {
      setLoading(true);
      try {
        const response = await clientApi.get<{ data: MyWallet }>("/api/v1/me/wallet", "my-wallet");
        if (!effect.isCancelled()) {
          setWallet(response.data);
          setError(null);
        }
      } catch (caught) {
        if (!effect.isCancelled()) {
          setError(caught instanceof ClientApiError ? caught.message : "Could not load wallet.");
        }
      } finally {
        if (!effect.isCancelled()) setLoading(false);
      }
    })();
    return () => {
      effect.cancel();
    };
  }, []);

  if (loading) {
    return <p className="text-sm opacity-70">Loading wallet…</p>;
  }

  if (error) {
    return (
      <p role="alert" className="text-sm text-destructive-text">
        {error}
      </p>
    );
  }

  if (!wallet) return null;

  if (!wallet.enabled) {
    return (
      <div className="rounded-lg border border-dashed p-6 text-sm opacity-80">
        Wallet rewards are not enabled for this school yet.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border p-4">
          <p className="text-xs font-semibold uppercase tracking-wide opacity-60">Available</p>
          <p className="mt-2 text-2xl font-semibold">{wallet.availableBalance}</p>
          <p className="mt-1 text-xs opacity-70">
            ≈ {formatMoney(wallet.availableBalance * wallet.creditValueCents, wallet.currency)}
          </p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-xs font-semibold uppercase tracking-wide opacity-60">Earned</p>
          <p className="mt-2 text-2xl font-semibold">{wallet.earnedCredits}</p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-xs font-semibold uppercase tracking-wide opacity-60">Used</p>
          <p className="mt-2 text-2xl font-semibold">{wallet.usedCredits}</p>
        </div>
      </div>

      <p className="text-sm opacity-70">
        1 credit = {formatMoney(wallet.creditValueCents, wallet.currency)}
        {wallet.maxCreditsPerOrder != null
          ? ` · max ${wallet.maxCreditsPerOrder} credits per order`
          : ""}
      </p>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Transaction log</h2>
        {wallet.transactions.length === 0 ? (
          <p className="text-sm opacity-70">No transactions yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-muted/50 text-xs uppercase tracking-wide opacity-70">
                <tr>
                  <th className="px-3 py-2">When</th>
                  <th className="px-3 py-2">Type</th>
                  <th className="px-3 py-2">Credits</th>
                  <th className="px-3 py-2">Balance</th>
                  <th className="px-3 py-2">Note</th>
                </tr>
              </thead>
              <tbody>
                {wallet.transactions.map((tx) => (
                  <tr key={tx.id} className="border-t">
                    <td className="px-3 py-2 whitespace-nowrap">
                      {new Date(tx.createdAt).toLocaleString()}
                    </td>
                    <td className="px-3 py-2">
                      {tx.direction === "CREDIT" ? "+" : "−"} {tx.reason.replaceAll("_", " ")}
                    </td>
                    <td className="px-3 py-2">{tx.credits}</td>
                    <td className="px-3 py-2">{tx.balanceAfter}</td>
                    <td className="px-3 py-2 opacity-70">{tx.note ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
