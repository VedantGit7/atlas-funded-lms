// Poisons this module for any client bundle. Audit finding M9: nothing at the
// language level stopped a server module being pulled into a client component,
// so a leak of service code -- and whatever secrets or privileged queries it
// closes over -- would only have shown up as a runtime surprise.
import "server-only";

import { randomUUID } from "node:crypto";

type Tx = {
  $queryRaw<T = unknown>(query: TemplateStringsArray, ...values: unknown[]): Promise<T>;
  $executeRaw(query: TemplateStringsArray, ...values: unknown[]): Promise<unknown>;
};

export type LessonAssetRow = {
  id: string;
  lessonId: string;
  assetType: string;
  provider: string;
  objectKeyOrUrl: string;
  metadataJson: Record<string, unknown> | null;
};

export async function listLessonAssets(args: {
  tx: Tx;
  lessonId: string;
}): Promise<LessonAssetRow[]> {
  const rows = await args.tx.$queryRaw<
    Array<{
      id: string;
      lesson_id: string;
      asset_type: string;
      provider: string;
      object_key_or_url: string;
      metadata_json: Record<string, unknown> | null;
    }>
  >`
    select
      id::text,
      lesson_id::text,
      asset_type,
      provider,
      object_key_or_url,
      metadata_json
    from lesson_assets
    where lesson_id = ${args.lessonId}::uuid
      and deleted_at is null
    order by coalesce((metadata_json->>'displayOrder')::int, 0) asc, created_at asc
  `;

  return rows.map((row) => ({
    id: row.id,
    lessonId: row.lesson_id,
    assetType: row.asset_type,
    provider: row.provider,
    objectKeyOrUrl: row.object_key_or_url,
    metadataJson: row.metadata_json,
  }));
}

export async function findLessonAssetById(args: {
  tx: Tx;
  assetId: string;
  lessonId: string;
}): Promise<LessonAssetRow | null> {
  const rows = await args.tx.$queryRaw<
    Array<{
      id: string;
      lesson_id: string;
      asset_type: string;
      provider: string;
      object_key_or_url: string;
      metadata_json: Record<string, unknown> | null;
    }>
  >`
    select
      id::text,
      lesson_id::text,
      asset_type,
      provider,
      object_key_or_url,
      metadata_json
    from lesson_assets
    where id = ${args.assetId}::uuid
      and lesson_id = ${args.lessonId}::uuid
      and deleted_at is null
    limit 1
  `;

  const row = rows[0];
  if (!row) return null;

  return {
    id: row.id,
    lessonId: row.lesson_id,
    assetType: row.asset_type,
    provider: row.provider,
    objectKeyOrUrl: row.object_key_or_url,
    metadataJson: row.metadata_json,
  };
}

export async function insertLessonAsset(args: {
  tx: Tx;
  tenantId: string;
  lessonId: string;
  assetType: string;
  provider: string;
  objectKeyOrUrl: string;
  metadataJson: Record<string, unknown> | null;
}): Promise<{ id: string }> {
  const assetId = randomUUID();

  await args.tx.$executeRaw`
    insert into lesson_assets (
      id,
      tenant_id,
      lesson_id,
      asset_type,
      provider,
      object_key_or_url,
      metadata_json,
      created_at
    )
    values (
      ${assetId}::uuid,
      ${args.tenantId}::uuid,
      ${args.lessonId}::uuid,
      ${args.assetType},
      ${args.provider},
      ${args.objectKeyOrUrl},
      ${args.metadataJson == null ? null : JSON.stringify(args.metadataJson)}::jsonb,
      now()
    )
  `;

  return { id: assetId };
}

export async function softDeleteLessonAsset(args: { tx: Tx; assetId: string }): Promise<void> {
  await args.tx.$executeRaw`
    update lesson_assets
    set deleted_at = now()
    where id = ${args.assetId}::uuid
      and deleted_at is null
  `;
}

export async function findStorageReferenceById(args: {
  tx: Tx;
  storageReferenceId: string;
}): Promise<{
  id: string;
  fileName: string;
  contentType: string;
  status: string;
  resourceId: string | null;
} | null> {
  const rows = await args.tx.$queryRaw<
    Array<{
      id: string;
      file_name: string;
      content_type: string;
      status: string;
      resource_id: string | null;
    }>
  >`
    select
      id::text,
      file_name,
      content_type,
      status::text,
      resource_id::text
    from storage_references
    where id = ${args.storageReferenceId}::uuid
      and deleted_at is null
    limit 1
  `;

  const row = rows[0];
  if (!row) return null;

  return {
    id: row.id,
    fileName: row.file_name,
    contentType: row.content_type,
    status: row.status,
    resourceId: row.resource_id,
  };
}
