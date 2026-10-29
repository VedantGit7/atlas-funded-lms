"use client";

import { MfaManager, type MfaApiPaths } from "@/features/account-security/MfaManager";

// Add and verify only: removing the console's only factor would lock the operator out.
const PLATFORM_MFA_API: MfaApiPaths = {
  factors: "/api/v1/platform/me/security/mfa",
  verify: "/api/v1/platform/me/security/mfa/verify",
};

/**
 * First-time MFA for a platform operator. The console requires a verified
 * factor, and an operator need not belong to any tenant, so the factor is set
 * up here through the platform's own enrollment routes. Verifying it completes
 * MFA for this session, so the console opens without signing in again.
 */
export function PlatformMfaSetup({ requestId }: { requestId: string }) {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-xl font-semibold">Set up multi-factor authentication</h1>
      <p className="mt-2 text-sm">
        The platform console requires an authenticator app. Scan the code with your app, enter the
        6-digit code it shows, then continue to the console.
      </p>
      <div className="mt-6">
        <MfaManager highlight api={PLATFORM_MFA_API} continuePath="/platform" />
      </div>
      <p className="mt-4 text-xs opacity-70">Request ID: {requestId}</p>
    </main>
  );
}
