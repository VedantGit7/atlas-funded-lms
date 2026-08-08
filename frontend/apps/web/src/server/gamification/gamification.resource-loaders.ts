import { createTenantResourceRef } from "@atlas/authorization";
import type { TenantTx } from "@atlas/db";

type LoaderCtx = {
  tenantId: string;
  actorMembershipId: string;
};

export function loadSelfGamificationResourceRef(args: { ctx: LoaderCtx }) {
  return Promise.resolve(
    createTenantResourceRef({
      type: "gamification_profile",
      id: args.ctx.actorMembershipId,
      tenantId: args.ctx.tenantId,
      ownerMembershipId: args.ctx.actorMembershipId,
      relationships: {
        selfGamificationProfile: args.ctx.actorMembershipId,
      },
    }),
  );
}

export function loadBadgeCatalogResourceRef(args: { ctx: LoaderCtx }) {
  return Promise.resolve(
    createTenantResourceRef({
      type: "badge",
      id: args.ctx.tenantId,
      tenantId: args.ctx.tenantId,
    }),
  );
}

export function loadLeaderboardCatalogResourceRef(args: { ctx: LoaderCtx }) {
  return Promise.resolve(
    createTenantResourceRef({
      type: "leaderboard_definition",
      id: args.ctx.tenantId,
      tenantId: args.ctx.tenantId,
    }),
  );
}

export function loadLeaderboardDetailResourceRef(args: {
  tx: TenantTx;
  ctx: LoaderCtx;
  leaderboardId: string;
}) {
  return Promise.resolve(
    createTenantResourceRef({
      type: "leaderboard_definition",
      id: args.leaderboardId,
      tenantId: args.ctx.tenantId,
    }),
  );
}
