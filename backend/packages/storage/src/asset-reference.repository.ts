import type { TenantTx } from "@atlas/db";
import type { CreateAssetReferenceInput } from "./schemas/asset-reference";
import type { AssetPurpose, AssetStatus, AssetVisibility } from "./schemas/storage-policy";

export type StorageReferenceRow = {
  id: string;
  tenant_id: string;
  bucket: string;
  object_key: string;
  purpose: AssetPurpose;
  resource_type: string;
  resource_id: string | null;
  file_name: string;
  content_type: string;
  size_bytes: bigint | number;
  checksum_sha256: string | null;
  visibility: AssetVisibility;
  status: AssetStatus;
  created_at: Date;
  updated_at: Date;
  deleted_at?: Date | null;
};

export async function insertPendingAssetReference(
  tx: TenantTx,
  input: CreateAssetReferenceInput & {
    tenantId: string;
    bucket: string;
    key: string;
  },
): Promise<StorageReferenceRow> {
  const rows = await tx.$queryRaw<StorageReferenceRow[]>`
    INSERT INTO storage_references (
      tenant_id,
      bucket,
      object_key,
      purpose,
      resource_type,
      resource_id,
      file_name,
      content_type,
      size_bytes,
      checksum_sha256,
      visibility,
      status
    )
    VALUES (
      ${input.tenantId},
      ${input.bucket},
      ${input.key},
      ${input.purpose},
      ${input.resourceType},
      ${input.resourceId},
      ${input.fileName},
      ${input.contentType},
      ${input.sizeBytes},
      ${input.checksumSha256 ?? null},
      ${input.visibility},
      'PENDING_UPLOAD'
    )
    RETURNING *
  `;

  const row = rows[0];
  if (!row) {
    throw new Error("ASSET_REFERENCE_NOT_FOUND");
  }

  return row;
}

export async function updatePendingAssetReferenceSizeBytes(
  tx: TenantTx,
  assetReferenceId: string,
  sizeBytes: number,
): Promise<void> {
  await tx.$queryRaw`
    UPDATE storage_references
    SET size_bytes = ${sizeBytes},
        updated_at = now()
    WHERE id = ${assetReferenceId}
      AND tenant_id = app.current_tenant_id()
      AND status = 'PENDING_UPLOAD'
  `;
}

/** A member's confirmed avatar images, newest first. */
export async function listMemberAvatarReferences(
  tx: TenantTx,
  membershipId: string,
): Promise<Array<{ id: string; bucket: string; object_key: string }>> {
  return tx.$queryRaw<Array<{ id: string; bucket: string; object_key: string }>>`
    SELECT id::text, bucket, object_key
    FROM storage_references
    WHERE tenant_id = app.current_tenant_id()
      AND purpose = 'member.avatar'
      AND resource_type = 'member_profile'
      AND resource_id = ${membershipId}::uuid
      AND status = 'READY'
    ORDER BY created_at DESC
  `;
}

/** A confirmed, public-safe avatar image of the current tenant, or null. */
export async function findReadyMemberAvatar(
  tx: TenantTx,
  assetReferenceId: string,
): Promise<StorageReferenceRow | null> {
  const rows = await tx.$queryRaw<StorageReferenceRow[]>`
    SELECT *
    FROM storage_references
    WHERE id = ${assetReferenceId}::uuid
      AND tenant_id = app.current_tenant_id()
      AND purpose = 'member.avatar'
      AND visibility = 'public-safe'
      AND status = 'READY'
    LIMIT 1
  `;
  return rows[0] ?? null;
}

/**
 * Uploads that were signed but never confirmed, older than `before`. A signed
 * upload URL lasts minutes, so these will never complete.
 */
export async function listAbandonedPendingUploads(
  tx: TenantTx,
  input: { before: Date; limit: number },
): Promise<Array<{ id: string; bucket: string; object_key: string }>> {
  return tx.$queryRaw<Array<{ id: string; bucket: string; object_key: string }>>`
    SELECT id::text, bucket, object_key
    FROM storage_references
    WHERE tenant_id = app.current_tenant_id()
      AND status = 'PENDING_UPLOAD'
      AND created_at < ${input.before}
    ORDER BY created_at
    LIMIT ${input.limit}
  `;
}

/** Marks abandoned uploads deleted, once their objects are gone. */
export async function markAbandonedUploadsDeleted(tx: TenantTx, ids: string[]): Promise<number> {
  if (ids.length === 0) return 0;
  return tx.$executeRaw`
    UPDATE storage_references
    SET status = 'DELETED',
        deleted_at = now(),
        updated_at = now()
    WHERE id = ANY(${ids}::uuid[])
      AND tenant_id = app.current_tenant_id()
      AND status = 'PENDING_UPLOAD'
  `;
}

export async function findAssetReferenceById(
  tx: TenantTx,
  assetReferenceId: string,
): Promise<StorageReferenceRow | null> {
  const rows = await tx.$queryRaw<StorageReferenceRow[]>`
    SELECT *
    FROM storage_references
    WHERE id = ${assetReferenceId}
      AND tenant_id = app.current_tenant_id()
      AND status <> 'DELETED'
    LIMIT 1
  `;

  return rows[0] ?? null;
}

export async function markAssetReferenceReady(
  tx: TenantTx,
  input: {
    assetReferenceId: string;
    checksumSha256?: string | null;
  },
): Promise<StorageReferenceRow | null> {
  const rows = await tx.$queryRaw<StorageReferenceRow[]>`
    UPDATE storage_references
    SET status = 'READY',
        checksum_sha256 = COALESCE(${input.checksumSha256 ?? null}, checksum_sha256),
        updated_at = now()
    WHERE id = ${input.assetReferenceId}
      AND tenant_id = app.current_tenant_id()
      AND status = 'PENDING_UPLOAD'
    RETURNING *
  `;

  return rows[0] ?? null;
}

export async function softDeleteAssetReference(
  tx: TenantTx,
  assetReferenceId: string,
): Promise<StorageReferenceRow | null> {
  const rows = await tx.$queryRaw<StorageReferenceRow[]>`
    UPDATE storage_references
    SET status = 'DELETED',
        deleted_at = now(),
        updated_at = now()
    WHERE id = ${assetReferenceId}
      AND tenant_id = app.current_tenant_id()
      AND status <> 'DELETED'
    RETURNING *
  `;

  return rows[0] ?? null;
}
