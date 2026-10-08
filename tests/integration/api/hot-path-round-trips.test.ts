import { randomUUID } from "node:crypto";
import pg from "pg";
import type * as AtlasAuth from "@atlas/auth";
import { NextRequest } from "next/server";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { withTenantTx, type TenantTx } from "@atlas/db";
import { requireActiveMembership } from "@atlas/membership";
import {
  createCourseEnrollmentFixture,
  type CourseEnrollmentFixture,
} from "../../fixtures/course-enrollment-fixture";
import {
  authoringTenantTx,
  createAssessmentFixture,
  learnerCtx,
  publishAssessmentFixture,
  type AssessmentFixture,
} from "../../fixtures/assessment-fixture";

/**
 * Audit §3.1–3.2: database round trips on the authenticated hot path and the
 * exam runner. Against a remote database every statement costs one network
 * round trip while a pooled connection is held, so the counts here are the
 * latency and capacity budget, asserted here. Supabase Auth is stubbed: it is
 * not a database round trip, and its cost is covered by the session cache
 * tests. HOT_PATH_SAMPLES=100 also reports local latency.
 */
const supabaseUser = vi.hoisted(() => ({ current: null as null | Record<string, unknown> }));
vi.mock("@atlas/auth", async (importOriginal) => ({
  ...(await importOriginal<typeof AtlasAuth>()),
  requireSupabaseUser: vi.fn(async () => {
    if (!supabaseUser.current) throw new Error("no stub user");
    return supabaseUser.current;
  }),
}));

const { GET: getCourse } =
  await import("../../../backend/apps/api/src/app/api/v1/courses/[id]/route");
const { getAttempt, startAttempt } =
  await import("../../../backend/apps/api/src/server/attempts/attempts.service");

const suite =
  process.env["DATABASE_URL"] && process.env["PLATFORM_DATABASE_URL"] ? describe : describe.skip;

/** Every statement the pg driver sends, including BEGIN and COMMIT. */
const statements: string[] = [];
let recording = false;
const originalQuery = pg.Client.prototype.query;
function recordQueries() {
  pg.Client.prototype.query = function (this: pg.Client, ...args: unknown[]) {
    if (recording) {
      const first = args[0];
      const text =
        typeof first === "string"
          ? first
          : typeof first === "object" && first !== null && "text" in first
            ? String((first as { text: unknown }).text)
            : "?";
      statements.push(text.replace(/\s+/g, " ").trim().slice(0, 90));
    }
    return (originalQuery as (...a: unknown[]) => unknown).apply(this, args);
  } as typeof pg.Client.prototype.query;
}

/** Straight to stdout: the app logger replaces console output with structured records. */
function report(line: string): void {
  process.stdout.write(`${line}
`);
}

async function countStatements<T>(work: () => Promise<T>): Promise<{ result: T; sql: string[] }> {
  statements.length = 0;
  recording = true;
  try {
    const result = await work();
    return { result, sql: [...statements] };
  } finally {
    recording = false;
  }
}

suite("hot-path database round trips (audit §3.1–3.2)", () => {
  let course: CourseEnrollmentFixture;
  let host: string;

  beforeAll(async () => {
    recordQueries();
    course = await createCourseEnrollmentFixture();
    host = `${course.slug}.hot-path.test`;
    await withTenantTx(
      { tenantId: course.tenantId, requestId: randomUUID(), allowAnonymousTenantRead: true },
      (tx) => tx.$executeRaw`
        insert into tenant_domains (id, tenant_id, hostname, type, status, updated_at)
        values (${randomUUID()}::uuid, ${course.tenantId}::uuid, ${host},
                'ATLAS_SUBDOMAIN', 'ACTIVE', now())
      `,
    );
    const [principal] = await withTenantTx(
      { tenantId: course.tenantId, requestId: randomUUID(), allowAnonymousTenantRead: true },
      (tx) => tx.$queryRaw<Array<{ supabase_user_id: string; email: string }>>`
        select supabase_user_id::text, email from auth_principals where id = ${course.principalId}::uuid
      `,
    );
    if (!principal) throw new Error("fixture principal missing");
    supabaseUser.current = {
      supabaseUserId: principal.supabase_user_id,
      email: principal.email,
      emailConfirmed: true,
      mfaEnabled: false,
      sessionAssuranceLevel: "aal1",
    };
  });

  afterAll(async () => {
    pg.Client.prototype.query = originalQuery;
    await withTenantTx(
      { tenantId: course.tenantId, requestId: randomUUID(), allowAnonymousTenantRead: true },
      (tx) => tx.$executeRaw`delete from tenant_domains where hostname = ${host}`,
    );
  });

  const courseRequest = () =>
    getCourse(
      new NextRequest(`https://${host}/api/v1/courses/${course.publishedCourseId}`, {
        headers: { host, "x-forwarded-for": "198.51.100.9" },
      }),
      { params: Promise.resolve({ id: course.publishedCourseId }) },
    );

  it("an authenticated learner read stays within its round-trip budget", async () => {
    // Warm once: the first request of the day writes the activity rows.
    expect((await courseRequest()).status).toBe(200);
    const { result, sql } = await countStatements(courseRequest);
    expect(result.status).toBe(200);
    report(
      `[hot-path] learner course read: ${String(sql.length)} statements\n  ${sql.join("\n  ")}`,
    );
    // 18 before the audit §3.1 work: global transaction 5 (BEGIN, role, host,
    // principal, COMMIT); tenant transaction 7 (BEGIN, role and context,
    // membership gate, the course loader's 2, can(), COMMIT).
    expect(sql.length, sql.join("\n")).toBeLessThanOrEqual(12);

    // Latency only on request: timings on a shared CI runner are noise.
    const samples = Number(process.env["HOT_PATH_SAMPLES"] ?? 0);
    if (samples > 0) {
      const timings: number[] = [];
      for (let index = 0; index < samples; index += 1) {
        const started = performance.now();
        await courseRequest();
        timings.push(performance.now() - started);
      }
      timings.sort((a, b) => a - b);
      const at = (p: number) => timings[Math.ceil((p / 100) * timings.length) - 1]?.toFixed(1);
      report(`[hot-path] learner course read: p50 ${at(50)} ms, p95 ${at(95)} ms`);
    }
  });

  it("runs tenant work as atlas_app, set in the context statement", async () => {
    const [row] = await withTenantTx(
      {
        tenantId: course.tenantId,
        requestId: randomUUID(),
        actorMembershipId: course.membershipId,
      },
      (tx) => tx.$queryRaw<Array<{ role: string; tenant: string }>>`
        select current_user::text as role, current_setting('app.tenant_id') as tenant
      `,
    );
    expect(row).toEqual({ role: "atlas_app", tenant: course.tenantId });
  });

  it("records membership activity only for a request the gate admits", async () => {
    const admin = new pg.Client({ connectionString: process.env["DATABASE_URL"] });
    await admin.connect();
    const setPrincipal = (status: string) =>
      admin.query(`update auth_principals set global_status = $2 where id = $1::uuid`, [
        course.principalId,
        status,
      ]);
    const activity = async (tx: TenantTx) => {
      const [row] = await tx.$queryRaw<Array<{ last_active: boolean; active_days: number }>>`
        select
          (select last_active_at is not null from memberships where id = ${course.membershipId}::uuid) as last_active,
          (select count(*)::int from tenant_active_days where membership_id = ${course.membershipId}::uuid) as active_days
      `;
      return row;
    };
    // The gate's own statement, observed before the request's transaction ends.
    const gateThenActivity = () =>
      withTenantTx(
        { tenantId: course.tenantId, requestId: randomUUID(), allowAnonymousTenantRead: true },
        async (tx) => {
          const outcome = await requireActiveMembership({
            tx,
            tenantId: course.tenantId,
            authPrincipalId: course.principalId,
          }).then(
            () => "admitted",
            (error: { code?: string }) => error.code ?? "error",
          );
          return { outcome, activity: await activity(tx) };
        },
      );
    try {
      await admin.query(`update memberships set last_active_at = null where id = $1::uuid`, [
        course.membershipId,
      ]);
      await admin.query(`delete from tenant_active_days where membership_id = $1::uuid`, [
        course.membershipId,
      ]);

      await setPrincipal("disabled");
      expect(await gateThenActivity()).toEqual({
        outcome: "ACCOUNT_DISABLED",
        activity: { last_active: false, active_days: 0 },
      });

      await setPrincipal("active");
      expect(await gateThenActivity()).toEqual({
        outcome: "admitted",
        activity: { last_active: true, active_days: 1 },
      });
    } finally {
      await setPrincipal("active");
      await admin.end();
    }
  });

  describe("exam runner", () => {
    let exam: AssessmentFixture;
    const asLearner = <T>(fn: (tx: TenantTx) => Promise<T>) =>
      withTenantTx(authoringTenantTx(exam, exam.learnerMembershipId), fn);

    async function addQuestions(count: number) {
      await withTenantTx(authoringTenantTx(exam), async (tx) => {
        for (let index = 0; index < count; index += 1) {
          const itemId = randomUUID();
          await tx.$executeRaw`
            insert into items (id, tenant_id, item_type_key, stem_json, explanation_json, status, tags,
                               created_by_membership_id, created_at, updated_at)
            values (${itemId}::uuid, ${exam.tenantId}::uuid, 'mcq_single',
                    ${JSON.stringify({ stem: `Q${String(index)}` })}::jsonb, '{}'::jsonb,
                    'PUBLISHED', '{}'::text[], ${exam.instructorMembershipId}::uuid, now(), now())
          `;
          await tx.$executeRaw`
            insert into item_options (id, tenant_id, item_id, option_json, is_correct, position, created_at, updated_at)
            select gen_random_uuid(), ${exam.tenantId}::uuid, ${itemId}::uuid,
                   jsonb_build_object('label', 'Option ' || n), n = 1, n, now(), now()
            from generate_series(1, 4) as n
          `;
          await tx.$executeRaw`
            insert into assessment_items (id, tenant_id, assessment_id, item_id, position, points, config_json, created_at)
            values (${randomUUID()}::uuid, ${exam.tenantId}::uuid, ${exam.assessmentId}::uuid,
                    ${itemId}::uuid, ${index + 3}, 1, '{"required":false}'::jsonb, now())
          `;
        }
        await tx.$executeRaw`
          update assessments
             set config_json = config_json || '{"shuffleItems":true,"shuffleOptions":true,"attemptsAllowed":10}'::jsonb
           where id = ${exam.assessmentId}::uuid
        `;
      });
    }

    async function measureExam(): Promise<{ start: number; load: number; questions: number }> {
      const started = await countStatements(() =>
        asLearner((tx) => startAttempt(tx, learnerCtx(exam), exam.assessmentId, randomUUID())),
      );
      const attemptId = started.result.data.id;
      const loaded = await countStatements(() =>
        asLearner((tx) => getAttempt(tx, learnerCtx(exam), attemptId)),
      );
      return {
        start: started.sql.length,
        load: loaded.sql.length,
        questions: loaded.result.data.items.length,
      };
    }

    beforeAll(async () => {
      exam = await createAssessmentFixture();
      await publishAssessmentFixture(exam);
    });

    it("start and load cost per question", async () => {
      const small = await measureExam();
      await addQuestions(18);
      const large = await measureExam();
      report(
        `[hot-path] exam start: ${String(small.start)} statements @ ${String(small.questions)} questions, ` +
          `${String(large.start)} @ ${String(large.questions)}`,
      );
      report(
        `[hot-path] exam load: ${String(small.load)} statements @ ${String(small.questions)} questions, ` +
          `${String(large.load)} @ ${String(large.questions)}`,
      );
      expect(large.questions).toBe(small.questions + 18);
      // Before: two statements per question to load (47 at 20 questions) and
      // one per question to start a shuffled exam.
      expect(large.load).toBe(small.load);
      expect(large.start - small.start).toBeLessThanOrEqual(2);
    });
  });
});
