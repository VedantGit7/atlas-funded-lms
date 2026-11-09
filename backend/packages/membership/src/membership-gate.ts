import { findMembershipForRequest } from "./membership.repository";
import {
  membershipStatusToError,
  noMembership,
  principalDisabled,
  principalNotFound,
} from "./membership-errors";
import type { ActiveMembershipContext } from "./types";

type Tx = Parameters<typeof findMembershipForRequest>[0]["tx"];

const LAST_ACTIVE_THROTTLE_MINUTES = 5;

export async function requireActiveMembership(args: {
  tx: Tx;
  tenantId: string;
  authPrincipalId: string;
}): Promise<ActiveMembershipContext> {
  // One statement: the principal, the membership and the activity bookkeeping,
  // which it records only for a request this gate admits.
  const found = await findMembershipForRequest({
    tx: args.tx,
    tenantId: args.tenantId,
    authPrincipalId: args.authPrincipalId,
    lastActiveThrottleMinutes: LAST_ACTIVE_THROTTLE_MINUTES,
  });

  // The account first, with the answers the separate principal lookup gave
  // before this gate replaced it: a deleted principal is not signed in, and a
  // disabled account is refused whatever its memberships are.
  if (found.principalStatus === null) {
    throw principalNotFound();
  }
  if (found.principalStatus !== "active") {
    throw principalDisabled();
  }

  const { membership } = found;

  if (!membership) {
    throw noMembership();
  }

  if (membership.status !== "ACTIVE") {
    throw membershipStatusToError(membership.status);
  }

  return {
    membershipId: membership.id,
    tenantId: membership.tenantId,
    status: "ACTIVE",
    profileId: null,
  };
}
