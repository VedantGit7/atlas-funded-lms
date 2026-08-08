import { ChangePasswordForm, ChangeEmailForm, PhoneForm } from "./account-security-forms";
import { ConnectedAccounts, SignOutOtherSessionsCard } from "./ConnectedAccounts";
import { MfaManager } from "./MfaManager";

type AccountSecuritySectionProps = Readonly<{
  highlightMfa?: boolean;
  continuePath?: string | null;
}>;

export function AccountSecuritySection({
  highlightMfa = false,
  continuePath = null,
}: AccountSecuritySectionProps) {
  return (
    <div className="space-y-12">
      <ChangePasswordForm />
      <hr className="border-[var(--acct-border)]" />
      <ChangeEmailForm />
      <hr className="border-[var(--acct-border)]" />
      <PhoneForm />
      <hr className="border-[var(--acct-border)]" />
      <MfaManager highlight={highlightMfa} continuePath={continuePath} />
      <hr className="border-[var(--acct-border)]" />
      <SignOutOtherSessionsCard />
      <hr className="border-[var(--acct-border)]" />
      <ConnectedAccounts />
    </div>
  );
}
