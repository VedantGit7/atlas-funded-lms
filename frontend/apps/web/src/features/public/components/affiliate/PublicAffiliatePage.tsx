"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type AffiliateStatus = {
  enabled: boolean;
  accessMode: "PUBLIC" | "PRIVATE";
  askAdmin: boolean;
};

/**
 * Public view of the affiliate programme.
 *
 * `GET /api/v1/public/affiliates/status` is the anonymous counterpart to the
 * authenticated affiliate panel, and had no caller — so the only way to learn
 * whether a tenant even runs an affiliate programme was to create an account
 * first and look in your profile. That is backwards for a programme whose whole
 * purpose is recruiting people from outside.
 *
 * The three fields map to three genuinely different answers, which is why this
 * page branches rather than showing one generic CTA:
 *   - not enabled        → the programme does not exist here
 *   - PUBLIC             → anyone may join, so send them to sign-up
 *   - PRIVATE + askAdmin → it exists but is invite-only; ask an admin
 */
export function PublicAffiliatePage() {
  const [status, setStatus] = useState<AffiliateStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const response = await fetch("/api/v1/public/affiliates/status", {
          method: "GET",
          credentials: "include",
        });
        if (!response.ok) throw new Error(String(response.status));
        const json = (await response.json()) as { data: AffiliateStatus };
        setStatus(json.data);
      } catch {
        setFailed(true);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return <p className="p-8 text-sm text-[var(--muted-foreground)]">Loading…</p>;
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="text-3xl font-semibold text-foreground">Affiliate programme</h1>

      {failed || status === null ? (
        <p className="mt-4 text-sm text-[var(--muted-foreground)]">
          The affiliate programme details are not available right now.
        </p>
      ) : !status.enabled ? (
        <p className="mt-4 text-base text-[var(--muted-foreground)]">
          This academy does not run an affiliate programme.
        </p>
      ) : status.accessMode === "PUBLIC" ? (
        <>
          <p className="mt-4 text-base leading-relaxed text-foreground">
            Earn commission by referring learners to this academy. Create an account and you can
            join the programme from your profile.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/signup"
              className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
            >
              Create an account
            </Link>
            <Link
              href="/profile/affiliate"
              className="rounded-lg border border-border px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
            >
              I already have an account
            </Link>
          </div>
        </>
      ) : (
        <>
          <p className="mt-4 text-base leading-relaxed text-foreground">
            This academy runs an affiliate programme by invitation.
            {status.askAdmin ? " Contact an administrator to request access." : ""}
          </p>
          <Link
            href="/p/home"
            className="mt-8 inline-block text-sm font-semibold text-primary hover:underline"
          >
            Back to home
          </Link>
        </>
      )}
    </main>
  );
}
