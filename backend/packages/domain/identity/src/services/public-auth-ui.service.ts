import { AtlasHttpError } from "@atlas/core/http/errors";
import type { MembershipStatus } from "@atlas/membership";

export const GENERIC_LOGIN_ERROR_MESSAGE = "Invalid email or password";
export const GENERIC_SIGNUP_ERROR_MESSAGE = "Unable to create account. Please try again.";
export const GENERIC_PASSWORD_RESET_MESSAGE =
  "If an account exists for that email, password reset instructions have been sent.";

export type PublicAuthStatus =
  | "AUTHENTICATED"
  | "EMAIL_VERIFICATION_REQUIRED"
  | "MFA_REQUIRED"
  | "NO_ACTIVE_MEMBERSHIP"
  | "INVITED_MEMBERSHIP";

const ROLE_HOME_PRIORITY: ReadonlyArray<{ keys: readonly string[]; path: string }> = [
  { keys: ["owner", "admin"], path: "/admin" },
  { keys: ["instructor"], path: "/studio" },
  { keys: ["moderator"], path: "/moderate" },
  { keys: ["learner"], path: "/" },
];

export function rejectClientTenantId(body: unknown): void {
  if (!body || typeof body !== "object") {
    return;
  }

  if ("tenant_id" in body || "tenantId" in body) {
    throw new AtlasHttpError({
      code: "VALIDATION_ERROR",
      status: 400,
      message: "Invalid request",
    });
  }
}

export function resolvePublicAuthStatus(args: {
  mfaEnabled: boolean;
  membershipStatus: MembershipStatus | null;
  authenticated: boolean;
  verificationRequired: boolean;
}): PublicAuthStatus {
  if (args.verificationRequired) {
    return "EMAIL_VERIFICATION_REQUIRED";
  }

  if (!args.authenticated) {
    return "NO_ACTIVE_MEMBERSHIP";
  }

  if (args.mfaEnabled) {
    return "MFA_REQUIRED";
  }

  if (!args.membershipStatus) {
    return "NO_ACTIVE_MEMBERSHIP";
  }

  if (args.membershipStatus === "INVITED") {
    return "INVITED_MEMBERSHIP";
  }

  if (args.membershipStatus !== "ACTIVE") {
    return "NO_ACTIVE_MEMBERSHIP";
  }

  return "AUTHENTICATED";
}

export function mapAuthServiceStatusToPublicStatus(args: {
  serviceStatus: "signed_in" | "verification_required";
  mfaEnabled: boolean;
  membershipStatus: MembershipStatus | null;
}): PublicAuthStatus {
  return resolvePublicAuthStatus({
    mfaEnabled: args.mfaEnabled,
    membershipStatus: args.membershipStatus,
    authenticated: args.serviceStatus === "signed_in",
    verificationRequired: args.serviceStatus === "verification_required",
  });
}

export function resolveRoleHomePath(roleKeys: readonly string[]): string {
  for (const entry of ROLE_HOME_PRIORITY) {
    if (entry.keys.some((key) => roleKeys.includes(key))) {
      return entry.path;
    }
  }

  return "/";
}

const MFA_ASSURED_HOME_PATHS = new Set(["/admin", "/studio", "/moderate"]);

/**
 * After invitation acceptance, privileged role homes require MFA before the
 * corresponding console shell will load. Finish onboarding on the lightweight
 * invite security screen (auth layout) so we do not route new members through
 * learner/admin shells that can fail transiently right after sign-in.
 */
export function resolvePostInviteRedirect(args: {
  roleHome: string;
  mfaEnabled: boolean;
}): string {
  if (!args.mfaEnabled && MFA_ASSURED_HOME_PATHS.has(args.roleHome)) {
    return `/invite/security?next=${encodeURIComponent(args.roleHome)}`;
  }

  return args.roleHome;
}

export function resolveRedirectForAuthStatus(
  status: PublicAuthStatus,
  roleHome: string | null,
): string | null {
  switch (status) {
    case "AUTHENTICATED":
      return roleHome;
    case "INVITED_MEMBERSHIP":
      return "/invite/accept";
    case "EMAIL_VERIFICATION_REQUIRED":
      return null;
    case "MFA_REQUIRED":
      return null;
    case "NO_ACTIVE_MEMBERSHIP":
      return null;
  }
}
