import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { withTenantTx } from "@atlas/db";
import { checkTenantForeignKeys } from "../../../scripts/db/check-tenant-fk-integrity.mjs";
import {
  createTenantIsolationFixture,
  tenantCtx,
  type TenantIsolationFixture,
} from "../../tenant-isolation/tenant-isolation-fixture";

/**
 * Audit M3 against Postgres: a row may only reference a parent of its own
 * tenant. RLS hides other tenants' rows from reads but never stopped a write
 * that named one; the composite foreign keys do.
 */
const suite =
  process.env["DATABASE_URL"] && process.env["PLATFORM_DATABASE_URL"] ? describe : describe.skip;

suite("composite tenant foreign keys (audit M3)", () => {
  let fixture: TenantIsolationFixture;
  const asA = <T>(fn: Parameters<typeof withTenantTx<T>>[1]) =>
    withTenantTx(tenantCtx(fixture.tenantA), fn);
  const asB = <T>(fn: Parameters<typeof withTenantTx<T>>[1]) =>
    withTenantTx(tenantCtx(fixture.tenantB), fn);
  const rejectedBy = (constraint: string) =>
    expect.objectContaining({ message: expect.stringContaining(constraint) });

  const enrol = (courseId: string, membershipId: string) =>
    asA(
      (tx) => tx.$executeRaw`
        insert into enrollments (id, tenant_id, course_id, membership_id)
        values (${randomUUID()}::uuid, ${fixture.tenantA.tenantId}::uuid, ${courseId}::uuid, ${membershipId}::uuid)
      `,
    );

  beforeAll(async () => {
    fixture = await createTenantIsolationFixture();
  });

  it("accepts a reference to a parent of the same tenant", async () => {
    await expect(enrol(fixture.tenantA.courseId, fixture.tenantA.membershipId)).resolves.toBe(1);
  });

  it("refuses a reference to another tenant's course or member", async () => {
    await expect(enrol(fixture.tenantB.courseId, fixture.tenantA.membershipId)).rejects.toEqual(
      rejectedBy("enrollments_course_id_tenant_fkey"),
    );
    await expect(enrol(fixture.tenantA.courseId, fixture.tenantB.membershipId)).rejects.toEqual(
      rejectedBy("enrollments_membership_id_tenant_fkey"),
    );
  });

  it("refuses a reference to a parent that does not exist", async () => {
    await expect(enrol(randomUUID(), fixture.tenantA.membershipId)).rejects.toEqual(
      rejectedBy("enrollments_course_id_tenant_fkey"),
    );
  });

  it("refuses an attempt on another tenant's assessment, and a grant of another tenant's role", async () => {
    const assessmentId = randomUUID();
    const roleId = randomUUID();
    await asB(async (tx) => {
      await tx.$executeRaw`
        insert into assessments (id, tenant_id, slug, title, assessment_type, status, config_json, updated_at)
        values (${assessmentId}::uuid, ${fixture.tenantB.tenantId}::uuid, ${`m3-${assessmentId}`},
                'M3', 'quiz', 'PUBLISHED', '{}'::jsonb, now())
      `;
      await tx.$executeRaw`
        insert into roles (id, tenant_id, key, name, updated_at)
        values (${roleId}::uuid, ${fixture.tenantB.tenantId}::uuid, ${`m3-${roleId}`}, 'M3', now())
      `;
    });

    await expect(
      asA(
        (tx) => tx.$executeRaw`
          insert into attempts (id, tenant_id, assessment_id, membership_id)
          values (${randomUUID()}::uuid, ${fixture.tenantA.tenantId}::uuid, ${assessmentId}::uuid,
                  ${fixture.tenantA.membershipId}::uuid)
        `,
      ),
    ).rejects.toEqual(rejectedBy("attempts_assessment_id_tenant_fkey"));

    await expect(
      asA(
        (tx) => tx.$executeRaw`
          insert into user_roles (id, tenant_id, membership_id, role_id)
          values (${randomUUID()}::uuid, ${fixture.tenantA.tenantId}::uuid,
                  ${fixture.tenantA.membershipId}::uuid, ${roleId}::uuid)
        `,
      ),
    ).rejects.toEqual(rejectedBy("user_roles_role_id_tenant_fkey"));
  });

  it("refuses to delete a parent that still has children", async () => {
    await expect(
      asA((tx) => tx.$executeRaw`delete from courses where id = ${fixture.tenantA.courseId}::uuid`),
    ).rejects.toEqual(rejectedBy("enrollments_course_id_tenant_fkey"));
  });

  it("leaves every constraint validated and no row in violation", async () => {
    const report = await checkTenantForeignKeys(process.env["DATABASE_URL"]);
    expect(report.violations).toEqual([]);
    expect(report.allValidated).toBe(true);
    expect(report.results).toHaveLength(44);
  });
});
