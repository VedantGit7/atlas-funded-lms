import type { TenantTx } from "@atlas/db";
import { roundGb } from "./resource-usage-roster.repository-helpers";

/**
 * Storage: the asset breakdown, top contributors and storage holders.
 * Part of resourceUsageRosterRepository.
 */
export const resourceUsageRosterStorageRepository = {
  async getStorageAssetBreakdown(
    tx: TenantTx,
  ): Promise<Array<{ key: string; label: string; storage_gb: number }>> {
    const rows = await tx.$queryRaw<Array<{ asset_key: string; storage_gb: number }>>`
      select
        case
          when lower(coalesce(purpose, '')) like '%backup%' then 'backups'
          when lower(coalesce(purpose, '')) like '%scorm%'
            or lower(coalesce(content_type, '')) like '%scorm%' then 'scorm'
          when content_type like 'video/%' then 'video'
          when content_type like 'audio/%' then 'audio'
          when content_type like 'image/%' then 'images'
          when content_type like 'application/pdf%'
            or content_type like 'text/%'
            or content_type like 'application/msword%'
            or content_type like 'application/vnd.openxmlformats%'
            or content_type like 'application/vnd.ms-%' then 'documents'
          else 'attachments'
        end as asset_key,
        coalesce(sum(size_bytes), 0)::float8 / 1e9 as storage_gb
      from storage_references
      where tenant_id = current_setting('app.tenant_id', true)::uuid
        and deleted_at is null
      group by 1
      having coalesce(sum(size_bytes), 0) > 0
      order by storage_gb desc
    `;

    const labels: Record<string, string> = {
      video: "Video",
      documents: "Documents",
      images: "Images",
      audio: "Audio",
      scorm: "SCORM",
      attachments: "Attachments",
      backups: "Backups",
    };

    return rows.map((row) => ({
      key: row.asset_key,
      label: labels[row.asset_key] ?? row.asset_key,
      storage_gb: roundGb(row.storage_gb),
    }));
  },

  async listTopStorageContributors(
    tx: TenantTx,
    limit = 10,
  ): Promise<
    Array<{
      course_id: string;
      title: string;
      storage_gb: number;
      updated_at: Date | null;
    }>
  > {
    const rows = await tx.$queryRaw<
      Array<{
        course_id: string;
        title: string;
        storage_gb: number;
        updated_at: Date | null;
      }>
    >`
      select
        c.id::text as course_id,
        c.title,
        c.updated_at,
        coalesce((
          select sum(sr.size_bytes)::float8 / 1e9
          from storage_references sr
          where sr.deleted_at is null
            and sr.tenant_id = c.tenant_id
            and (
              (sr.resource_type = 'course' and sr.resource_id = c.id)
              or (
                sr.resource_type = 'course_module'
                and sr.resource_id in (
                  select cm2.id from course_modules cm2
                  where cm2.course_id = c.id and cm2.tenant_id = c.tenant_id and cm2.deleted_at is null
                )
              )
              or (
                sr.resource_type = 'lesson'
                and sr.resource_id in (
                  select l2.id from lessons l2
                  join course_modules cm3 on cm3.id = l2.module_id and cm3.tenant_id = l2.tenant_id
                  where cm3.course_id = c.id and l2.tenant_id = c.tenant_id
                    and l2.deleted_at is null and cm3.deleted_at is null
                )
              )
            )
        ), 0) as storage_gb
      from courses c
      where c.tenant_id = current_setting('app.tenant_id', true)::uuid
        and c.deleted_at is null
      order by storage_gb desc, c.title asc
      limit ${limit}
    `;

    return rows
      .filter((row) => row.storage_gb > 0)
      .map((row) => ({
        course_id: row.course_id,
        title: row.title,
        storage_gb: roundGb(row.storage_gb),
        updated_at: row.updated_at,
      }));
  },

  async getStorageFileCount(tx: TenantTx): Promise<number> {
    const rows = await tx.$queryRaw<Array<{ count: bigint }>>`
      select count(*)::bigint as count
      from storage_references
      where tenant_id = current_setting('app.tenant_id', true)::uuid
        and deleted_at is null
    `;
    return Number(rows[0]?.count ?? 0);
  },

  async getStorageReclaimSignals(tx: TenantTx): Promise<{
    orphaned_gb: number;
    archived_gb: number;
  }> {
    const [orphanRows, archivedRows] = await Promise.all([
      tx.$queryRaw<Array<{ storage_gb: number }>>`
        select coalesce(sum(size_bytes), 0)::float8 / 1e9 as storage_gb
        from storage_references
        where tenant_id = current_setting('app.tenant_id', true)::uuid
          and deleted_at is null
          and resource_id is null
      `,
      tx.$queryRaw<Array<{ storage_gb: number }>>`
        select coalesce(sum(sr.size_bytes), 0)::float8 / 1e9 as storage_gb
        from storage_references sr
        join courses c
          on c.id = sr.resource_id
          and c.tenant_id = sr.tenant_id
          and c.deleted_at is null
        where sr.tenant_id = current_setting('app.tenant_id', true)::uuid
          and sr.deleted_at is null
          and sr.resource_type = 'course'
          and c.status = 'ARCHIVED'
      `,
    ]);
    return {
      orphaned_gb: roundGb(orphanRows[0]?.storage_gb ?? 0),
      archived_gb: roundGb(archivedRows[0]?.storage_gb ?? 0),
    };
  },

  async countStorageHolders(tx: TenantTx, assetType: string | null): Promise<number> {
    const rows = await tx.$queryRaw<Array<{ count: bigint }>>`
      with course_storage as (
        select
          c.id,
          coalesce((
            select sum(sr.size_bytes)::float8 / 1e9
            from storage_references sr
            where sr.deleted_at is null
              and sr.tenant_id = c.tenant_id
              and (
                ${assetType}::text is null
                or (
                  case
                    when lower(coalesce(sr.purpose, '')) like '%backup%' then 'backups'
                    when lower(coalesce(sr.purpose, '')) like '%scorm%'
                      or lower(coalesce(sr.content_type, '')) like '%scorm%' then 'scorm'
                    when sr.content_type like 'video/%' then 'video'
                    when sr.content_type like 'audio/%' then 'audio'
                    when sr.content_type like 'image/%' then 'images'
                    when sr.content_type like 'application/pdf%'
                      or sr.content_type like 'text/%'
                      or sr.content_type like 'application/msword%'
                      or sr.content_type like 'application/vnd.openxmlformats%'
                      or sr.content_type like 'application/vnd.ms-%' then 'documents'
                    else 'attachments'
                  end
                ) = ${assetType}
              )
              and (
                (sr.resource_type = 'course' and sr.resource_id = c.id)
                or (
                  sr.resource_type = 'course_module'
                  and sr.resource_id in (
                    select cm2.id from course_modules cm2
                    where cm2.course_id = c.id and cm2.tenant_id = c.tenant_id and cm2.deleted_at is null
                  )
                )
                or (
                  sr.resource_type = 'lesson'
                  and sr.resource_id in (
                    select l2.id from lessons l2
                    join course_modules cm3 on cm3.id = l2.module_id and cm3.tenant_id = l2.tenant_id
                    where cm3.course_id = c.id and l2.tenant_id = c.tenant_id
                      and l2.deleted_at is null and cm3.deleted_at is null
                  )
                )
              )
          ), 0) as storage_gb
        from courses c
        where c.tenant_id = current_setting('app.tenant_id', true)::uuid
          and c.deleted_at is null
      )
      select count(*)::bigint as count
      from course_storage
      where storage_gb > 0
    `;
    return Number(rows[0]?.count ?? 0);
  },

  async listStorageHolders(
    tx: TenantTx,
    args: {
      assetType: string | null;
      sort: "size_desc" | "files_desc" | "activity_asc" | "title_asc";
      page: number;
      limit: number;
    },
  ): Promise<
    Array<{
      course_id: string;
      title: string;
      status: string;
      storage_gb: number;
      file_count: number;
      last_learner_activity_at: Date | null;
      created_at: Date | null;
    }>
  > {
    const offset = (args.page - 1) * args.limit;
    const assetType = args.assetType;
    const sort = args.sort;
    const rows = await tx.$queryRaw<
      Array<{
        course_id: string;
        title: string;
        status: string;
        storage_gb: number;
        file_count: number;
        last_learner_activity_at: Date | null;
        created_at: Date | null;
      }>
    >`
      with course_storage as (
        select
          c.id as course_id,
          c.title,
          c.status::text as status,
          c.created_at,
          max(lp.last_seen_at) as last_learner_activity_at,
          coalesce((
            select sum(sr.size_bytes)::float8 / 1e9
            from storage_references sr
            where sr.deleted_at is null
              and sr.tenant_id = c.tenant_id
              and (
                ${assetType}::text is null
                or (
                  case
                    when lower(coalesce(sr.purpose, '')) like '%backup%' then 'backups'
                    when lower(coalesce(sr.purpose, '')) like '%scorm%'
                      or lower(coalesce(sr.content_type, '')) like '%scorm%' then 'scorm'
                    when sr.content_type like 'video/%' then 'video'
                    when sr.content_type like 'audio/%' then 'audio'
                    when sr.content_type like 'image/%' then 'images'
                    when sr.content_type like 'application/pdf%'
                      or sr.content_type like 'text/%'
                      or sr.content_type like 'application/msword%'
                      or sr.content_type like 'application/vnd.openxmlformats%'
                      or sr.content_type like 'application/vnd.ms-%' then 'documents'
                    else 'attachments'
                  end
                ) = ${assetType}
              )
              and (
                (sr.resource_type = 'course' and sr.resource_id = c.id)
                or (
                  sr.resource_type = 'course_module'
                  and sr.resource_id in (
                    select cm2.id from course_modules cm2
                    where cm2.course_id = c.id and cm2.tenant_id = c.tenant_id and cm2.deleted_at is null
                  )
                )
                or (
                  sr.resource_type = 'lesson'
                  and sr.resource_id in (
                    select l2.id from lessons l2
                    join course_modules cm3 on cm3.id = l2.module_id and cm3.tenant_id = l2.tenant_id
                    where cm3.course_id = c.id and l2.tenant_id = c.tenant_id
                      and l2.deleted_at is null and cm3.deleted_at is null
                  )
                )
              )
          ), 0) as storage_gb,
          coalesce((
            select count(*)::int
            from storage_references sr
            where sr.deleted_at is null
              and sr.tenant_id = c.tenant_id
              and (
                (sr.resource_type = 'course' and sr.resource_id = c.id)
                or (
                  sr.resource_type = 'course_module'
                  and sr.resource_id in (
                    select cm2.id from course_modules cm2
                    where cm2.course_id = c.id and cm2.tenant_id = c.tenant_id and cm2.deleted_at is null
                  )
                )
                or (
                  sr.resource_type = 'lesson'
                  and sr.resource_id in (
                    select l2.id from lessons l2
                    join course_modules cm3 on cm3.id = l2.module_id and cm3.tenant_id = l2.tenant_id
                    where cm3.course_id = c.id and l2.tenant_id = c.tenant_id
                      and l2.deleted_at is null and cm3.deleted_at is null
                  )
                )
              )
          ), 0) as file_count
        from courses c
        left join course_modules cm
          on cm.course_id = c.id and cm.tenant_id = c.tenant_id and cm.deleted_at is null
        left join lessons l
          on l.module_id = cm.id and l.tenant_id = c.tenant_id and l.deleted_at is null
        left join lesson_progress lp
          on lp.lesson_id = l.id and lp.tenant_id = c.tenant_id
        where c.tenant_id = current_setting('app.tenant_id', true)::uuid
          and c.deleted_at is null
        group by c.id, c.title, c.status, c.created_at
      )
      select
        course_id::text as course_id,
        title,
        status,
        storage_gb,
        file_count,
        last_learner_activity_at,
        created_at
      from course_storage
      where storage_gb > 0
      order by
        case when ${sort}::text = 'size_desc' then storage_gb end desc nulls last,
        case when ${sort}::text = 'files_desc' then file_count end desc nulls last,
        case when ${sort}::text = 'activity_asc' then last_learner_activity_at end asc nulls first,
        case when ${sort}::text = 'title_asc' then title end asc nulls last,
        title asc
      limit ${args.limit} offset ${offset}
    `;

    return rows.map((row) => ({
      course_id: row.course_id,
      title: row.title,
      status: row.status,
      storage_gb: roundGb(row.storage_gb),
      file_count: row.file_count,
      last_learner_activity_at: row.last_learner_activity_at,
      created_at: row.created_at,
    }));
  },
};
