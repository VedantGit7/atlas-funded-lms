"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { platformApi } from "../platform-api";
import { usePlatformReason } from "./PlatformReasonProvider";
import { PlatformReasonGate } from "./PlatformReasonDialog";

type TenantRow = {
  id: string;
  slug: string;
  displayName: string;
  state: string;
  provisioning: { latestStatus: string | null };
};

export function PlatformTenantListClient({ canProvision }: { canProvision: boolean }) {
  const { reason, isValid } = usePlatformReason();
  const [rows, setRows] = useState<TenantRow[]>([]);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isValid || !reason) {
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    const params = new URLSearchParams();
    if (query.trim()) {
      params.set("q", query.trim());
    }

    platformApi
      .get<{ data: TenantRow[] }>(`/api/v1/platform/tenants?${params.toString()}`, reason)
      .then((response) => {
        if (!cancelled) {
          setRows(response.data);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Request failed.");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [isValid, reason, query]);

  return (
    <PlatformReasonGate ready={isValid} onPrompt={() => undefined}>
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Tenants</h1>
            <p className="text-sm opacity-70">
              Cross-tenant tenant registry and provisioning state.
            </p>
          </div>
          {canProvision ? (
            <Link
              href="/platform/tenants/new"
              className="rounded bg-neutral-900 px-3 py-2 text-sm text-white"
            >
              Provision tenant
            </Link>
          ) : null}
        </div>

        <label className="block text-sm">
          <span className="font-medium">Search</span>
          <input
            className="mt-1 w-full max-w-md rounded border px-3 py-2"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
            }}
            placeholder="Slug or display name"
          />
        </label>

        {loading ? <p>Loading tenants…</p> : null}
        {error ? (
          <p role="alert" className="text-sm text-red-700">
            {error}
          </p>
        ) : null}

        <table className="w-full border-collapse text-sm">
          <caption className="sr-only">Platform tenant list</caption>
          <thead>
            <tr className="border-b text-left">
              <th scope="col" className="py-2 pr-4">
                Tenant
              </th>
              <th scope="col" className="py-2 pr-4">
                State
              </th>
              <th scope="col" className="py-2 pr-4">
                Provisioning
              </th>
              <th scope="col" className="py-2">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b">
                <td className="py-3 pr-4">
                  <div className="font-medium">{row.displayName}</div>
                  <div className="text-xs opacity-70">{row.slug}</div>
                </td>
                <td className="py-3 pr-4">{row.state}</td>
                <td className="py-3 pr-4">{row.provisioning.latestStatus ?? "—"}</td>
                <td className="py-3">
                  <Link href={`/platform/tenants/${row.id}`} className="rounded border px-2 py-1">
                    View
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {!loading && rows.length === 0 ? <p>No tenants found.</p> : null}
      </section>
    </PlatformReasonGate>
  );
}
