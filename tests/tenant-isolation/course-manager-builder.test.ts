import { describe, expect, it } from "vitest";
import { withTenantTx } from "@atlas/db";
import {
  createCourseDraft,
  createCourseModule,
  getCourseForBuilder,
  listStudioCourses,
  submitCourseForReview,
  updateCourse,
  updateCourseModule,
} from "../../apps/web/src/server/courses/course-authoring.service";
import { createCourseBodySchema } from "../../apps/web/src/server/courses/course-authoring-schemas";
import {
  createCourseAuthoringFixture,
  instructorCtx,
  otherInstructorCtx,
  authoringTenantTx,
} from "../fixtures/course-authoring-fixture";

const describeWithDb =
  process.env["DATABASE_URL"] && process.env["PLATFORM_DATABASE_URL"] ? describe : describe.skip;

describeWithDb("course manager builder tenant isolation", () => {
  it("Tenant A cannot list Tenant B studio courses", async () => {
    const tenantA = await createCourseAuthoringFixture();
    const tenantB = await createCourseAuthoringFixture();

    const result = await withTenantTx(authoringTenantTx(tenantA), async (tx) =>
      listStudioCourses(tx, instructorCtx(tenantA), {
        view: "studio",
        limit: 25,
        sort: "updated_desc",
      }),
    );

    const ids = result.data.items.map((item) => item.id);
    expect(ids).not.toContain(tenantB.draftCourseId);
  });

  it("Tenant A cannot read Tenant B draft course by ID", async () => {
    const tenantA = await createCourseAuthoringFixture();
    const tenantB = await createCourseAuthoringFixture();

    await expect(
      withTenantTx(authoringTenantTx(tenantA), async (tx) =>
        getCourseForBuilder(tx, instructorCtx(tenantA), tenantB.draftCourseId),
      ),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("Tenant A cannot update Tenant B course", async () => {
    const tenantA = await createCourseAuthoringFixture();
    const tenantB = await createCourseAuthoringFixture();

    await expect(
      withTenantTx(authoringTenantTx(tenantA), async (tx) =>
        updateCourse(tx, instructorCtx(tenantA, "req_iso_update"), tenantB.draftCourseId, {
          title: "Hijacked",
        }),
      ),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("instructor cannot update another instructor course", async () => {
    const fixture = await createCourseAuthoringFixture();

    await expect(
      withTenantTx(authoringTenantTx(fixture, fixture.otherInstructorMembershipId), async (tx) =>
        updateCourse(tx, otherInstructorCtx(fixture, "req_other_update"), fixture.draftCourseId, {
          title: "Not allowed",
        }),
      ),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("instructor cannot submit another instructor course for review", async () => {
    const fixture = await createCourseAuthoringFixture();

    await expect(
      withTenantTx(authoringTenantTx(fixture, fixture.otherInstructorMembershipId), async (tx) =>
        submitCourseForReview(
          tx,
          otherInstructorCtx(fixture, "req_other_publish"),
          fixture.draftCourseId,
          {},
        ),
      ),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("rejects client tenant_id in create body schema", () => {
    expect(() =>
      createCourseBodySchema.parse({
        title: "Course",
        tenant_id: "018f0000-0000-7000-8000-000000000099",
      }),
    ).toThrow();
  });

  it("cannot create module in another tenant course via service tenant guard", async () => {
    const tenantA = await createCourseAuthoringFixture();
    const tenantB = await createCourseAuthoringFixture();

    await expect(
      withTenantTx(authoringTenantTx(tenantA), async (tx) =>
        createCourseModule(tx, instructorCtx(tenantA, "req_iso_module"), tenantB.draftCourseId, {
          title: "Bad module",
        }),
      ),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("cannot update another tenant module", async () => {
    const tenantA = await createCourseAuthoringFixture();
    const tenantB = await createCourseAuthoringFixture();

    const moduleId = await withTenantTx(authoringTenantTx(tenantB), async (tx) => {
      const created = await createCourseModule(
        tx,
        instructorCtx(tenantB, "req_b_module"),
        tenantB.draftCourseId,
        { title: "Tenant B Module" },
      );
      return created.data.id;
    });

    await expect(
      withTenantTx(authoringTenantTx(tenantA), async (tx) =>
        updateCourseModule(tx, instructorCtx(tenantA, "req_iso_module_update"), moduleId, {
          title: "Hijacked",
        }),
      ),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("create course uses host tenant membership only", async () => {
    const fixture = await createCourseAuthoringFixture();
    const created = await withTenantTx(authoringTenantTx(fixture), async (tx) =>
      createCourseDraft(tx, instructorCtx(fixture, "req_iso_create"), { title: "Tenant scoped" }),
    );

    const course = await withTenantTx(authoringTenantTx(fixture), async (tx) =>
      getCourseForBuilder(tx, instructorCtx(fixture), created.data.id),
    );

    expect(course.data.title).toBe("Tenant scoped");
  });
});
