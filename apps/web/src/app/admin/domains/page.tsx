import type { z } from "zod";
import type { EntitlementViewSchema } from "@atlas/domain-config/schemas/entitlements";
import type { DomainListResponseSchema } from "@atlas/domain-branding/schemas/domains";
import { DomainStatusPanel } from "./_components/DomainStatusPanel";
import { AddDomainDialog } from "./_components/AddDomainDialog";
import { serverApi } from "../../../lib/server-api";

type DomainListResponse = z.infer<typeof DomainListResponseSchema>;
type EntitlementView = z.infer<typeof EntitlementViewSchema>;

export default async function AdminDomainsPage() {
  const [domains, entitlements] = await Promise.all([
    serverApi.get<DomainListResponse>("/api/v1/domains"),
    serverApi.get<{ data: EntitlementView[] }>("/api/v1/entitlements"),
  ]);

  const customDomainEntitled = entitlements.data.some(
    (entitlement: EntitlementView) =>
      entitlement.key === "branding.custom_domain.enable" && entitlement.enabled,
  );

  return (
    <main className="space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1>Domains</h1>
          <p>Manage tenant fallback and custom domains for host-based tenant routing.</p>
        </div>
        <AddDomainDialog customDomainEntitled={customDomainEntitled} />
      </header>

      <DomainStatusPanel domains={domains.data} />
    </main>
  );
}
