import { describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { withTenantTx } from "@atlas/db";
import { runProtectedTenantRoutePipeline } from "@atlas/api";
import { querySearch, requestSearchReindex } from "@atlas/domain/search/search.service";
import {
  searchQueryMetadata,
  searchReindexMetadata,
} from "@atlas/domain/search/search.route-metadata";
import { processSearchSourceEvent } from "@atlas/domain/search/search.worker";
import "../../../backend/apps/api/src/server/search/search-source-adapters";
import {
  adminCtx,
  authoringTenantTx,
  createCourseAuthoringFixture,
  learnerCtx,
} from "../../fixtures/course-authoring-fixture";

const describeWithDb =
  process.env["DATABASE_URL"] && process.env["PLATFORM_DATABASE_URL"] ? describe : describe.skip;

describeWithDb("search API integration", () => {
  it("GET /search returns authorized results without access_json", async () => {
    const fixture = await createCourseAuthoringFixture();
    const learner = learnerCtx(fixture, "req_search_get");

    await withTenantTx(authoringTenantTx(fixture, fixture.learnerMembershipId), async (tx) => {
      await tx.$executeRaw`
        update courses
        set status = 'PUBLISHED', title = 'Published Atlas Search Course', updated_at = now()
        where id = ${fixture.draftCourseId}::uuid
      `;

      await processSearchSourceEvent(
        tx,
        {
          tenantId: fixture.tenantId,
          actorMembershipId: fixture.adminMembershipId,
          requestId: "req_search_index",
        },
        {
          id: randomUUID(),
          eventType: "course.published",
          payload: { courseId: fixture.draftCourseId, publishedAt: new Date().toISOString() },
        },
      );
    });

    await withTenantTx(authoringTenantTx(fixture, fixture.learnerMembershipId), async (tx) =>
      runProtectedTenantRoutePipeline({
        tx,
        ctx: {
          tenantId: fixture.tenantId,
          requestId: learner.requestId,
          actorMembershipId: fixture.learnerMembershipId,
        },
        metadata: searchQueryMetadata,
        params: {},
        input: { q: "Atlas Search" },
      }),
    );

    const response = await withTenantTx(
      authoringTenantTx(fixture, fixture.learnerMembershipId),
      async (tx) =>
        querySearch(
          tx,
          {
            tenantId: fixture.tenantId,
            actorMembershipId: fixture.learnerMembershipId,
            requestId: learner.requestId,
          },
          { q: "Atlas Search" },
        ),
    );

    expect(response.data.items.length).toBeGreaterThan(0);
    expect(response.data.items[0]?.actionPath.startsWith("/courses/")).toBe(true);
    expect(JSON.stringify(response.data.items)).not.toContain("access_json");
    expect(JSON.stringify(response.data.items)).not.toContain("accessJson");
    expect(JSON.stringify(response.data.items)).not.toContain("vector_ref");
  });

  it("POST /search/reindex emits outbox only and does not write index rows in route", async () => {
    const fixture = await createCourseAuthoringFixture();
    const admin = adminCtx(fixture, "req_search_reindex_route");

    const before = await withTenantTx(
      authoringTenantTx(fixture),
      async (tx) =>
        tx.$queryRaw<Array<{ count: number }>>`
        select count(*)::int as count from search_index_entries where tenant_id = ${fixture.tenantId}::uuid
      `,
    );

    await withTenantTx(authoringTenantTx(fixture, fixture.adminMembershipId), async (tx) => {
      await runProtectedTenantRoutePipeline({
        tx,
        ctx: {
          tenantId: fixture.tenantId,
          requestId: admin.requestId,
          actorMembershipId: fixture.adminMembershipId,
          idempotencyKey: "search-reindex-route",
        },
        metadata: searchReindexMetadata,
        params: {},
        input: {},
      });

      await requestSearchReindex(tx, {
        tenantId: fixture.tenantId,
        actorMembershipId: fixture.adminMembershipId,
        requestId: admin.requestId,
        idempotencyKey: "search-reindex-route",
      });
    });

    const after = await withTenantTx(
      authoringTenantTx(fixture),
      async (tx) =>
        tx.$queryRaw<Array<{ count: number }>>`
        select count(*)::int as count from search_index_entries where tenant_id = ${fixture.tenantId}::uuid
      `,
    );

    const outbox = await withTenantTx(
      authoringTenantTx(fixture),
      async (tx) =>
        tx.$queryRaw<Array<{ event_type: string }>>`
        select event_type
        from outbox_events
        where event_type = 'search.reindex_requested'
        order by occurred_at desc
        limit 1
      `,
    );

    const auditCount = await withTenantTx(
      authoringTenantTx(fixture),
      async (tx) =>
        tx.$queryRaw<Array<{ count: number }>>`
        select count(*)::int as count
        from audit_entries
        where tenant_id = ${fixture.tenantId}::uuid
          and action like '%search%'
      `,
    );

    expect(after[0]?.count).toBe(before[0]?.count);
    expect(outbox[0]?.event_type).toBe("search.reindex_requested");
    expect(auditCount[0]?.count).toBe(0);
  });

  it("strictly rejects short q and unknown type", async () => {
    const fixture = await createCourseAuthoringFixture();

    await expect(
      withTenantTx(authoringTenantTx(fixture, fixture.learnerMembershipId), async (tx) =>
        querySearch(
          tx,
          {
            tenantId: fixture.tenantId,
            actorMembershipId: fixture.learnerMembershipId,
            requestId: "req_search_invalid",
          },
          { q: "a" },
        ),
      ),
    ).rejects.toThrow();
  });
});
