import { createTenantResourceRef } from "@atlas/authorization";
import { AtlasHttpError } from "@atlas/core/http/errors";
import type { TenantTx } from "@atlas/db";
import {
  isInstructorOfMember,
  isInstructorOfPathMember,
  membershipExists,
} from "./competency-projection.repository";

type LoaderCtx = {
  tenantId: string;
  actorMembershipId: string;
};

export function competencyMemberNotFound(): AtlasHttpError {
  return new AtlasHttpError({
    code: "PERMISSION_DENIED",
    status: 404,
    message: "Resource not found.",
  });
}

export function loadSelfCompetencyResourceRef(args: { ctx: LoaderCtx }) {
  return Promise.resolve(
    createTenantResourceRef({
      type: "competency_score",
      id: args.ctx.actorMembershipId,
      tenantId: args.ctx.tenantId,
      ownerMembershipId: args.ctx.actorMembershipId,
      relationships: {
        selfCompetencyScore: args.ctx.actorMembershipId,
      },
    }),
  );
}

export async function loadMemberCompetencyResourceRef(args: {
  tx: TenantTx;
  ctx: LoaderCtx;
  membershipId: string;
}) {
  const exists = await membershipExists({
    tx: args.tx,
    tenantId: args.ctx.tenantId,
    membershipId: args.membershipId,
  });

  if (!exists) {
    throw competencyMemberNotFound();
  }

  const relationships: Record<string, string | boolean> = {};

  if (args.membershipId === args.ctx.actorMembershipId) {
    relationships["selfCompetencyScore"] = args.ctx.actorMembershipId;
  }

  const instructorOfCourse = await isInstructorOfMember({
    tx: args.tx,
    instructorMembershipId: args.ctx.actorMembershipId,
    learnerMembershipId: args.membershipId,
  });

  if (instructorOfCourse) {
    relationships["instructorOfCourse"] = args.ctx.actorMembershipId;
  }

  const instructorOfPath = await isInstructorOfPathMember({
    tx: args.tx,
    instructorMembershipId: args.ctx.actorMembershipId,
    learnerMembershipId: args.membershipId,
  });

  if (instructorOfPath) {
    relationships["instructorOfPath"] = args.ctx.actorMembershipId;
  }

  return createTenantResourceRef({
    type: "competency_score",
    id: args.membershipId,
    tenantId: args.ctx.tenantId,
    ownerMembershipId: args.membershipId,
    relationships,
  });
}

export function loadCompetencySignalsCatalogResourceRef(args: { ctx: LoaderCtx }) {
  return Promise.resolve(
    createTenantResourceRef({
      type: "competency_signal_catalog",
      id: args.ctx.tenantId,
      tenantId: args.ctx.tenantId,
    }),
  );
}
