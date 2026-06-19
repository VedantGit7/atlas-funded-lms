import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { withTenantTx } from "@atlas/db";
import {
  getMemberCompetency,
  listTenantCompetencySignals,
} from "../../apps/web/src/server/competency/competency-query.service";
import { handleCompetencyOutboxEvent } from "../../apps/web/src/server/competency/competency.worker";
import {
  authoringTenantTx,
  createCompetencyProjectionFixture,
  submitScoredMcqAttempt,
} from "../fixtures/competency-projection-fixture";
import { createTenantIsolationFixture, tenantCtx } from "./tenant-isolation-fixture";

const describeWithDb =
  process.env["DATABASE_URL"] && process.env["PLATFORM_DATABASE_URL"] ? describe : describe.skip;

describeWithDb("competency projection tenant isolation", () => {
  it("Tenant A cannot read Tenant B competency score rows via member query context", async () => {
    const fixture = await createCompetencyProjectionFixture();
    const tenantB = await createTenantIsolationFixture();

    await withTenantTx(tenantCtx(tenantB.tenantA), async (tx) => {
      await tx.$executeRaw`
        insert into competency_scores (
          id, tenant_id, membership_id, dimension_id, scoring_profile_id,
          score, band_key, calculated_at, config_version_id
        )
        values (
          ${randomUUID()}::uuid,
          ${tenantB.tenantA.tenantId}::uuid,
          ${tenantB.tenantA.membershipId}::uuid,
          ${randomUUID()}::uuid,
          ${randomUUID()}::uuid,
          88,
          'proficient',
          now(),
          ${randomUUID()}::uuid
        )
      `;
    });

    const scores = await withTenantTx(
      authoringTenantTx(fixture, fixture.adminMembershipId),
      async (tx) => getMemberCompetency(tx, tenantB.tenantA.membershipId),
    );

    expect(scores.data.scores).toHaveLength(0);
  });

  it("Tenant A cannot read Tenant B signals", async () => {
    const fixture = await createCompetencyProjectionFixture();
    const tenantB = await createTenantIsolationFixture();
    const signalId = randomUUID();

    await withTenantTx(tenantCtx(tenantB.tenantA), async (tx) => {
      const dimensionId = randomUUID();
      await tx.$executeRaw`
        insert into competency_dimensions (
          id, tenant_id, key, name, description, created_at, updated_at
        )
        values (
          ${dimensionId}::uuid,
          ${tenantB.tenantA.tenantId}::uuid,
          'tenant_b_dim',
          'Tenant B Dim',
          null,
          now(),
          now()
        )
      `;

      await tx.$executeRaw`
        insert into competency_signals (
          id, tenant_id, membership_id, dimension_id, signal_source_key,
          source_event_id, raw_score, weight, metadata_json, occurred_at, idempotency_key
        )
        values (
          ${signalId}::uuid,
          ${tenantB.tenantA.tenantId}::uuid,
          ${tenantB.tenantA.membershipId}::uuid,
          ${dimensionId}::uuid,
          'assessment',
          null,
          90,
          1,
          null,
          now(),
          ${`tenant-b-signal-${signalId}`}
        )
      `;
    });

    const result = await withTenantTx(
      authoringTenantTx(fixture, fixture.adminMembershipId),
      async (tx) => listTenantCompetencySignals(tx, { limit: 50 }),
    );

    expect(result.data.items.some((item) => item.id === signalId)).toBe(false);
  });

  it("worker event tenant context cannot project another tenant", async () => {
    const fixture = await createCompetencyProjectionFixture();
    const tenantB = await createTenantIsolationFixture();
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
      tenantId: tenantB.tenantA.tenantId,
      payload: event.payload_json,
      requestId: "req_cross_tenant",
    });

    const tenantASignals = await withTenantTx(
      authoringTenantTx(fixture),
      async (tx) =>
        tx.$queryRaw<Array<{ count: bigint }>>`
        select count(*)::bigint as count
        from competency_signals
        where membership_id = ${fixture.learnerMembershipId}::uuid
      `,
    );

    const tenantBSignals = await withTenantTx(
      tenantCtx(tenantB.tenantA),
      async (tx) =>
        tx.$queryRaw<
          Array<{ count: bigint }>
        >`select count(*)::bigint as count from competency_signals`,
    );

    expect(Number(tenantASignals[0]?.count ?? 0)).toBe(0);
    expect(Number(tenantBSignals[0]?.count ?? 0)).toBe(0);
  });
});
