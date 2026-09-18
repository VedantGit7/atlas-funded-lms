// Poisons this module for any client bundle. Audit finding M9: nothing at the
// language level stopped a server module being pulled into a client component,
// so a leak of service code -- and whatever secrets or privileged queries it
// closes over -- would only have shown up as a runtime surprise.
import "server-only";

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
