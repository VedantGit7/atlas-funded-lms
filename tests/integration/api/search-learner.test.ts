import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { withTenantTx } from "@atlas/db";
import { processSearchSourceEvent } from "@atlas/domain/search/search.worker";
import { querySearch } from "../../../backend/apps/api/src/server/search/search-query";
import {
  authoringTenantTx,
  createCourseAuthoringFixture,
  learnerCtx,
  type CourseAuthoringFixture,
} from "../../fixtures/course-authoring-fixture";

/**
 * QA review 1 C9, review 2 C4 against Postgres: a learner searching for a
 * published course finds it, through the same module the API route uses, and
 * no longer finds it once it is unpublished.
 *
 * Like the route, this file loads the search sources only through
 * server/search/search-query (it must not import search-source-adapters).
 */
const describeWithDb =
  process.env["DATABASE_URL"] && process.env["PLATFORM_DATABASE_URL"] ? describe : describe.skip;

async function setStatusAndIndex(
  fixture: CourseAuthoringFixture,
  status: "PUBLISHED" | "DRAFT",
  title: string,
) {
  await withTenantTx(authoringTenantTx(fixture, fixture.adminMembershipId), async (tx) => {
    await tx.$executeRaw`
      update courses
         set status = ${status}::"PublishStatus", title = ${title}, updated_at = now()
       where id = ${fixture.draftCourseId}::uuid
    `;
    // What the worker does with the outbox event (search.worker).
    await processSearchSourceEvent(
      tx,
      {
        tenantId: fixture.tenantId,
        actorMembershipId: fixture.adminMembershipId,
        requestId: randomUUID(),
      },
      status === "PUBLISHED"
        ? {
            id: randomUUID(),
            eventType: "course.published",
            payload: { courseId: fixture.draftCourseId, publishedAt: new Date().toISOString() },
          }
        : {
            id: randomUUID(),
            eventType: "course.unpublished",
            payload: {
              courseId: fixture.draftCourseId,
              unpublishedAt: new Date().toISOString(),
            },
          },
    );
  });
}

async function search(fixture: CourseAuthoringFixture, q: string) {
  return withTenantTx(authoringTenantTx(fixture, fixture.learnerMembershipId), (tx) =>
    querySearch(tx, learnerCtx(fixture), { q }),
  );
}

describeWithDb("learner search (S1.5)", () => {
  it("finds a newly published course, and not once it is unpublished", async () => {
    const fixture = await createCourseAuthoringFixture();
    const title = `Price Action Mastery ${randomUUID().slice(0, 6)}`;

    expect((await search(fixture, "Price Action Mastery")).data.items).toEqual([]);

    await setStatusAndIndex(fixture, "PUBLISHED", title);
    const found = await search(fixture, "Price Action Mastery");
    expect(found.data.items).toEqual([
      expect.objectContaining({
        type: "course",
        title,
        actionPath: `/courses/${fixture.draftCourseId}`,
      }),
    ]);

    // A partial word finds it too.
    expect((await search(fixture, "mastery")).data.items).toHaveLength(1);

    await setStatusAndIndex(fixture, "DRAFT", title);
    expect((await search(fixture, "Price Action Mastery")).data.items).toEqual([]);
  });
});
