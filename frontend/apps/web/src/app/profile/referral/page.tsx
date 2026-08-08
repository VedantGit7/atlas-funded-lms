import { AccountSettingsPageHeader } from "../../../features/account-settings/account-settings-page-header";
import { LearnerReferralPanel } from "../../../features/learner/components/LearnerReferralPanel";

export default function ProfileReferralPage() {
  return (
    <div className="space-y-6">
      <AccountSettingsPageHeader
        title="Invite & Earn"
        description="Share your referral code, track successful invites, and earn wallet credits."
      />
      <LearnerReferralPanel />
    </div>
  );
}
