import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { withTenantTx } from "@atlas/db";
import { createCompetencyProjectionFixture } from "../../fixtures/competency-projection-fixture";
import { authoringTenantTx } from "../../fixtures/assessment-fixture";
import {
  completePublicDiagnosticSession,
  startPublicDiagnosticSession,
} from "../../../backend/apps/api/src/server/diagnostics/diagnostic-public-session.service";
import { mergeAnonymousDiagnosticSession } from "../../../backend/apps/api/src/server/diagnostics/diagnostic-merge.service";
import { handleCompetencyOutboxEvent } from "../../../backend/apps/api/src/server/competency/competency.worker";

const describeWithDb =
  process.env["DATABASE_URL"] && process.env["PLATFORM_DATABASE_URL"] ? describe : describe.skip;

function requireAnonymousId(anonymousId: string | null): string {
  if (!anonymousId) throw new Error("Missing anonymous id");
  return anonymousId;
}

describeWithDb("diagnostic integration", () => {
  it("public start stores hashed ip/ua and complete returns partial result metadata", async () => {
    const fixture = await createCompetencyProjectionFixture();

    await withTenantTx(authoringTenantTx(fixture), async (tx) => {
      await tx.$executeRaw`
        update assessments
        set assessment_type = 'diagnostic', status = 'PUBLISHED'
        where id = ${fixture.assessmentId}::uuid
      `;
    });

    const req = new Request("https://tenant-a.example.com/api/v1/public/diagnostic/start", {
      headers: {
        "x-forwarded-for": "203.0.113.44",
        "user-agent": "DiagnosticIntegration/1.0",
      },
    });

    const started = await withTenantTx(
      { tenantId: fixture.tenantId, requestId: "req_diag_start", allowAnonymousTenantRead: true },
      async (tx) =>
        startPublicDiagnosticSession({
          tx,
          ctx: { tenantId: fixture.tenantId, requestId: "req_diag_start" },
          req,
        }),
    );

    const sessionRow = await withTenantTx(
      { tenantId: fixture.tenantId, requestId: "req_diag_read", allowAnonymousTenantRead: true },
      async (tx) =>
        tx.$queryRaw<
          Array<{ ip_hash: string | null; user_agent_hash: string | null; metadata_json: unknown }>
        >`
          select ip_hash, user_agent_hash, metadata_json
          from diagnostic_sessions
          where id = ${started.session.id}::uuid
        `,
    );

    expect(sessionRow[0]?.ip_hash).toBeTruthy();
    expect(sessionRow[0]?.user_agent_hash).toBeTruthy();
    expect(sessionRow[0]?.ip_hash).not.toContain("203.0.113.44");
    expect(JSON.stringify(sessionRow[0]?.metadata_json)).not.toMatch(/correctOptionId|is_correct/);

    const options = await withTenantTx(
      authoringTenantTx(fixture),
      async (tx) =>
        tx.$queryRaw<Array<{ id: string }>>`
        select id::text from item_options where item_id = ${fixture.mcqItemId}::uuid limit 1
      `,
    );

    const completed = await withTenantTx(
      {
        tenantId: fixture.tenantId,
        requestId: "req_diag_complete",
        allowAnonymousTenantRead: true,
      },
      async (tx) =>
        completePublicDiagnosticSession({
          tx,
          ctx: { tenantId: fixture.tenantId, requestId: "req_diag_complete" },
          input: {
            operation: "complete",
            anonymousId: requireAnonymousId(started.session.anonymous_id),
            answers: [
              {
                itemId: fixture.mcqItemId,
                answerJson: { selectedOptionId: options[0]?.id },
              },
            ],
          },
          secret: started.proof.secret,
        }),
    );

    expect(completed.data.status).toBe("completed");
  });

  it("merge materializes attempt, emits assessment.submitted, and writes audit", async () => {
    const fixture = await createCompetencyProjectionFixture();

    await withTenantTx(authoringTenantTx(fixture), async (tx) => {
      await tx.$executeRaw`
        update assessments
        set assessment_type = 'diagnostic', status = 'PUBLISHED'
        where id = ${fixture.assessmentId}::uuid
      `;
    });

    const req = new Request("https://tenant-a.example.com/api/v1/public/diagnostic/start", {
      headers: { "x-forwarded-for": "203.0.113.45", "user-agent": "DiagnosticIntegration/1.0" },
    });

    const started = await withTenantTx(
      {
        tenantId: fixture.tenantId,
        requestId: "req_diag_merge_start",
        allowAnonymousTenantRead: true,
      },
      async (tx) =>
        startPublicDiagnosticSession({
          tx,
          ctx: { tenantId: fixture.tenantId, requestId: "req_diag_merge_start" },
          req,
        }),
    );

    const options = await withTenantTx(
      authoringTenantTx(fixture),
      async (tx) =>
        tx.$queryRaw<Array<{ id: string; is_correct: boolean | null }>>`
        select id::text, is_correct from item_options where item_id = ${fixture.mcqItemId}::uuid
      `,
    );
    const correctOption = options.find((option) => option.is_correct)?.id;

    await withTenantTx(
      {
        tenantId: fixture.tenantId,
        requestId: "req_diag_merge_complete",
        allowAnonymousTenantRead: true,
      },
      async (tx) =>
        completePublicDiagnosticSession({
          tx,
          ctx: { tenantId: fixture.tenantId, requestId: "req_diag_merge_complete" },
          input: {
            operation: "complete",
            anonymousId: requireAnonymousId(started.session.anonymous_id),
            answers: [
              { itemId: fixture.mcqItemId, answerJson: { selectedOptionId: correctOption } },
            ],
          },
          secret: started.proof.secret,
        }),
    );

    const mergeResult = await withTenantTx(
      { tenantId: fixture.tenantId, requestId: "req_diag_merge", allowAnonymousTenantRead: true },
      async (tx) =>
        mergeAnonymousDiagnosticSession({
          tx,
          ctx: {
            tenantId: fixture.tenantId,
            actorMembershipId: fixture.learnerMembershipId,
            requestId: "req_diag_merge",
          },
          anonymousId: requireAnonymousId(started.session.anonymous_id),
          secret: started.proof.secret,
          idempotencyKey: `merge-${randomUUID().slice(0, 8)}`,
        }),
    );

    expect(mergeResult.data.attemptId).toBeTruthy();

    const duplicate = await withTenantTx(
      {
        tenantId: fixture.tenantId,
        requestId: "req_diag_merge_dup",
        allowAnonymousTenantRead: true,
      },
      async (tx) =>
        mergeAnonymousDiagnosticSession({
          tx,
          ctx: {
            tenantId: fixture.tenantId,
            actorMembershipId: fixture.learnerMembershipId,
            requestId: "req_diag_merge_dup",
          },
          anonymousId: requireAnonymousId(started.session.anonymous_id),
          secret: started.proof.secret,
          idempotencyKey: `merge-dup-${randomUUID().slice(0, 8)}`,
        }),
    );

    expect(duplicate.data.alreadyMerged).toBe(true);
    expect(duplicate.data.attemptId).toBe(mergeResult.data.attemptId);

    const outbox = await withTenantTx(
      authoringTenantTx(fixture),
      async (tx) =>
        tx.$queryRaw<Array<{ event_type: string }>>`
        select event_type
        from outbox_events
        where aggregate_id = ${mergeResult.data.attemptId}
          and event_type = 'assessment.submitted'
      `,
    );
    expect(outbox).toHaveLength(1);

    const audit = await withTenantTx(
      authoringTenantTx(fixture),
      async (tx) =>
        tx.$queryRaw<Array<{ action: string }>>`
        select action
        from audit_entries
        where target_id = ${started.session.id}
          and action = 'diagnostic.anonymous_merged'
      `,
    );
    expect(audit).toHaveLength(1);

    const event = await withTenantTx(authoringTenantTx(fixture), async (tx) => {
      const rows = await tx.$queryRaw<
        Array<{ id: string; payload_json: unknown; metadata_json: { requestId?: string } | null }>
      >`
        select id::text, payload_json, metadata_json
        from outbox_events
        where aggregate_id = ${mergeResult.data.attemptId}
          and event_type = 'assessment.submitted'
        limit 1
      `;
      return rows[0] ?? null;
    });

    if (event) {
      await handleCompetencyOutboxEvent({
        id: event.id,
        eventType: "assessment.submitted",
        tenantId: fixture.tenantId,
        payload: event.payload_json,
        requestId: event.metadata_json?.requestId ?? "req_diag_projection",
      });
    }
  });
});
