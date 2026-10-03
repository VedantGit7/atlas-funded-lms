import type { TenantTx } from "@atlas/db";
import { EXPORT_PAGE_SIZE, type ExportSection, type ExportPageRow } from "./export-spool";
export async function readExportPage(
  tx: TenantTx,
  tenantId: string,
  section: ExportSection,
  cursor?: string,
): Promise<ExportPageRow[]> {
  switch (section) {
    case "memberships":
      return tx.$queryRaw<ExportPageRow[]>`
      select id::text as cursor, case when octet_length(payload::text) <= 65536 then payload else null end as data
      from (select id, jsonb_build_object('id',id,'status',status,'joinedAt',joined_at) as payload from memberships
        where tenant_id = ${tenantId}::uuid and tenant_id = current_setting('app.tenant_id', true)::uuid
          and (${cursor ?? null}::uuid is null or id > ${cursor ?? null}::uuid) 
        order by id limit ${EXPORT_PAGE_SIZE}
      ) page order by id
    `;
    case "memberProfiles":
      return tx.$queryRaw<ExportPageRow[]>`
      select id::text as cursor, case when octet_length(payload::text) <= 65536 then payload else null end as data
      from (select id, jsonb_build_object('membershipId',membership_id,'displayName',display_name) as payload from member_profiles
        where tenant_id = ${tenantId}::uuid and tenant_id = current_setting('app.tenant_id', true)::uuid
          and (${cursor ?? null}::uuid is null or id > ${cursor ?? null}::uuid) 
        order by id limit ${EXPORT_PAGE_SIZE}
      ) page order by id
    `;
    case "courses":
      return tx.$queryRaw<ExportPageRow[]>`
      select id::text as cursor, case when octet_length(payload::text) <= 65536 then payload else null end as data
      from (select id, jsonb_build_object('id',id,'slug',slug,'title',title,'status',status) as payload from courses
        where tenant_id = ${tenantId}::uuid and tenant_id = current_setting('app.tenant_id', true)::uuid
          and (${cursor ?? null}::uuid is null or id > ${cursor ?? null}::uuid) and deleted_at is null
        order by id limit ${EXPORT_PAGE_SIZE}
      ) page order by id
    `;
    case "enrollments":
      return tx.$queryRaw<ExportPageRow[]>`
      select id::text as cursor, case when octet_length(payload::text) <= 65536 then payload else null end as data
      from (select id, jsonb_build_object('id',id,'courseId',course_id,'membershipId',membership_id,'status',status) as payload from enrollments
        where tenant_id = ${tenantId}::uuid and tenant_id = current_setting('app.tenant_id', true)::uuid
          and (${cursor ?? null}::uuid is null or id > ${cursor ?? null}::uuid) 
        order by id limit ${EXPORT_PAGE_SIZE}
      ) page order by id
    `;
  }
}
