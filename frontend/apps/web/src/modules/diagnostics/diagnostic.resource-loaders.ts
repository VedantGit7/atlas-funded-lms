import { createTenantResourceRef } from "@atlas/authorization";
import type { TenantTx } from "@atlas/db";
import { AtlasHttpError } from "@atlas/core/http/errors";
import { diagnosticRepository } from "./diagnostic.repository";

type LoaderCtx = {
  tenantId: string;
  actorMembershipId: string;
};

export function diagnosticNotFound(): AtlasHttpError {
  return new AtlasHttpError({
    code: "PERMISSION_DENIED",
    status: 404,
    message: "Diagnostic session not found or access denied.",
  });
}

export function diagnosticUnavailable(): AtlasHttpError {
  return new AtlasHttpError({
    code: "INTERNAL_ERROR",
    status: 503,
    message: "Diagnostic is not available for this academy.",
  });
}

export async function loadPublishedDiagnosticAssessmentResourceRef(args: {
  tx: TenantTx;
  ctx: LoaderCtx;
}) {
  const assessment = await diagnosticRepository.findPublishedDiagnosticAssessment(
    args.tx,
    args.ctx.tenantId,
  );

  if (!assessment) {
    throw diagnosticUnavailable();
  }

  return createTenantResourceRef({
    type: "diagnostic_session",
    id: assessment.id,
    tenantId: args.ctx.tenantId,
    relationships: {
      publishedLearnerVisible: true,
    },
  });
}

export async function loadDiagnosticSessionResourceRef(args: {
  tx: TenantTx;
  ctx: LoaderCtx;
  sessionId: string;
}) {
  const session = await diagnosticRepository.findById(args.tx, args.sessionId);

  if (!session || session.tenant_id !== args.ctx.tenantId) {
    throw diagnosticNotFound();
  }

  const relationships: Record<string, boolean | string> = {};

  if (session.membership_id === args.ctx.actorMembershipId) {
    relationships["selfDiagnosticSession"] = args.ctx.actorMembershipId;
  }

  return createTenantResourceRef({
    type: "diagnostic_session",
    id: session.id,
    tenantId: args.ctx.tenantId,
    ownerMembershipId: session.membership_id,
    relationships,
  });
}
