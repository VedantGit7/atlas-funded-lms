import { describe, expect, it } from "vitest";
import { assignDefaultLearnerRole } from "@atlas/access";
import { readTenantAuditLog } from "@atlas/audit/services/audit-reader.service";
import { withTenantTx, type TenantTx } from "@atlas/db";
import { getUsageTierAMetrics } from "@atlas/domain-config/repositories/usage.repository";
import { readTenantConfigVersions } from "@atlas/domain-config/services/tenant-config.service";
import { getUsageSummary } from "@atlas/domain-config/services/usage.service";
import { getMemberStats, suspendMember } from "@atlas/membership";
import { getAdminOverview } from "../../../backend/apps/api/src/server/admin/admin-overview.service";
import {
  adminCtx,
  authoringTenantTx,
  createCourseAuthoringFixture,
  type CourseAuthoringFixture,
} from "../../fixtures/course-authoring-fixture";

/**
 * QA S2.4 against Postgres: one meaning of "learner" on every count (review 1
 * M8, m13) and names, not IDs, on the audit log and config history (review 2
 * 4.3.2).
 */
const describeWithDb =
  process.env["DATABASE_URL"] && process.env["PLATFORM_DATABASE_URL"] ? describe : describe.skip;

function asAdmin<T>(fixture: CourseAuthoringFixture, fn: (tx: TenantTx) => Promise<T>) {
  return withTenantTx(authoringTenantTx(fixture, fixture.adminMembershipId), fn);
}

async function emailOf(fixture: CourseAuthoringFixture, membershipId: string): Promise<string> {
  const rows = await asAdmin(
    fixture,
    (tx) =>
      tx.$queryRaw<Array<{ email: string }>>`
        select ap.email from memberships m
        join auth_principals ap on ap.id = m.auth_principal_id
        where m.id = ${membershipId}::uuid
      `,
  );
  const email = rows[0]?.email;
  if (!email) throw new Error("member has no email");
  return email;
}

describeWithDb("vocabulary and counts (S2.4)", () => {
  it("counts only members with no staff role as learners, everywhere (M8, m13)", async () => {
    const fixture = await createCourseAuthoringFixture();
    // The admin also holds the learner role ("Admin + Learner" in QA review 1).
    await asAdmin(fixture, (tx) =>
      assignDefaultLearnerRole({
        tx,
        tenantId: fixture.tenantId,
        membershipId: fixture.adminMembershipId,
      }),
    );

    const stats = await asAdmin(fixture, (tx) =>
      getMemberStats(tx, { tenantId: fixture.tenantId }),
    );
    // Two instructors and the admin are staff; the admin's learner role
    // does not make them a learner.
    expect(stats.data.staffMembers).toBe(3);
    expect(stats.data.totalLearners).toBe(stats.data.totalMembers - 3);
    expect(stats.data.activeLearners).toBe(stats.data.totalLearners);
    const learners = stats.data.totalLearners;

    const overview = await asAdmin(fixture, (tx) =>
      getAdminOverview(tx, { tenantId: fixture.tenantId }),
    );
    expect(overview.data.kpis.learnerCount).toBe(learners);

    const usage = await asAdmin(fixture, (tx) => getUsageTierAMetrics(tx));
    expect(usage.totalLearners).toBe(learners);
  });

  it("shows one active-learner and one monthly-active count per page (staging check)", async () => {
    const fixture = await createCourseAuthoringFixture();
    await asAdmin(fixture, (tx) =>
      suspendMember(tx, adminCtx(fixture), fixture.learnerMembershipId),
    );

    const stats = await asAdmin(fixture, (tx) =>
      getMemberStats(tx, { tenantId: fixture.tenantId }),
    );
    // The suspended learner is still a learner, just not an active one.
    expect(stats.data.activeLearners).toBe(stats.data.totalLearners - 1);

    // "Active learners" on the dashboard and the usage page is the same number
    // as "(n active)" on the members page.
    const overview = await asAdmin(fixture, (tx) =>
      getAdminOverview(tx, { tenantId: fixture.tenantId }),
    );
    expect(overview.data.kpis.learnerCount).toBe(stats.data.activeLearners);
    const summary = await asAdmin(fixture, (tx) => getUsageSummary(tx));
    expect(summary.data.kpis.totalLearners).toBe(stats.data.activeLearners);

    // The monthly-active tile and the chart headline come from one count.
    expect(summary.data.kpis.averageMau).toBe(summary.data.mau.comparison.current);
  });

  it("names the person behind each audit entry and config version (4.3.2)", async () => {
    const fixture = await createCourseAuthoringFixture();
    const adminEmail = await emailOf(fixture, fixture.adminMembershipId);
    await asAdmin(fixture, (tx) =>
      suspendMember(tx, adminCtx(fixture), fixture.learnerMembershipId),
    );

    const log = await asAdmin(fixture, (tx) => readTenantAuditLog(tx, { limit: 20 }));
    const entry = log.data.find((row) => row.actorMembershipId === fixture.adminMembershipId);
    expect(entry?.actorName).toBe(adminEmail);

    const versions = await asAdmin(fixture, (tx) => readTenantConfigVersions(tx));
    for (const version of versions.data) {
      if (version.createdByMembershipId) expect(version.createdByName).toBeTruthy();
    }
  });
});
