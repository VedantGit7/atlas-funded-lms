import { AccountSettingsPageHeader } from "../../../features/account-settings/account-settings-page-header";
import { LearnerWalletPanel } from "../../../features/learner/components/LearnerWalletPanel";

export default function ProfileWalletPage() {
  return (
    <div className="space-y-6">
      <AccountSettingsPageHeader
        title="Wallet"
        description="View your reward credits, spending history, and available balance."
      />
      <LearnerWalletPanel />
    </div>
  );
}
