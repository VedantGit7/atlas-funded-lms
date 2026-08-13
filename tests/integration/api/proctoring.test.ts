import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { withTenantTx } from "@atlas/db";
import { AtlasHttpError } from "@atlas/core/http/errors";
import {
  startAttempt,
  submitAttempt,
} from "../../../backend/apps/api/src/server/attempts/attempts.service";
import {
  getTimelineForAttempt,
  ingestProctoringEvents,
  submitIdentityVerification,
} from "../../../backend/apps/api/src/server/proctoring/proctoring.service";
import {
  createAssessmentFixture,
  instructorCtx,
  learnerCtx,
  publishAssessmentFixture,
  authoringTenantTx,
} from "../../fixtures/assessment-fixture";

const describeWithDb =
  process.env["DATABASE_URL"] && process.env["PLATFORM_DATABASE_URL"] ? describe : describe.skip;

async function enableL1Proctoring(fixture: Awaited<ReturnType<typeof createAssessmentFixture>>) {
  await withTenantTx(authoringTenantTx(fixture), async (tx) => {
    await tx.$executeRaw`
      update assessments
      set config_json = jsonb_set(
        jsonb_set(config_json, '{l1ProctoringEnabled}', 'true'::jsonb, true),
        '{proctoringLevel}',
        '1'::jsonb,
        true
      )
      where id = ${fixture.assessmentId}::uuid
    `;
  });
}

async function setProctoringLevel(
  fixture: Awaited<ReturnType<typeof createAssessmentFixture>>,
  level: 1 | 2 | 3,
) {
  await withTenantTx(authoringTenantTx(fixture), async (tx) => {
    await tx.$executeRaw`
      update assessments
      set config_json = jsonb_set(
        jsonb_set(config_json, '{proctoringLevel}', ${JSON.stringify(level)}::jsonb, true),
        '{l1ProctoringEnabled}',
        ${level >= 1 ? "true" : "false"}::jsonb,
        true
      )
      where id = ${fixture.assessmentId}::uuid
    `;
  });
}

describeWithDb("proctoring L1 integration", () => {
  it("starts L1 attempt and creates proctoring session", async () => {
    const fixture = await publishAssessmentFixture(await createAssessmentFixture());
    await enableL1Proctoring(fixture);
    const learner = learnerCtx(fixture, "req_proctor_start");

    const started = await withTenantTx(
      authoringTenantTx(fixture, fixture.learnerMembershipId),
      async (tx) =>
        startAttempt(tx, learner, fixture.assessmentId, `idem-proc-start-${randomUUID()}`, {
          consentedAt: new Date().toISOString(),
          level: 1,
        }),
    );

    const sessions = await withTenantTx(
      authoringTenantTx(fixture),
      async (tx) =>
        tx.$queryRaw<Array<{ id: string; status: string }>>`
        select id::text, status
        from proctoring_sessions
        where attempt_id = ${started.data.id}::uuid
      `,
    );

    expect(sessions).toHaveLength(1);
    expect(sessions[0]?.status).toBe("active");
  });

  it("ingests events into timeline and dedupes clientEventId", async () => {
    const fixture = await publishAssessmentFixture(await createAssessmentFixture());
    await enableL1Proctoring(fixture);
    const learner = learnerCtx(fixture, "req_proctor_ingest");

    const started = await withTenantTx(
      authoringTenantTx(fixture, fixture.learnerMembershipId),
      async (tx) =>
        startAttempt(tx, learner, fixture.assessmentId, `idem-proc-ingest-${randomUUID()}`),
    );

    const clientEventId = randomUUID();
    const occurredAt = new Date().toISOString();

    const first = await withTenantTx(
      authoringTenantTx(fixture, fixture.learnerMembershipId),
      async (tx) =>
        ingestProctoringEvents(
          tx,
          learner,
          started.data.id,
          {
            events: [
              {
                eventType: "tab_hidden",
                occurredAt,
                clientEventId,
              },
              {
                eventType: "copy",
                occurredAt,
                clientEventId: randomUUID(),
              },
            ],
          },
          randomUUID(),
        ),
    );

    expect(first.data.accepted).toBe(2);
    expect(first.data.duplicates).toBe(0);

    const second = await withTenantTx(
      authoringTenantTx(fixture, fixture.learnerMembershipId),
      async (tx) =>
        ingestProctoringEvents(
          tx,
          learner,
          started.data.id,
          {
            events: [
              {
                eventType: "tab_hidden",
                occurredAt,
                clientEventId,
              },
            ],
          },
          randomUUID(),
        ),
    );

    expect(second.data.accepted).toBe(0);
    expect(second.data.duplicates).toBe(1);

    const timeline = await withTenantTx(
      authoringTenantTx(fixture, fixture.learnerMembershipId),
      async (tx) => getTimelineForAttempt(tx, learner, started.data.id),
    );

    expect(timeline.timeline).toHaveLength(2);
    expect(timeline.timeline.map((event) => event.eventType).sort()).toEqual([
      "copy",
      "tab_hidden",
    ]);
  });

  it("finalizes advisory report on submit with risk_score", async () => {
    const fixture = await publishAssessmentFixture(await createAssessmentFixture());
    await enableL1Proctoring(fixture);
    const learner = learnerCtx(fixture, "req_proctor_finalize");

    const started = await withTenantTx(
      authoringTenantTx(fixture, fixture.learnerMembershipId),
      async (tx) =>
        startAttempt(tx, learner, fixture.assessmentId, `idem-proc-final-${randomUUID()}`),
    );

    await withTenantTx(authoringTenantTx(fixture, fixture.learnerMembershipId), async (tx) => {
      await ingestProctoringEvents(
        tx,
        learner,
        started.data.id,
        {
          events: [
            {
              eventType: "devtools_heuristic",
              occurredAt: new Date().toISOString(),
              clientEventId: randomUUID(),
            },
            {
              eventType: "fullscreen_exit",
              occurredAt: new Date().toISOString(),
              clientEventId: randomUUID(),
            },
          ],
        },
        randomUUID(),
      );

      await submitAttempt(tx, learner, started.data.id, `idem-proc-submit-${randomUUID()}`);
    });

    const report = await withTenantTx(
      authoringTenantTx(fixture),
      async (tx) =>
        tx.$queryRaw<Array<{ risk_score: unknown; report_json: unknown }>>`
        select r.risk_score, r.report_json
        from proctoring_reports r
        join proctoring_sessions s on s.id = r.proctoring_session_id
        where s.attempt_id = ${started.data.id}::uuid
        limit 1
      `,
    );

    expect(report).toHaveLength(1);
    expect(Number(report[0]?.risk_score)).toBe(5);

    const reportJson = report[0]?.report_json as Record<string, unknown>;
    expect(reportJson["advisory"]).toBe(true);
    expect(reportJson["riskScore"]).toBe(5);

    const timeline = await withTenantTx(
      authoringTenantTx(fixture, fixture.learnerMembershipId),
      async (tx) => getTimelineForAttempt(tx, learner, started.data.id),
    );
    expect(timeline.report?.riskScore).toBe(5);
    expect(timeline.report?.summary).toContain("Advisory risk score");
  });

  it("rejects non-owner ingest", async () => {
    const fixture = await publishAssessmentFixture(await createAssessmentFixture());
    await enableL1Proctoring(fixture);
    const learner = learnerCtx(fixture, "req_proctor_owner");
    const instructor = instructorCtx(fixture, "req_proctor_non_owner");

    const started = await withTenantTx(
      authoringTenantTx(fixture, fixture.learnerMembershipId),
      async (tx) =>
        startAttempt(tx, learner, fixture.assessmentId, `idem-proc-owner-${randomUUID()}`),
    );

    try {
      await withTenantTx(authoringTenantTx(fixture, fixture.instructorMembershipId), async (tx) =>
        ingestProctoringEvents(
          tx,
          instructor,
          started.data.id,
          {
            events: [
              {
                eventType: "tab_hidden",
                occurredAt: new Date().toISOString(),
                clientEventId: randomUUID(),
              },
            ],
          },
          randomUUID(),
        ),
      );
      expect.fail("expected non-owner ingest to fail");
    } catch (error) {
      expect(error).toBeInstanceOf(AtlasHttpError);
      expect((error as AtlasHttpError).status).toBe(404);
      expect((error as AtlasHttpError).code).toBe("PERMISSION_DENIED");
    }
  });
});

describeWithDb("proctoring L2/L3 integration", () => {
  it("ingests L2 face/mic events when level=2", async () => {
    const fixture = await publishAssessmentFixture(await createAssessmentFixture());
    await setProctoringLevel(fixture, 2);
    const learner = learnerCtx(fixture, "req_proctor_l2");

    const started = await withTenantTx(
      authoringTenantTx(fixture, fixture.learnerMembershipId),
      async (tx) =>
        startAttempt(tx, learner, fixture.assessmentId, `idem-proc-l2-${randomUUID()}`, {
          consentedAt: new Date().toISOString(),
          level: 2,
        }),
    );

    const session = await withTenantTx(
      authoringTenantTx(fixture),
      async (tx) =>
        tx.$queryRaw<Array<{ level: number }>>`
        select level
        from proctoring_sessions
        where attempt_id = ${started.data.id}::uuid
      `,
    );
    expect(session[0]?.level).toBe(2);

    const result = await withTenantTx(
      authoringTenantTx(fixture, fixture.learnerMembershipId),
      async (tx) =>
        ingestProctoringEvents(
          tx,
          learner,
          started.data.id,
          {
            events: [
              {
                eventType: "face_absent",
                occurredAt: new Date().toISOString(),
                clientEventId: randomUUID(),
              },
              {
                eventType: "microphone_activity",
                occurredAt: new Date().toISOString(),
                clientEventId: randomUUID(),
              },
            ],
          },
          randomUUID(),
        ),
    );

    expect(result.data.accepted).toBe(2);

    const timeline = await withTenantTx(
      authoringTenantTx(fixture, fixture.learnerMembershipId),
      async (tx) => getTimelineForAttempt(tx, learner, started.data.id),
    );
    expect(timeline.timeline.map((event) => event.eventType).sort()).toEqual([
      "face_absent",
      "microphone_activity",
    ]);
  });

  it("rejects L2 events when session level=1", async () => {
    const fixture = await publishAssessmentFixture(await createAssessmentFixture());
    await setProctoringLevel(fixture, 1);
    const learner = learnerCtx(fixture, "req_proctor_gate");

    const started = await withTenantTx(
      authoringTenantTx(fixture, fixture.learnerMembershipId),
      async (tx) =>
        startAttempt(tx, learner, fixture.assessmentId, `idem-proc-gate-${randomUUID()}`, {
          consentedAt: new Date().toISOString(),
          level: 1,
        }),
    );

    try {
      await withTenantTx(authoringTenantTx(fixture, fixture.learnerMembershipId), async (tx) =>
        ingestProctoringEvents(
          tx,
          learner,
          started.data.id,
          {
            events: [
              {
                eventType: "face_absent",
                occurredAt: new Date().toISOString(),
                clientEventId: randomUUID(),
              },
            ],
          },
          randomUUID(),
        ),
      );
      expect.fail("expected L2 event to be rejected on L1 session");
    } catch (error) {
      expect(error).toBeInstanceOf(AtlasHttpError);
      expect((error as AtlasHttpError).status).toBe(400);
      expect((error as AtlasHttpError).code).toBe("VALIDATION_ERROR");
    }
  });

  it("creates identity verification and timeline event at level=3", async () => {
    const fixture = await publishAssessmentFixture(await createAssessmentFixture());
    await setProctoringLevel(fixture, 3);
    const learner = learnerCtx(fixture, "req_proctor_id");

    const started = await withTenantTx(
      authoringTenantTx(fixture, fixture.learnerMembershipId),
      async (tx) =>
        startAttempt(tx, learner, fixture.assessmentId, `idem-proc-id-${randomUUID()}`, {
          consentedAt: new Date().toISOString(),
          level: 3,
        }),
    );

    const identity = await withTenantTx(
      authoringTenantTx(fixture, fixture.learnerMembershipId),
      async (tx) =>
        submitIdentityVerification(tx, learner, started.data.id, {
          status: "passed",
          method: "fixture",
          score: 0.95,
          metadata: { source: "integration" },
        }),
    );

    expect(identity.data.status).toBe("passed");
    expect(identity.data.method).toBe("fixture");

    const rows = await withTenantTx(
      authoringTenantTx(fixture),
      async (tx) =>
        tx.$queryRaw<Array<{ status: string; method: string }>>`
        select v.status, v.method
        from identity_verifications v
        join proctoring_sessions s on s.id = v.proctoring_session_id
        where s.attempt_id = ${started.data.id}::uuid
      `,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]?.status).toBe("passed");

    const timeline = await withTenantTx(
      authoringTenantTx(fixture, fixture.learnerMembershipId),
      async (tx) => getTimelineForAttempt(tx, learner, started.data.id),
    );
    expect(
      timeline.timeline.some((event) => event.eventType === "identity_verification_passed"),
    ).toBe(true);
  });
});
