import type { InvitationAcceptStatus } from "../schemas/invitation-public";

export function redactTokenForLogging(): string {
  return "[redacted]";
}

export function safeInvitationErrorMessage(code: string | undefined): string {
  if (code === "AUTH_REQUIRED") {
    return "Sign in or create an account to accept this invitation.";
  }

  return "This invitation is invalid or has expired.";
}

export function mapInvitationAcceptResponse(args: {
  authenticated: boolean;
  accepted: boolean;
  roleHome: string | null;
}): { status: InvitationAcceptStatus; redirectTo: string | null } {
  if (!args.authenticated) {
    return { status: "LOGIN_REQUIRED", redirectTo: null };
  }

  if (args.accepted) {
    return { status: "ACCEPTED", redirectTo: args.roleHome };
  }

  return { status: "LOGIN_REQUIRED", redirectTo: null };
}
