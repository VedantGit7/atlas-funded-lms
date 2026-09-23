import { readFileSync } from "node:fs";
import { z } from "zod";

const scenarioSchema = z.object({
  tenantId: z.uuid(),
  learnerMembershipId: z.uuid(),
  instructorMembershipId: z.uuid(),
  adminMembershipId: z.uuid(),
  courseId: z.uuid(),
  lessonId: z.uuid(),
  assessmentId: z.uuid(),
  assessmentItemId: z.uuid(),
  correctOptionId: z.string().min(1),
  foreignCourseId: z.uuid(),
  foreignLessonId: z.uuid(),
  foreignSentinel: z.string().min(10),
  foreignTenantId: z.uuid(),
  roleTargetMembershipId: z.uuid(),
  instructorRoleId: z.uuid(),
  ownCertificateId: z.uuid(),
  foreignCertificateId: z.uuid(),
});

/** Required stateful journeys fail on missing fixtures instead of passing as skipped. */
export function scenario() {
  const path = process.env["E2E_SCENARIO_PATH"];
  if (!path)
    throw new Error("E2E_SCENARIO_PATH is required. Seed an isolated browser fixture first.");
  return scenarioSchema.parse(JSON.parse(readFileSync(path, "utf8")) as unknown);
}
