import { DEFAULT_ACCEPTED_MEMBER_ROLE } from "./tenant-system-roles";
import { assignSystemRoleToMembership } from "./access-seed.repository";

type Tx = Parameters<typeof assignSystemRoleToMembership>[0]["tx"];

export async function assignDefaultLearnerRole(args: {
  tx: Tx;
  tenantId: string;
  membershipId: string;
}): Promise<void> {
  await assignSystemRoleToMembership({
    tx: args.tx,
    tenantId: args.tenantId,
    membershipId: args.membershipId,
    roleKey: DEFAULT_ACCEPTED_MEMBER_ROLE,
    assignedByMembershipId: null,
  });
}

export async function bootstrapOwnerRoleForTenantSeed(args: {
  tx: Tx;
  tenantId: string;
  ownerMembershipId: string;
}): Promise<void> {
  await assignSystemRoleToMembership({
    tx: args.tx,
    tenantId: args.tenantId,
    membershipId: args.ownerMembershipId,
    roleKey: "owner",
    assignedByMembershipId: args.ownerMembershipId,
  });
}
