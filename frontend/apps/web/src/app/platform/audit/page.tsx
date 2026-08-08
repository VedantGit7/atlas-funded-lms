import { PlatformAuditTable } from "../../../features/platform/components/PlatformAuditTable";
import { PlatformPageGate } from "../../../features/platform/components/PlatformPageGate";
import { loadPlatformPageAccess } from "../../../lib/server/platform-page-access";

export default async function PlatformAuditPage() {
  const access = await loadPlatformPageAccess();

  if (access.kind === "denied") {
    return (
      <PlatformPageGate
        screenId="P6"
        state="denied"
        title="Platform audit"
        deniedMessage={access.message}
      />
    );
  }

  if (!access.capabilities.canAuditRead) {
    return (
      <PlatformPageGate
        screenId="P6"
        state="denied"
        title="Platform audit"
        deniedMessage="You do not have permission to read the platform audit log."
      />
    );
  }

  return (
    <PlatformPageGate screenId="P6" state="ready" title="Platform audit">
      <PlatformAuditTable />
    </PlatformPageGate>
  );
}
