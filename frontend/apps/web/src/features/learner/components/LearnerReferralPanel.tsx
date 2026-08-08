"use client";

import { useEffect, useMemo, useState } from "react";
import { ClientApiError, clientApi, toast } from "../../../lib/client-api";

type MyReferral = {
  enabled: boolean;
  walletEnabled: boolean;
  code: string | null;
  sharePath: string | null;
  successfulReferrals: number;
  totalRewardsEarned: number;
  referrerSignupCredits: number;
  refereeSignupCredits: number;
  referrerPurchaseCredits: number;
  maxReferrals: number | null;
  remainingReferrals: number | null;
};

export function LearnerReferralPanel() {
  const [referral, setReferral] = useState<MyReferral | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      try {
        const response = await clientApi.get<{ data: MyReferral }>(
          "/api/v1/me/referral",
          "my-referral",
        );
        if (!cancelled) {
          setReferral(response.data);
          setError(null);
        }
      } catch (caught) {
        if (!cancelled) {
          setError(caught instanceof ClientApiError ? caught.message : "Could not load referrals.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const shareUrl = useMemo(() => {
    if (!referral?.sharePath || typeof window === "undefined") return null;
    return `${window.location.origin}${referral.sharePath}`;
  }, [referral?.sharePath]);

  async function copyText(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} copied.`);
    } catch {
      toast.error(`Could not copy ${label.toLowerCase()}.`);
    }
  }

  if (loading) {
    return <p className="text-sm opacity-70">Loading Invite &amp; Earn…</p>;
  }

  if (error) {
    return (
      <p role="alert" className="text-sm text-red-700">
        {error}
      </p>
    );
  }

  if (!referral) return null;

  if (!referral.enabled) {
    return (
      <div className="rounded-lg border border-dashed p-6 text-sm opacity-80">
        {referral.walletEnabled
          ? "Refer & Earn is not enabled for this school yet."
          : "Wallet rewards must be enabled before referrals can grant credits."}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border p-4">
          <p className="text-xs uppercase tracking-wide opacity-60">Your code</p>
          <p className="mt-1 font-mono text-xl font-semibold">{referral.code}</p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-xs uppercase tracking-wide opacity-60">Successful referrals</p>
          <p className="mt-1 text-xl font-semibold">{referral.successfulReferrals}</p>
          {referral.remainingReferrals != null ? (
            <p className="mt-1 text-xs opacity-60">{referral.remainingReferrals} remaining</p>
          ) : null}
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-xs uppercase tracking-wide opacity-60">Rewards earned</p>
          <p className="mt-1 text-xl font-semibold">{referral.totalRewardsEarned} credits</p>
        </div>
      </div>

      <div className="space-y-3 rounded-lg border p-4">
        <p className="text-sm font-medium">Share your invite</p>
        <p className="text-sm opacity-70">
          Friends who sign up with your code earn {referral.refereeSignupCredits} credits. You earn{" "}
          {referral.referrerSignupCredits} on signup
          {referral.referrerPurchaseCredits > 0
            ? ` and ${referral.referrerPurchaseCredits} when they purchase`
            : ""}
          .
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded-md border px-3 py-2 text-sm font-medium"
            onClick={() => void copyText(referral.code ?? "", "Referral code")}
          >
            Copy code
          </button>
          {shareUrl ? (
            <>
              <button
                type="button"
                className="rounded-md border px-3 py-2 text-sm font-medium"
                onClick={() => void copyText(shareUrl, "Invite link")}
              >
                Copy link
              </button>
              <a
                className="rounded-md border px-3 py-2 text-sm font-medium"
                href={`https://wa.me/?text=${encodeURIComponent(`Join with my referral code ${referral.code}: ${shareUrl}`)}`}
                target="_blank"
                rel="noreferrer"
              >
                WhatsApp
              </a>
              <a
                className="rounded-md border px-3 py-2 text-sm font-medium"
                href={`https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(`Join with my referral code ${referral.code}`)}`}
                target="_blank"
                rel="noreferrer"
              >
                Telegram
              </a>
              <a
                className="rounded-md border px-3 py-2 text-sm font-medium"
                href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`}
                target="_blank"
                rel="noreferrer"
              >
                Facebook
              </a>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
