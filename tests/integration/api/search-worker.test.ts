import { describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { withTenantTx } from "@atlas/db";
import { processSearchSourceEvent } from "@atlas/domain/search/search.worker";
import { searchRepository } from "@atlas/domain/search/search.repository";
import { runSearchReindex } from "@atlas/domain/search/search-reindex-runner";
import "../../../apps/web/src/server/search/search-source-adapters";
import {
  authoringTenantTx,
  createCourseAuthoringFixture,
} from "../../fixtures/course-authoring-fixture";

const describeWithDb =
  process.env["DATABASE_URL"] && process.env["PLATFORM_DATABASE_URL"] ? describe : describe.skip;

describeWithDb("search worker", () => {
  it("indexes one derived entry from course.published", async () => {
    const fixture = await createCourseAuthoringFixture();

    await withTenantTx(authoringTenantTx(fixture, fixture.adminMembershipId), async (tx) => {
      await tx.$executeRaw`
        update courses
        set status = 'PUBLISHED', title = 'Worker Course Alpha', updated_at = now()
        where id = ${fixture.draftCourseId}::uuid
      `;

      await processSearchSourceEvent(
        tx,
        {
          tenantId: fixture.tenantId,
          actorMembershipId: fixture.adminMembershipId,
          requestId: "req_worker_course",
        },
        {
          id: randomUUID(),
          eventType: "course.published",
          payload: { courseId: fixture.draftCourseId, publishedAt: new Date().toISOString() },
        },
      );
    });

    const entry = await withTenantTx(authoringTenantTx(fixture), async (tx) =>
      searchRepository.findIndexEntryByIdentity(tx, {
        sourceContext: "learning",
        sourceType: "course",
        sourceId: fixture.draftCourseId,
      }),
    );

    expect(entry?.title).toBe("Worker Course Alpha");
  });

  it("replay keeps same index identity without duplicate rows", async () => {
    const fixture = await createCourseAuthoringFixture();

    await withTenantTx(authoringTenantTx(fixture, fixture.adminMembershipId), async (tx) => {
      await tx.$executeRaw`
        update courses
        set status = 'PUBLISHED', title = 'Replay Course', updated_at = now()
        where id = ${fixture.draftCourseId}::uuid
      `;

      const event = {
        id: randomUUID(),
        eventType: "course.published",
        payload: { courseId: fixture.draftCourseId, publishedAt: new Date().toISOString() },
      };

      await processSearchSourceEvent(
        tx,
        {
          tenantId: fixture.tenantId,
          actorMembershipId: fixture.adminMembershipId,
          requestId: "req_worker_replay_1",
        },
        event,
      );

      await processSearchSourceEvent(
        tx,
        {
          tenantId: fixture.tenantId,
          actorMembershipId: fixture.adminMembershipId,
          requestId: "req_worker_replay_2",
        },
        event,
      );
    });

    const count = await withTenantTx(
      authoringTenantTx(fixture),
      async (tx) =>
        tx.$queryRaw<Array<{ count: number }>>`
        select count(*)::int as count
        from search_index_entries
        where tenant_id = ${fixture.tenantId}::uuid
          and source_context = 'learning'
          and source_type = 'course'
          and source_id = ${fixture.draftCourseId}::uuid
      `,
    );

    expect(count[0]?.count).toBe(1);
  });

  it("removes index entry when source becomes unavailable", async () => {
    const fixture = await createCourseAuthoringFixture();

    await withTenantTx(authoringTenantTx(fixture, fixture.adminMembershipId), async (tx) => {
      await tx.$executeRaw`
        update courses
        set status = 'PUBLISHED', title = 'Temporary Course', updated_at = now()
        where id = ${fixture.draftCourseId}::uuid
      `;

      await processSearchSourceEvent(
        tx,
        {
          tenantId: fixture.tenantId,
          actorMembershipId: fixture.adminMembershipId,
          requestId: "req_worker_remove",
        },
        {
          id: randomUUID(),
          eventType: "course.published",
          payload: { courseId: fixture.draftCourseId, publishedAt: new Date().toISOString() },
        },
      );

      await tx.$executeRaw`
        update courses
        set status = 'DRAFT', updated_at = now()
        where id = ${fixture.draftCourseId}::uuid
      `;

      await processSearchSourceEvent(
        tx,
        {
          tenantId: fixture.tenantId,
          actorMembershipId: fixture.adminMembershipId,
          requestId: "req_worker_remove_2",
        },
        {
          id: randomUUID(),
          eventType: "course.published",
          payload: { courseId: fixture.draftCourseId, publishedAt: new Date().toISOString() },
        },
      );
    });

    const entry = await withTenantTx(authoringTenantTx(fixture), async (tx) =>
      searchRepository.findIndexEntryByIdentity(tx, {
        sourceContext: "learning",
        sourceType: "course",
        sourceId: fixture.draftCourseId,
      }),
    );

    expect(entry).toBeNull();
  });

  it("ignores unknown events", async () => {
    const fixture = await createCourseAuthoringFixture();

    await expect(
      withTenantTx(authoringTenantTx(fixture, fixture.adminMembershipId), async (tx) =>
        processSearchSourceEvent(
          tx,
          {
            tenantId: fixture.tenantId,
            actorMembershipId: fixture.adminMembershipId,
            requestId: "req_worker_unknown",
          },
          {
            id: randomUUID(),
            eventType: "analytics.projection_requested",
            payload: {},
          },
        ),
      ),
    ).resolves.toBeUndefined();
  });

  it("reindex runs registered adapters only", async () => {
    const fixture = await createCourseAuthoringFixture();

    await withTenantTx(authoringTenantTx(fixture, fixture.adminMembershipId), async (tx) => {
      await tx.$executeRaw`
        update courses
        set status = 'PUBLISHED', title = 'Reindex Course', updated_at = now()
        where id = ${fixture.draftCourseId}::uuid
      `;

      const result = await runSearchReindex(tx, {
        tenantId: fixture.tenantId,
        actorMembershipId: fixture.adminMembershipId,
        requestId: "req_worker_reindex",
      });

      expect(result.indexed).toBeGreaterThan(0);
    });
  });
});
