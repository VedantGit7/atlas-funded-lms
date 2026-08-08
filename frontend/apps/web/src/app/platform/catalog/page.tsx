import { GlobalCatalogTabs } from "../../../features/platform/components/GlobalCatalogTabs";
import { PlatformPageGate } from "../../../features/platform/components/PlatformPageGate";
import { loadPlatformPageAccess } from "../../../lib/server/platform-page-access";

export default async function PlatformCatalogPage() {
  const access = await loadPlatformPageAccess();

  if (access.kind === "denied") {
    return (
      <PlatformPageGate
        screenId="P5"
        state="denied"
        title="Global catalog"
        deniedMessage={access.message}
      />
    );
  }

  if (!access.capabilities.canCatalogManage) {
    return (
      <PlatformPageGate
        screenId="P5"
        state="denied"
        title="Global catalog"
        deniedMessage="You do not have permission to manage the global catalog."
      />
    );
  }

  return (
    <PlatformPageGate screenId="P5" state="ready" title="Global catalog">
      <GlobalCatalogTabs />
    </PlatformPageGate>
  );
}
