// Poisons this module for any client bundle. Audit finding M9: nothing at the
// language level stopped a server module being pulled into a client component,
// so a leak of service code -- and whatever secrets or privileged queries it
// closes over -- would only have shown up as a runtime surprise.
import "server-only";

import { createTenantResourceRef } from "@atlas/authorization";
import type { TenantTx } from "@atlas/db";
import { AtlasHttpError } from "@atlas/core/http/errors";
import { findReadinessPolicy } from "./readiness.repository";

type LoaderCtx = {
  tenantId: string;
  actorMembershipId: string;
};

export function readinessPolicyNotFound(): AtlasHttpError {
  return new AtlasHttpError({
    code: "PERMISSION_DENIED",
    status: 404,
    message: "Readiness policy not found or access denied.",
  });
}

export async function loadReadinessPolicyResourceRef(args: { ctx: LoaderCtx }) {
  return Promise.resolve(
    createTenantResourceRef({
      type: "readiness_policy",
      id: args.ctx.tenantId,
      tenantId: args.ctx.tenantId,
    }),
  );
}

export async function loadReadinessPolicyRecordResourceRef(args: { tx: TenantTx; ctx: LoaderCtx }) {
  const policy = await findReadinessPolicy({ tx: args.tx });
  if (!policy) throw readinessPolicyNotFound();

  return createTenantResourceRef({
    type: "readiness_policy",
    id: policy.id,
    tenantId: args.ctx.tenantId,
  });
}

export async function loadSelfAttributionResourceRef(args: { ctx: LoaderCtx }) {
  return Promise.resolve(
    createTenantResourceRef({
      type: "readiness_policy",
      id: args.ctx.tenantId,
      tenantId: args.ctx.tenantId,
      ownerMembershipId: args.ctx.actorMembershipId,
      relationships: {
        selfReadinessPolicy: args.ctx.actorMembershipId,
      },
    }),
  );
}
