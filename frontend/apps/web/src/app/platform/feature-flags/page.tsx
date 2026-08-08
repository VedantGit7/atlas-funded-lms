import { GlobalFeatureFlagEditor } from "../../../features/platform/components/GlobalFeatureFlagEditor";
import { PlatformPageGate } from "../../../features/platform/components/PlatformPageGate";
import { loadPlatformPageAccess } from "../../../lib/server/platform-page-access";

export default async function PlatformFeatureFlagsPage() {
  const access = await loadPlatformPageAccess();

  if (access.kind === "denied") {
    return (
      <PlatformPageGate
        screenId="P4"
        state="denied"
        title="Global feature flags"
        deniedMessage={access.message}
      />
    );
  }

  if (!access.capabilities.canFeatureFlagManage) {
    return (
      <PlatformPageGate
        screenId="P4"
        state="denied"
        title="Global feature flags"
        deniedMessage="You do not have permission to manage global feature flags."
      />
    );
  }

  return (
    <PlatformPageGate screenId="P4" state="ready" title="Global feature flags">
      <GlobalFeatureFlagEditor />
    </PlatformPageGate>
  );
}
