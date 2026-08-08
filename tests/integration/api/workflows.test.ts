import { describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { withTenantTx } from "@atlas/db";
import { submitAssessmentForReview } from "../../../backend/apps/api/src/server/assessments/assessments.service";
import { submitCourseForReview } from "../../../backend/apps/api/src/server/courses/course-authoring.service";
import { createCourseModule } from "../../../backend/apps/api/src/server/courses/course-authoring.service";
import { findCourseAuthProjection } from "../../../backend/apps/api/src/server/courses/courses.repository";
import {
  submitLearningPathForReview,
  updateLearningPath,
} from "../../../backend/apps/api/src/server/learning-paths/learning-path.service";
import {
  actOnWorkflowTransition,
  listReviewQueue,
} from "../../../backend/apps/api/src/server/workflows/workflows.service";
import {
  adminCtx,
  authoringTenantTx,
  createCourseAuthoringFixture,
  instructorCtx,
} from "../../fixtures/course-authoring-fixture";
import {
  createAssessmentFixture,
  instructorCtx as assessmentInstructorCtx,
  adminCtx as assessmentAdminCtx,
  authoringTenantTx as assessmentAuthoringTenantTx,
} from "../../fixtures/assessment-fixture";
import {
  createLearningPathFixture,
  instructorCtx as pathInstructorCtx,
  authoringTenantTx as pathAuthoringTenantTx,
} from "../../fixtures/learning-path-fixture";

const describeWithDb =
  process.env["DATABASE_URL"] && process.env["PLATFORM_DATABASE_URL"] ? describe : describe.skip;

describeWithDb("workflow integration", () => {
  it("lists pending course review items for admin", async () => {
    const fixture = await createCourseAuthoringFixture();
    const instructor = instructorCtx(fixture, "req_list_queue");
    const admin = adminCtx(fixture, "req_list_queue_admin");

    await withTenantTx(authoringTenantTx(fixture), async (tx) => {
      await createCourseModule(tx, instructor, fixture.draftCourseId, { title: "Queue Module" });
      await submitCourseForReview(tx, instructor, fixture.draftCourseId, {});
    });

    const queue = await withTenantTx(
      authoringTenantTx(fixture, fixture.adminMembershipId),
      async (tx) => listReviewQueue(tx, admin, { status: "pending", limit: 25 }),
    );

    expect(queue.data.length).toBeGreaterThan(0);
    expect(queue.data[0]?.target.type).toBe("course");
    expect(queue.data[0]?.target.status).toBe("REVIEW");
  });

  it("approves review course and publishes it", async () => {
    const fixture = await createCourseAuthoringFixture();
    const instructor = instructorCtx(fixture, "req_approve_course");
    const admin = adminCtx(fixture, "req_approve_course_admin");

    const submitted = await withTenantTx(authoringTenantTx(fixture), async (tx) => {
      await createCourseModule(tx, instructor, fixture.draftCourseId, { title: "Approve Module" });
      return submitCourseForReview(tx, instructor, fixture.draftCourseId, { reason: "Ready" });
    });

    const approved = await withTenantTx(
      authoringTenantTx(fixture, fixture.adminMembershipId),
      async (tx) =>
        actOnWorkflowTransition(tx, admin, submitted.data.workflowTransitionId, {
          action: "approve",
          comment: "Approved",
        }),
    );

    expect(approved.data.targetStatus).toBe("PUBLISHED");

    await withTenantTx(authoringTenantTx(fixture, fixture.adminMembershipId), async (tx) => {
      const course = await findCourseAuthProjection({ tx, courseId: fixture.draftCourseId });
      expect(course?.status).toBe("PUBLISHED");
    });
  });

  it("returns review course to draft with comment", async () => {
    const fixture = await createCourseAuthoringFixture();
    const instructor = instructorCtx(fixture, "req_return_course");
    const admin = adminCtx(fixture, "req_return_course_admin");

    const submitted = await withTenantTx(authoringTenantTx(fixture), async (tx) => {
      await createCourseModule(tx, instructor, fixture.draftCourseId, { title: "Return Module" });
      return submitCourseForReview(tx, instructor, fixture.draftCourseId, {});
    });

    const returned = await withTenantTx(
      authoringTenantTx(fixture, fixture.adminMembershipId),
      async (tx) =>
        actOnWorkflowTransition(tx, admin, submitted.data.workflowTransitionId, {
          action: "return",
          comment: "Needs more modules",
        }),
    );

    expect(returned.data.targetStatus).toBe("DRAFT");
  });

  it("returns conflict when workflow already acted on", async () => {
    const fixture = await createCourseAuthoringFixture();
    const instructor = instructorCtx(fixture, "req_stale_transition");
    const admin = adminCtx(fixture, "req_stale_transition_admin");

    const submitted = await withTenantTx(authoringTenantTx(fixture), async (tx) => {
      await createCourseModule(tx, instructor, fixture.draftCourseId, { title: "Stale Module" });
      return submitCourseForReview(tx, instructor, fixture.draftCourseId, {});
    });

    await withTenantTx(authoringTenantTx(fixture, fixture.adminMembershipId), async (tx) => {
      await actOnWorkflowTransition(tx, admin, submitted.data.workflowTransitionId, {
        action: "approve",
      });
    });

    await expect(
      withTenantTx(authoringTenantTx(fixture, fixture.adminMembershipId), async (tx) =>
        actOnWorkflowTransition(tx, admin, submitted.data.workflowTransitionId, {
          action: "approve",
        }),
      ),
    ).rejects.toMatchObject({ status: 409 });
  });

  it("writes audit and outbox rows for submit and approve", async () => {
    const fixture = await createCourseAuthoringFixture();
    const instructor = instructorCtx(fixture, "req_workflow_outbox");
    const admin = adminCtx(fixture, "req_workflow_outbox_admin");

    const submitted = await withTenantTx(authoringTenantTx(fixture), async (tx) => {
      await createCourseModule(tx, instructor, fixture.draftCourseId, { title: "Outbox Module" });
      return submitCourseForReview(tx, instructor, fixture.draftCourseId, {});
    });

    await withTenantTx(authoringTenantTx(fixture, fixture.adminMembershipId), async (tx) => {
      await actOnWorkflowTransition(tx, admin, submitted.data.workflowTransitionId, {
        action: "approve",
      });

      const auditRows = await tx.$queryRaw<Array<{ action: string }>>`
        select action
        from audit_entries
        where tenant_id = ${fixture.tenantId}::uuid
          and target_id = ${fixture.draftCourseId}
          and action in ('course.submitted_for_review', 'workflow.transition')
      `;
      expect(auditRows.length).toBeGreaterThanOrEqual(2);

      const outboxRows = await tx.$queryRaw<Array<{ event_type: string }>>`
        select event_type
        from outbox_events
        where tenant_id = ${fixture.tenantId}::uuid
          and aggregate_id in (${fixture.draftCourseId}::uuid, ${submitted.data.workflowTransitionId}::uuid)
      `;
      const eventTypes = outboxRows.map((row) => row.event_type);
      expect(eventTypes).toContain("course.submitted_for_review");
      expect(eventTypes).toContain("workflow.transitioned");
      expect(eventTypes).toContain("course.published");
    });
  });

  it("lists pending assessment review items filtered by targetType", async () => {
    const fixture = await createAssessmentFixture();
    const instructor = assessmentInstructorCtx(fixture, "req_assessment_queue");
    const admin = assessmentAdminCtx(fixture, "req_assessment_queue_admin");

    await withTenantTx(assessmentAuthoringTenantTx(fixture), async (tx) => {
      await submitAssessmentForReview(tx, instructor, fixture.assessmentId, {});
    });

    const queue = await withTenantTx(
      assessmentAuthoringTenantTx(fixture, fixture.adminMembershipId),
      async (tx) =>
        listReviewQueue(tx, admin, { status: "pending", targetType: "assessment", limit: 25 }),
    );

    expect(queue.data.length).toBeGreaterThan(0);
    expect(queue.data.every((item) => item.target.type === "assessment")).toBe(true);
    expect(queue.data[0]?.target.status).toBe("REVIEW");
  });

  it("lists pending learning path review items filtered by targetType", async () => {
    const fixture = await createLearningPathFixture();
    const instructor = pathInstructorCtx(fixture, "req_path_queue");
    const admin = {
      tenantId: fixture.tenantId,
      actorMembershipId: fixture.adminMembershipId,
      requestId: "req_path_queue_admin",
    };

    await withTenantTx(pathAuthoringTenantTx(fixture), async (tx) => {
      await updateLearningPath(tx, instructor, fixture.draftPathId, {
        steps: [
          {
            stepType: "course",
            refId: fixture.publishedCourseId,
            title: "Step 1",
            position: 1,
            gates: [{ gateType: "open", config: {} }],
          },
        ],
      });
      await submitLearningPathForReview(tx, instructor, fixture.draftPathId, {});
    });

    const queue = await withTenantTx(
      {
        tenantId: fixture.tenantId,
        actorMembershipId: fixture.adminMembershipId,
        requestId: randomUUID(),
      },
      async (tx) =>
        listReviewQueue(tx, admin, {
          status: "pending",
          targetType: "learning_path",
          limit: 25,
        }),
    );

    expect(queue.data.length).toBeGreaterThan(0);
    expect(queue.data.every((item) => item.target.type === "learning_path")).toBe(true);
    expect(queue.data[0]?.target.status).toBe("REVIEW");
  });
});
