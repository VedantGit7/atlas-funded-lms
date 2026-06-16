import { findMembershipByPrincipal } from "./membership.repository";
import { membershipStatusToError, noMembership } from "./membership-errors";
import type { ActiveMembershipContext } from "./types";

type Tx = Parameters<typeof findMembershipByPrincipal>[0]["tx"];

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

  return {
    membershipId: membership.id,
    tenantId: membership.tenantId,
    status: "ACTIVE",
    profileId: null,
  };
}
