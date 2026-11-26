import { describe, expect, it } from "vitest";
import { withTenantTx, type TenantTx } from "@atlas/db";
import { buildReportDataset } from "@atlas/domain/reports/reports.datasets";
import { renderReportCsv } from "@atlas/domain/reports/reports-export-runner";
import { createReportRun } from "@atlas/domain/reports/reports.service";
import {
  adminCtx,
  authoringTenantTx,
  createCourseAuthoringFixture,
  type CourseAuthoringFixture,
} from "../../fixtures/course-authoring-fixture";

/**
 * QA S2.7 (review 1 M15, m18): the Members export goes through the export
 * centre, names every member (the owner included) and writes one date format.
 */
const describeWithDb =
  process.env["DATABASE_URL"] && process.env["PLATFORM_DATABASE_URL"] ? describe : describe.skip;

function asAdmin<T>(fixture: CourseAuthoringFixture, fn: (tx: TenantTx) => Promise<T>) {
  return withTenantTx(authoringTenantTx(fixture, fixture.adminMembershipId), fn);
}

describeWithDb("members export (S2.7)", () => {
  it("names each member by profile, else account name, never by repeating the email (m18)", async () => {
    const fixture = await createCourseAuthoringFixture();
    const dataset = await asAdmin(fixture, (tx) =>
      buildReportDataset(tx, { datasetKey: "members", params: {} }),
    );

    expect(dataset.columns).toEqual([
      "name",
      "email",
      "status",
      "roles",
      "joined_at",
      "last_active_at",
    ]);
    expect(dataset.rows.length).toBeGreaterThan(0);
    for (const row of dataset.rows) {
      expect(row["name"]).not.toBe(row["email"]);
    }

    // The admin's name is their profile name, else the name on their account.
    const expected = await asAdmin(
      fixture,
      (tx) =>
        tx.$queryRaw<Array<{ name: string | null; email: string | null }>>`
        select
          coalesce(nullif(btrim(mp.display_name), ''), nullif(btrim(ap.name), '')) as name,
          ap.email
        from memberships m
        left join member_profiles mp
          on mp.membership_id = m.id and mp.tenant_id = m.tenant_id and mp.deleted_at is null
        left join auth_principals ap on ap.id = m.auth_principal_id
        where m.id = ${fixture.adminMembershipId}::uuid
      `,
    );
    const admin = dataset.rows.find((row) => row["email"] === expected[0]?.email);
    expect(admin?.["name"] ?? null).toBe(expected[0]?.name ?? null);
  });

  it("filters like the Members page and writes dates in one format (M15)", async () => {
    const fixture = await createCourseAuthoringFixture();
    const active = await asAdmin(fixture, (tx) =>
      buildReportDataset(tx, { datasetKey: "members", params: { status: "ACTIVE" } }),
    );
    expect(active.rows.every((row) => row["status"] === "Active")).toBe(true);

    const csv = new TextDecoder().decode(renderReportCsv(active));
    const [header, ...lines] = csv.trim().split("\n");
    expect(header).toBe("name,email,status,roles,joined_at,last_active_at");
    const isoOrEmpty = /^("?\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z"?)?$/;
    for (const line of lines) {
      const cells = line.split(",");
      expect(cells.at(-2)).toMatch(isoOrEmpty);
      expect(cells.at(-1)).toMatch(isoOrEmpty);
    }
  });

  it("runs from the export centre, so it is logged with a history (M15)", async () => {
    const fixture = await createCourseAuthoringFixture();
    const run = await asAdmin(fixture, (tx) =>
      createReportRun(tx, adminCtx(fixture), {
        definitionKey: "members",
        format: "csv",
        params: { status: "ACTIVE" },
      }),
    );
    expect(run.data.id).toBeTruthy();
    const logged = await asAdmin(
      fixture,
      (tx) =>
        tx.$queryRaw<Array<{ requested_by: string | null }>>`
        select rr.requested_by_membership_id::text as requested_by
        from report_runs rr
        where rr.id = ${run.data.id}::uuid
      `,
    );
    expect(logged[0]?.requested_by).toBe(fixture.adminMembershipId);
  });
});
