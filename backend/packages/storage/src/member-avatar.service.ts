import type { TenantTx } from "@atlas/db";
import { createSignedUpload } from "./signed-upload";
import { confirmAssetUpload, deleteAssetReference } from "./asset-reference.service";
import { getStorageProvider } from "./providers/storage-provider-factory";
import { buildPublicSafeAssetUrl } from "./branding-public-url";

export async function createMemberAvatarUpload(
  tx: TenantTx,
  ctx: { tenantId: string },
  input: {
    membershipId: string;
    fileName: string;
    contentType: string;
    sizeBytes: number;
    checksumSha256?: string | null;
  },
) {
  return createSignedUpload(tx, ctx, {
    purpose: "member.avatar",
    resourceType: "member_profile",
    resourceId: input.membershipId,
    fileName: input.fileName,
    contentType: input.contentType,
    sizeBytes: input.sizeBytes,
    checksumSha256: input.checksumSha256 ?? null,
    visibility: "public-safe",
  });
}

export async function confirmMemberAvatarUpload(
  tx: TenantTx,
  ctx: { tenantId: string },
  input: { assetReferenceId: string },
): Promise<{ avatarUrl: string | null }> {
  const provider = getStorageProvider();
  const confirmed = await confirmAssetUpload(tx, provider, ctx, input);
  const avatarUrl = buildPublicSafeAssetUrl({
    bucket: confirmed.data.bucket,
    object_key: confirmed.data.key,
  });
  return { avatarUrl };
}

export async function deleteMemberAvatarAsset(
  tx: TenantTx,
  ctx: { tenantId: string },
  input: { assetReferenceId: string },
) {
  const provider = getStorageProvider();
  return deleteAssetReference(tx, provider, ctx, input);
}
