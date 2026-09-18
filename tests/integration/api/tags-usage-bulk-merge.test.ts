import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { withTenantTx } from "@atlas/db";
import {
  bulkTagAction,
  createTag,
  getTagUsage,
  listTenantTags,
  mergeTags,
} from "../../../backend/apps/api/src/server/tags/tags.service";
import {
  createTenantIsolationFixture,
  tenantCtx,
  type IsolationTenantFixture,
} from "../../tenant-isolation/tenant-isolation-fixture";

/**
 * The three capabilities the tag console needed and the API did not have.
 *
 * All three are worth testing against a real database rather than a mock.
 * Usage is a reverse lookup across two join tables whose whole point is that
 * the counts are true. Bulk is one statement over a set, so the interesting
 * case is the id that no longer resolves. And merge is insert-then-delete
 * across a unique constraint — the case where both tags are already on the same
 * course is exactly the case a merge of near-duplicates hits, and it is the one
 * a naive `update ... set tag_id` would fail on.
 */

const describeWithDb =
  process.env["DATABASE_URL"] && process.env["PLATFORM_DATABASE_URL"] ? describe : describe.skip;

async function makeTag(tenant: IsolationTenantFixture, title: string): Promise<string> {
  const ctx = tenantCtx(tenant);
  const created = await withTenantTx(ctx, async (tx) => createTag(tx, ctx, { title }));
  return created.data.id;
}

/** A second course, so course counts are not always the fixture's one course. */
async function insertCourse(tenant: IsolationTenantFixture, title: string): Promise<string> {
  const id = randomUUID();
  await withTenantTx(tenantCtx(tenant), async (tx) => {
    await tx.$executeRaw`
      insert into courses (id, tenant_id, slug, title, status, created_at, updated_at)
      values (${id}::uuid, ${tenant.tenantId}::uuid, ${`course-${id.slice(0, 8)}`},
              ${title}, 'PUBLISHED'::"PublishStatus", now(), now())
    `;
  });
  return id;
}

/** A lesson needs a module, and the module needs a course. */
async function insertLesson(
  tenant: IsolationTenantFixture,
  courseId: string,
  title: string,
): Promise<string> {
  const moduleId = randomUUID();
  const lessonId = randomUUID();
  await withTenantTx(tenantCtx(tenant), async (tx) => {
    await tx.$executeRaw`
      insert into course_modules (id, tenant_id, course_id, title, position, status, created_at, updated_at)
      values (${moduleId}::uuid, ${tenant.tenantId}::uuid, ${courseId}::uuid, 'Module',
              ${Math.floor(Math.random() * 100000)}, 'PUBLISHED'::"PublishStatus", now(), now())
    `;
    await tx.$executeRaw`
      insert into lessons (id, tenant_id, module_id, slug, title, position, status, created_at, updated_at)
      values (${lessonId}::uuid, ${tenant.tenantId}::uuid, ${moduleId}::uuid,
              ${`lesson-${lessonId.slice(0, 8)}`}, ${title}, 1, 'PUBLISHED'::"PublishStatus",
              now(), now())
    `;
  });
  return lessonId;
}

async function attachToCourse(tenant: IsolationTenantFixture, courseId: string, tagId: string) {
  await withTenantTx(tenantCtx(tenant), async (tx) => {
    await tx.$executeRaw`
      insert into course_tags (id, tenant_id, course_id, tag_id, created_at)
      values (${randomUUID()}::uuid, ${tenant.tenantId}::uuid, ${courseId}::uuid, ${tagId}::uuid, now())
      on conflict (tenant_id, course_id, tag_id) do nothing
    `;
  });
}

async function attachToLesson(tenant: IsolationTenantFixture, lessonId: string, tagId: string) {
  await withTenantTx(tenantCtx(tenant), async (tx) => {
    await tx.$executeRaw`
      insert into lesson_tags (id, tenant_id, lesson_id, tag_id, created_at)
      values (${randomUUID()}::uuid, ${tenant.tenantId}::uuid, ${lessonId}::uuid, ${tagId}::uuid, now())
      on conflict (tenant_id, lesson_id, tag_id) do nothing
    `;
  });
}

describeWithDb("tag usage (database)", () => {
  it("counts courses and lessons separately, and names them", async () => {
    const { tenantA } = await createTenantIsolationFixture();
    const ctx = tenantCtx(tenantA);
    const tagId = await makeTag(tenantA, "Risk management");

    const secondCourse = await insertCourse(tenantA, "Position sizing");
    await attachToCourse(tenantA, tenantA.courseId, tagId);
    await attachToCourse(tenantA, secondCourse, tagId);
    const lessonId = await insertLesson(tenantA, secondCourse, "Introduction");
    await attachToLesson(tenantA, lessonId, tagId);

    const usage = await withTenantTx(ctx, async (tx) => getTagUsage(tx, ctx, tagId));

    expect(usage.data.counts).toEqual({ courses: 2, lessons: 1 });
    expect(usage.data.truncated).toBe(false);
    // A lesson title alone does not identify a lesson, so the course comes with it.
    expect(usage.data.lessons[0]?.courseTitle).toBe("Position sizing");
  });

  it("does not count a soft-deleted course", async () => {
    const { tenantA } = await createTenantIsolationFixture();
    const ctx = tenantCtx(tenantA);
    const tagId = await makeTag(tenantA, "Archived topic");
    const courseId = await insertCourse(tenantA, "Retired course");
    await attachToCourse(tenantA, courseId, tagId);

    await withTenantTx(ctx, async (tx) => {
      await tx.$executeRaw`
        update courses set deleted_at = now() where id = ${courseId}::uuid
      `;
    });

    const usage = await withTenantTx(ctx, async (tx) => getTagUsage(tx, ctx, tagId));
    // Inflating the blast radius before a destructive action is worse than
    // showing no number at all.
    expect(usage.data.counts.courses).toBe(0);
  });

  it("reports zero rather than refusing to answer for an unattached tag", async () => {
    const { tenantA } = await createTenantIsolationFixture();
    const ctx = tenantCtx(tenantA);
    const tagId = await makeTag(tenantA, "Unused");

    const usage = await withTenantTx(ctx, async (tx) => getTagUsage(tx, ctx, tagId));
    expect(usage.data.counts).toEqual({ courses: 0, lessons: 0 });
  });

  it("404s for a tag belonging to another tenant", async () => {
    const { tenantA, tenantB } = await createTenantIsolationFixture();
    const foreignTagId = await makeTag(tenantB, "Their tag");
    const ctx = tenantCtx(tenantA);

    await expect(
      withTenantTx(ctx, async (tx) => getTagUsage(tx, ctx, foreignTagId)),
    ).rejects.toThrow(/Tag not found/);
  });

  it("attaches usage to the list only when it is asked for", async () => {
    const { tenantA } = await createTenantIsolationFixture();
    const ctx = tenantCtx(tenantA);
    const tagId = await makeTag(tenantA, "Listed");
    await attachToCourse(tenantA, tenantA.courseId, tagId);

    const without = await withTenantTx(ctx, async (tx) => listTenantTags(tx, ctx, {}));
    expect(without.data.items[0]?.usage).toBeUndefined();

    const withUsage = await withTenantTx(ctx, async (tx) =>
      listTenantTags(tx, ctx, { withUsage: true }),
    );
    expect(withUsage.data.items.find((tag) => tag.id === tagId)?.usage).toEqual({
      courses: 1,
      lessons: 0,
    });
  });
});

describeWithDb("bulk tag actions (database)", () => {
  it("re-scopes a selection and reports ids that no longer resolve", async () => {
    const { tenantA } = await createTenantIsolationFixture();
    const ctx = tenantCtx(tenantA);
    const first = await makeTag(tenantA, "Alpha");
    const second = await makeTag(tenantA, "Beta");
    const gone = randomUUID();

    const result = await withTenantTx(ctx, async (tx) =>
      bulkTagAction(tx, ctx, {
        action: "set_visibility",
        tagIds: [first, second, gone],
        visibility: "classification",
      }),
    );

    expect(result.data.updatedIds.sort()).toEqual([first, second].sort());
    // A tag deleted by a colleague must not cost the operator the rest of the
    // selection.
    expect(result.data.missingIds).toEqual([gone]);

    const listed = await withTenantTx(ctx, async (tx) => listTenantTags(tx, ctx, {}));
    expect(listed.data.items.every((tag) => tag.visibility === "classification")).toBe(true);
  });

  it("deletes a selection and writes one audit entry per tag", async () => {
    const { tenantA } = await createTenantIsolationFixture();
    const ctx = tenantCtx(tenantA);
    const first = await makeTag(tenantA, "Doomed one");
    const second = await makeTag(tenantA, "Doomed two");

    await withTenantTx(ctx, async (tx) =>
      bulkTagAction(tx, ctx, { action: "delete", tagIds: [first, second] }),
    );

    const listed = await withTenantTx(ctx, async (tx) => listTenantTags(tx, ctx, {}));
    expect(listed.data.items).toHaveLength(0);

    const audits = await withTenantTx(
      ctx,
      async (tx) =>
        tx.$queryRaw<Array<{ target_id: string }>>`
          select target_id from audit_entries
          where tenant_id = ${tenantA.tenantId}::uuid
            and action = 'tag.delete'
            and target_id = any(array[${first}, ${second}])
        `,
    );
    // Bulk work reuses the single-tag action, so an existing query for
    // 'tag.delete' does not quietly miss everything done in bulk.
    expect(audits).toHaveLength(2);
  });

  it("cannot touch another tenant's tag", async () => {
    const { tenantA, tenantB } = await createTenantIsolationFixture();
    const foreignTagId = await makeTag(tenantB, "Theirs");
    const ctx = tenantCtx(tenantA);

    const result = await withTenantTx(ctx, async (tx) =>
      bulkTagAction(tx, ctx, { action: "delete", tagIds: [foreignTagId] }),
    );

    expect(result.data.updatedIds).toEqual([]);
    expect(result.data.missingIds).toEqual([foreignTagId]);

    const stillThere = await withTenantTx(tenantCtx(tenantB), async (tx) =>
      listTenantTags(tx, tenantCtx(tenantB), {}),
    );
    expect(stillThere.data.items.map((tag) => tag.id)).toContain(foreignTagId);
  });
});

describeWithDb("tag merge (database)", () => {
  it("moves attachments onto the survivor and removes the folded tag", async () => {
    const { tenantA } = await createTenantIsolationFixture();
    const ctx = tenantCtx(tenantA);
    const keep = await makeTag(tenantA, "Beginner");
    const fold = await makeTag(tenantA, "Beginners");

    const otherCourse = await insertCourse(tenantA, "Second course");
    await attachToCourse(tenantA, otherCourse, fold);
    const lessonId = await insertLesson(tenantA, otherCourse, "Lesson one");
    await attachToLesson(tenantA, lessonId, fold);

    const result = await withTenantTx(ctx, async (tx) =>
      mergeTags(tx, ctx, { sourceTagIds: [fold], targetTagId: keep }),
    );

    expect(result.data.movedCourses).toBe(1);
    expect(result.data.movedLessons).toBe(1);

    const usage = await withTenantTx(ctx, async (tx) => getTagUsage(tx, ctx, keep));
    expect(usage.data.counts).toEqual({ courses: 1, lessons: 1 });

    const listed = await withTenantTx(ctx, async (tx) => listTenantTags(tx, ctx, {}));
    expect(listed.data.items.map((tag) => tag.id)).toEqual([keep]);
  });

  it("absorbs a course already carrying both tags instead of failing", async () => {
    const { tenantA } = await createTenantIsolationFixture();
    const ctx = tenantCtx(tenantA);
    const keep = await makeTag(tenantA, "Beginner");
    const fold = await makeTag(tenantA, "Beginners");

    // The near-duplicate case: one course carries both, so the unique index on
    // (tenant_id, course_id, tag_id) would reject a plain re-point.
    await attachToCourse(tenantA, tenantA.courseId, keep);
    await attachToCourse(tenantA, tenantA.courseId, fold);

    const result = await withTenantTx(ctx, async (tx) =>
      mergeTags(tx, ctx, { sourceTagIds: [fold], targetTagId: keep }),
    );

    expect(result.data.movedCourses).toBe(0);
    expect(result.data.alreadyTagged).toBe(1);

    const usage = await withTenantTx(ctx, async (tx) => getTagUsage(tx, ctx, keep));
    // The course keeps exactly one tagging, not a duplicate row.
    expect(usage.data.counts.courses).toBe(1);
  });

  it("writes an audit entry naming both sides", async () => {
    const { tenantA } = await createTenantIsolationFixture();
    const ctx = tenantCtx(tenantA);
    const keep = await makeTag(tenantA, "Keep me");
    const fold = await makeTag(tenantA, "Fold me");

    await withTenantTx(ctx, async (tx) =>
      mergeTags(tx, ctx, { sourceTagIds: [fold], targetTagId: keep }),
    );

    const audits = await withTenantTx(
      ctx,
      async (tx) =>
        tx.$queryRaw<Array<{ target_id: string }>>`
          select target_id from audit_entries
          where tenant_id = ${tenantA.tenantId}::uuid
            and action = 'tag.merge'
            and target_id = ${keep}
        `,
    );
    expect(audits).toHaveLength(1);
  });

  it("refuses to merge across tenants", async () => {
    const { tenantA, tenantB } = await createTenantIsolationFixture();
    const mine = await makeTag(tenantA, "Mine");
    const theirs = await makeTag(tenantB, "Theirs");
    const ctx = tenantCtx(tenantA);

    await expect(
      withTenantTx(ctx, async (tx) =>
        mergeTags(tx, ctx, { sourceTagIds: [theirs], targetTagId: mine }),
      ),
    ).rejects.toThrow(/Tag not found/);
  });
});
