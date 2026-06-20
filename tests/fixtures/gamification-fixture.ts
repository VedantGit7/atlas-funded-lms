import { randomUUID } from "node:crypto";
import { withTenantTx } from "@atlas/db";
import {
  adminCtx,
  authoringTenantTx,
  createPracticeFixture,
  learnerCtx,
  type PracticeFixture,
} from "./practice-fixture";

export type GamificationFixture = PracticeFixture;

export async function seedGamificationEntitlement(fixture: GamificationFixture) {
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
        'gamification.enable',
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

export async function createGamificationFixture(): Promise<GamificationFixture> {
  const fixture = await createPracticeFixture();
  await seedGamificationEntitlement(fixture);
  return fixture;
}

export { adminCtx, authoringTenantTx, learnerCtx };
