import { describe, expect, it } from "vitest";
import { withTenantTx } from "@atlas/db";
import {
  createCourseModule,
  deleteCourseModule,
  listCourseModulesForBuilderService,
  updateCourseModule,
} from "../../../apps/web/src/server/courses/course-authoring.service";
import { getPublishedCourseModules } from "../../../apps/web/src/server/courses/courses.service";
import {
  createCourseAuthoringFixture,
  instructorCtx,
  authoringTenantTx,
} from "../../fixtures/course-authoring-fixture";
import { createCourseEnrollmentFixture } from "../../fixtures/course-enrollment-fixture";
import { tenantCtx } from "../../tenant-isolation/tenant-isolation-fixture";

const describeWithDb =
  process.env["DATABASE_URL"] && process.env["PLATFORM_DATABASE_URL"] ? describe : describe.skip;

describeWithDb("course modules integration", () => {
  it("preserves learner published module outline", async () => {
    const fixture = await createCourseEnrollmentFixture();
    const ctx = { tenantId: fixture.tenantId, actorMembershipId: fixture.membershipId };

    const result = await withTenantTx(tenantCtx(fixture), async (tx) =>
      getPublishedCourseModules(tx, ctx, fixture.publishedCourseId),
    );

    expect(result.data.items).toHaveLength(1);
    expect(result.data.items[0]?.lessonCount).toBe(1);
  });

  it("creates module under owned draft course", async () => {
    const fixture = await createCourseAuthoringFixture();
    const ctx = instructorCtx(fixture, "req_module_create");

    const created = await withTenantTx(authoringTenantTx(fixture), async (tx) =>
      createCourseModule(tx, ctx, fixture.draftCourseId, { title: "Module A" }),
    );

    expect(created.data.title).toBe("Module A");
    expect(created.data.position).toBe(1);
  });

  it("lists builder modules and updates position/title", async () => {
    const fixture = await createCourseAuthoringFixture();
    const ctx = instructorCtx(fixture, "req_module_update");

    const module = await withTenantTx(authoringTenantTx(fixture), async (tx) => {
      const created = await createCourseModule(tx, ctx, fixture.draftCourseId, {
        title: "Module B",
      });
      await updateCourseModule(tx, ctx, created.data.id, {
        title: "Module B Updated",
        position: 1,
      });
      return created.data.id;
    });

    const listed = await withTenantTx(authoringTenantTx(fixture), async (tx) =>
      listCourseModulesForBuilderService(tx, instructorCtx(fixture), fixture.draftCourseId),
    );

    expect(listed.data.items.find((item) => item.id === module)?.title).toBe("Module B Updated");
  });

  it("deletes module without lessons", async () => {
    const fixture = await createCourseAuthoringFixture();
    const ctx = instructorCtx(fixture, "req_module_delete");

    await withTenantTx(authoringTenantTx(fixture), async (tx) => {
      const created = await createCourseModule(tx, ctx, fixture.draftCourseId, {
        title: "Temp Module",
      });
      await deleteCourseModule(tx, ctx, created.data.id);

      const listed = await listCourseModulesForBuilderService(
        tx,
        instructorCtx(fixture),
        fixture.draftCourseId,
      );
      expect(listed.data.items.some((item) => item.id === created.data.id)).toBe(false);
    });
  });
});
