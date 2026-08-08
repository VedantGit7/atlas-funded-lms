import { DeadLetterEventTable } from "../../../features/platform/components/DeadLetterEventTable";
import { PlatformPageGate } from "../../../features/platform/components/PlatformPageGate";
import { loadPlatformPageAccess } from "../../../lib/server/platform-page-access";

export default async function PlatformEventingPage() {
  const access = await loadPlatformPageAccess();

  if (access.kind === "denied") {
    return (
      <PlatformPageGate
        screenId="P8"
        state="denied"
        title="Eventing"
        deniedMessage={access.message}
      />
    );
  }

  if (!access.capabilities.canEventingReplay) {
    return (
      <PlatformPageGate
        screenId="P8"
        state="denied"
        title="Eventing"
        deniedMessage="You do not have permission to manage eventing operations."
      />
    );
  }

  return (
    <PlatformPageGate screenId="P8" state="ready" title="Eventing">
      <DeadLetterEventTable />
    </PlatformPageGate>
  );
}
