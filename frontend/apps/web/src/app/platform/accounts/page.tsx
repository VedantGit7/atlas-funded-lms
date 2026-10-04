import { PlatformAccountReview } from "../../../features/platform/components/PlatformAccountReview";
import { PlatformPageGate } from "../../../features/platform/components/PlatformPageGate";
import { loadPlatformPageAccess } from "../../../lib/server/platform-page-access";

export default async function PlatformAccountsPage() {
  const access = await loadPlatformPageAccess();

  if (access.kind === "denied") {
    return (
      <PlatformPageGate
        screenId="P10"
        state="denied"
        title="Accounts"
        deniedMessage={access.message}
      />
    );
  }

  if (!access.capabilities.canIdentityManage) {
    return (
      <PlatformPageGate
        screenId="P10"
        state="denied"
        title="Accounts"
        deniedMessage="You do not have permission to review accounts."
      />
    );
  }

  return (
    <PlatformPageGate screenId="P10" state="ready" title="Accounts">
      <PlatformAccountReview />
    </PlatformPageGate>
  );
}
