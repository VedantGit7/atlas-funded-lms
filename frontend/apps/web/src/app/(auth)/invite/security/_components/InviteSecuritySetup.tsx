"use client";

import { MfaManager } from "@/features/account-security/MfaManager";
import { resolveSafeRedirectPath } from "@/lib/auth/safe-redirect";

const cardClass =
  "w-full rounded-[16px] border-[1.5px] border-[var(--fba-bdr)] bg-[var(--fba-surf)] p-7 shadow-[0_24px_60px_rgba(0,0,0,0.12)]";

const headlineClass =
  "text-[24px] font-bold leading-[1.25] tracking-[-0.01em] text-[var(--fba-tx)]";

const bodyClass = "text-[14px] leading-[1.6] text-[var(--fba-tx2)]";

type InviteSecuritySetupProps = Readonly<{
  continuePath: string;
}>;

export function InviteSecuritySetup({ continuePath }: InviteSecuritySetupProps) {
  const safeContinuePath = resolveSafeRedirectPath(continuePath) ?? "/admin";

  return (
    <section aria-labelledby="invite-security-title" className={cardClass}>
      <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--fba-ind-tx)]">
        Almost there
      </p>
      <h1 id="invite-security-title" className={`mb-2 ${headlineClass}`}>
        Secure your account
      </h1>
      <p className={`mb-6 ${bodyClass}`}>
        Your academy requires multi-factor authentication before you can access the admin console.
        Set up an authenticator app below, then continue.
      </p>

      <MfaManager highlight continuePath={safeContinuePath} />
    </section>
  );
}
