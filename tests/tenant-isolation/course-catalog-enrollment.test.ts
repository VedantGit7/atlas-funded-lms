import { describe, expect, it } from "vitest";
import { withTenantTx } from "@atlas/db";
import { enrollmentCreateBodySchema } from "../../backend/apps/api/src/server/enrollments/schemas";
import {
  createCourseEnrollmentFixture,
  seedPublishedCourseForTenantB,
} from "../fixtures/course-enrollment-fixture";
import { tenantCtx } from "../tenant-isolation/tenant-isolation-fixture";
import {
  listPublishedCourses,
  getPublishedCourseDetail,
  getPublishedCourseModules,
} from "../../backend/apps/api/src/server/courses/courses.service";
import { enrollCurrentMemberInCourse } from "../../backend/apps/api/src/server/enrollments/enrollments.service";
import { courseListQuerySchema } from "../../backend/apps/api/src/server/courses/schemas";

const describeWithDb =
  process.env["DATABASE_URL"] && process.env["PLATFORM_DATABASE_URL"] ? describe : describe.skip;

describeWithDb("course catalog enrollment tenant isolation", () => {
  it("Tenant A cannot list Tenant B published courses", async () => {
    const fixture = await createCourseEnrollmentFixture();
    const tenantB = await seedPublishedCourseForTenantB();
    const ctx = { tenantId: fixture.tenantId, actorMembershipId: fixture.membershipId };

    const result = await withTenantTx(tenantCtx(fixture), async (tx) =>
      listPublishedCourses(tx, ctx, courseListQuerySchema.parse({})),
    );

    const ids = result.data.items.map((item) => item.id);
    expect(ids).toContain(fixture.publishedCourseId);
    expect(ids).not.toContain(tenantB.publishedCourseId);
  });

  it("Tenant A cannot read Tenant B course by ID", async () => {
    const fixture = await createCourseEnrollmentFixture();
    const tenantB = await seedPublishedCourseForTenantB();
    const ctx = { tenantId: fixture.tenantId, actorMembershipId: fixture.membershipId };

    await expect(
      withTenantTx(tenantCtx(fixture), async (tx) =>
        getPublishedCourseDetail(tx, ctx, tenantB.publishedCourseId),
      ),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("Tenant A cannot read Tenant B course modules", async () => {
    const fixture = await createCourseEnrollmentFixture();
    const tenantB = await seedPublishedCourseForTenantB();
    const ctx = { tenantId: fixture.tenantId, actorMembershipId: fixture.membershipId };

    await expect(
      withTenantTx(tenantCtx(fixture), async (tx) =>
        getPublishedCourseModules(tx, ctx, tenantB.publishedCourseId),
      ),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("Tenant A cannot enroll in Tenant B course", async () => {
    const fixture = await createCourseEnrollmentFixture();
    const tenantB = await seedPublishedCourseForTenantB();

    await expect(
      withTenantTx(tenantCtx(fixture), async (tx) =>
        enrollCurrentMemberInCourse(
          tx,
          {
            tenantId: fixture.tenantId,
            actorMembershipId: fixture.membershipId,
            requestId: "req_isolation_enroll",
          },
          { courseId: tenantB.publishedCourseId },
        ),
      ),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("returns only PUBLISHED courses and hides draft/archived", async () => {
    const fixture = await createCourseEnrollmentFixture();
    const ctx = { tenantId: fixture.tenantId, actorMembershipId: fixture.membershipId };

    const result = await withTenantTx(tenantCtx(fixture), async (tx) =>
      listPublishedCourses(tx, ctx, courseListQuerySchema.parse({})),
    );

    const ids = result.data.items.map((item) => item.id);
    expect(ids).toContain(fixture.publishedCourseId);
    expect(ids).not.toContain(fixture.draftCourseId);
    expect(ids).not.toContain(fixture.archivedCourseId);
  });

  it("module outline does not return lesson content", async () => {
    const fixture = await createCourseEnrollmentFixture();
    const ctx = { tenantId: fixture.tenantId, actorMembershipId: fixture.membershipId };

    const result = await withTenantTx(tenantCtx(fixture), async (tx) =>
      getPublishedCourseModules(tx, ctx, fixture.publishedCourseId),
    );

    expect(result.data.items).toHaveLength(1);
    expect(result.data.items[0]).toEqual({
      id: fixture.moduleId,
      title: "Module 1",
      position: 1,
      lessonCount: 1,
    });
    expect(JSON.stringify(result.data)).not.toContain("secret lesson body");
  });

  it("duplicate enrollment is idempotent", async () => {
    const fixture = await createCourseEnrollmentFixture();
    const ctx = {
      tenantId: fixture.tenantId,
      actorMembershipId: fixture.membershipId,
      requestId: "req_duplicate_enroll",
    };

    const first = await withTenantTx(tenantCtx(fixture), async (tx) =>
      enrollCurrentMemberInCourse(tx, ctx, { courseId: fixture.publishedCourseId }),
    );
    const second = await withTenantTx(tenantCtx(fixture), async (tx) =>
      enrollCurrentMemberInCourse(tx, ctx, { courseId: fixture.publishedCourseId }),
    );

    expect(first.data.created).toBe(true);
    expect(second.data.created).toBe(false);
    expect(second.data.id).toBe(first.data.id);
  });

  it("rejects client tenant_id on enrollment body", () => {
    expect(() =>
      enrollmentCreateBodySchema.parse({
        courseId: "018f0000-0000-7000-8000-000000000001",
        tenant_id: "018f0000-0000-7000-8000-000000000099",
      }),
    ).toThrow();
  });
});
