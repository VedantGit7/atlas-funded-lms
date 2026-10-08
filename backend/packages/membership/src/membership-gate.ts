import { findMembershipForRequest } from "./membership.repository";
import { membershipStatusToError, noMembership, principalDisabled } from "./membership-errors";
import type { ActiveMembershipContext } from "./types";

type Tx = Parameters<typeof findMembershipForRequest>[0]["tx"];

const LAST_ACTIVE_THROTTLE_MINUTES = 5;

export async function requireActiveMembership(args: {
  tx: Tx;
  tenantId: string;
  authPrincipalId: string;
}): Promise<ActiveMembershipContext> {
  // One statement: the lookup and the activity bookkeeping, which it records
  // only for a request this gate admits.
  const found = await findMembershipForRequest({
    tx: args.tx,
    tenantId: args.tenantId,
    authPrincipalId: args.authPrincipalId,
    lastActiveThrottleMinutes: LAST_ACTIVE_THROTTLE_MINUTES,
  });

  if (!found) {
    throw noMembership();
  }

  const { membership } = found;

  if (membership.status !== "ACTIVE") {
    throw membershipStatusToError(membership.status);
  }

  // An ACTIVE membership belongs to an active account, never a disabled one.
  // Principal resolution already refuses a disabled principal; checking again
  // keeps tenant access closed for a caller that reached the gate another way.
  if (found.principalStatus !== "active") {
    throw principalDisabled();
  }

  return {
    membershipId: membership.id,
    tenantId: membership.tenantId,
    status: "ACTIVE",
    profileId: null,
  };
}
