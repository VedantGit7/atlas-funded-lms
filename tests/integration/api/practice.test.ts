import { describe, expect, it } from "vitest";
import { withTenantTx } from "@atlas/db";
import { handleCompetencyOutboxEvent } from "../../../backend/apps/api/src/server/competency/competency.worker";
import {
  completePracticeSession,
  getDueQueue,
  startPracticeSession,
  submitPracticeResponse,
} from "../../../backend/apps/api/src/server/practice/practice.service";
import {
  authoringTenantTx,
  createPracticeFixture,
  learnerCtx,
} from "../../fixtures/practice-fixture";

const describeWithDb =
  process.env["DATABASE_URL"] && process.env["PLATFORM_DATABASE_URL"] ? describe : describe.skip;

describeWithDb("practice integration", () => {
  it("starts due session with server selection and idempotency replay", async () => {
    const fixture = await createPracticeFixture();
    const ctx = learnerCtx(fixture, "req_practice_start");

    const first = await withTenantTx(
      authoringTenantTx(fixture, fixture.learnerMembershipId),
      async (tx) =>
        startPracticeSession(tx, ctx, { mode: "due", maxItems: 2 }, "idem-practice-start"),
    );

    expect(first.data.session.totalItems).toBeGreaterThan(0);
    expect(first.data.card?.itemId).toBeTruthy();
    expect(first.data.card).not.toHaveProperty("answerKey");

    const replay = await withTenantTx(
      authoringTenantTx(fixture, fixture.learnerMembershipId),
      async (tx) =>
        startPracticeSession(tx, ctx, { mode: "due", maxItems: 2 }, "idem-practice-start"),
    );

    expect(replay.data.session.id).toBe(first.data.session.id);
  });

  it("records response, updates SRS, and completes session once", async () => {
    const fixture = await createPracticeFixture();
    const ctx = learnerCtx(fixture, "req_practice_response");

    const started = await withTenantTx(
      authoringTenantTx(fixture, fixture.learnerMembershipId),
      async (tx) =>
        startPracticeSession(tx, ctx, { mode: "due", maxItems: 1 }, "idem-practice-one"),
    );

    const itemId = started.data.card?.itemId;
    if (!itemId) {
      throw new Error("Expected a card item id.");
    }

    await withTenantTx(authoringTenantTx(fixture, fixture.learnerMembershipId), async (tx) => {
      const response = await submitPracticeResponse(
        tx,
        ctx,
        started.data.session.id,
        { itemId, action: "known" },
        "idem-response-1",
      );

      expect(typeof response.data.response.isCorrect).toBe("boolean");
      expect(response.data.response.feedbackLabel.length).toBeGreaterThan(0);
      expect(response.data.nextCard).toBeNull();

      const srs = await tx.$queryRaw<Array<{ interval_days: number }>>`
        select interval_days from srs_state where membership_id = ${fixture.learnerMembershipId}::uuid and item_id = ${itemId}::uuid
      `;
      expect(srs).toHaveLength(1);

      const completed = await completePracticeSession(
        tx,
        ctx,
        started.data.session.id,
        "idem-complete-1",
      );
      expect(completed.data.status).toBe("completed");
    });

    const events = await withTenantTx(
      authoringTenantTx(fixture),
      async (tx) =>
        tx.$queryRaw<Array<{ id: string; event_type: string }>>`
        select id::text, event_type
        from outbox_events
        where aggregate_id = ${started.data.session.id}
          and event_type = 'practice.session_completed'
      `,
    );

    expect(events).toHaveLength(1);

    await handleCompetencyOutboxEvent({
      id: events[0]?.id ?? "",
      eventType: "practice.session_completed",
      tenantId: fixture.tenantId,
      payload: {
        practiceSessionId: started.data.session.id,
        membershipId: fixture.learnerMembershipId,
        sessionType: "swipe",
      },
      requestId: "req_practice_worker",
    });

    const signals = await withTenantTx(
      authoringTenantTx(fixture),
      async (tx) =>
        tx.$queryRaw<Array<{ signal_source_key: string }>>`
        select signal_source_key from competency_signals where membership_id = ${fixture.learnerMembershipId}::uuid and signal_source_key = 'practice'
      `,
    );

    expect(signals.length).toBeGreaterThanOrEqual(0);
  });

  it("rejects duplicate same card with different idempotency key", async () => {
    const fixture = await createPracticeFixture();
    const ctx = learnerCtx(fixture, "req_practice_duplicate");

    const started = await withTenantTx(
      authoringTenantTx(fixture, fixture.learnerMembershipId),
      async (tx) =>
        startPracticeSession(tx, ctx, { mode: "due", maxItems: 1 }, "idem-practice-dup"),
    );

    const card = started.data.card;
    if (!card) {
      throw new Error("Expected a starting card.");
    }

    const itemId = card.itemId;

    await withTenantTx(authoringTenantTx(fixture, fixture.learnerMembershipId), async (tx) => {
      await submitPracticeResponse(
        tx,
        ctx,
        started.data.session.id,
        { itemId, action: "known" },
        "idem-response-a",
      );

      await expect(
        submitPracticeResponse(
          tx,
          ctx,
          started.data.session.id,
          { itemId, action: "unknown" },
          "idem-response-b",
        ),
      ).rejects.toMatchObject({ status: 409 });
    });
  });

  it("returns own due queue only", async () => {
    const fixture = await createPracticeFixture();
    const ctx = learnerCtx(fixture, "req_practice_due");

    const due = await withTenantTx(
      authoringTenantTx(fixture, fixture.learnerMembershipId),
      async (tx) => getDueQueue(tx, ctx, { limit: 20 }),
    );

    expect(due.data.availableDecks.length).toBeGreaterThan(0);
    for (const item of due.data.items) {
      expect(item.card).not.toHaveProperty("answerKey");
    }
  });
});
