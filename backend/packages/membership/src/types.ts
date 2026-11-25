export type MembershipStatus = "INVITED" | "ACTIVE" | "SUSPENDED" | "REMOVED";

export type MembershipProjection = {
  id: string;
  tenantId: string;
  authPrincipalId: string | null;
  status: MembershipStatus;
  invitedEmailNormalized: string | null;
};

export type MemberProfileProjection = {
  id: string;
  membershipId: string;
  displayName: string | null;
  avatarUrl: string | null;
  /** The member's own IANA time zone, when they chose one. */
  timezone?: string | null;
};

export type ActiveMembershipContext = {
  membershipId: string;
  tenantId: string;
  status: "ACTIVE";
  profileId: string | null;
};
