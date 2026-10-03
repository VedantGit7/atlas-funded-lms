import { PlatformCostAttribution } from "../../../features/platform/components/PlatformCostAttribution";
import { PlatformPageGate } from "../../../features/platform/components/PlatformPageGate";
import { loadPlatformPageAccess } from "../../../lib/server/platform-page-access";

export default async function PlatformCostsPage() {
  const access = await loadPlatformPageAccess();

  if (access.kind === "denied") {
    return (
      <PlatformPageGate screenId="P9" state="denied" title="Costs" deniedMessage={access.message} />
    );
  }

  if (!access.capabilities.canCostRead) {
    return (
      <PlatformPageGate
        screenId="P9"
        state="denied"
        title="Costs"
        deniedMessage="You do not have permission to view platform costs."
      />
    );
  }

  return (
    <PlatformPageGate screenId="P9" state="ready" title="Costs">
      <PlatformCostAttribution canManage={access.capabilities.canCostManage} />
    </PlatformPageGate>
  );
}
