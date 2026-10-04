import {
  findMembershipByPrincipal,
  findPrincipalGlobalStatus,
  recordMembershipActiveDay,
  touchMembershipLastActive,
} from "./membership.repository";
import { membershipStatusToError, noMembership, principalDisabled } from "./membership-errors";
import type { ActiveMembershipContext } from "./types";

type Tx = Parameters<typeof findMembershipByPrincipal>[0]["tx"];

const LAST_ACTIVE_THROTTLE_MINUTES = 5;

export async function requireActiveMembership(args: {
  tx: Tx;
  tenantId: string;
  authPrincipalId: string;
}): Promise<ActiveMembershipContext> {
  const membership = await findMembershipByPrincipal({
    tx: args.tx,
    tenantId: args.tenantId,
    authPrincipalId: args.authPrincipalId,
  });

  if (!membership) {
    throw noMembership();
  }

  if (membership.status !== "ACTIVE") {
    throw membershipStatusToError(membership.status);
  }

  // An ACTIVE membership belongs to an active account, never a disabled one.
  const principalStatus = await findPrincipalGlobalStatus({
    tx: args.tx,
    authPrincipalId: args.authPrincipalId,
  });

  if (principalStatus !== "active") {
    throw principalDisabled();
  }

  await touchMembershipLastActive({
    tx: args.tx,
    tenantId: membership.tenantId,
    membershipId: membership.id,
    throttleMinutes: LAST_ACTIVE_THROTTLE_MINUTES,
  });

  await recordMembershipActiveDay({
    tx: args.tx,
    tenantId: membership.tenantId,
    membershipId: membership.id,
  });

  return {
    membershipId: membership.id,
    tenantId: membership.tenantId,
    status: "ACTIVE",
    profileId: null,
  };
}
