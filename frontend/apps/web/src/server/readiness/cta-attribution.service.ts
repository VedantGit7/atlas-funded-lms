// Poisons this module for any client bundle. Audit finding M9: nothing at the
// language level stopped a server module being pulled into a client component,
// so a leak of service code -- and whatever secrets or privileged queries it
// closes over -- would only have shown up as a runtime surprise.
import "server-only";

import { createHash, randomBytes } from "node:crypto";
import type { TenantTx } from "@atlas/db";
import { auditWriter } from "@atlas/audit";
import { AtlasHttpError } from "@atlas/core/http/errors";
import {
  buildAttributionTokenPayload,
  buildOutboundUrl,
  type CreateAttributionTokenBody,
} from "./readiness.schemas";
import {
  findCompositeReadinessState,
  findReadinessPolicy,
  insertAttributionToken,
} from "./readiness.repository";
import { DEFAULT_COMPOSITE_KEY } from "./readiness.types";

type ServiceCtx = {
  tenantId: string;
  actorMembershipId: string;
  requestId: string;
};

function policyUnavailable(): AtlasHttpError {
  return new AtlasHttpError({
    code: "VALIDATION_ERROR",
    status: 409,
    message: "Readiness policy is not configured for this tenant.",
  });
}

function hashAttributionToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function mintAttributionTokenValue(): string {
  return randomBytes(32).toString("base64url");
}

export async function createAttributionToken(
  tx: TenantTx,
  ctx: ServiceCtx,
  input: CreateAttributionTokenBody,
) {
  const policy = await findReadinessPolicy({ tx });
  if (!policy || policy.status !== "ACTIVE") {
    throw policyUnavailable();
  }

  const composite = await findCompositeReadinessState({
    tx,
    membershipId: ctx.actorMembershipId,
    scoringProfileId: policy.scoringProfileId,
    compositeKey: DEFAULT_COMPOSITE_KEY,
  });

  const rawToken = mintAttributionTokenValue();
  const tokenHash = hashAttributionToken(rawToken);
  const expiresAt = new Date(Date.now() + policy.ctaPolicy.tokenTtlSeconds * 1000);
  const destinationUrl = policy.ctaPolicy.outboundTargetUrl;

  const metadataJson = buildAttributionTokenPayload({
    tokenId: "",
    tenantId: ctx.tenantId,
    membershipId: ctx.actorMembershipId,
    sourceSurface: input.sourceSurface,
    sourcePath: input.sourcePath,
    readinessBandKey: composite?.bandKey ?? null,
  });

  const inserted = await insertAttributionToken({
    tx,
    tenantId: ctx.tenantId,
    membershipId: ctx.actorMembershipId,
    tokenHash,
    destinationUrl,
    sourceSurface: input.sourceSurface,
    readinessBandKey: composite?.bandKey ?? null,
    metadataJson: {
      ...metadataJson,
      sourcePath: input.sourcePath,
    },
    expiresAt,
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
      action: "attribution.token_created",
      target: { type: "attribution_token", id: inserted.id },
      before: null,
      after: {
        id: inserted.id,
        sourceSurface: input.sourceSurface,
        sourcePath: input.sourcePath,
        destinationUrl,
        expiresAt: expiresAt.toISOString(),
        readinessBandKey: composite?.bandKey ?? null,
      },
      reason: null,
      metadata: {
        tokenHashPrefix: tokenHash.slice(0, 8),
      },
    },
  );

  return {
    data: {
      outboundUrl: buildOutboundUrl(destinationUrl, rawToken),
      expiresAt: expiresAt.toISOString(),
      tokenId: inserted.id,
    },
  };
}
