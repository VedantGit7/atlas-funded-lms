export function isAppealSelfReviewBlocked(args: {
  viewerMembershipId: string;
  submittedByMembershipId: string;
}): boolean {
  return args.viewerMembershipId === args.submittedByMembershipId;
}
