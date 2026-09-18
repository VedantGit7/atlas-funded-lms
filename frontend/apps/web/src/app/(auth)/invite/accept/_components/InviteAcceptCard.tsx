"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import {
  acceptInvitationAction,
  setInvitationPasswordAction,
  type AcceptInvitationActionState,
} from "../_actions/accept-invitation-action";
import { InviteSignOutButton } from "./InviteSignOutButton";
import { VerificationSuccess } from "../../../login/_components/VerificationSuccess";

const initialState: AcceptInvitationActionState = {
  ok: false,
  message: "",
  requestId: "",
};

const cardClass =
  "w-full rounded-[16px] border-[1.5px] border-[var(--fba-bdr)] bg-[var(--fba-surf)] p-7 shadow-[0_24px_60px_rgba(0,0,0,0.12)]";

const headlineClass =
  "text-[24px] font-bold leading-[1.25] tracking-[-0.01em] text-[var(--fba-tx)]";

const bodyClass = "text-[14px] leading-[1.6] text-[var(--fba-tx2)]";

const labelClass = "block text-[12px] font-bold uppercase tracking-[0.05em] text-[var(--fba-tx2)]";

const inputClass =
  "w-full rounded-[10px] border-[1.5px] border-[var(--fba-bdr)] bg-[var(--fba-bg2)] px-4 py-3 pr-12 text-[15px] text-[var(--fba-tx)] outline-none transition-all placeholder:text-[var(--fba-tx3)] focus:border-transparent focus:ring-2 focus:ring-[var(--fba-ind)]";

const primaryButtonClass =
  "flex w-full items-center justify-center gap-2 rounded-[10px] bg-[var(--fba-ind)] px-4 py-4 text-[15px] font-bold text-white transition-all hover:bg-[var(--fba-ind-d)] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-70";

const secondaryButtonClass =
  "flex items-center justify-center rounded-[10px] border-[1.5px] border-[var(--fba-bdr)] px-4 py-3 text-[14px] font-semibold text-[var(--fba-tx)] no-underline transition-colors hover:border-[var(--fba-bdr2)]";

type InviteAcceptCardProps = Readonly<{
  token: string;
  isAuthenticated: boolean;
  signedInEmail: string | null;
  invitedEmail: string | null;
  inviteValid: boolean;
}>;

type InviteSession = {
  accessToken: string;
  refreshToken: string;
};

// Invitation links land here with the invited account's session in the URL hash
// (Supabase implicit flow for invite / magic-link). We read it once on mount so
// the invitee finishes as their own account, regardless of who was signed in.
const INVITE_HASH_TYPES = new Set(["invite", "magiclink", "signup", "recovery"]);

function readInviteSessionFromHash(): InviteSession | null {
  if (typeof window === "undefined") {
    return null;
  }

  const rawHash = window.location.hash.startsWith("#")
    ? window.location.hash.slice(1)
    : window.location.hash;

  if (!rawHash) {
    return null;
  }

  const params = new URLSearchParams(rawHash);
  const accessToken = params.get("access_token");
  const refreshToken = params.get("refresh_token");
  const type = params.get("type");

  if (!accessToken || (type && !INVITE_HASH_TYPES.has(type))) {
    return null;
  }

  return { accessToken, refreshToken: refreshToken ?? "" };
}

function emailsMismatch(signedInEmail: string | null, invitedEmail: string | null): boolean {
  return Boolean(signedInEmail && invitedEmail && signedInEmail !== invitedEmail);
}

function passwordStrength(password: string): number {
  if (!password) {
    return 0;
  }

  let score = 0;
  if (password.length >= 8) score += 1;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1;
  if (/\d/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;
  return score;
}

function EyeIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {open ? (
        <>
          <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
          <circle cx="12" cy="12" r="3" />
        </>
      ) : (
        <>
          <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c6.5 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
          <path d="M6.61 6.61A13.53 13.53 0 0 0 2 12s3.5 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
          <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24M2 2l20 20" />
        </>
      )}
    </svg>
  );
}

function Spinner() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      className="animate-spin"
      aria-hidden
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.3" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

function StrengthMeter({ score }: { score: number }) {
  return (
    <div className="flex h-1 w-full gap-1" aria-hidden>
      {[0, 1, 2, 3].map((index) => (
        <div
          key={index}
          className={`flex-1 rounded-full transition-colors ${
            index < score ? "bg-[var(--fba-ind)]" : "bg-[var(--fba-bdr)]"
          }`}
        />
      ))}
    </div>
  );
}

function CardShell({ labelledBy, children }: { labelledBy: string; children: ReactNode }) {
  return (
    <section aria-labelledby={labelledBy} className={cardClass}>
      {children}
    </section>
  );
}

function InvalidInviteCard({
  token,
  signedInEmail,
}: {
  token: string;
  signedInEmail: string | null;
}) {
  return (
    <CardShell labelledBy="invite-invalid-title">
      <h2 id="invite-invalid-title" className={`mb-2 ${headlineClass}`}>
        Invitation unavailable
      </h2>
      <p className={bodyClass}>
        This invitation link is invalid or has expired. Ask your academy administrator to send a new
        invitation, then open the link from the latest email.
      </p>
      {signedInEmail ? (
        <div className="mt-5 space-y-3">
          <p className={`text-[13px] ${bodyClass}`}>
            You&apos;re currently signed in as{" "}
            <span className="font-semibold text-[var(--fba-tx)]">{signedInEmail}</span>. If the
            invitation was sent to a different address, sign out and use the link from that inbox.
          </p>
          <InviteSignOutButton redirectTo={`/invite/accept?token=${encodeURIComponent(token)}`} />
        </div>
      ) : null}
    </CardShell>
  );
}

export function InviteAcceptCard({
  token,
  isAuthenticated,
  signedInEmail,
  invitedEmail,
  inviteValid,
}: InviteAcceptCardProps) {
  const [acceptState, acceptAction, acceptPending] = useActionState(
    acceptInvitationAction,
    initialState,
  );
  const [passwordState, passwordAction, passwordPending] = useActionState(
    setInvitationPasswordAction,
    initialState,
  );
  const [inviteSession, setInviteSession] = useState<InviteSession | null>(null);
  const [hashChecked, setHashChecked] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [password, setPassword] = useState("");

  useEffect(() => {
    const session = readInviteSessionFromHash();
    if (session) {
      setInviteSession(session);
      // Strip the tokens from the address bar so they aren't left in history.
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
    }
    setHashChecked(true);
  }, []);

  const mismatch = useMemo(
    () => emailsMismatch(signedInEmail, invitedEmail),
    [signedInEmail, invitedEmail],
  );

  const strength = passwordStrength(password);

  // Same pattern as LoginForm: server actions set session cookies, then the
  // client performs a full navigation. redirect() inside the action drops tenant
  // host context on the destination RSC render and causes TENANT_NOT_FOUND.
  useEffect(() => {
    if (passwordState.ok && passwordState.destination) {
      window.location.assign(passwordState.destination);
    }
  }, [passwordState.ok, passwordState.destination]);

  useEffect(() => {
    if (acceptState.ok && acceptState.destination) {
      window.location.assign(acceptState.destination);
    }
  }, [acceptState.ok, acceptState.destination]);

  if (passwordState.ok && passwordState.destination) {
    return (
      <VerificationSuccess
        destination={passwordState.destination}
        title="Account ready"
        message="Your password is set. Taking you to the next step…"
      />
    );
  }

  if (acceptState.ok && acceptState.destination) {
    return (
      <VerificationSuccess
        destination={acceptState.destination}
        title="Invitation accepted"
        message="You're in. Taking you to your academy…"
      />
    );
  }

  if (!token) {
    return (
      <CardShell labelledBy="invite-missing-token">
        <h2 id="invite-missing-token" className={headlineClass}>
          Invitation required
        </h2>
        <p className={`mt-2 ${bodyClass}`}>This page requires a valid invitation link.</p>
      </CardShell>
    );
  }

  // Primary path: the email link delivered an invited session. Let the invitee
  // set a password and finish — this takes over from any prior session.
  if (inviteSession) {
    return (
      <CardShell labelledBy="invite-set-password-title">
        <h2 id="invite-set-password-title" className={`mb-2 ${headlineClass}`}>
          Set your password
        </h2>
        {invitedEmail ? (
          <p className={bodyClass}>
            Secure your account for{" "}
            <span className="font-bold text-[var(--fba-tx)]">{invitedEmail}</span>. Choose a strong,
            unique password.
          </p>
        ) : (
          <p className={bodyClass}>
            Choose a strong, unique password to finish setting up your account.
          </p>
        )}

        {mismatch ? (
          <p className="mt-4 rounded-[10px] border-[1.5px] border-[var(--fba-bdr)] bg-[var(--fba-bg2)] p-3 text-[12px] text-[var(--fba-tx2)]">
            You were signed in as{" "}
            <span className="font-semibold text-[var(--fba-tx)]">{signedInEmail}</span>. Completing
            this step signs you in as{" "}
            <span className="font-semibold text-[var(--fba-tx)]">
              {invitedEmail ?? "the invited user"}
            </span>
            .
          </p>
        ) : null}

        {passwordState.message ? (
          <p
            role="alert"
            className={`mt-4 text-[13px] ${
              passwordState.ok ? "text-[var(--fba-grn)]" : "text-[var(--fba-red-tx)]"
            }`}
          >
            {passwordState.message}
          </p>
        ) : null}

        <form action={passwordAction} className="mt-6 space-y-5">
          <input type="hidden" name="token" value={token} />
          <input type="hidden" name="accessToken" value={inviteSession.accessToken} />
          <input type="hidden" name="refreshToken" value={inviteSession.refreshToken} />

          <div className="space-y-2">
            <label htmlFor="invite-password" className={labelClass}>
              New password
            </label>
            <div className="relative">
              <input
                id="invite-password"
                name="password"
                type={showPassword ? "text" : "password"}
                required
                minLength={8}
                autoComplete="new-password"
                placeholder="At least 8 characters"
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value);
                }}
                className={inputClass}
              />
              <button
                type="button"
                onClick={() => {
                  setShowPassword((prev) => !prev);
                }}
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--fba-tx3)] transition-colors hover:text-[var(--fba-tx)]"
              >
                <EyeIcon open={showPassword} />
              </button>
            </div>
            <StrengthMeter score={strength} />
          </div>

          <button type="submit" disabled={passwordPending} className={primaryButtonClass}>
            {passwordPending ? <Spinner /> : null}
            {passwordPending ? "Setting up your account..." : "Set password and continue"}
          </button>
        </form>
      </CardShell>
    );
  }

  // Wait for the one-shot hash read before deciding which fallback to show, so a
  // valid invite link never briefly flashes the sign-in prompt.
  if (!hashChecked) {
    return (
      <CardShell labelledBy="invite-loading">
        <h2 id="invite-loading" className="sr-only">
          Loading invitation
        </h2>
        <p className={bodyClass}>Loading invitation...</p>
      </CardShell>
    );
  }

  if (!inviteValid) {
    return <InvalidInviteCard token={token} signedInEmail={signedInEmail} />;
  }

  if (!isAuthenticated) {
    const loginHref = `/login?next=${encodeURIComponent(`/invite/accept?token=${token}`)}`;
    const signupHref = `/signup?inviteToken=${encodeURIComponent(token)}`;

    return (
      <CardShell labelledBy="invite-auth-required">
        <h2 id="invite-auth-required" className={`mb-2 ${headlineClass}`}>
          Accept your invitation
        </h2>
        {invitedEmail ? (
          <p className={bodyClass}>
            This invitation was sent to{" "}
            <span className="font-bold text-[var(--fba-tx)]">{invitedEmail}</span>. Open the link in
            your invitation email to continue, or sign in with that email.
          </p>
        ) : (
          <p className={bodyClass}>
            Open the link in your invitation email to continue, or sign in to accept this
            invitation.
          </p>
        )}
        <div className="mt-6 flex flex-col gap-3">
          <Link href={signupHref} className={primaryButtonClass}>
            Create account
          </Link>
          <Link href={loginHref} className={secondaryButtonClass}>
            Sign in
          </Link>
        </div>
      </CardShell>
    );
  }

  // Authenticated but no invited session in the hash (e.g. the link was already
  // consumed). If the signed-in account is the invited one, accept directly;
  // otherwise prompt them to switch.
  return (
    <CardShell labelledBy="invite-accept-title">
      <h2 id="invite-accept-title" className={`mb-2 ${headlineClass}`}>
        Accept invitation
      </h2>
      <p className={bodyClass}>Your role was assigned by your academy administrator.</p>

      <div className="mt-4 space-y-1">
        {invitedEmail ? (
          <p className={`text-[13px] ${bodyClass}`}>
            Invitation sent to{" "}
            <span className="font-semibold text-[var(--fba-tx)]">{invitedEmail}</span>.
          </p>
        ) : null}

        {signedInEmail ? (
          <p className={`text-[13px] ${bodyClass}`}>
            Signed in as <span className="font-semibold text-[var(--fba-tx)]">{signedInEmail}</span>
            .
          </p>
        ) : null}
      </div>

      {mismatch ? (
        <div
          role="alert"
          className="mt-5 space-y-3 rounded-[10px] border-[1.5px] border-[var(--fba-red)]/30 bg-[var(--fba-red)]/5 p-4 text-[13px] text-[var(--fba-red-tx)]"
        >
          <p>
            You are signed in with a different email than the one that received this invitation.
            Sign out, then open your invitation link again to accept as{" "}
            <span className="font-semibold">{invitedEmail ?? "the invited user"}</span>.
          </p>
          <InviteSignOutButton redirectTo={`/invite/accept?token=${encodeURIComponent(token)}`} />
        </div>
      ) : (
        <>
          {/* The invited-session path returned above, so this always renders. */}
          <p
            className={`mt-4 rounded-[10px] border-[1.5px] border-[var(--fba-bdr)] bg-[var(--fba-bg2)] p-3 text-[13px] ${bodyClass}`}
          >
            Open the invitation link from your email on this device to set your password. If you
            already completed that step, click below to finish accepting.
          </p>

          {acceptState.message ? (
            <p
              role="alert"
              className={`mt-4 text-[13px] ${
                acceptState.ok ? "text-[var(--fba-grn)]" : "text-[var(--fba-red-tx)]"
              }`}
            >
              {acceptState.message}
            </p>
          ) : null}

          <form action={acceptAction} className="mt-6">
            <input type="hidden" name="token" value={token} />
            <button type="submit" disabled={acceptPending} className={primaryButtonClass}>
              {acceptPending ? <Spinner /> : null}
              {acceptPending ? "Accepting..." : "Accept invitation"}
            </button>
          </form>
        </>
      )}
    </CardShell>
  );
}
