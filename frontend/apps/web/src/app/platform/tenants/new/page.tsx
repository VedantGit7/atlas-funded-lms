import { ProvisionTenantWizard } from "../../../../features/platform/components/ProvisionTenantWizard";
import { PlatformPageGate } from "../../../../features/platform/components/PlatformPageGate";
import { loadPlatformPageAccess } from "../../../../lib/server/platform-page-access";

export default async function ProvisionTenantPage() {
  const access = await loadPlatformPageAccess();

  if (access.kind === "denied") {
    return (
      <PlatformPageGate
        screenId="P2"
        state="denied"
        title="Provision tenant"
        deniedMessage={access.message}
      />
    );
  }

  if (!access.capabilities.canTenantManage) {
    return (
      <PlatformPageGate
        screenId="P2"
        state="denied"
        title="Provision tenant"
        deniedMessage="You do not have permission to provision tenants."
      />
    );
  }

  return (
    <PlatformPageGate screenId="P2" state="ready" title="Provision tenant">
      <ProvisionTenantWizard />
    </PlatformPageGate>
  );
}
