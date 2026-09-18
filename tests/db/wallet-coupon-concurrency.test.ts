import { randomUUID } from "node:crypto";
import { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { withTenantTx } from "@atlas/db/with-tenant-tx";
import { salesWalletRepository } from "../../backend/apps/api/src/server/sales-wallet/sales-wallet.repository";
import { salesCouponsRepository } from "../../backend/apps/api/src/server/sales-coupons/sales-coupons.repository";

/**
 * Concurrency regression tests for the two money races proven in the
 * 2026-08-15 audit and fixed in hardening Phase 1.
 *
 * These call the SHIPPED repository functions rather than re-implementing their
 * SQL, so a future refactor that reintroduces read-compute-write cannot pass by
 * only keeping a hand-written probe happy.
 *
 * Before the fix:
 *   - wallet: 5 concurrent spends of 100 credits all succeeded against a
 *     100-credit wallet (500 credits of value released from 100).
 *   - coupon: 5 concurrent redemptions all succeeded against
 *     total_usage_limit = 1.
 */

const databaseUrl = process.env["DATABASE_URL"];
const describeWithDb = databaseUrl ? describe : describe.skip;

const tenantId = randomUUID();
const membershipId = randomUUID();
const walletId = randomUUID();
const couponId = randomUUID();
const perLearnerCouponId = randomUUID();
const creatorId = randomUUID();

let admin: Client;

function tenantCtx() {
  return { tenantId, requestId: randomUUID(), actorMembershipId: membershipId };
}

describeWithDb("money-path concurrency", () => {
  beforeAll(async () => {
    admin = new Client({ connectionString: databaseUrl });
    await admin.connect();

    // Despite the name, this connection is not privileged. `pnpm test:rls` runs
    // this file against .env.local, which now connects as `atlas_app_login`
    // (NOSUPERUSER NOBYPASSRLS) after the SEC-03 hardening, so every write below
    // is subject to RLS.
    //
    // The context is session-scoped (`is_local = false`) rather than wrapped
    // around each statement because this client serves exactly one tenant for
    // the lifetime of the suite. Without it the INSERTs fail outright -- and the
    // afterAll DELETEs are worse than that: RLS makes them match zero rows and
    // report success, so cleanup would leak every fixture row while looking
    // green.
    await admin.query(`select set_config('app.tenant_id', $1, false)`, [tenantId]);

    await admin.query(
      `insert into tenants (id, slug, display_name, state, updated_at)
       values ($1::uuid, $2, $3, 'ACTIVE', now())`,
      [tenantId, `conc-${tenantId.slice(0, 8)}`, "concurrency-test"],
    );
    for (const id of [membershipId, creatorId]) {
      await admin.query(
        `insert into memberships (id, tenant_id, status, updated_at)
         values ($1::uuid, $2::uuid, 'ACTIVE', now())`,
        [id, tenantId],
      );
    }
  });

  afterAll(async () => {
    await admin.query(`delete from sales_wallet_transactions where tenant_id = $1::uuid`, [
      tenantId,
    ]);
    await admin.query(`delete from sales_wallets where tenant_id = $1::uuid`, [tenantId]);
    await admin.query(`delete from sales_coupon_redemptions where tenant_id = $1::uuid`, [
      tenantId,
    ]);
    await admin.query(`delete from sales_coupons where tenant_id = $1::uuid`, [tenantId]);
    await admin.query(`delete from memberships where tenant_id = $1::uuid`, [tenantId]);
    await admin.query(`delete from tenants where id = $1::uuid`, [tenantId]);
    await admin.end();
  });

  it("allows exactly one of N concurrent wallet spends to succeed", async () => {
    await admin.query(
      `insert into sales_wallets (id, tenant_id, membership_id, balance_credits, updated_at)
       values ($1::uuid, $2::uuid, $3::uuid, 100, now())`,
      [walletId, tenantId, membershipId],
    );

    const attempts = Array.from({ length: 5 }, () =>
      withTenantTx(tenantCtx(), async (tx) =>
        salesWalletRepository.spendCredits(tx, { walletId, credits: 100 }),
      ),
    );

    const results = await Promise.all(attempts);
    const succeeded = results.filter((r) => r !== null);

    expect(succeeded).toHaveLength(1);
    expect(succeeded[0]?.balanceAfter).toBe(0);

    const { rows } = await admin.query<{ balance_credits: number; used_credits: number }>(
      `select balance_credits, used_credits from sales_wallets where id = $1::uuid`,
      [walletId],
    );
    expect(rows[0]?.balance_credits).toBe(0);
    // The ledger must stay internally consistent: exactly one spend recorded.
    expect(rows[0]?.used_credits).toBe(100);
  });

  it("holds a coupon total_usage_limit under concurrent redemption", async () => {
    await admin.query(
      `insert into sales_coupons (
         id, tenant_id, code, name, status, discount_type, discount_value, currency,
         total_usage_limit, per_learner_limit, created_by_membership_id, updated_at
       ) values ($1::uuid, $2::uuid, 'CONCTEST', 'conc', 'ACTIVE', 'PERCENT', 100, 'INR', 1, 1, $3::uuid, now())`,
      [couponId, tenantId, creatorId],
    );

    async function attemptRedemption() {
      const redeemer = randomUUID();
      await admin.query(
        `insert into memberships (id, tenant_id, status, updated_at)
         values ($1::uuid, $2::uuid, 'ACTIVE', now())`,
        [redeemer, tenantId],
      );

      return withTenantTx(tenantCtx(), async (tx) => {
        const limits = await salesCouponsRepository.lockCouponForRedemption(tx, {
          couponId,
          membershipId: redeemer,
        });
        if (!limits) return "NO_COUPON";
        if (limits.totalUsageLimit != null && limits.totalRedemptions >= limits.totalUsageLimit) {
          return "REJECTED";
        }
        if (limits.memberRedemptions >= limits.perLearnerLimit) return "REJECTED";

        await salesCouponsRepository.insertRedemption(tx, {
          couponId,
          membershipId: redeemer,
          courseId: null,
          paymentOrderId: null,
          discountCents: 10_000,
          originalAmountCents: 10_000,
          finalAmountCents: 0,
          currency: "INR",
          codeSnapshot: "CONCTEST",
        });
        return "REDEEMED";
      });
    }

    const results = await Promise.all(Array.from({ length: 5 }, attemptRedemption));

    expect(results.filter((r) => r === "REDEEMED")).toHaveLength(1);

    const { rows } = await admin.query<{ n: number }>(
      `select count(*)::int as n from sales_coupon_redemptions where coupon_id = $1::uuid`,
      [couponId],
    );
    expect(rows[0]?.n).toBe(1);
  });
  it("holds a coupon per_learner_limit under concurrent redemption by one member", async () => {
    // The total_usage_limit case above uses a different member per attempt, so
    // it proves the total cap and says nothing about the per-learner cap. This
    // is the same C3 shape aimed at the other limit: one member, five
    // simultaneous redemptions, per_learner_limit = 1 and no total cap.
    //
    // Worth stating why there is no unique index behind this. Phase 1.3
    // prescribed
    //   create unique index ... on (tenant_id, coupon_id, membership_id)
    // which would be wrong for this schema: per_learner_limit is an integer that
    // may exceed 1, and a unique index would cap every coupon at one redemption
    // per learner regardless of configuration. The row lock on sales_coupons --
    // also prescribed by 1.3 -- is what serialises these, and this test is the
    // evidence that it does.
    await admin.query(
      `insert into sales_coupons (
         id, tenant_id, code, name, status, discount_type, discount_value, currency,
         total_usage_limit, per_learner_limit, created_by_membership_id, updated_at
       ) values ($1::uuid, $2::uuid, 'PERLEARNER', 'per-learner', 'ACTIVE', 'PERCENT', 100, 'INR', null, 1, $3::uuid, now())`,
      [perLearnerCouponId, tenantId, creatorId],
    );

    const redeemer = randomUUID();
    await admin.query(
      `insert into memberships (id, tenant_id, status, updated_at)
       values ($1::uuid, $2::uuid, 'ACTIVE', now())`,
      [redeemer, tenantId],
    );

    async function attempt() {
      return withTenantTx(tenantCtx(), async (tx) => {
        const limits = await salesCouponsRepository.lockCouponForRedemption(tx, {
          couponId: perLearnerCouponId,
          membershipId: redeemer,
        });
        if (!limits) return "NO_COUPON";
        if (limits.totalUsageLimit != null && limits.totalRedemptions >= limits.totalUsageLimit) {
          return "REJECTED";
        }
        if (limits.memberRedemptions >= limits.perLearnerLimit) return "REJECTED";

        await salesCouponsRepository.insertRedemption(tx, {
          couponId: perLearnerCouponId,
          membershipId: redeemer,
          courseId: null,
          paymentOrderId: null,
          discountCents: 10_000,
          originalAmountCents: 10_000,
          finalAmountCents: 0,
          currency: "INR",
          codeSnapshot: "PERLEARNER",
        });
        return "REDEEMED";
      });
    }

    const results = await Promise.all(Array.from({ length: 5 }, attempt));
    expect(results.filter((r) => r === "REDEEMED")).toHaveLength(1);

    const { rows } = await admin.query<{ n: number }>(
      `select count(*)::int as n
         from sales_coupon_redemptions
        where coupon_id = $1::uuid and membership_id = $2::uuid`,
      [perLearnerCouponId, redeemer],
    );
    expect(rows[0]?.n).toBe(1);
  });
});
