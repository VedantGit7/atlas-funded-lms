import { AtlasHttpError } from "@atlas/core/http/errors";
import type { SessionAssuranceLevel } from "./session";

/**
 * MFA enforcement (F01). Only verified assurance on the current access token
 * proves that this session completed MFA. A verified enrolled factor does not.
 */

/** Thrown as 403 so the client can start enrollment or a session challenge. */
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
export function assertPlatformMfa(args: {
  sessionAssuranceLevel?: SessionAssuranceLevel | undefined;
  principalId: string;
}): void {
  if (args.sessionAssuranceLevel === "aal2") return;

  throw mfaRequiredError(
    "Platform access requires multi-factor authentication. Complete MFA verification for this session.",
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
  sessionAssuranceLevel?: SessionAssuranceLevel | undefined;
  required: boolean;
  permission: string;
}): void {
  if (!args.required || args.sessionAssuranceLevel === "aal2") return;

  throw mfaRequiredError(
    `This action requires multi-factor authentication (${args.permission}). Complete MFA verification for this session.`,
  );
}
