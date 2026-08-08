import Link from "next/link";
import type { z } from "zod";
import type { EntitlementViewSchema } from "@atlas/domain-config/schemas/entitlements";
import type { DomainListResponseSchema } from "@atlas/domain-branding/schemas/domains";
import { Info } from "lucide-react";
import { AdminPageGate } from "../../../components/patterns/AdminPageGate";
import { DomainStatusPanel } from "./_components/DomainStatusPanel";
import { AddDomainDialog } from "./_components/AddDomainDialog";
import { ServerApiError, serverApi } from "../../../lib/server-api";

type DomainListResponse = z.infer<typeof DomainListResponseSchema>;
type EntitlementView = z.infer<typeof EntitlementViewSchema>;

export default async function AdminDomainsPage() {
  try {
    const [domains, entitlements] = await Promise.all([
      serverApi.get<DomainListResponse>("/api/v1/domains"),
      serverApi.get<{ data: EntitlementView[] }>("/api/v1/entitlements"),
    ]);

    const customDomainEntitled = entitlements.data.some(
      (entitlement: EntitlementView) =>
        entitlement.key === "branding.custom_domain.enable" && entitlement.enabled,
    );

    return (
      <AdminPageGate screenId="T7" state="ready" title="Domains">
        <div className="mx-auto max-w-7xl space-y-6">
          <header className="flex flex-col gap-4 border-b border-[var(--admin-border)] pb-6 md:flex-row md:items-end md:justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-[var(--admin-on-surface)] sm:text-3xl">
                Domains
              </h1>
              <p className="mt-1 max-w-2xl text-sm leading-relaxed text-[var(--admin-on-surface-variant)]">
                Manage tenant hostnames for host-based routing.
              </p>
            </div>
            <AddDomainDialog customDomainEntitled={customDomainEntitled} />
          </header>

          <DomainStatusPanel domains={domains.data} />

          <aside className="flex gap-4 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-low)]/50 p-4">
            <Info
              className="mt-0.5 h-5 w-5 shrink-0 text-[var(--admin-on-surface-variant)]"
              aria-hidden="true"
            />
            <p className="text-sm leading-relaxed text-[var(--admin-on-surface-variant)]">
              Looking to route to a specific program? Path-based routing can be configured in{" "}
              <Link
                href="/admin/config"
                className="font-medium text-[var(--admin-primary)] transition-colors hover:underline"
              >
                tenant configuration
              </Link>{" "}
              after domain verification is complete.
            </p>
          </aside>
        </div>
      </AdminPageGate>
    );
  } catch (error) {
    if (error instanceof ServerApiError && (error.status === 401 || error.status === 403)) {
      return (
        <AdminPageGate
          screenId="T7"
          state="denied"
          title="Domains"
          deniedMessage="You do not have permission to view tenant domains."
        />
      );
    }

    if (error instanceof ServerApiError) {
      return (
        <AdminPageGate screenId="T7" state="ready" title="Domains">
          <div className="mx-auto max-w-7xl">
            <header className="border-b border-[var(--admin-border)] pb-6">
              <h1 className="text-2xl font-bold tracking-tight text-[var(--admin-on-surface)] sm:text-3xl">
                Domains
              </h1>
              <p className="mt-1 text-sm text-[var(--admin-on-surface-variant)]">
                Manage tenant hostnames for host-based routing.
              </p>
            </header>
            <div
              role="alert"
              className="mt-6 rounded-lg border border-[var(--admin-danger)]/30 bg-[var(--admin-danger)]/10 px-4 py-3 text-sm text-[var(--admin-danger)]"
            >
              Could not load domains ({error.code}). {error.message}
            </div>
          </div>
        </AdminPageGate>
      );
    }

    throw error;
  }
}
