"use client";

import { useActionState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  acceptInvitationAction,
  type AcceptInvitationActionState,
} from "../_actions/accept-invitation-action";

const initialState: AcceptInvitationActionState = {
  ok: false,
  message: "",
  requestId: "",
};

type InviteAcceptCardProps = Readonly<{
  isAuthenticated: boolean;
}>;

export function InviteAcceptCard({ isAuthenticated }: InviteAcceptCardProps) {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [state, formAction, pending] = useActionState(acceptInvitationAction, initialState);

  if (!token) {
    return (
      <section aria-labelledby="invite-missing-token">
        <h2 id="invite-missing-token">Invitation required</h2>
        <p>This page requires a valid invitation link.</p>
      </section>
    );
  }

  if (!isAuthenticated) {
    const signupHref = `/signup?inviteToken=${encodeURIComponent(token)}`;
    const loginHref = `/login?next=${encodeURIComponent(`/invite/accept?token=${token}`)}`;

    return (
      <section aria-labelledby="invite-auth-required">
        <h2 id="invite-auth-required">Accept your invitation</h2>
        <p>Sign in or create an account to accept this invitation.</p>
        <div style={{ display: "flex", gap: "0.75rem", marginTop: "1rem" }}>
          <Link href={loginHref}>Sign in</Link>
          <Link href={signupHref}>Create account</Link>
        </div>
      </section>
    );
  }

  return (
    <section aria-labelledby="invite-accept-title">
      <h2 id="invite-accept-title">Accept invitation</h2>
      <p>Your role was assigned by your academy administrator.</p>
      <form action={formAction}>
        <input type="hidden" name="token" value={token} />
        {state.message ? (
          <p role="alert" style={{ color: state.ok ? "#027a48" : "#b42318" }}>
            {state.message}
          </p>
        ) : null}
        <button type="submit" disabled={pending} style={{ marginTop: "1rem" }}>
          {pending ? "Accepting..." : "Accept invitation"}
        </button>
      </form>
    </section>
  );
}
