import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { withTenantTx } from "@atlas/db";
import { batchesRepository } from "@atlas/domain/batches/batches.repository";
import { liveRepository } from "@atlas/domain/live/live.repository";
import { destinationsRosterRepository } from "@atlas/domain/reports/destinations-roster.repository";
import { deleteDimensionRecord } from "../../../backend/apps/api/src/server/competency/competency-config.repository";
import { marketingFormsRepository } from "../../../backend/apps/api/src/server/marketing-forms/marketing-forms.repository";
import { marketingWorkflowRepository } from "../../../backend/apps/api/src/server/marketing-workflows/marketing-workflow.repository";
import { checkTenantForeignKeys } from "../../../scripts/db/check-tenant-fk-integrity.mjs";
import { TENANT_FOREIGN_KEYS } from "../../../scripts/db/tenant-fk-spec.mjs";
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

  it("covers the remaining tables: reviews, activity days", async () => {
    const review = (courseId: string, membershipId: string) =>
      asA(
        (tx) => tx.$executeRaw`
          insert into course_reviews (id, tenant_id, course_id, membership_id, rating, updated_at)
          values (${randomUUID()}::uuid, ${fixture.tenantA.tenantId}::uuid, ${courseId}::uuid,
                  ${membershipId}::uuid, 5, now())
        `,
      );
    await expect(review(fixture.tenantB.courseId, fixture.tenantA.membershipId)).rejects.toEqual(
      rejectedBy("course_reviews_course_id_tenant_fkey"),
    );
    await expect(review(fixture.tenantA.courseId, fixture.tenantB.membershipId)).rejects.toEqual(
      rejectedBy("course_reviews_membership_id_tenant_fkey"),
    );

    // A table keyed by (tenant_id, membership_id, day) rather than an id.
    await expect(
      asA(
        (tx) => tx.$executeRaw`
          insert into tenant_active_days (tenant_id, membership_id, day)
          values (${fixture.tenantA.tenantId}::uuid, ${fixture.tenantB.membershipId}::uuid, current_date)
        `,
      ),
    ).rejects.toEqual(rejectedBy("tenant_active_days_membership_id_tenant_fkey"));
  });

  it("refuses to delete a parent that still has children", async () => {
    await expect(
      asA((tx) => tx.$executeRaw`delete from courses where id = ${fixture.tenantA.courseId}::uuid`),
    ).rejects.toEqual(rejectedBy("enrollments_course_id_tenant_fkey"));
  });

  it("lets the parents that are hard-deleted go, releasing their dependants first", async () => {
    const tenantId = fixture.tenantA.tenantId;
    const memberId = fixture.tenantA.membershipId;
    const id = {
      form: randomUUID(),
      cta: randomUUID(),
      workflow: randomUUID(),
      run: randomUUID(),
      log: randomUUID(),
      dimension: randomUUID(),
      item: randomUUID(),
      weight: randomUUID(),
      batch: randomUUID(),
      session: randomUUID(),
      poll: randomUUID(),
      definition: randomUUID(),
      reportRun: randomUUID(),
      destination: randomUUID(),
    };
    const effectKey = `m3-${id.reportRun}`;

    await asA(async (tx) => {
      await tx.$executeRaw`
        insert into marketing_forms (id, tenant_id, title, share_token, created_by_membership_id)
        values (${id.form}::uuid, ${tenantId}::uuid, 'M3 form', ${id.form}, ${memberId}::uuid)`;
      await tx.$executeRaw`
        insert into marketing_ctas (id, tenant_id, title, cta_type, form_id, created_by_membership_id)
        values (${id.cta}::uuid, ${tenantId}::uuid, 'M3 CTA', 'form', ${id.form}::uuid, ${memberId}::uuid)`;
      await tx.$executeRaw`
        insert into marketing_workflows (id, tenant_id, title, created_by_membership_id)
        values (${id.workflow}::uuid, ${tenantId}::uuid, 'M3 workflow', ${memberId}::uuid)`;
      await tx.$executeRaw`
        insert into marketing_workflow_runs (id, tenant_id, workflow_id, trigger_event_type, idempotency_key)
        values (${id.run}::uuid, ${tenantId}::uuid, ${id.workflow}::uuid, 'm3.test', ${id.run})`;
      await tx.$executeRaw`
        insert into marketing_workflow_run_logs (id, tenant_id, run_id, status)
        values (${id.log}::uuid, ${tenantId}::uuid, ${id.run}::uuid, 'ok')`;
      await tx.$executeRaw`
        insert into competency_dimensions (id, tenant_id, key, name, updated_at)
        values (${id.dimension}::uuid, ${tenantId}::uuid, ${`m3-${id.dimension}`}, 'M3', now())`;
      await tx.$executeRaw`
        insert into items (id, tenant_id, item_type_key, stem_json, updated_at)
        values (${id.item}::uuid, ${tenantId}::uuid, 'mcq_single', '{}'::jsonb, now())`;
      await tx.$executeRaw`
        insert into item_dimension_weights (id, tenant_id, item_id, dimension_id, weight)
        values (${id.weight}::uuid, ${tenantId}::uuid, ${id.item}::uuid, ${id.dimension}::uuid, 1)`;
      await tx.$executeRaw`
        insert into batches (id, tenant_id, key, name, updated_at)
        values (${id.batch}::uuid, ${tenantId}::uuid, ${`m3-${id.batch}`}, 'M3 batch', now())`;
      await tx.$executeRaw`
        insert into live_sessions (id, tenant_id, title, batch_id, updated_at)
        values (${id.session}::uuid, ${tenantId}::uuid, 'M3 session', ${id.batch}::uuid, now())`;
      await tx.$executeRaw`
        insert into polls (id, tenant_id, title, live_session_id, updated_at)
        values (${id.poll}::uuid, ${tenantId}::uuid, 'M3 poll', ${id.session}::uuid, now())`;
      await tx.$executeRaw`
        insert into report_definitions (id, tenant_id, key, category, title, param_schema_json, dataset_key, updated_at)
        values (${id.definition}::uuid, ${tenantId}::uuid, ${`m3-${id.definition}`}, 'm3', 'M3',
                '{}'::jsonb, 'm3', now())`;
      await tx.$executeRaw`
        insert into report_runs (id, tenant_id, report_definition_id, requested_by_membership_id, params_json, format, updated_at)
        values (${id.reportRun}::uuid, ${tenantId}::uuid, ${id.definition}::uuid, ${memberId}::uuid,
                '{}'::jsonb, 'csv', now())`;
      await tx.$executeRaw`
        insert into report_delivery_destinations (id, tenant_id, created_by_membership_id, name, kind)
        values (${id.destination}::uuid, ${tenantId}::uuid, ${memberId}::uuid, 'M3 hook', 'webhook')`;
      await tx.$executeRaw`
        insert into report_delivery_effects
          (effect_key, tenant_id, report_run_id, ordinal, kind, destination_id, request_json, retry_on_crash, status)
        values (${effectKey}, ${tenantId}::uuid, ${id.reportRun}::uuid, 0, 'webhook',
                ${id.destination}::uuid, '{}'::jsonb, false, 'succeeded')`;
    });

    await asA(async (tx) => {
      await expect(marketingFormsRepository.deleteById(tx, id.form)).resolves.toBe(true);
      await expect(marketingWorkflowRepository.deleteById(tx, id.workflow)).resolves.toBe(true);
      await expect(deleteDimensionRecord({ tx, dimensionId: id.dimension })).resolves.toBe(true);
      await expect(batchesRepository.deleteBatch(tx, id.batch)).resolves.toBe(true);
      await expect(liveRepository.deleteSession(tx, id.session)).resolves.toBe(true);
      await destinationsRosterRepository.delete(tx, id.destination);
    });

    // Kept, no longer naming the deleted parent: the CTA, the poll, the
    // delivery record. Removed with it: the workflow's runs and logs, and the
    // dimension's item weights.
    const remaining = await asA(
      (tx) => tx.$queryRaw<Array<Record<string, string | number | null>>>`
        select
          (select form_id::text from marketing_ctas where id = ${id.cta}::uuid) as cta_form,
          (select live_session_id::text from polls where id = ${id.poll}::uuid) as poll_session,
          (select destination_id::text from report_delivery_effects where effect_key = ${effectKey}) as effect_destination,
          (select count(*)::int from marketing_ctas where id = ${id.cta}::uuid) as ctas,
          (select count(*)::int from polls where id = ${id.poll}::uuid) as polls,
          (select count(*)::int from report_delivery_effects where effect_key = ${effectKey}) as effects,
          (select count(*)::int from marketing_workflow_runs where id = ${id.run}::uuid) as runs,
          (select count(*)::int from marketing_workflow_run_logs where id = ${id.log}::uuid) as logs,
          (select count(*)::int from item_dimension_weights where id = ${id.weight}::uuid) as weights`,
    );
    expect(remaining[0]).toEqual({
      cta_form: null,
      poll_session: null,
      effect_destination: null,
      ctas: 1,
      polls: 1,
      effects: 1,
      runs: 0,
      logs: 0,
      weights: 0,
    });
  });

  it("leaves every constraint validated and no row in violation", async () => {
    const report = await checkTenantForeignKeys(process.env["DATABASE_URL"]);
    expect(report.violations).toEqual([]);
    expect(report.allValidated).toBe(true);
    expect(report.results).toHaveLength(TENANT_FOREIGN_KEYS.length);
    expect(TENANT_FOREIGN_KEYS).toHaveLength(44 + 135);
  });
});
