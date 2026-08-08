import { PlatformTenantListClient } from "../../features/platform/components/PlatformTenantListClient";
import { PlatformPageGate } from "../../features/platform/components/PlatformPageGate";
import { loadPlatformPageAccess } from "../../lib/server/platform-page-access";

export default async function PlatformTenantsPage() {
  const access = await loadPlatformPageAccess();

  if (access.kind === "denied") {
    return (
      <PlatformPageGate screenId="P1" state="denied" title="Tenants" deniedMessage={access.message} />
    );
  }

  return (
    <PlatformPageGate screenId="P1" state="ready" title="Tenants">
      <PlatformTenantListClient canProvision={access.capabilities.canTenantManage} />
    </PlatformPageGate>
  );
}
