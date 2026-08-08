"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ClientApiError, clientApi, toast } from "../../../lib/client-api";
import { formatMoney } from "../../admin/grow/coupons-shared";

type MyAffiliateProduct = {
  courseId: string;
  courseTitle: string | null;
  enabled: boolean;
  discountPct: number;
  commissionPct: number;
};

type MyAffiliate = {
  enabled: boolean;
  accessMode: "PUBLIC" | "PRIVATE";
  askAdmin: boolean;
  status: "none" | "pending" | "active" | "inactive";
  code: string | null;
  tier: "STANDARD" | "PREMIUM" | null;
  products: MyAffiliateProduct[];
  unpaidCents: number;
  paidCents: number;
  payoutUpi: string | null;
  payoutBankAccount: string | null;
  payoutIfsc: string | null;
  payoutAccountName: string | null;
  sharePath: string | null;
};

const FIELD =
  "w-full rounded-md border px-3 py-2 text-sm outline-none focus:border-[var(--acct-primary)] focus:ring-2 focus:ring-[var(--acct-primary)]/20";

export function LearnerAffiliatePanel() {
  const [affiliate, setAffiliate] = useState<MyAffiliate | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [savingPayout, setSavingPayout] = useState(false);
  const [payoutUpi, setPayoutUpi] = useState("");
  const [payoutBankAccount, setPayoutBankAccount] = useState("");
  const [payoutIfsc, setPayoutIfsc] = useState("");
  const [payoutAccountName, setPayoutAccountName] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await clientApi.get<{ data: MyAffiliate }>(
        "/api/v1/me/affiliate",
        "my-affiliate",
      );
      setAffiliate(response.data);
      setPayoutUpi(response.data.payoutUpi ?? "");
      setPayoutBankAccount(response.data.payoutBankAccount ?? "");
      setPayoutIfsc(response.data.payoutIfsc ?? "");
      setPayoutAccountName(response.data.payoutAccountName ?? "");
      setError(null);
    } catch (caught) {
      setError(
        caught instanceof ClientApiError ? caught.message : "Could not load affiliate program.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const shareUrl = useMemo(() => {
    if (!affiliate?.sharePath || typeof window === "undefined") return null;
    return `${window.location.origin}${affiliate.sharePath}`;
  }, [affiliate?.sharePath]);

  async function copyText(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} copied.`);
    } catch {
      toast.error(`Could not copy ${label.toLowerCase()}.`);
    }
  }

  async function onJoin() {
    setJoining(true);
    try {
      const response = await clientApi.post<{ data: MyAffiliate }>(
        "/api/v1/me/affiliate",
        {},
        "join-affiliate",
        { successMessage: "Affiliate request submitted." },
      );
      setAffiliate(response.data);
      setError(null);
    } catch (caught) {
      toast.error(caught instanceof ClientApiError ? caught.message : "Could not join program.");
    } finally {
      setJoining(false);
    }
  }

  async function onSavePayout() {
    setSavingPayout(true);
    try {
      const response = await clientApi.put<{ data: MyAffiliate }>(
        "/api/v1/me/affiliate",
        {
          payoutUpi: payoutUpi.trim() || null,
          payoutBankAccount: payoutBankAccount.trim() || null,
          payoutIfsc: payoutIfsc.trim() || null,
          payoutAccountName: payoutAccountName.trim() || null,
        },
        "my-affiliate-payout",
        { successMessage: "Payout details saved." },
      );
      setAffiliate(response.data);
    } catch (caught) {
      toast.error(
        caught instanceof ClientApiError ? caught.message : "Could not save payout details.",
      );
    } finally {
      setSavingPayout(false);
    }
  }

  if (loading) {
    return <p className="text-sm opacity-70">Loading affiliate program…</p>;
  }

  if (error) {
    return (
      <p role="alert" className="text-sm text-red-700">
        {error}
      </p>
    );
  }

  if (!affiliate) return null;

  if (!affiliate.enabled) {
    return (
      <div className="rounded-lg border border-dashed p-6 text-sm opacity-80">
        The affiliate program is not enabled for this school yet.
      </div>
    );
  }

  if (affiliate.status === "none") {
    return (
      <div className="space-y-4 rounded-lg border p-6">
        <p className="text-sm opacity-80">
          {affiliate.accessMode === "PRIVATE" && !affiliate.askAdmin
            ? "This affiliate program is invite-only. Contact your school admin for access."
            : affiliate.askAdmin
              ? "Apply to become an affiliate partner. An admin will review your request."
              : "Join the affiliate program and earn commissions when learners purchase through your link."}
        </p>
        {affiliate.accessMode === "PUBLIC" || affiliate.askAdmin ? (
          <button
            type="button"
            className="rounded-md border px-4 py-2 text-sm font-medium"
            disabled={joining}
            onClick={() => void onJoin()}
          >
            {joining ? "Submitting…" : affiliate.askAdmin ? "Apply to join" : "Join program"}
          </button>
        ) : null}
      </div>
    );
  }

  if (affiliate.status === "pending") {
    return (
      <div className="rounded-lg border border-dashed p-6 text-sm opacity-80">
        Your affiliate application is pending admin approval. You will be notified once reviewed.
      </div>
    );
  }

  if (affiliate.status === "inactive") {
    return (
      <div className="rounded-lg border border-dashed p-6 text-sm opacity-80">
        Your affiliate account is inactive. Contact your school admin if you believe this is a
        mistake.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border p-4">
          <p className="text-xs uppercase tracking-wide opacity-60">Your code</p>
          <p className="mt-1 font-mono text-xl font-semibold">{affiliate.code}</p>
          {affiliate.tier ? <p className="mt-1 text-xs opacity-60">{affiliate.tier} tier</p> : null}
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-xs uppercase tracking-wide opacity-60">Unpaid commissions</p>
          <p className="mt-1 text-xl font-semibold">{formatMoney(affiliate.unpaidCents, "USD")}</p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-xs uppercase tracking-wide opacity-60">Paid out</p>
          <p className="mt-1 text-xl font-semibold">{formatMoney(affiliate.paidCents, "USD")}</p>
        </div>
      </div>

      <div className="space-y-3 rounded-lg border p-4">
        <p className="text-sm font-medium">Share your affiliate link</p>
        <p className="text-sm opacity-70">
          Share your code or link at checkout. Learners get a discount and you earn commission on
          qualifying purchases.
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded-md border px-3 py-2 text-sm font-medium"
            onClick={() => void copyText(affiliate.code ?? "", "Affiliate code")}
          >
            Copy code
          </button>
          {shareUrl ? (
            <>
              <button
                type="button"
                className="rounded-md border px-3 py-2 text-sm font-medium"
                onClick={() => void copyText(shareUrl, "Affiliate link")}
              >
                Copy link
              </button>
              <a
                className="rounded-md border px-3 py-2 text-sm font-medium"
                href={`https://wa.me/?text=${encodeURIComponent(`Use my affiliate code ${String(affiliate.code)}: ${shareUrl}`)}`}
                target="_blank"
                rel="noreferrer"
              >
                WhatsApp
              </a>
              <a
                className="rounded-md border px-3 py-2 text-sm font-medium"
                href={`https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(`Use my affiliate code ${String(affiliate.code)}`)}`}
                target="_blank"
                rel="noreferrer"
              >
                Telegram
              </a>
            </>
          ) : null}
        </div>
      </div>

      {affiliate.products.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold">Products &amp; commissions</h2>
          <div className="overflow-x-auto rounded-lg border">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-[var(--acct-surface-container)] text-xs uppercase tracking-wide opacity-70">
                <tr>
                  <th className="px-3 py-2 font-medium">Course</th>
                  <th className="px-3 py-2 font-medium">Buyer discount</th>
                  <th className="px-3 py-2 font-medium">Your commission</th>
                </tr>
              </thead>
              <tbody>
                {affiliate.products.map((product) => (
                  <tr key={product.courseId} className="border-t">
                    <td className="px-3 py-2">{product.courseTitle ?? "Course"}</td>
                    <td className="px-3 py-2">{product.discountPct}%</td>
                    <td className="px-3 py-2">{product.commissionPct}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      <section className="space-y-4 rounded-lg border p-4">
        <div>
          <p className="text-sm font-medium">Payout details</p>
          <p className="mt-1 text-sm opacity-70">
            Add your bank or UPI details so admins can send commission payouts.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-xs font-medium">UPI ID</label>
            <input
              value={payoutUpi}
              onChange={(e) => {
                setPayoutUpi(e.target.value);
              }}
              className={FIELD}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium">Account holder name</label>
            <input
              value={payoutAccountName}
              onChange={(e) => {
                setPayoutAccountName(e.target.value);
              }}
              className={FIELD}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium">Bank account number</label>
            <input
              value={payoutBankAccount}
              onChange={(e) => {
                setPayoutBankAccount(e.target.value);
              }}
              className={FIELD}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium">IFSC</label>
            <input
              value={payoutIfsc}
              onChange={(e) => {
                setPayoutIfsc(e.target.value);
              }}
              className={FIELD}
            />
          </div>
        </div>
        <button
          type="button"
          className="rounded-md border px-4 py-2 text-sm font-medium"
          disabled={savingPayout}
          onClick={() => void onSavePayout()}
        >
          {savingPayout ? "Saving…" : "Save payout details"}
        </button>
      </section>
    </div>
  );
}
