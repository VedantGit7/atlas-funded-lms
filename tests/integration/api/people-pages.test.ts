import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { withTenantTx, type TenantTx } from "@atlas/db";
import { reactivateMember, suspendMember } from "@atlas/membership";
import { listEnrollments } from "../../../backend/apps/api/src/server/enrollments/enrollments.service";
import { getMemberOverview } from "../../../backend/apps/api/src/server/members/member-overview.service";
import {
  getCourseReviews,
  submitCourseReview,
} from "../../../backend/apps/api/src/server/reviews/reviews.service";
import {
  addSectionWithLesson,
  adminCtx,
  authoringTenantTx,
  createCourseAuthoringFixture,
  instructorCtx,
  learnerCtx,
  type CourseAuthoringFixture,
} from "../../fixtures/course-authoring-fixture";

/**
 * QA S1.15 against Postgres: learners named by email in rosters (review 2
 * H15), review approval status (H21), the member page's learner profile and
 * reactivation (H22).
 */
const describeWithDb =
  process.env["DATABASE_URL"] && process.env["PLATFORM_DATABASE_URL"] ? describe : describe.skip;

function asAdmin<T>(fixture: CourseAuthoringFixture, fn: (tx: TenantTx) => Promise<T>) {
  return withTenantTx(authoringTenantTx(fixture, fixture.adminMembershipId), fn);
}

async function learnerEmail(fixture: CourseAuthoringFixture): Promise<string> {
  const rows = await asAdmin(
    fixture,
    (tx) =>
      tx.$queryRaw<Array<{ email: string }>>`
        select ap.email from memberships m
        join auth_principals ap on ap.id = m.auth_principal_id
        where m.id = ${fixture.learnerMembershipId}::uuid
      `,
  );
  const email = rows[0]?.email;
  if (!email) throw new Error("learner has no email");
  return email;
}

/** The fixture's course, published, with one lesson the learner finished and an order. */
async function enrolledLearner() {
  const fixture = await createCourseAuthoringFixture();
  const { lessonId } = await withTenantTx(authoringTenantTx(fixture), (tx) =>
    addSectionWithLesson(tx, instructorCtx(fixture), fixture.draftCourseId),
  );
  await asAdmin(fixture, async (tx) => {
    await tx.$executeRaw`update courses set status = 'PUBLISHED' where id = ${fixture.draftCourseId}::uuid`;
    await tx.$executeRaw`
      insert into enrollments (id, tenant_id, course_id, membership_id, status, enrolled_type, enrolled_at)
      values (${randomUUID()}::uuid, ${fixture.tenantId}::uuid, ${fixture.draftCourseId}::uuid,
              ${fixture.learnerMembershipId}::uuid, 'active', 'free', now() - interval '2 days')
    `;
    await tx.$executeRaw`
      insert into lesson_progress (id, tenant_id, lesson_id, membership_id, status, progress_pct,
                                   last_seen_at, completed_at, updated_at)
      values (${randomUUID()}::uuid, ${fixture.tenantId}::uuid, ${lessonId}::uuid,
              ${fixture.learnerMembershipId}::uuid, 'completed', 100, now(), now(), now())
    `;
    await tx.$executeRaw`
      insert into payment_orders (id, tenant_id, membership_id, amount_cents, currency, status,
                                  product_title, paid_at, created_at, updated_at)
      values (${randomUUID()}::uuid, ${fixture.tenantId}::uuid, ${fixture.learnerMembershipId}::uuid,
              4900, 'USD', 'paid', 'S1.15 course', now(), now(), now())
    `;
  });
  return fixture;
}

describeWithDb("people pages (S1.15)", () => {
  it("names learners by email in a course roster when they have no display name (H15)", async () => {
    const fixture = await enrolledLearner();
    const email = await learnerEmail(fixture);
    const roster = await withTenantTx(authoringTenantTx(fixture), (tx) =>
      listEnrollments(tx, instructorCtx(fixture), { courseId: fixture.draftCourseId, limit: 25 }),
    );
    const row = roster.data.items.find((item) => item.membershipId === fixture.learnerMembershipId);
    expect(row?.email).toBe(email);
  });

  it("tells the learner their review waits for approval (H21)", async () => {
    const fixture = await enrolledLearner();
    const asLearner = <T>(fn: (tx: TenantTx) => Promise<T>) =>
      withTenantTx(authoringTenantTx(fixture, fixture.learnerMembershipId), fn);

    await asLearner((tx) =>
      submitCourseReview(tx, learnerCtx(fixture), fixture.draftCourseId, {
        rating: 4,
        comment: "Clear and practical.",
      }),
    );
    const view = await asLearner((tx) =>
      getCourseReviews(tx, learnerCtx(fixture), fixture.draftCourseId, { limit: 20 }),
    );
    expect(view.data.myReview?.status).toBe("PENDING");
    // Not listed or counted until approved.
    expect(view.data.items).toHaveLength(0);
    expect(view.data.aggregate.count).toBe(0);
  });

  it("shows an admin the learner's courses, scores, payments and activity (H22)", async () => {
    const fixture = await enrolledLearner();
    const overview = await asAdmin(fixture, (tx) =>
      getMemberOverview(tx, adminCtx(fixture), fixture.learnerMembershipId),
    );
    expect(overview.data.email).toBe(await learnerEmail(fixture));
    expect(overview.data.summary).toMatchObject({ coursesEnrolled: 1, coursesCompleted: 1 });
    expect(overview.data.courses[0]).toMatchObject({
      courseId: fixture.draftCourseId,
      completedLessons: 1,
      totalLessons: 1,
      progressPct: 100,
    });
    expect(overview.data.payments?.[0]).toMatchObject({
      amountCents: 4900,
      currency: "USD",
      status: "paid",
    });
    expect(overview.data.activity.map((event) => event.kind)).toEqual(
      expect.arrayContaining(["enrolled", "lesson_completed", "payment"]),
    );
    expect(overview.data.lastActiveAt).not.toBeNull();
  });

  it("leaves payments out for staff who can't read them", async () => {
    const fixture = await enrolledLearner();
    const overview = await withTenantTx(authoringTenantTx(fixture), (tx) =>
      getMemberOverview(tx, instructorCtx(fixture), fixture.learnerMembershipId),
    );
    expect(overview.data.payments).toBeNull();
    expect(overview.data.activity.some((event) => event.kind === "payment")).toBe(false);
  });

  it("reactivates a suspended learner, and only a suspended one (H22)", async () => {
    const fixture = await createCourseAuthoringFixture();
    await expect(
      asAdmin(fixture, (tx) =>
        reactivateMember(tx, adminCtx(fixture), fixture.learnerMembershipId),
      ),
    ).rejects.toThrow(/Only a suspended member/);

    await asAdmin(fixture, (tx) =>
      suspendMember(tx, adminCtx(fixture), fixture.learnerMembershipId),
    );
    const result = await asAdmin(fixture, (tx) =>
      reactivateMember(tx, adminCtx(fixture), fixture.learnerMembershipId),
    );
    expect(result.data.status).toBe("ACTIVE");

    const audit = await asAdmin(
      fixture,
      (tx) =>
        tx.$queryRaw<Array<{ count: bigint }>>`
          select count(*)::bigint as count from audit_entries
          where target_id = ${fixture.learnerMembershipId}
            and action = 'identity.membership.status_changed'
        `,
    );
    expect(Number(audit[0]?.count ?? 0)).toBe(2);
  });
});
