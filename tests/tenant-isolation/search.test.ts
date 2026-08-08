import { describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { withTenantTx } from "@atlas/db";
import { requestSearchReindex } from "@atlas/domain/search/search.service";
import { searchRepository } from "@atlas/domain/search/search.repository";
import "../../backend/apps/api/src/server/search/search-source-adapters";
import {
  adminCtx,
  authoringTenantTx,
  createCourseAuthoringFixture,
} from "../fixtures/course-authoring-fixture";
import { createTenantIsolationFixture, tenantCtx } from "./tenant-isolation-fixture";

const describeWithDb =
  process.env["DATABASE_URL"] && process.env["PLATFORM_DATABASE_URL"] ? describe : describe.skip;

describeWithDb("search tenant isolation", () => {
  it("RLS filters search_index_entries to current tenant", async () => {
    const isolation = await createTenantIsolationFixture();

    const rows = await withTenantTx(
      tenantCtx(isolation.tenantA),
      async (tx) =>
        tx.$queryRaw<Array<{ id: string }>>`
        select id::text
        from search_index_entries
        where tenant_id = ${isolation.tenantB.tenantId}::uuid
      `,
    );

    expect(rows).toHaveLength(0);
  });

  it("does not expose tenant B indexed titles to tenant A search query", async () => {
    const fixture = await createCourseAuthoringFixture();
    const isolation = await createTenantIsolationFixture();

    await withTenantTx(authoringTenantTx(fixture, fixture.learnerMembershipId), async (tx) => {
      await tx.$executeRaw`
        insert into search_index_entries (
          id, tenant_id, source_context, source_type, source_id, title, body, visibility, updated_at
        )
        values (
          ${randomUUID()}::uuid,
          ${fixture.tenantId}::uuid,
          'learning',
          'course',
          ${fixture.draftCourseId}::uuid,
          'Tenant A Secret Course',
          'hidden body',
          'TENANT',
          now()
        )
      `;
    });

    const foreignResults = await withTenantTx(tenantCtx(isolation.tenantA), async (tx) => {
      const { querySearch } = await import("@atlas/domain/search/search.service");
      return querySearch(
        tx,
        {
          tenantId: isolation.tenantA.tenantId,
          actorMembershipId: isolation.tenantA.membershipId,
          requestId: "req_search_foreign",
        },
        { q: "Secret" },
      );
    });

    expect(foreignResults.data.items.some((item) => item.title.includes("Secret"))).toBe(false);
  });

  it("reindex outbox event remains tenant scoped", async () => {
    const fixture = await createCourseAuthoringFixture();
    const admin = adminCtx(fixture, "req_search_reindex_iso");

    await withTenantTx(authoringTenantTx(fixture, fixture.adminMembershipId), async (tx) =>
      requestSearchReindex(tx, {
        tenantId: fixture.tenantId,
        actorMembershipId: fixture.adminMembershipId,
        requestId: admin.requestId,
        idempotencyKey: "search-reindex-iso",
      }),
    );

    const rows = await withTenantTx(
      authoringTenantTx(fixture),
      async (tx) =>
        tx.$queryRaw<Array<{ tenant_id: string; event_type: string }>>`
        select tenant_id::text, event_type
        from outbox_events
        where event_type = 'search.reindex_requested'
        order by occurred_at desc
        limit 1
      `,
    );

    expect(rows[0]?.tenant_id).toBe(fixture.tenantId);
    expect(rows[0]?.event_type).toBe("search.reindex_requested");
  });
});

describeWithDb("search worker tenant isolation", () => {
  it("uses withTenantTx through worker handler", async () => {
    const fixture = await createCourseAuthoringFixture();

    await withTenantTx(authoringTenantTx(fixture, fixture.adminMembershipId), async (tx) => {
      await tx.$executeRaw`
        update courses
        set status = 'PUBLISHED', title = 'Worker Indexed Course', updated_at = now()
        where id = ${fixture.draftCourseId}::uuid
      `;
    });

    const { handleSearchOutboxEvent } = await import("@atlas/domain/search/search.worker");

    await handleSearchOutboxEvent({
      id: randomUUID(),
      eventType: "course.published",
      tenantId: fixture.tenantId,
      payload: { courseId: fixture.draftCourseId, publishedAt: new Date().toISOString() },
      requestId: "req_search_worker",
    });

    const entry = await withTenantTx(authoringTenantTx(fixture), async (tx) =>
      searchRepository.findIndexEntryByIdentity(tx, {
        sourceContext: "learning",
        sourceType: "course",
        sourceId: fixture.draftCourseId,
      }),
    );

    expect(entry?.title).toBe("Worker Indexed Course");
  });
});
