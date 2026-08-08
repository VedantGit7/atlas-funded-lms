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
