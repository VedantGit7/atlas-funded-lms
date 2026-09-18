// Poisons this module for any client bundle. Audit finding M9: nothing at the
// language level stopped a server module being pulled into a client component,
// so a leak of service code -- and whatever secrets or privileged queries it
// closes over -- would only have shown up as a runtime surprise.
import "server-only";

import { createTenantResourceRef } from "@atlas/authorization";
import type { TenantTx } from "@atlas/db";
import { practiceRepository } from "./practice.repository";
import { practiceSessionNotFound } from "./practice.errors";

type LoaderCtx = {
  tenantId: string;
  actorMembershipId: string;
};

export function loadSelfPracticeResourceRef(args: { ctx: LoaderCtx }) {
  return Promise.resolve(
    createTenantResourceRef({
      type: "practice_session",
      id: args.ctx.actorMembershipId,
      tenantId: args.ctx.tenantId,
      ownerMembershipId: args.ctx.actorMembershipId,
      relationships: {
        selfSrsState: args.ctx.actorMembershipId,
        selfPracticeSession: args.ctx.actorMembershipId,
      },
    }),
  );
}

export async function loadPracticeSessionResourceRef(args: {
  tx: TenantTx;
  ctx: LoaderCtx;
  sessionId: string;
}) {
  const session = await practiceRepository.findById(args.tx, args.sessionId);

  if (!session || session.tenant_id !== args.ctx.tenantId) {
    throw practiceSessionNotFound();
  }

  const relationships: Record<string, boolean | string> = {};

  if (session.membership_id === args.ctx.actorMembershipId) {
    relationships["selfPracticeSession"] = args.ctx.actorMembershipId;
  }

  return createTenantResourceRef({
    type: "practice_session",
    id: session.id,
    tenantId: args.ctx.tenantId,
    ownerMembershipId: session.membership_id,
    relationships,
  });
}
