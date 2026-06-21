import { randomUUID } from "node:crypto";
import { withTenantTx } from "@atlas/db";
import {
  adminCtx,
  authoringTenantTx,
  createCourseAuthoringFixture,
  learnerCtx,
  type CourseAuthoringFixture,
} from "./course-authoring-fixture";

export type DataRightsFixture = CourseAuthoringFixture;

export async function seedDataExportEntitlement(fixture: DataRightsFixture) {
  await withTenantTx(authoringTenantTx(fixture), async (tx) => {
    await tx.$executeRaw`
      insert into entitlements (
        id,
        tenant_id,
        key,
        value_json,
        source,
        starts_at,
        expires_at,
        created_at,
        updated_at
      )
      values (
        ${randomUUID()}::uuid,
        ${fixture.tenantId}::uuid,
        'data.export.enable',
        'true'::jsonb,
        'test-fixture',
        now(),
        null,
        now(),
        now()
      )
      on conflict (tenant_id, key) do update set
        value_json = excluded.value_json,
        updated_at = now()
    `;
  });
}

export { adminCtx, authoringTenantTx, createCourseAuthoringFixture, learnerCtx };
