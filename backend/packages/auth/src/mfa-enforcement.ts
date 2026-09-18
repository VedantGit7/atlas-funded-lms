import { AtlasHttpError } from "@atlas/core/http/errors";

/**
 * MFA enforcement. Audit finding H5.
 *
 * `mfa_enabled` was computed on every sign-in, stored on the principal, and
 * **never checked anywhere**. The platform console — the one surface with
 * cross-tenant reach — was reachable with a password alone.
 *
 * A note on what `mfaEnabled` means, because the earlier record got this wrong
 * and then corrected itself: `listFactors()` types `data.totp` and `data.phone`
 * as `Factor<K, "verified">[]` and keeps unverified factors in `data.all`, so
 * those arrays are pre-filtered by Supabase. Presence in them **is**
 * verification — the value is trustworthy, which is what makes enforcing on it
 * meaningful rather than theatre.
 */

/** Thrown as 403 with a code the client can act on by starting enrolment. */
export function mfaRequiredError(detail: string): AtlasHttpError {
  return new AtlasHttpError({
    code: "MFA_REQUIRED",
    status: 403,
    message: detail,
  });
}

/**
 * Platform operators must always have MFA.
 *
 * Deliberately unconditional: platform permissions cross every tenant, so there
 * is no operation on that surface where a password alone is an acceptable bar.
 */
export function assertPlatformMfa(args: { mfaEnabled: boolean; principalId: string }): void {
  if (args.mfaEnabled) return;

  throw mfaRequiredError(
    "Platform access requires multi-factor authentication. Enrol a factor and sign in again.",
  );
}

/**
 * Sensitive tenant operations that require MFA when the route declares it.
 *
 * Scoped by route metadata rather than inferred from the permission string, so
 * adding a destructive route is a deliberate decision about whether it needs a
 * second factor — the same reason permissions and audit are declared and not
 * guessed.
 */
export function assertTenantMfa(args: {
  mfaEnabled: boolean;
  required: boolean;
  permission: string;
}): void {
  if (!args.required || args.mfaEnabled) return;

  throw mfaRequiredError(
    `This action requires multi-factor authentication (${args.permission}). Enrol a factor and sign in again.`,
  );
}
