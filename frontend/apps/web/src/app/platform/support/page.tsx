import { SupportSessionPanel } from "../../../features/platform/components/SupportSessionPanel";
import { PlatformPageGate } from "../../../features/platform/components/PlatformPageGate";
import { loadPlatformPageAccess } from "../../../lib/server/platform-page-access";

export default async function PlatformSupportPage() {
  const access = await loadPlatformPageAccess();

  if (access.kind === "denied") {
    return (
      <PlatformPageGate
        screenId="P7"
        state="denied"
        title="Support sessions"
        deniedMessage={access.message}
      />
    );
  }

  if (!access.capabilities.canSupportAccess) {
    return (
      <PlatformPageGate
        screenId="P7"
        state="denied"
        title="Support sessions"
        deniedMessage="You do not have permission to open support sessions."
      />
    );
  }

  return (
    <PlatformPageGate screenId="P7" state="ready" title="Support sessions">
      <SupportSessionPanel />
    </PlatformPageGate>
  );
}
