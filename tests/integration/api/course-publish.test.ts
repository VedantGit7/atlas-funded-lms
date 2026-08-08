import { describe, expect, it } from "vitest";
import { withTenantTx } from "@atlas/db";
import { submitCourseForReview } from "../../../backend/apps/api/src/server/courses/course-authoring.service";
import { createCourseModule } from "../../../backend/apps/api/src/server/courses/course-authoring.service";
import { findCourseAuthProjection } from "../../../backend/apps/api/src/server/courses/courses.repository";
import {
  createCourseAuthoringFixture,
  instructorCtx,
  authoringTenantTx,
} from "../../fixtures/course-authoring-fixture";

const describeWithDb =
  process.env["DATABASE_URL"] && process.env["PLATFORM_DATABASE_URL"] ? describe : describe.skip;

describeWithDb("course publish integration", () => {
  it("submits draft course for review and records workflow transition", async () => {
    const fixture = await createCourseAuthoringFixture();
    const ctx = instructorCtx(fixture, "req_publish_course");

    const result = await withTenantTx(authoringTenantTx(fixture), async (tx) => {
      await createCourseModule(tx, ctx, fixture.draftCourseId, { title: "Publish Module" });
      return submitCourseForReview(tx, ctx, fixture.draftCourseId, {});
    });

    expect(result.data.status).toBe("REVIEW");
    expect(result.data.workflowTransitionId).toBeTruthy();

    await withTenantTx(authoringTenantTx(fixture), async (tx) => {
      const course = await findCourseAuthProjection({ tx, courseId: fixture.draftCourseId });
      expect(course?.status).toBe("REVIEW");

      const transitions = await tx.$queryRaw<Array<{ to_state: string }>>`
        select to_state
        from workflow_transitions
        where tenant_id = ${fixture.tenantId}::uuid
          and target_id = ${fixture.draftCourseId}::uuid
          and target_type = 'course'
        limit 1
      `;
      expect(transitions[0]?.to_state).toBe("REVIEW");
    });
  });

  it("writes audit entry for publish submission", async () => {
    const fixture = await createCourseAuthoringFixture();
    const ctx = instructorCtx(fixture, "req_publish_audit");

    await withTenantTx(authoringTenantTx(fixture), async (tx) => {
      await createCourseModule(tx, ctx, fixture.draftCourseId, { title: "Audit Module" });
      await submitCourseForReview(tx, ctx, fixture.draftCourseId, { reason: "Ready" });

      const rows = await tx.$queryRaw<Array<{ action: string }>>`
        select action
        from audit_entries
        where tenant_id = ${fixture.tenantId}::uuid
          and target_id = ${fixture.draftCourseId}
          and action = 'course.submitted_for_review'
        limit 1
      `;
      expect(rows).toHaveLength(1);
    });
  });
});
