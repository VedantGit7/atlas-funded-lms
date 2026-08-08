import type { TenantTx } from "@atlas/db";
import { auditWriter } from "@atlas/audit";
import { AtlasHttpError } from "@atlas/core/http/errors";
import type { UpdateReadinessPolicyBody } from "./readiness.schemas";
import { updateReadinessPolicyBodySchema } from "./readiness.schemas";
import {
  findReadinessPolicy,
  scoringProfileExists,
  upsertReadinessPolicy,
} from "./readiness.repository";

type ServiceCtx = {
  tenantId: string;
  actorMembershipId: string;
  requestId: string;
};

function scoringProfileNotFound(): AtlasHttpError {
  return new AtlasHttpError({
    code: "VALIDATION_ERROR",
    status: 404,
    message: "Scoring profile not found.",
  });
}

export async function getReadinessPolicy(tx: TenantTx) {
  const policy = await findReadinessPolicy({ tx });
  return { data: policy };
}

export async function updateReadinessPolicy(
  tx: TenantTx,
  ctx: ServiceCtx,
  input: UpdateReadinessPolicyBody,
) {
  const validated = updateReadinessPolicyBodySchema.parse(input);
  const profileExists = await scoringProfileExists({ tx, profileId: validated.scoringProfileId });
  if (!profileExists) throw scoringProfileNotFound();

  const before = await findReadinessPolicy({ tx });

  const updated = await upsertReadinessPolicy({
    tx,
    tenantId: ctx.tenantId,
    scoringProfileId: validated.scoringProfileId,
    ctaPolicy: validated.ctaPolicy,
    legalCopy: validated.legalCopy,
    ...(validated.status != null ? { status: validated.status } : {}),
  });

  await auditWriter.write(
    tx,
    {
      tenantId: ctx.tenantId,
      actorMembershipId: ctx.actorMembershipId,
      platformPrincipalId: null,
      requestId: ctx.requestId,
    },
    {
      action: "readiness_policy.updated",
      target: { type: "readiness_policy", id: updated.id },
      before,
      after: updated,
      reason: null,
      metadata: {},
    },
  );

  return { data: updated };
}
