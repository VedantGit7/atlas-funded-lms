import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { withTenantTx, type TenantTx } from "@atlas/db";
import {
  getAttempt,
  saveAttemptAnswer,
  startAttempt,
  submitAttempt,
} from "../../../backend/apps/api/src/server/attempts/attempts.service";
import {
  getAuthenticatedDiagnosticResult,
  startAuthenticatedDiagnostic,
} from "../../../backend/apps/api/src/server/diagnostics/diagnostic-authenticated.service";
import {
  completePublicDiagnosticSession,
  startPublicDiagnosticSession,
} from "../../../backend/apps/api/src/server/diagnostics/diagnostic-public-session.service";
import { mergeAnonymousDiagnosticSession } from "../../../backend/apps/api/src/server/diagnostics/diagnostic-merge.service";
import {
  authoringTenantTx,
  createAssessmentFixture,
  learnerCtx,
  publishAssessmentFixture,
  type AssessmentFixture,
} from "../../fixtures/assessment-fixture";

/**
 * Audit M9 against Postgres: a shuffled exam is shuffled once, at start, and
 * every later fetch (reloads, after saving, review after submission) shows the
 * same item and option order. The authenticated diagnostic, which runs on an
 * attempt, shows that same order, and a merged anonymous diagnostic keeps the
 * order the anonymous session presented.
 */
const suite =
  process.env["DATABASE_URL"] && process.env["PLATFORM_DATABASE_URL"] ? describe : describe.skip;

type Layout = Array<{ assessmentItemId: string; options: string[] }>;
const layout = (items: Array<{ assessmentItemId: string; options: Array<{ id: string }> }>) =>
  items.map((item) => ({
    assessmentItemId: item.assessmentItemId,
    options: item.options.map((option) => option.id),
  }));

/**
 * Six more four-option questions, with both shuffles on, so an order that
 * changed between fetches could not plausibly come out the same by chance.
 */
async function addShuffledQuestions(fixture: AssessmentFixture, settings: Record<string, unknown>) {
  await withTenantTx(authoringTenantTx(fixture), async (tx) => {
    for (let index = 0; index < 6; index += 1) {
      const itemId = randomUUID();
      await tx.$executeRaw`
        insert into items (id, tenant_id, item_type_key, stem_json, explanation_json, status, tags,
                           created_by_membership_id, created_at, updated_at)
        values (${itemId}::uuid, ${fixture.tenantId}::uuid, 'mcq_single',
                ${JSON.stringify({ stem: `Question ${String(index)}` })}::jsonb, '{}'::jsonb,
                'PUBLISHED', '{}'::text[], ${fixture.instructorMembershipId}::uuid, now(), now())
      `;
      for (let option = 1; option <= 4; option += 1) {
        await tx.$executeRaw`
          insert into item_options (id, tenant_id, item_id, option_json, is_correct, position, created_at, updated_at)
          values (${randomUUID()}::uuid, ${fixture.tenantId}::uuid, ${itemId}::uuid,
                  ${JSON.stringify({ label: `Option ${String(option)}` })}::jsonb, ${option === 1},
                  ${option}, now(), now())
        `;
      }
      await tx.$executeRaw`
        insert into assessment_items (id, tenant_id, assessment_id, item_id, position, points, config_json, created_at)
        values (${randomUUID()}::uuid, ${fixture.tenantId}::uuid, ${fixture.assessmentId}::uuid,
                ${itemId}::uuid, ${index + 3}, 1, '{"required":false}'::jsonb, now())
      `;
    }
    await tx.$executeRaw`
      update assessments
         set config_json = config_json || ${JSON.stringify({
           shuffleItems: true,
           shuffleOptions: true,
           attemptsAllowed: 5,
           ...settings,
         })}::jsonb
       where id = ${fixture.assessmentId}::uuid
    `;
  });
  await publishAssessmentFixture(fixture);
}

suite("attempt presentation order (audit M9)", () => {
  let fixture: AssessmentFixture;
  const asLearner = <T>(fn: (tx: TenantTx) => Promise<T>) =>
    withTenantTx(authoringTenantTx(fixture, fixture.learnerMembershipId), fn);
  const fetch = (attemptId: string) =>
    asLearner(async (tx) => (await getAttempt(tx, learnerCtx(fixture), attemptId)).data);
  const start = () =>
    asLearner(
      async (tx) =>
        (await startAttempt(tx, learnerCtx(fixture), fixture.assessmentId, randomUUID())).data.id,
    );

  beforeAll(async () => {
    fixture = await createAssessmentFixture();
    await addShuffledQuestions(fixture, {});
  });

  it("shows the order drawn at start on every fetch, after saving, and in review", async () => {
    const attemptId = await start();
    const runner = await fetch(attemptId);
    const first = layout(runner.items);
    expect(first).toHaveLength(8);

    // The stored order is what the runner shows.
    const [stored] = await asLearner(
      (tx) =>
        tx.$queryRaw<Array<{ presentation: { itemOrder: string[] } }>>`
        select metadata_json->'presentation' as presentation from attempts where id = ${attemptId}::uuid
      `,
    );
    expect(stored?.presentation.itemOrder).toEqual(first.map((item) => item.assessmentItemId));

    expect(layout((await fetch(attemptId)).items)).toEqual(first);
    expect(layout((await fetch(attemptId)).items)).toEqual(first);

    const firstItem = runner.items[0];
    if (!firstItem) throw new Error("no items");
    await asLearner((tx) =>
      saveAttemptAnswer(
        tx,
        learnerCtx(fixture),
        attemptId,
        {
          itemId: firstItem.itemId,
          answerJson: { selectedOptionId: firstItem.options[0]?.id },
        },
        randomUUID(),
      ),
    );
    expect(layout((await fetch(attemptId)).items)).toEqual(first);

    await asLearner((tx) => submitAttempt(tx, learnerCtx(fixture), attemptId, randomUUID()));
    const review = await fetch(attemptId);
    expect(review.status).not.toBe("STARTED");
    expect(layout(review.items)).toEqual(first);
  });

  it("draws a different order for a different attempt", async () => {
    const one = layout((await fetch(await start())).items);
    const two = layout((await fetch(await start())).items);
    expect(two).not.toEqual(one);
  });

  it("keeps an attempt started before orders were stored in one order", async () => {
    const attemptId = await start();
    await asLearner(
      (tx) => tx.$executeRaw`
        update attempts set metadata_json = metadata_json - 'presentation' where id = ${attemptId}::uuid
      `,
    );
    const first = layout((await fetch(attemptId)).items);
    expect(layout((await fetch(attemptId)).items)).toEqual(first);
    expect(layout((await fetch(attemptId)).items)).toEqual(first);
  });
});

suite("diagnostic presentation order (audit M9)", () => {
  let fixture: AssessmentFixture;
  const asLearner = <T>(fn: (tx: TenantTx) => Promise<T>) =>
    withTenantTx(authoringTenantTx(fixture, fixture.learnerMembershipId), fn);

  beforeAll(async () => {
    fixture = await createAssessmentFixture();
    await addShuffledQuestions(fixture, {});
    await withTenantTx(
      authoringTenantTx(fixture),
      (tx) => tx.$executeRaw`
        update assessments set assessment_type = 'diagnostic' where id = ${fixture.assessmentId}::uuid
      `,
    );
  });

  it("shows the authenticated diagnostic in its attempt's order, on start and on every reload", async () => {
    const started = await asLearner((tx) =>
      startAuthenticatedDiagnostic({ tx, ctx: learnerCtx(fixture), idempotencyKey: randomUUID() }),
    );
    const first: Layout = layout(started.data.items);

    const reload = () =>
      asLearner((tx) =>
        getAuthenticatedDiagnosticResult({
          tx,
          ctx: learnerCtx(fixture),
          sessionId: started.data.sessionId,
        }),
      );
    for (let index = 0; index < 2; index += 1) {
      const result = await reload();
      expect(layout(result.data.runner?.items ?? [])).toEqual(first);
    }

    const runner = await asLearner((tx) =>
      getAttempt(tx, learnerCtx(fixture), started.data.attemptId),
    );
    expect(layout(runner.data.items)).toEqual(first);
  });

  it("keeps the order an anonymous session presented when it is merged into an attempt", async () => {
    const anonymous = await withTenantTx(
      { tenantId: fixture.tenantId, requestId: randomUUID(), allowAnonymousTenantRead: true },
      (tx) =>
        startPublicDiagnosticSession({
          tx,
          ctx: { tenantId: fixture.tenantId, requestId: randomUUID() },
          req: new Request("https://tenant.example.test/api/v1/public/diagnostic/start"),
        }),
    );
    const presented = layout(anonymous.response.data.items);

    const anonymousId = anonymous.session.anonymous_id;
    if (!anonymousId) throw new Error("anonymous id missing");
    const mcq = anonymous.response.data.items.find((item) => item.itemId === fixture.mcqItemId);
    await withTenantTx(
      { tenantId: fixture.tenantId, requestId: randomUUID(), allowAnonymousTenantRead: true },
      (tx) =>
        completePublicDiagnosticSession({
          tx,
          ctx: { tenantId: fixture.tenantId, requestId: randomUUID() },
          input: {
            operation: "complete",
            anonymousId,
            answers: [
              { itemId: fixture.mcqItemId, answerJson: { selectedOptionId: mcq?.options[0]?.id } },
            ],
          },
          secret: anonymous.proof.secret,
        }),
    );
    const merged = await withTenantTx(
      { tenantId: fixture.tenantId, requestId: randomUUID(), allowAnonymousTenantRead: true },
      (tx) =>
        mergeAnonymousDiagnosticSession({
          tx,
          ctx: {
            tenantId: fixture.tenantId,
            actorMembershipId: fixture.learnerMembershipId,
            requestId: randomUUID(),
          },
          anonymousId,
          secret: anonymous.proof.secret,
          idempotencyKey: randomUUID(),
        }),
    );

    const [stored] = await asLearner(
      (tx) =>
        tx.$queryRaw<Array<{ presentation: { itemOrder: string[] } }>>`
        select metadata_json->'presentation' as presentation from attempts
         where id = ${merged.data.attemptId}::uuid
      `,
    );
    expect(stored?.presentation.itemOrder).toEqual(presented.map((item) => item.assessmentItemId));
  });
});
