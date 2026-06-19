import { describe, expect, it } from "vitest";
import { withTenantTx } from "@atlas/db";
import {
  getMemberCompetency,
  getMyCompetency,
  getMyCompetencyHistory,
  listTenantCompetencySignals,
} from "../../../apps/web/src/server/competency/competency-query.service";
import { handleCompetencyOutboxEvent } from "../../../apps/web/src/server/competency/competency.worker";
import {
  authoringTenantTx,
  createCompetencyProjectionFixture,
  learnerCtx,
  processLatestAssessmentSubmittedEvent,
  seedPracticeSessionWithSignal,
  submitScoredMcqAttempt,
} from "../../fixtures/competency-projection-fixture";

const describeWithDb =
  process.env["DATABASE_URL"] && process.env["PLATFORM_DATABASE_URL"] ? describe : describe.skip;

describeWithDb("competency projection integration", () => {
  it("worker consumes assessment.submitted and writes competency_signals", async () => {
    const fixture = await createCompetencyProjectionFixture();
    await submitScoredMcqAttempt(fixture);
    await processLatestAssessmentSubmittedEvent(fixture);

    const signals = await withTenantTx(
      authoringTenantTx(fixture),
      async (tx) =>
        tx.$queryRaw<Array<{ id: string }>>`
        select id::text from competency_signals where membership_id = ${fixture.learnerMembershipId}::uuid
      `,
    );

    expect(signals.length).toBeGreaterThan(0);
  });

  it("worker consumes practice.session_completed and writes competency_signals", async () => {
    const fixture = await createCompetencyProjectionFixture();
    await seedPracticeSessionWithSignal(fixture);

    const signals = await withTenantTx(
      authoringTenantTx(fixture),
      async (tx) =>
        tx.$queryRaw<Array<{ signal_source_key: string }>>`
        select signal_source_key
        from competency_signals
        where membership_id = ${fixture.learnerMembershipId}::uuid
          and signal_source_key = 'practice'
      `,
    );

    expect(signals).toHaveLength(1);
  });

  it("duplicate event does not duplicate signals", async () => {
    const fixture = await createCompetencyProjectionFixture();
    await submitScoredMcqAttempt(fixture);

    const event = await withTenantTx(authoringTenantTx(fixture), async (tx) => {
      const rows = await tx.$queryRaw<
        Array<{ id: string; payload_json: unknown; metadata_json: { requestId?: string } | null }>
      >`
        select id::text, payload_json, metadata_json
        from outbox_events
        where event_type = 'assessment.submitted'
        order by occurred_at desc
        limit 1
      `;
      return rows[0];
    });

    if (!event) throw new Error("Missing event");

    await handleCompetencyOutboxEvent({
      id: event.id,
      eventType: "assessment.submitted",
      tenantId: fixture.tenantId,
      payload: event.payload_json,
      requestId: event.metadata_json?.requestId ?? "req_dup",
    });

    await handleCompetencyOutboxEvent({
      id: event.id,
      eventType: "assessment.submitted",
      tenantId: fixture.tenantId,
      payload: event.payload_json,
      requestId: event.metadata_json?.requestId ?? "req_dup",
    });

    const signals = await withTenantTx(
      authoringTenantTx(fixture),
      async (tx) =>
        tx.$queryRaw<Array<{ count: bigint }>>`
        select count(*)::bigint as count
        from competency_signals
        where membership_id = ${fixture.learnerMembershipId}::uuid
      `,
    );

    expect(Number(signals[0]?.count ?? 0)).toBe(1);
  });

  it("projection upserts competency_scores and appends snapshots", async () => {
    const fixture = await createCompetencyProjectionFixture();
    await submitScoredMcqAttempt(fixture);
    await processLatestAssessmentSubmittedEvent(fixture);

    const scores = await withTenantTx(
      authoringTenantTx(fixture),
      async (tx) =>
        tx.$queryRaw<Array<{ score: unknown; band_key: string | null }>>`
        select score, band_key
        from competency_scores
        where membership_id = ${fixture.learnerMembershipId}::uuid
      `,
    );

    const snapshots = await withTenantTx(
      authoringTenantTx(fixture),
      async (tx) =>
        tx.$queryRaw<Array<{ id: string }>>`
        select id::text
        from competency_score_snapshots
        where membership_id = ${fixture.learnerMembershipId}::uuid
      `,
    );

    expect(scores.length).toBeGreaterThan(0);
    expect(Number(scores[0]?.score)).toBe(100);
    expect(scores[0]?.band_key).toBe("proficient");
    expect(snapshots.length).toBeGreaterThan(0);
  });

  it("score change emits competency.score_changed outbox event", async () => {
    const fixture = await createCompetencyProjectionFixture();
    await submitScoredMcqAttempt(fixture);
    await processLatestAssessmentSubmittedEvent(fixture);

    const events = await withTenantTx(
      authoringTenantTx(fixture),
      async (tx) =>
        tx.$queryRaw<Array<{ event_type: string }>>`
        select event_type
        from outbox_events
        where event_type in ('competency.score_changed', 'competency.signal_recorded')
      `,
    );

    expect(events.some((event) => event.event_type === "competency.score_changed")).toBe(true);
    expect(events.some((event) => event.event_type === "competency.signal_recorded")).toBe(true);
  });

  it("GET /me/competency returns own scores via service", async () => {
    const fixture = await createCompetencyProjectionFixture();
    await submitScoredMcqAttempt(fixture);
    await processLatestAssessmentSubmittedEvent(fixture);
    const ctx = learnerCtx(fixture, "req_me_competency");

    const result = await withTenantTx(
      authoringTenantTx(fixture, fixture.learnerMembershipId),
      async (tx) => getMyCompetency(tx, ctx),
    );

    expect(result.data.scores.length).toBeGreaterThan(0);
    expect(result.data.scores[0]?.dimensionKey).toBe("execution_skill");
  });

  it("GET /me/competency/history returns own snapshots", async () => {
    const fixture = await createCompetencyProjectionFixture();
    await submitScoredMcqAttempt(fixture);
    await processLatestAssessmentSubmittedEvent(fixture);
    const ctx = learnerCtx(fixture, "req_me_history");

    const result = await withTenantTx(
      authoringTenantTx(fixture, fixture.learnerMembershipId),
      async (tx) => getMyCompetencyHistory(tx, ctx, { limit: 10 }),
    );

    expect(result.data.items.length).toBeGreaterThan(0);
    expect(result.data.items[0]?.scores.length).toBeGreaterThan(0);
  });

  it("GET /members/:id/competency returns learner scores for admin", async () => {
    const fixture = await createCompetencyProjectionFixture();
    await submitScoredMcqAttempt(fixture);
    await processLatestAssessmentSubmittedEvent(fixture);

    const result = await withTenantTx(
      authoringTenantTx(fixture, fixture.adminMembershipId),
      async (tx) => getMemberCompetency(tx, fixture.learnerMembershipId),
    );

    expect(result.data.scores.length).toBeGreaterThan(0);
  });

  it("GET /competency-signals returns paginated raw signals", async () => {
    const fixture = await createCompetencyProjectionFixture();
    await submitScoredMcqAttempt(fixture);
    await processLatestAssessmentSubmittedEvent(fixture);

    const result = await withTenantTx(
      authoringTenantTx(fixture, fixture.adminMembershipId),
      async (tx) => listTenantCompetencySignals(tx, { limit: 10 }),
    );

    expect(result.data.items.length).toBeGreaterThan(0);
    expect(result.data.pageInfo.hasNextPage).toBe(false);
  });
});
