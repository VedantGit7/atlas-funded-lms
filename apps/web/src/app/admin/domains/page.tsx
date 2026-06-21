import type { z } from "zod";
import type { EntitlementViewSchema } from "@atlas/domain-config/schemas/entitlements";
import type { DomainListResponseSchema } from "@atlas/domain-branding/schemas/domains";
import { AdminPageGate, PageHeader } from "../../../components/patterns/AdminPageGate";
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
        <main className="space-y-6">
          <header className="flex items-start justify-between gap-4">
            <PageHeader
              title="Domains"
              description="Manage tenant fallback and custom domains for host-based tenant routing."
            />
            <AddDomainDialog customDomainEntitled={customDomainEntitled} />
          </header>

          <DomainStatusPanel domains={domains.data} />
        </main>
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

    throw error;
  }
}
