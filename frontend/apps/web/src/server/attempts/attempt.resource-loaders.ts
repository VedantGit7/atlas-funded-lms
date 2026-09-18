// Poisons this module for any client bundle. Audit finding M9: nothing at the
// language level stopped a server module being pulled into a client component,
// so a leak of service code -- and whatever secrets or privileged queries it
// closes over -- would only have shown up as a runtime surprise.
import "server-only";

import { createTenantResourceRef } from "@atlas/authorization";
import type { TenantTx } from "@atlas/db";
import { attemptsRepository } from "./attempts.repository";
import { attemptNotFound } from "./attempts.errors";

type LoaderCtx = {
  tenantId: string;
  actorMembershipId: string;
};

export async function loadAttemptResourceRef(args: {
  tx: TenantTx;
  ctx: LoaderCtx;
  attemptId: string;
}) {
  const attempt = await attemptsRepository.findById(args.tx, args.attemptId);

  if (!attempt || attempt.tenant_id !== args.ctx.tenantId) {
    throw attemptNotFound();
  }

  const relationships: Record<string, boolean | string> = {};

  if (attempt.membership_id === args.ctx.actorMembershipId) {
    relationships["selfAttempt"] = args.ctx.actorMembershipId;
  }

  return createTenantResourceRef({
    type: "attempt",
    id: attempt.id,
    tenantId: args.ctx.tenantId,
    ownerMembershipId: attempt.membership_id,
    relationships,
  });
}
