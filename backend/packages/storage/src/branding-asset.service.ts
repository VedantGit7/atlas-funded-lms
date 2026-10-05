import type { TenantTx } from "@atlas/db";
import { auditWriter } from "@atlas/audit";
import { createSignedUpload } from "./signed-upload";
import { confirmAssetUpload } from "./asset-reference.service";
import { findAssetReferenceById } from "./asset-reference.repository";
import { BRANDING_ASSET_PURPOSES, resolveBrandingAssetUrl } from "./branding-public-url";
import { getStorageProvider } from "./providers/storage-provider-factory";

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

/**
 * Finalize a branding upload (audit M8).
 *
 * Branding uploads used to have no confirm step at all: the reference stayed
 * PENDING_UPLOAD, so the bytes were never checked and the logo never resolved.
 * Now the stored object is checked against its declared type, an SVG is
 * sanitized, and only then does the reference become READY and usable.
 */
export async function confirmBrandingAssetUpload(
  tx: TenantTx,
  ctx: {
    tenantId: string;
    actorMembershipId?: string | null;
    requestId?: string;
  },
  input: { assetReferenceId: string },
) {
  const pending = await findAssetReferenceById(tx, input.assetReferenceId);
  if (!pending || !BRANDING_ASSET_PURPOSES.has(pending.purpose)) {
    throw new Error("ASSET_REFERENCE_NOT_FOUND");
  }

  const confirmed = await confirmAssetUpload(tx, getStorageProvider(), ctx, input);

  await auditWriter.write(
    tx,
    {
      tenantId: ctx.tenantId,
      actorMembershipId: ctx.actorMembershipId ?? null,
      platformPrincipalId: null,
      requestId: ctx.requestId ?? "",
    },
    {
      action: "config.branding.asset_uploaded",
      target: { type: "tenant_branding", id: ctx.tenantId },
      before: null,
      after: {
        assetReferenceId: confirmed.data.id,
        purpose: confirmed.data.purpose,
        contentType: confirmed.data.contentType,
        sizeBytes: confirmed.data.sizeBytes,
        checksumSha256: confirmed.data.checksumSha256,
      },
      reason: null,
      metadata: {},
    },
  );

  return {
    data: {
      asset: confirmed.data,
      url: await resolveBrandingAssetUrl(tx, ctx, confirmed.data.id),
    },
  };
}
