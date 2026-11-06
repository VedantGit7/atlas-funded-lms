import type { TenantTx } from "@atlas/db";
import { createSignedUpload } from "./signed-upload";
import { confirmAssetUpload, deleteAssetReference } from "./asset-reference.service";
import {
  findAssetReferenceById,
  findReadyMemberAvatar,
  listMemberAvatarReferences,
  softDeleteAssetReference,
} from "./asset-reference.repository";
import { getStorageProvider } from "./providers/storage-provider-factory";
import type { StorageProvider } from "./providers/storage-provider";
import { buildPublicSafeAssetUrl } from "./branding-public-url";
import { isInlineSafeContentType } from "./content-disposition";
import { parseStorageEnv } from "./schemas/storage-env";

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

/**
 * The avatar's lasting address: an app route that redirects to a short-lived
 * signed URL. Stored in the profile like any avatar URL, so every place that
 * shows avatars works unchanged. Used when there's no public R2 endpoint
 * (`R2_PUBLIC_ENDPOINT`); without it, avatars had no address and never showed
 * (launch plan 5.1, staging, 6 November 2026).
 */
export function memberAvatarPath(assetReferenceId: string): string {
  return `/api/v1/public/avatars/${assetReferenceId}`;
}

/**
 * Confirms the member's own uploaded avatar and retires the ones it replaces:
 * their objects are deleted and their references marked deleted.
 */
export async function confirmMemberAvatarUpload(
  tx: TenantTx,
  ctx: { tenantId: string },
  input: { assetReferenceId: string; membershipId: string },
): Promise<{ avatarUrl: string }> {
  const pending = await findAssetReferenceById(tx, input.assetReferenceId);
  if (
    !pending ||
    pending.purpose !== "member.avatar" ||
    pending.resource_id !== input.membershipId
  ) {
    throw new Error("ASSET_REFERENCE_NOT_FOUND");
  }

  const provider = getStorageProvider();
  const confirmed = await confirmAssetUpload(tx, provider, ctx, {
    assetReferenceId: input.assetReferenceId,
  });
  await retireMemberAvatars(tx, provider, {
    membershipId: input.membershipId,
    keepAssetReferenceId: confirmed.data.id,
  });

  const avatarUrl =
    buildPublicSafeAssetUrl({ bucket: confirmed.data.bucket, object_key: confirmed.data.key }) ??
    memberAvatarPath(confirmed.data.id);
  return { avatarUrl };
}

/**
 * Deletes a member's avatar images, except `keepAssetReferenceId`. Removing an
 * avatar used to clear only the profile link, so the photo stayed in storage.
 * A reference whose object can't be deleted stays as it is; nothing links to
 * it any more, and the next removal tries again.
 */
export async function retireMemberAvatars(
  tx: TenantTx,
  provider: StorageProvider,
  input: { membershipId: string; keepAssetReferenceId?: string },
): Promise<{ retired: number; failed: number }> {
  const avatars = await listMemberAvatarReferences(tx, input.membershipId);
  let retired = 0;
  let failed = 0;
  for (const avatar of avatars) {
    if (avatar.id === input.keepAssetReferenceId) continue;
    try {
      await provider.deleteObject({ bucket: avatar.bucket, key: avatar.object_key });
      await softDeleteAssetReference(tx, avatar.id);
      retired += 1;
    } catch {
      failed += 1;
    }
  }
  return { retired, failed };
}

/**
 * A short-lived signed URL for a confirmed avatar image of the current tenant,
 * or null. Only raster images are served: anything a browser would run or
 * render as a document isn't an avatar.
 */
export async function signMemberAvatarDownload(
  tx: TenantTx,
  assetReferenceId: string,
): Promise<string | null> {
  const avatar = await findReadyMemberAvatar(tx, assetReferenceId);
  if (!avatar || !isInlineSafeContentType(avatar.content_type)) return null;

  const signed = await getStorageProvider().createSignedDownloadUrl({
    bucket: avatar.bucket,
    key: avatar.object_key,
    expiresInSeconds: parseStorageEnv(process.env).STORAGE_SIGNED_DOWNLOAD_TTL_SECONDS,
    responseContentType: avatar.content_type,
  });
  return signed.url;
}

export async function deleteMemberAvatarAsset(
  tx: TenantTx,
  ctx: { tenantId: string },
  input: { assetReferenceId: string },
) {
  const provider = getStorageProvider();
  return deleteAssetReference(tx, provider, ctx, input);
}
