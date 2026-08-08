import { PlatformTenantDetailClient } from "../../../../features/platform/components/PlatformTenantDetailClient";
import { PlatformPageGate } from "../../../../features/platform/components/PlatformPageGate";
import { loadPlatformPageAccess } from "../../../../lib/server/platform-page-access";

export default async function PlatformTenantDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const access = await loadPlatformPageAccess();

  if (access.kind === "denied") {
    return (
      <PlatformPageGate
        screenId="P3"
        state="denied"
        title="Tenant detail"
        deniedMessage={access.message}
      />
    );
  }

  if (!access.capabilities.canTenantRead) {
    return (
      <PlatformPageGate
        screenId="P3"
        state="denied"
        title="Tenant detail"
        deniedMessage="You do not have permission to view tenant details."
      />
    );
  }

  return (
    <PlatformPageGate screenId="P3" state="ready" title="Tenant detail">
      <PlatformTenantDetailClient tenantId={id} capabilities={access.capabilities} />
    </PlatformPageGate>
  );
}
