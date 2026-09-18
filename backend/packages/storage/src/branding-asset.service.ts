import type { TenantTx } from "@atlas/db";
import { auditWriter } from "@atlas/audit";
import { createSignedUpload } from "./signed-upload";

export async function createBrandingAssetUpload(
  tx: TenantTx,
  ctx: {
    tenantId: string;
    actorMembershipId?: string | null;
    requestId?: string;
  },
  input: {
    purpose: "branding.logo" | "branding.favicon" | "branding.og-image";
    fileName: string;
    contentType: string;
    sizeBytes: number;
    checksumSha256?: string | null;
    visibility?: "public-safe" | "private";
  },
) {
  const upload = await createSignedUpload(tx, ctx, {
    purpose: input.purpose,
    resourceType: "tenant_branding",
    resourceId: ctx.tenantId,
    fileName: input.fileName,
    contentType: input.contentType,
    sizeBytes: input.sizeBytes,
    checksumSha256: input.checksumSha256 ?? null,
    visibility: input.visibility ?? "public-safe",
  });

  // Issuing a signed upload URL is the point at which a tenant's public brand
  // assets can be replaced, so it is the event worth attributing. The write is
  // in the same transaction as the reference row, so a rolled-back upload
  // leaves no audit entry claiming one happened.
  await auditWriter.write(
    tx,
    {
      tenantId: ctx.tenantId,
      actorMembershipId: ctx.actorMembershipId ?? null,
      platformPrincipalId: null,
      requestId: ctx.requestId ?? "",
    },
    {
      action: "config.branding.asset_upload_requested",
      target: { type: "tenant_branding", id: ctx.tenantId },
      before: null,
      after: {
        purpose: input.purpose,
        fileName: input.fileName,
        contentType: input.contentType,
        sizeBytes: input.sizeBytes,
      },
      reason: null,
      metadata: {},
    },
  );

  return upload;
}
