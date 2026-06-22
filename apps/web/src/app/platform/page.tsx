import { PlatformTenantListClient } from "../../features/platform/components/PlatformTenantListClient";
import { loadPlatformShellContext } from "../../lib/server/platform-shell-context";

export default async function PlatformTenantsPage() {
  const context = await loadPlatformShellContext();
  const canProvision = context.kind === "ready" && context.capabilities.canTenantManage;

  return <PlatformTenantListClient canProvision={canProvision} />;
}
