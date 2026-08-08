"use client";

import Link from "next/link";
import { Award, Ban, Clock3, Home, PauseCircle, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { AdminPageGate, PageHeader } from "../../../../components/patterns/AdminPageGate";
import { clientApi } from "../../../../lib/client-api";
import {
  ghostButtonClassName,
  outlineButtonClassName,
} from "../../../../features/certificates/components/certificate-template-admin-shared";

type Counts = { issued: number; revoked: number; expired: number; suspended: number };

const EMPTY_COUNTS: Counts = { issued: 0, revoked: 0, expired: 0, suspended: 0 };
const CARDS = [
  { key: "issued", label: "Issued", icon: Award, tone: "var(--admin-success)" },
  { key: "revoked", label: "Revoked", icon: Ban, tone: "var(--admin-danger)" },
  { key: "expired", label: "Expired", icon: Clock3, tone: "var(--admin-on-surface-variant)" },
  { key: "suspended", label: "Suspended", icon: PauseCircle, tone: "var(--admin-warning)" },
] as const;

export default function CertificateAnalyticsPage() {
  const [counts, setCounts] = useState<Counts>(EMPTY_COUNTS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const response = await clientApi.get<{ data: Counts }>("/api/v1/certificates/analytics");
      setCounts(response.data);
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load certificate analytics.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <AdminPageGate screenId="T13" state="ready" title="Certificate analytics">
      <main className="flex flex-col gap-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <PageHeader
            title="Certificate analytics"
            description="A live status snapshot of every credential in this tenant."
          />
          <div className="flex items-center gap-3">
            <Link
              href="/admin/certificate-builder/home"
              className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--admin-primary)] px-3 py-2 text-sm font-semibold text-[var(--admin-on-primary)] shadow-md transition-all hover:opacity-90"
            >
              <Home className="h-4 w-4" aria-hidden="true" strokeWidth={2.25} />
              Go to Home screen
            </Link>
            <Link href="/admin/certificates" className={ghostButtonClassName}>
              View certificates
            </Link>
            <button
              type="button"
              className={outlineButtonClassName}
              disabled={loading}
              onClick={() => void refresh()}
            >
              <RefreshCw
                className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
                aria-hidden="true"
              />
              Refresh
            </button>
          </div>
        </header>

        {error ? (
          <div className="rounded-xl border border-[var(--admin-danger)]/30 bg-[var(--admin-surface)] p-4 text-sm text-[var(--admin-danger)]">
            {error}
          </div>
        ) : null}

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Status counts">
          {CARDS.map(({ key, label, icon: Icon, tone }) => (
            <article
              key={key}
              className="relative overflow-hidden rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5 shadow-sm"
            >
              <div
                className="absolute inset-x-0 top-0 h-1"
                style={{ backgroundColor: tone }}
                aria-hidden="true"
              />
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--admin-on-surface-variant)]">
                    {label}
                  </p>
                  <p className="mt-3 text-4xl font-semibold tabular-nums text-[var(--admin-on-surface)]">
                    {loading ? "—" : counts[key].toLocaleString()}
                  </p>
                </div>
                <div
                  className="flex h-11 w-11 items-center justify-center rounded-xl"
                  style={{
                    color: tone,
                    backgroundColor: `color-mix(in srgb, ${tone} 12%, transparent)`,
                  }}
                >
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </div>
              </div>
            </article>
          ))}
        </section>
      </main>
    </AdminPageGate>
  );
}
