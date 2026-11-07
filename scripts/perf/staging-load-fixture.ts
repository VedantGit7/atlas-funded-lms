/**
 * Synthetic learners and a course for the hosted load test (launch plan 5.2).
 *
 * Creates N verified Better Auth logins (`loadtest-learner-NNN@loadtest.example.test`)
 * and one published "Load test course" with a single section and lesson, then
 * writes the harness's private configuration. Learners get their tenant
 * membership on their first sign-in, and their enrollment through the API, as
 * real self-service learners do; the harness measures both.
 *
 * Idempotent: re-running keeps the learners and the course, resets each
 * learner's password to a new random one, and rewrites the configuration. The
 * learners are kept between runs (decided 7 November 2026).
 *
 * Refuses unless APP_ENV is "staging" and `--ack-staging-load-fixtures` is
 * given, so it can't be pointed at production by accident. Run it on the
 * staging server with the API's environment (DATABASE_URL, BETTER_AUTH_SECRET):
 *
 *   tsx --tsconfig backend/apps/api/tsconfig.json scripts/perf/staging-load-fixture.ts \
 *     --ack-staging-load-fixtures --tenant-id <uuid> --owner-membership-id <uuid> \
 *     --origin https://staging-academy.example --learners 500 --out <private-config.json>
 *
 * The configuration holds passwords: keep it on the server (mode 600). Nothing
 * here prints a password.
 */
import { randomBytes } from "node:crypto";
import { chmodSync, writeFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { withTenantTx } from "@atlas/db";
import { upsertFixtureLogin } from "../e2e/better-auth-fixture-logins";
import {
  createCourseDraft,
  createCourseModule,
} from "../../backend/apps/api/src/server/courses/course-authoring.service";
import {
  setCourseModuleStatus,
  updateCourseStatus,
} from "../../backend/apps/api/src/server/courses/course-authoring.repository";
import { createCourseBodySchema } from "../../backend/apps/api/src/server/courses/course-authoring-schemas";
import { createLesson } from "../../backend/apps/api/src/server/lessons/lessons.service";
import { createLessonBodySchema } from "../../backend/apps/api/src/server/lessons/lesson-schemas";
import { setLessonStatus } from "../../backend/apps/api/src/server/lessons/lessons.repository";

const COURSE_SLUG = "load-test-course";
// A 10-minute lesson saved at one minute: 10%, which the percentage progress
// stores exactly, so the harness can read back the position it saved.
const LESSON_SECONDS = 600;
const POSITION_SECONDS = 60;

const { values } = parseArgs({
  options: {
    "ack-staging-load-fixtures": { type: "boolean", default: false },
    "tenant-id": { type: "string" },
    "owner-membership-id": { type: "string" },
    origin: { type: "string" },
    learners: { type: "string", default: "500" },
    out: { type: "string" },
  },
});

function fail(message: string): never {
  console.error(`staging-load-fixture: ${message}`);
  process.exit(1);
}

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
if (!values["ack-staging-load-fixtures"]) fail("pass --ack-staging-load-fixtures");
if (process.env["APP_ENV"] !== "staging") fail("APP_ENV must be staging");
if (!process.env["DATABASE_URL"] || !process.env["BETTER_AUTH_SECRET"])
  fail("DATABASE_URL and BETTER_AUTH_SECRET are required (the API's environment)");
const tenantId = values["tenant-id"] ?? "";
const ownerMembershipId = values["owner-membership-id"] ?? "";
if (!uuid.test(tenantId) || !uuid.test(ownerMembershipId))
  fail("--tenant-id and --owner-membership-id must be UUIDs");
const origin = new URL(values.origin ?? "");
if (origin.protocol !== "https:" || origin.origin !== values.origin)
  fail("--origin must be an exact https origin");
const learnerCount = Number(values.learners);
if (!Number.isInteger(learnerCount) || learnerCount < 1 || learnerCount > 500)
  fail("--learners must be 1 to 500");
const outPath = values.out;
if (!outPath) fail("--out is required");

const ctx = { tenantId, actorMembershipId: ownerMembershipId, requestId: "load-test-fixture" };

/** The course and its one lesson, created once and published; found by slug afterwards. */
async function ensureCourse(): Promise<{ courseId: string; lessonId: string }> {
  return withTenantTx(ctx, async (tx) => {
    const existing = await tx.$queryRaw<Array<{ course_id: string; lesson_id: string | null }>>`
      select c.id::text as course_id,
        (select l.id::text from lessons l join course_modules m on m.id = l.module_id
          where m.course_id = c.id and l.deleted_at is null and m.deleted_at is null
          order by m.position, l.position limit 1) as lesson_id
      from courses c
      where c.tenant_id = ${tenantId}::uuid and c.slug = ${COURSE_SLUG} and c.deleted_at is null
    `;
    const found = existing[0];
    if (found?.lesson_id) return { courseId: found.course_id, lessonId: found.lesson_id };
    if (found) fail("the load-test course exists without a lesson; fix it in the studio");

    const course = await createCourseDraft(
      tx,
      ctx,
      createCourseBodySchema.parse({
        title: "Load test course",
        slug: COURSE_SLUG,
        description: "Synthetic course for staging load tests. Not for learners.",
      }),
    );
    const courseId = course.data.id;
    const module = await createCourseModule(tx, ctx, courseId, { title: "Load test section" });
    const lesson = await createLesson(
      tx,
      ctx,
      module.data.id,
      createLessonBodySchema.parse({
        title: "Load test lesson",
        videoProvider: "youtube",
        videoUrl: "https://www.youtube.com/watch?v=aqz-KE-bpKQ",
        durationSeconds: LESSON_SECONDS,
      }),
    );
    // Published directly: this synthetic course has no reviewer to approve it.
    await setLessonStatus({ tx, lessonId: lesson.data.id, status: "PUBLISHED" });
    await setCourseModuleStatus({ tx, moduleId: module.data.id, status: "PUBLISHED" });
    await updateCourseStatus({ tx, courseId, status: "PUBLISHED" });
    return { courseId, lessonId: lesson.data.id };
  });
}

// tsx runs this repository's .ts files as CommonJS, which has no top-level await.
async function main(out: string): Promise<void> {
  const fixture = await ensureCourse();

  const users: Array<{ email: string; password: string }> = [];
  for (let i = 1; i <= learnerCount; i++) {
    const email = `loadtest-learner-${String(i).padStart(3, "0")}@loadtest.example.test`;
    const password = randomBytes(24).toString("base64url");
    await upsertFixtureLogin(email, password);
    users.push({ email, password });
    if (i % 50 === 0) console.log(`staging-load-fixture: ${i}/${learnerCount} learners ready`);
  }

  writeFileSync(
    out,
    `${JSON.stringify(
      {
        mode: "staging",
        origin: origin.origin,
        disposableFixtures: true,
        clientAddressHeader: "cf-connecting-ip",
        fixture: { ...fixture, positionSeconds: POSITION_SECONDS },
        users,
      },
      null,
      2,
    )}\n`,
    { mode: 0o600 },
  );
  chmodSync(out, 0o600);
  console.log(
    `staging-load-fixture: course ${fixture.courseId}, lesson ${fixture.lessonId}, ${users.length} learners; configuration written`,
  );
}

main(outPath).then(
  () => process.exit(0),
  (error: unknown) => {
    // The message only: a failure here never echoes a generated password.
    console.error(
      `staging-load-fixture: failed: ${error instanceof Error ? error.message : "unknown error"}`,
    );
    process.exit(1);
  },
);
