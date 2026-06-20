import { describe, expect, it } from "vitest";
import { withTenantTx } from "@atlas/db";
import { getMyGamificationProfile } from "../../apps/web/src/server/gamification/gamification.service";
import { gamificationRepository } from "../../apps/web/src/server/gamification/gamification.repository";
import { authoringTenantTx, createGamificationFixture } from "../fixtures/gamification-fixture";
import { createTenantIsolationFixture, tenantCtx } from "./tenant-isolation-fixture";

const describeWithDb =
  process.env["DATABASE_URL"] && process.env["PLATFORM_DATABASE_URL"] ? describe : describe.skip;

const GAMIFICATION_TABLES = [
  "gamification_profiles",
  "point_ledger",
  "badges",
  "badge_awards",
  "streak_states",
  "streak_freezes",
  "leaderboard_definitions",
  "leaderboard_snapshots",
] as const;

describeWithDb("gamification tenant isolation", () => {
  it("RLS filters gamification tables to current tenant", async () => {
    const fixture = await createGamificationFixture();
    const isolation = await createTenantIsolationFixture();

    await withTenantTx(authoringTenantTx(fixture, fixture.learnerMembershipId), async (tx) => {
      await gamificationRepository.insertProfile(tx, {
        tenantId: fixture.tenantId,
        membershipId: fixture.learnerMembershipId,
      });
    });

    for (const table of GAMIFICATION_TABLES) {
      const rows = await withTenantTx(tenantCtx(isolation.tenantA), async (tx) =>
        tx.$queryRawUnsafe<Array<{ tenant_id: string }>>(
          `select tenant_id::text from ${table} where tenant_id = $1::uuid`,
          fixture.tenantId,
        ),
      );

      expect(rows).toHaveLength(0);
    }
  });

  it("returns own profile only through service tenant context", async () => {
    const fixture = await createGamificationFixture();
    const isolation = await createTenantIsolationFixture();

    await withTenantTx(authoringTenantTx(fixture, fixture.learnerMembershipId), async (tx) => {
      await gamificationRepository.insertProfile(tx, {
        tenantId: fixture.tenantId,
        membershipId: fixture.learnerMembershipId,
      });
      await gamificationRepository.updateProfileXp(tx, {
        membershipId: fixture.learnerMembershipId,
        xpTotal: 42,
        levelKey: "level_1",
      });
    });

    const foreignProfile = await withTenantTx(tenantCtx(isolation.tenantB), async (tx) =>
      getMyGamificationProfile(tx, {
        tenantId: isolation.tenantB.tenantId,
        actorMembershipId: isolation.tenantB.membershipId,
        requestId: "iso_profile",
      }),
    );

    expect(foreignProfile.data.xpTotal).toBe(0);
  });
});
