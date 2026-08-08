import type { TenantTx } from "@atlas/db";
import { findEnrollmentForMembership } from "../courses/courses.service";

export async function isMemberEnrolledInCourse(args: {
  tx: TenantTx;
  courseId: string;
  membershipId: string;
}): Promise<boolean> {
  const enrollment = await findEnrollmentForMembership({
    tx: args.tx,
    courseId: args.courseId,
    membershipId: args.membershipId,
  });
  return enrollment != null;
}
