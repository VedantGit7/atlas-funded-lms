import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { withTenantTx } from "@atlas/db";
import {
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
 * Folding a whole duplicate cluster in one transaction.
 *
 * A drifted vocabulary carries "Beginner", "beginners" and "Beginner's guide"
 * together, so merging a pair at a time is the wrong unit of work: the second
 * call failing would leave the vocabulary half-tidied, which is the state the
 * merge screen exists to clear. These tests pin the two properties that follow
 * — every source folds, and a bad source folds none of them.
 */

const describeWithDb =
  process.env["DATABASE_URL"] && process.env["PLATFORM_DATABASE_URL"] ? describe : describe.skip;

async function makeTag(tenant: IsolationTenantFixture, title: string): Promise<string> {
  const ctx = tenantCtx(tenant);
  const created = await withTenantTx(ctx, async (tx) => createTag(tx, ctx, { title }));
  return created.data.id;
}

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

async function attachToCourse(tenant: IsolationTenantFixture, courseId: string, tagId: string) {
  await withTenantTx(tenantCtx(tenant), async (tx) => {
    await tx.$executeRaw`
      insert into course_tags (id, tenant_id, course_id, tag_id, created_at)
      values (${randomUUID()}::uuid, ${tenant.tenantId}::uuid, ${courseId}::uuid, ${tagId}::uuid, now())
      on conflict (tenant_id, course_id, tag_id) do nothing
    `;
  });
}

describeWithDb("multi-source tag merge (database)", () => {
  it("folds a whole cluster into one survivor", async () => {
    const { tenantA } = await createTenantIsolationFixture();
    const ctx = tenantCtx(tenantA);

    const keep = await makeTag(tenantA, "Beginner");
    const plural = await makeTag(tenantA, "Beginners");
    const spaced = await makeTag(tenantA, "Beginner guide");

    const courseOne = await insertCourse(tenantA, "Course one");
    const courseTwo = await insertCourse(tenantA, "Course two");
    await attachToCourse(tenantA, courseOne, plural);
    await attachToCourse(tenantA, courseTwo, spaced);

    const result = await withTenantTx(ctx, async (tx) =>
      mergeTags(tx, ctx, { sourceTagIds: [plural, spaced], targetTagId: keep }),
    );

    expect(result.data.sourceTagIds.sort()).toEqual([plural, spaced].sort());
    expect(result.data.movedCourses).toBe(2);

    const usage = await withTenantTx(ctx, async (tx) => getTagUsage(tx, ctx, keep));
    expect(usage.data.counts.courses).toBe(2);

    const listed = await withTenantTx(ctx, async (tx) => listTenantTags(tx, ctx, {}));
    expect(listed.data.items.map((tag) => tag.id)).toEqual([keep]);
  });

  it("counts a course already carrying the survivor as already tagged, not moved", async () => {
    const { tenantA } = await createTenantIsolationFixture();
    const ctx = tenantCtx(tenantA);

    const keep = await makeTag(tenantA, "Beginner");
    const plural = await makeTag(tenantA, "Beginners");
    const spaced = await makeTag(tenantA, "Beginner guide");

    // One course carries all three: the merge must leave it with exactly one
    // tagging rather than failing on the unique index.
    const courseId = await insertCourse(tenantA, "Shared course");
    for (const tagId of [keep, plural, spaced]) {
      await attachToCourse(tenantA, courseId, tagId);
    }

    const result = await withTenantTx(ctx, async (tx) =>
      mergeTags(tx, ctx, { sourceTagIds: [plural, spaced], targetTagId: keep }),
    );

    expect(result.data.movedCourses).toBe(0);
    expect(result.data.alreadyTagged).toBe(2);

    const usage = await withTenantTx(ctx, async (tx) => getTagUsage(tx, ctx, keep));
    expect(usage.data.counts.courses).toBe(1);
  });

  it("folds nothing when one source does not resolve", async () => {
    const { tenantA } = await createTenantIsolationFixture();
    const ctx = tenantCtx(tenantA);

    const keep = await makeTag(tenantA, "Beginner");
    const real = await makeTag(tenantA, "Beginners");
    const courseId = await insertCourse(tenantA, "Course one");
    await attachToCourse(tenantA, courseId, real);

    await expect(
      withTenantTx(ctx, async (tx) =>
        mergeTags(tx, ctx, { sourceTagIds: [real, randomUUID()], targetTagId: keep }),
      ),
    ).rejects.toThrow(/Tag not found/);

    // The rollback is the point: a half-merged vocabulary is worse than none.
    const listed = await withTenantTx(ctx, async (tx) => listTenantTags(tx, ctx, {}));
    expect(listed.data.items.map((tag) => tag.id).sort()).toEqual([keep, real].sort());

    const usage = await withTenantTx(ctx, async (tx) => getTagUsage(tx, ctx, real));
    expect(usage.data.counts.courses).toBe(1);
  });

  it("refuses to fold the survivor into itself", async () => {
    const { tenantA } = await createTenantIsolationFixture();
    const ctx = tenantCtx(tenantA);
    const keep = await makeTag(tenantA, "Beginner");
    const other = await makeTag(tenantA, "Beginners");

    await expect(
      withTenantTx(ctx, async (tx) =>
        mergeTags(tx, ctx, { sourceTagIds: [other, keep], targetTagId: keep }),
      ),
    ).rejects.toThrow(/merged into itself/i);
  });

  it("writes one audit entry per folded tag, not one per merge", async () => {
    const { tenantA } = await createTenantIsolationFixture();
    const ctx = tenantCtx(tenantA);

    const keep = await makeTag(tenantA, "Beginner");
    const plural = await makeTag(tenantA, "Beginners");
    const spaced = await makeTag(tenantA, "Beginner guide");

    await withTenantTx(ctx, async (tx) =>
      mergeTags(tx, ctx, { sourceTagIds: [plural, spaced], targetTagId: keep }),
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
    // "Which tags became this one" is the question the history has to answer,
    // and a single aggregate entry cannot.
    expect(audits).toHaveLength(2);
  });

  it("deduplicates a source listed twice", async () => {
    const { tenantA } = await createTenantIsolationFixture();
    const ctx = tenantCtx(tenantA);
    const keep = await makeTag(tenantA, "Beginner");
    const plural = await makeTag(tenantA, "Beginners");

    const result = await withTenantTx(ctx, async (tx) =>
      mergeTags(tx, ctx, { sourceTagIds: [plural, plural], targetTagId: keep }),
    );

    // Without the dedupe the second pass finds the tag already soft-deleted and
    // throws, turning a harmless duplicate in the request into a 404.
    expect(result.data.sourceTagIds).toEqual([plural]);
  });
});
