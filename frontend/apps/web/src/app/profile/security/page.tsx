import { PageGate } from "../../../components/patterns/PageGate";
import { AccountSettingsPageHeader } from "../../../features/account-settings/account-settings-page-header";
import { AccountSecuritySection } from "../../../features/account-security/AccountSecuritySection";
import { ServerApiError, serverApi } from "../../../lib/server-api";
import { resolveSafeRedirectPath } from "../../../lib/auth/safe-redirect";

type ProfileSecurityPageProps = {
  searchParams: Promise<{ setup?: string; next?: string }>;
};

export default async function ProfileSecurityPage({ searchParams }: ProfileSecurityPageProps) {
  const { setup, next } = await searchParams;
  const mfaSetupRequired = setup === "mfa";
  const continuePath = resolveSafeRedirectPath(next);

  try {
    const me = await serverApi.get<{
      data: { identity: { mfaEnabled: boolean } };
    }>("/api/v1/me");

    return (
      <PageGate state="ready" title="Security">
        <AccountSettingsPageHeader
          title="Security and access"
          description="Update your security preferences and monitor access to your account."
        />

        {mfaSetupRequired && !me.data.identity.mfaEnabled ? (
          <section role="status" className="mb-8 rounded-lg border border-[var(--acct-border)] bg-[var(--acct-surface-low)] p-4 text-sm">
            <p className="font-medium text-[var(--acct-on-surface)]">
              Set up multi-factor authentication to continue.
            </p>
            <p className="mt-1 text-[var(--acct-on-surface-variant)]">
              {continuePath
                ? `After MFA is enabled, you can return to ${continuePath}.`
                : "Use the authenticator setup below, then sign in again if prompted."}
            </p>
          </section>
        ) : null}

        <AccountSecuritySection highlightMfa={mfaSetupRequired} continuePath={continuePath} />
      </PageGate>
    );
  } catch (error) {
    if (error instanceof ServerApiError && (error.status === 401 || error.status === 403)) {
      return (
        <PageGate
          state="denied"
          title="Security"
          deniedMessage="You do not have permission to view security settings."
        />
      );
    }

    if (error instanceof ServerApiError) {
      return (
        <PageGate
          state="error"
          title="Security"
          errorMessage={`Failed to load security settings. Request ID: ${error.requestId}`}
        />
      );
    }

    throw error;
  }
}
