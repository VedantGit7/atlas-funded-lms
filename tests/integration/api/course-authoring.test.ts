import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { withTenantTx } from "@atlas/db";
import { courseListQuerySchema } from "../../../backend/apps/api/src/server/courses/schemas";
import {
  createCourseDraft,
  getCourseForBuilder,
  listStudioCourses,
  updateCourse,
  archiveOrDeleteCourse,
} from "../../../backend/apps/api/src/server/courses/course-authoring.service";
import { listPublishedCourses } from "../../../backend/apps/api/src/server/courses/courses.service";
import {
  createCourseAuthoringFixture,
  instructorCtx,
  authoringTenantTx,
} from "../../fixtures/course-authoring-fixture";
import { createCourseEnrollmentFixture } from "../../fixtures/course-enrollment-fixture";
const describeWithDb =
  process.env["DATABASE_URL"] && process.env["PLATFORM_DATABASE_URL"] ? describe : describe.skip;

describeWithDb("course authoring integration", () => {
  it("preserves learner published-only list behavior", async () => {
    const fixture = await createCourseEnrollmentFixture();
    const ctx = { tenantId: fixture.tenantId, actorMembershipId: fixture.membershipId };

    const result = await withTenantTx(
      {
        tenantId: fixture.tenantId,
        actorMembershipId: fixture.membershipId,
        requestId: randomUUID(),
      },
      async (tx) => listPublishedCourses(tx, ctx, courseListQuerySchema.parse({})),
    );

    const ids = result.data.items.map((item) => item.id);
    expect(ids).toContain(fixture.publishedCourseId);
    expect(ids).not.toContain(fixture.draftCourseId);
  });

  it("returns instructor studio courses", async () => {
    const fixture = await createCourseAuthoringFixture();
    const ctx = instructorCtx(fixture);

    const result = await withTenantTx(authoringTenantTx(fixture), async (tx) =>
      listStudioCourses(tx, ctx, { view: "studio", limit: 25, sort: "updated_desc" }),
    );

    const ids = result.data.items.map((item) => item.id);
    expect(ids).toContain(fixture.draftCourseId);
    expect(result.data.items.every((item) => item.status !== undefined)).toBe(true);
  });

  it("creates draft course", async () => {
    const fixture = await createCourseAuthoringFixture();
    const ctx = instructorCtx(fixture);

    const created = await withTenantTx(authoringTenantTx(fixture), async (tx) =>
      createCourseDraft(tx, ctx, { title: "New Draft Course" }),
    );

    expect(created.data.status).toBe("DRAFT");
    expect(created.data.title).toBe("New Draft Course");
  });

  it("reads owned draft for builder", async () => {
    const fixture = await createCourseAuthoringFixture();
    const ctx = instructorCtx(fixture);

    const detail = await withTenantTx(authoringTenantTx(fixture), async (tx) =>
      getCourseForBuilder(tx, ctx, fixture.draftCourseId),
    );

    expect(detail.data.id).toBe(fixture.draftCourseId);
    expect(detail.data.status).toBe("DRAFT");
  });

  it("updates owned draft", async () => {
    const fixture = await createCourseAuthoringFixture();
    const ctx = instructorCtx(fixture);

    const updated = await withTenantTx(authoringTenantTx(fixture), async (tx) =>
      updateCourse(tx, ctx, fixture.draftCourseId, { title: "Updated Draft Title" }),
    );

    expect(updated.data.title).toBe("Updated Draft Title");
  });

  it("archives owned draft", async () => {
    const fixture = await createCourseAuthoringFixture();
    const ctx = instructorCtx(fixture);

    const archived = await withTenantTx(authoringTenantTx(fixture), async (tx) =>
      archiveOrDeleteCourse(tx, ctx, fixture.draftCourseId),
    );

    expect(archived.data.status).toBe("ARCHIVED");
  });

  it("writes audit rows for course create", async () => {
    const fixture = await createCourseAuthoringFixture();
    const ctx = instructorCtx(fixture);

    await withTenantTx(authoringTenantTx(fixture), async (tx) => {
      const created = await createCourseDraft(tx, ctx, { title: "Audit Course" });
      const rows = await tx.$queryRaw<Array<{ action: string }>>`
        select action
        from audit_entries
        where tenant_id = ${fixture.tenantId}::uuid
          and target_id = ${created.data.id}
          and action = 'course.created'
        limit 1
      `;
      expect(rows).toHaveLength(1);
    });
  });
});
