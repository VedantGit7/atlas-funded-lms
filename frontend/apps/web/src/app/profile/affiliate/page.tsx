import { AccountSettingsPageHeader } from "../../../features/account-settings/account-settings-page-header";
import { LearnerAffiliatePanel } from "../../../features/learner/components/LearnerAffiliatePanel";

export default function ProfileAffiliatePage() {
  return (
    <div className="space-y-6">
      <AccountSettingsPageHeader
        title="Affiliate"
        description="Promote courses, share your affiliate link, and track commission earnings."
      />
      <LearnerAffiliatePanel />
    </div>
  );
}
