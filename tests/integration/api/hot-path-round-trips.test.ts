import { randomUUID } from "node:crypto";
import pg from "pg";
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
 * latency and capacity budget, asserted here. Login is Better Auth (launch
 * plan task 3.7); its session check is stubbed, since the session cache tests
 * cover its cost, and the principal is read from the database as in
 * production. HOT_PATH_SAMPLES=100 also reports local latency.
 */
const sessionUser = vi.hoisted(() => ({ current: null as null | Record<string, unknown> }));
vi.mock("../../../backend/packages/auth/src/better-auth-runtime", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  authProvider: () => "better-auth",
  requireBetterAuthUser: vi.fn(async () => {
    if (!sessionUser.current) throw new Error("no stub user");
    return sessionUser.current;
  }),
}));

const { GET: getCourse } =
  await import("../../../backend/apps/api/src/app/api/v1/courses/[id]/route");
const { GET: getLesson } =
  await import("../../../backend/apps/api/src/app/api/v1/lessons/[id]/route");
const { POST: postLessonProgress } =
  await import("../../../backend/apps/api/src/app/api/v1/lessons/[id]/progress/route");
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
    // The learner is enrolled, as in the staging load test's journey.
    await withTenantTx(
      { tenantId: course.tenantId, requestId: randomUUID(), allowAnonymousTenantRead: true },
      (tx) => tx.$executeRaw`
        insert into enrollments (id, tenant_id, course_id, membership_id, status, enrolled_at)
        values (${randomUUID()}::uuid, ${course.tenantId}::uuid, ${course.publishedCourseId}::uuid,
                ${course.membershipId}::uuid, 'active', now())
      `,
    );
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
      (tx) => tx.$queryRaw<Array<{ email: string }>>`
        select email from auth_principals where id = ${course.principalId}::uuid
      `,
    );
    if (!principal) throw new Error("fixture principal missing");
    sessionUser.current = {
      principalId: course.principalId,
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
    // membership gate, the course loader's 2, can(), COMMIT). 8 now, for an enrolled learner: the tenant
    // transaction alone, because the gate reads the account status itself and
    // the host was resolved by the warm-up request (staging load test,
    // docs/engineering/staging-load-test-2026-11-07.md).
    expect(sql.length, sql.join("\n")).toBeLessThanOrEqual(8);
    // One transaction: no separate global one to read the principal.
    expect(sql.filter((statement) => statement === "BEGIN")).toHaveLength(1);

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

  it("lesson reads and progress saves stay within their round-trip budget", async () => {
    const headers = { host, "x-forwarded-for": "198.51.100.9" };
    const lessonRequest = () =>
      getLesson(new NextRequest(`https://${host}/api/v1/lessons/${course.lessonId}`, { headers }), {
        params: Promise.resolve({ id: course.lessonId }),
      });
    const progressRequest = () =>
      postLessonProgress(
        new NextRequest(`https://${host}/api/v1/lessons/${course.lessonId}/progress`, {
          method: "POST",
          headers: { ...headers, "content-type": "application/json" },
          body: JSON.stringify({ positionSeconds: 30, completed: false }),
        }),
        { params: Promise.resolve({ id: course.lessonId }) },
      );
    // Warm once: creates the progress row, so the save below is an update.
    expect((await progressRequest()).status).toBe(200);

    const lesson = await countStatements(lessonRequest);
    const progress = await countStatements(progressRequest);
    expect(lesson.result.status).toBe(200);
    expect(progress.result.status).toBe(200);
    report(`[hot-path] learner lesson read: ${String(lesson.sql.length)} statements`);
    report(`[hot-path] learner progress save: ${String(progress.sql.length)} statements`);
    // 15 and 16 before: a global transaction for the principal (4), the
    // lesson, course and enrollment read separately (3), and, when saving, the
    // progress row read twice.
    expect(lesson.sql.length, lesson.sql.join("\n")).toBeLessThanOrEqual(9);
    expect(progress.sql.length, progress.sql.join("\n")).toBeLessThanOrEqual(9);
  });

  it("refuses a principal that no longer exists as signed out", async () => {
    const outcome = await withTenantTx(
      { tenantId: course.tenantId, requestId: randomUUID(), allowAnonymousTenantRead: true },
      (tx) =>
        requireActiveMembership({
          tx,
          tenantId: course.tenantId,
          authPrincipalId: randomUUID(),
        }).then(
          () => "admitted",
          (error: { code?: string; status?: number }) =>
            `${String(error.code)} ${String(error.status)}`,
        ),
    );
    expect(outcome).toBe("AUTH_REQUIRED 401");
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
