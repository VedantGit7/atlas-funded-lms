import { describe, expect, it } from "vitest";
import { withTenantTx } from "@atlas/db";
import {
  getDueQueue,
  startPracticeSession,
  submitPracticeResponse,
} from "../../backend/apps/api/src/server/practice/practice.service";
import { learnerCtx, createPracticeFixture, authoringTenantTx } from "../fixtures/practice-fixture";
import { createTenantIsolationFixture, tenantCtx } from "./tenant-isolation-fixture";

const describeWithDb =
  process.env["DATABASE_URL"] && process.env["PLATFORM_DATABASE_URL"] ? describe : describe.skip;

describeWithDb("practice tenant isolation", () => {
  it("blocks cross-tenant due queue reads", async () => {
    const fixture = await createPracticeFixture();
    const isolation = await createTenantIsolationFixture();

    const due = await withTenantTx(tenantCtx(isolation.tenantA), async (tx) =>
      getDueQueue(
        tx,
        {
          tenantId: isolation.tenantA.tenantId,
          actorMembershipId: isolation.tenantA.membershipId,
          requestId: "iso_due",
        },
        { limit: 20 },
      ),
    );

    expect(due.data.items.every((item) => item.itemId !== fixture.swipeItemIds[0])).toBe(true);
  });

  it("blocks cross-tenant collection start and foreign session response", async () => {
    const fixture = await createPracticeFixture();
    const isolation = await createTenantIsolationFixture();

    await expect(
      withTenantTx(tenantCtx(isolation.tenantB), async (tx) =>
        startPracticeSession(
          tx,
          learnerCtx(fixture, "iso_start"),
          {
            mode: "collection",
            engine: "swipe",
            collectionId: fixture.publishedCollectionId,
            maxItems: 1,
          },
          "iso-start",
        ),
      ),
    ).rejects.toMatchObject({ status: 404 });

    const started = await withTenantTx(
      authoringTenantTx(fixture, fixture.learnerMembershipId),
      async (tx) =>
        startPracticeSession(
          tx,
          learnerCtx(fixture, "iso_started"),
          { mode: "due", engine: "swipe", maxItems: 1 },
          "iso-started",
        ),
    );

    const card = started.data.card;
    if (!card) {
      throw new Error("Expected a starting card.");
    }

    await expect(
      withTenantTx(tenantCtx(isolation.tenantB), async (tx) =>
        submitPracticeResponse(
          tx,
          {
            tenantId: isolation.tenantB.tenantId,
            actorMembershipId: isolation.tenantB.membershipId,
            requestId: "iso_response",
          },
          started.data.session.id,
          { itemId: card.itemId, action: "known" },
          "iso-response",
        ),
      ),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("RLS filters practice tables to current tenant", async () => {
    const fixture = await createPracticeFixture();
    const isolation = await createTenantIsolationFixture();

    await withTenantTx(authoringTenantTx(fixture, fixture.learnerMembershipId), async (tx) => {
      await startPracticeSession(
        tx,
        learnerCtx(fixture, "rls_start"),
        { mode: "due", engine: "swipe", maxItems: 1 },
        "rls-start",
      );
    });

    const rows = await withTenantTx(
      tenantCtx(isolation.tenantA),
      async (tx) =>
        tx.$queryRaw<Array<{ tenant_id: string }>>`
        select tenant_id::text from practice_sessions where tenant_id = ${fixture.tenantId}::uuid
      `,
    );

    expect(rows).toHaveLength(0);
  });
});
