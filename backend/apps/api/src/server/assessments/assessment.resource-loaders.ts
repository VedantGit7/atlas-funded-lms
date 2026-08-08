import { createTenantResourceRef } from "@atlas/authorization";
import type { TenantTx } from "@atlas/db";
import { assessmentsRepository, readCreatedByMembershipId } from "./assessments.repository";
import { assessmentNotFound } from "./assessments.errors";

type LoaderCtx = {
  tenantId: string;
  actorMembershipId: string;
};

export async function loadAssessmentResourceRef(args: {
  tx: TenantTx;
  ctx: LoaderCtx;
  assessmentId: string;
  requirePublished?: boolean;
}) {
  const assessment = await assessmentsRepository.findById(args.tx, args.assessmentId);

  if (!assessment || assessment.tenant_id !== args.ctx.tenantId) {
    throw assessmentNotFound();
  }

  if (args.requirePublished === true && assessment.status !== "PUBLISHED") {
    throw assessmentNotFound();
  }

  const ownerMembershipId = readCreatedByMembershipId(assessment.config_json);
  const relationships: Record<string, boolean | string> = {};

  if (assessment.status === "PUBLISHED") {
    relationships["publishedLearnerVisible"] = true;
  }

  if (ownerMembershipId === args.ctx.actorMembershipId) {
    relationships["assessmentAuthor"] = args.ctx.actorMembershipId;
  }

  return createTenantResourceRef({
    type: "assessment",
    id: assessment.id,
    tenantId: args.ctx.tenantId,
    ownerMembershipId,
    relationships,
  });
}

export function loadAssessmentCatalogResourceRef(args: { ctx: LoaderCtx }) {
  return Promise.resolve(
    createTenantResourceRef({
      type: "assessment",
      id: args.ctx.tenantId,
      tenantId: args.ctx.tenantId,
    }),
  );
}

export function loadAssessmentCreateResourceRef(args: { ctx: LoaderCtx }) {
  return Promise.resolve(
    createTenantResourceRef({
      type: "assessment",
      id: args.ctx.tenantId,
      tenantId: args.ctx.tenantId,
    }),
  );
}
