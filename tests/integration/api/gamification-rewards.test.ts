import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { withTenantTx } from "@atlas/db";
import { processGamificationSourceEvent } from "../../../backend/apps/api/src/server/gamification/gamification.service";
import {
  getMyRewards,
  getRewardsAdmin,
  listRedemptionLog,
  mutateRewards,
  redeemReward,
  updateRewardItem,
} from "../../../backend/apps/api/src/server/gamification/rewards.service";
import {
  adminCtx,
  authoringTenantTx,
  createGamificationFixture,
  learnerCtx,
  type GamificationFixture,
} from "../../fixtures/gamification-fixture";

const describeWithDb =
  process.env["DATABASE_URL"] && process.env["PLATFORM_DATABASE_URL"] ? describe : describe.skip;

async function seedCoins(fixture: GamificationFixture, xpPerCoin: number | null = null) {
  const admin = adminCtx(fixture, "req_rewards_seed");
  await withTenantTx(authoringTenantTx(fixture, fixture.adminMembershipId), async (tx) =>
    mutateRewards(tx, admin, {
      operation: "upsert_currency",
      currency: {
        key: "coins",
        name: "Coins",
        symbol: "🪙",
        earnRules: xpPerCoin ? { xpPerCoin } : null,
      },
    }),
  );
  return admin;
}

describeWithDb("gamification rewards shop", () => {
  it("manages currencies and catalog with duplicate-key rejection", async () => {
    const fixture = await createGamificationFixture();
    const admin = await seedCoins(fixture);

    const created = await withTenantTx(
      authoringTenantTx(fixture, fixture.adminMembershipId),
      async (tx) =>
        mutateRewards(tx, admin, {
          operation: "create_item",
          item: {
            key: "discount-10",
            name: "10% Discount",
            costCurrencyKey: "coins",
            costAmount: 50,
            rewardType: "DISCOUNT_CODE",
            rewardPayload: { code: "SAVE10" },
            status: "ACTIVE",
          },
        }),
    );
    expect(created.data.item?.key).toBe("discount-10");

    await expect(
      withTenantTx(authoringTenantTx(fixture, fixture.adminMembershipId), async (tx) =>
        mutateRewards(tx, admin, {
          operation: "create_item",
          item: {
            key: "discount-10",
            name: "Duplicate",
            costCurrencyKey: "coins",
            costAmount: 10,
            rewardType: "CUSTOM",
            rewardPayload: {},
            status: "ACTIVE",
          },
        }),
      ),
    ).rejects.toThrow(/already exists/i);

    const itemId = created.data.item?.id ?? "";
    const updated = await withTenantTx(
      authoringTenantTx(fixture, fixture.adminMembershipId),
      async (tx) => updateRewardItem(tx, admin, { id: itemId, costAmount: 75, stock: 5 }),
    );
    expect(updated.data.item?.costAmount).toBe(75);
    expect(updated.data.item?.stock).toBe(5);

    const adminView = await withTenantTx(
      authoringTenantTx(fixture, fixture.adminMembershipId),
      async (tx) => getRewardsAdmin(tx),
    );
    expect(adminView.data.currencies).toHaveLength(1);
    expect(adminView.data.items).toHaveLength(1);
  });

  it("credits currency from XP accrual idempotently", async () => {
    const fixture = await createGamificationFixture();
    await seedCoins(fixture, 4); // 1 coin per 4 XP
    const learner = learnerCtx(fixture, "req_coin_earn");

    const event = {
      id: randomUUID(),
      eventType: "practice.session_completed",
      payload: {
        practiceSessionId: randomUUID(),
        membershipId: fixture.learnerMembershipId,
        collectionId: null,
        sessionType: "due",
      },
    };

    await withTenantTx(authoringTenantTx(fixture, fixture.learnerMembershipId), async (tx) =>
      processGamificationSourceEvent(tx, learner, event),
    );
    // Replay: no double credit.
    await withTenantTx(authoringTenantTx(fixture, fixture.learnerMembershipId), async (tx) =>
      processGamificationSourceEvent(tx, learner, event),
    );

    const mine = await withTenantTx(
      authoringTenantTx(fixture, fixture.learnerMembershipId),
      async (tx) => getMyRewards(tx, learner),
    );

    // 8 XP practice event → floor(8/4) = 2 coins.
    expect(mine.data.balances.find((b) => b.currencyKey === "coins")?.balance).toBe(2);
  });

  it("redeems rewards atomically with stock, fulfillment, and audit trail", async () => {
    const fixture = await createGamificationFixture();
    const admin = await seedCoins(fixture);
    const learner = learnerCtx(fixture, "req_redeem");

    await withTenantTx(authoringTenantTx(fixture, fixture.adminMembershipId), async (tx) =>
      mutateRewards(tx, admin, {
        operation: "grant_balance",
        membershipId: fixture.learnerMembershipId,
        currencyKey: "coins",
        amount: 100,
        reason: "Test grant",
      }),
    );

    const discount = await withTenantTx(
      authoringTenantTx(fixture, fixture.adminMembershipId),
      async (tx) =>
        mutateRewards(tx, admin, {
          operation: "create_item",
          item: {
            key: "discount",
            name: "Discount Code",
            costCurrencyKey: "coins",
            costAmount: 60,
            rewardType: "DISCOUNT_CODE",
            rewardPayload: { code: "SAVE20" },
            stock: 1,
            status: "ACTIVE",
          },
        }),
    );
    const unlock = await withTenantTx(
      authoringTenantTx(fixture, fixture.adminMembershipId),
      async (tx) =>
        mutateRewards(tx, admin, {
          operation: "create_item",
          item: {
            key: "course-unlock",
            name: "Course Unlock",
            costCurrencyKey: "coins",
            costAmount: 20,
            rewardType: "CONTENT_UNLOCK",
            rewardPayload: { courseId: fixture.draftCourseId },
            status: "ACTIVE",
          },
        }),
    );
    const custom = await withTenantTx(
      authoringTenantTx(fixture, fixture.adminMembershipId),
      async (tx) =>
        mutateRewards(tx, admin, {
          operation: "create_item",
          item: {
            key: "coaching-call",
            name: "Coaching Call",
            costCurrencyKey: "coins",
            costAmount: 10,
            rewardType: "CUSTOM",
            rewardPayload: { note: "Book via support" },
            status: "ACTIVE",
          },
        }),
    );

    // DISCOUNT_CODE: auto-fulfilled, code returned, stock decremented.
    const redeemed = await withTenantTx(
      authoringTenantTx(fixture, fixture.learnerMembershipId),
      async (tx) => redeemReward(tx, learner, { rewardItemId: discount.data.item?.id ?? "" }),
    );
    expect(redeemed.data.status).toBe("fulfilled");
    expect(redeemed.data.code).toBe("SAVE20");
    expect(redeemed.data.balance).toBe(40);

    // Stock exhausted: second redeem fails.
    await expect(
      withTenantTx(authoringTenantTx(fixture, fixture.learnerMembershipId), async (tx) =>
        redeemReward(tx, learner, { rewardItemId: discount.data.item?.id ?? "" }),
      ),
    ).rejects.toThrow(/out of stock/i);

    // CONTENT_UNLOCK: grants an enrollment.
    await withTenantTx(authoringTenantTx(fixture, fixture.learnerMembershipId), async (tx) =>
      redeemReward(tx, learner, { rewardItemId: unlock.data.item?.id ?? "" }),
    );
    const enrollment = await withTenantTx(
      authoringTenantTx(fixture, fixture.learnerMembershipId),
      async (tx) =>
        tx.$queryRaw<Array<{ count: number }>>`
          select count(*)::int as count from enrollments
          where course_id = ${fixture.draftCourseId}::uuid
            and membership_id = ${fixture.learnerMembershipId}::uuid
        `,
    );
    expect(enrollment[0]?.count).toBe(1);

    // CUSTOM: pending fulfillment, then admin fulfills.
    const pending = await withTenantTx(
      authoringTenantTx(fixture, fixture.learnerMembershipId),
      async (tx) => redeemReward(tx, learner, { rewardItemId: custom.data.item?.id ?? "" }),
    );
    expect(pending.data.status).toBe("pending_fulfillment");
    expect(pending.data.balance).toBe(10);

    await withTenantTx(authoringTenantTx(fixture, fixture.adminMembershipId), async (tx) =>
      mutateRewards(tx, admin, {
        operation: "fulfill_redemption",
        redemptionId: pending.data.redemptionId,
      }),
    );

    // Insufficient funds: only 10 coins left, custom item costs 10... grant nothing and try discount-priced item.
    await expect(
      withTenantTx(authoringTenantTx(fixture, fixture.learnerMembershipId), async (tx) =>
        redeemReward(tx, learner, { rewardItemId: unlock.data.item?.id ?? "" }),
      ),
    ).rejects.toThrow(/insufficient/i);

    // Redemption log with member labels and statuses.
    const log = await withTenantTx(
      authoringTenantTx(fixture, fixture.adminMembershipId),
      async (tx) => listRedemptionLog(tx, { limit: 10 }),
    );
    expect(log.data.items).toHaveLength(3);
    expect(log.data.items.every((item) => item.memberLabel.length > 0)).toBe(true);
    expect(log.data.items.find((item) => item.rewardName === "Coaching Call")?.status).toBe(
      "fulfilled",
    );

    // reward.redeemed outbox events.
    const outboxCount = await withTenantTx(
      authoringTenantTx(fixture, fixture.learnerMembershipId),
      async (tx) =>
        tx.$queryRaw<Array<{ count: number }>>`
          select count(*)::int as count from outbox_events where event_type = 'reward.redeemed'
        `,
    );
    expect(outboxCount[0]?.count).toBe(3);

    // Learner view shows history.
    const mine = await withTenantTx(
      authoringTenantTx(fixture, fixture.learnerMembershipId),
      async (tx) => getMyRewards(tx, learner),
    );
    expect(mine.data.redemptions).toHaveLength(3);
  });
});
