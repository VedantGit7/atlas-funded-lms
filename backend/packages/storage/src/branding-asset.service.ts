import type { TenantTx } from "@atlas/db";
import { createSignedUpload } from "./signed-upload";

export async function createBrandingAssetUpload(
  tx: TenantTx,
  ctx: {
    tenantId: string;
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
  return createSignedUpload(tx, ctx, {
    purpose: input.purpose,
    resourceType: "tenant_branding",
    resourceId: ctx.tenantId,
    fileName: input.fileName,
    contentType: input.contentType,
    sizeBytes: input.sizeBytes,
    checksumSha256: input.checksumSha256 ?? null,
    visibility: input.visibility ?? "public-safe",
  });
}
