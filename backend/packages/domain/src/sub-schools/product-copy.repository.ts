import { randomUUID } from "node:crypto";
import type { TenantTx } from "@atlas/db";
import type { PRODUCT_COPY_STATUSES, PRODUCT_COPY_TYPES } from "./product-copy.dto";

export type ProductCopyJobRow = {
  id: string;
  tenant_id: string;
  destination_sub_school_id: string;
  requested_by_membership_id: string;
  product_type: (typeof PRODUCT_COPY_TYPES)[number];
  source_product_id: string;
  source_product_title: string;
  destination_product_name: string;
  section_ids_json: unknown;
  result_product_id: string | null;
  status: (typeof PRODUCT_COPY_STATUSES)[number];
  error_json: unknown;
  started_at: Date | null;
  completed_at: Date | null;
  created_at: Date;
  updated_at: Date;
};

function mapJobRow(row: Record<string, unknown>): ProductCopyJobRow {
  return {
    id: String(row["id"]),
    tenant_id: String(row["tenant_id"]),
    destination_sub_school_id: String(row["destination_sub_school_id"]),
    requested_by_membership_id: String(row["requested_by_membership_id"]),
    product_type: String(row["product_type"]) as ProductCopyJobRow["product_type"],
    source_product_id: String(row["source_product_id"]),
    source_product_title: String(row["source_product_title"]),
    destination_product_name: String(row["destination_product_name"]),
    section_ids_json: row["section_ids_json"] ?? null,
    result_product_id:
      typeof row["result_product_id"] === "string" ? row["result_product_id"] : null,
    status: String(row["status"]) as ProductCopyJobRow["status"],
    error_json: row["error_json"] ?? null,
    started_at: (row["started_at"] as Date | null) ?? null,
    completed_at: (row["completed_at"] as Date | null) ?? null,
    created_at: row["created_at"] as Date,
    updated_at: row["updated_at"] as Date,
  };
}

export const productCopyRepository = {
  async insertJob(
    tx: TenantTx,
    args: {
      destinationSubSchoolId: string;
      requestedByMembershipId: string;
      productType: ProductCopyJobRow["product_type"];
      sourceProductId: string;
      sourceProductTitle: string;
      destinationProductName: string;
      sectionIds: string[] | null;
    },
  ): Promise<ProductCopyJobRow> {
    const id = randomUUID();
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      insert into product_copy_jobs (
        id,
        tenant_id,
        destination_sub_school_id,
        requested_by_membership_id,
        product_type,
        source_product_id,
        source_product_title,
        destination_product_name,
        section_ids_json,
        status,
        created_at,
        updated_at
      )
      values (
        ${id}::uuid,
        current_setting('app.tenant_id', true)::uuid,
        ${args.destinationSubSchoolId}::uuid,
        ${args.requestedByMembershipId}::uuid,
        ${args.productType},
        ${args.sourceProductId}::uuid,
        ${args.sourceProductTitle},
        ${args.destinationProductName},
        ${args.sectionIds == null ? null : JSON.stringify(args.sectionIds)}::jsonb,
        'QUEUED'::"JobStatus",
        now(),
        now()
      )
      returning *
    `;
    const row = rows[0];
    if (!row) throw new Error("PRODUCT_COPY_JOB_INSERT_FAILED");
    return mapJobRow(row);
  },

  async listJobsForSubSchool(tx: TenantTx, subSchoolId: string): Promise<ProductCopyJobRow[]> {
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      select * from product_copy_jobs
      where destination_sub_school_id = ${subSchoolId}::uuid
      order by created_at desc
      limit 100
    `;
    return rows.map(mapJobRow);
  },

  async findJobById(tx: TenantTx, jobId: string): Promise<ProductCopyJobRow | null> {
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      select * from product_copy_jobs where id = ${jobId}::uuid limit 1
    `;
    return rows[0] ? mapJobRow(rows[0]) : null;
  },

  async markRunning(tx: TenantTx, jobId: string): Promise<ProductCopyJobRow | null> {
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      update product_copy_jobs
      set status = 'RUNNING'::"JobStatus",
          started_at = now(),
          updated_at = now()
      where id = ${jobId}::uuid
      returning *
    `;
    return rows[0] ? mapJobRow(rows[0]) : null;
  },

  async markSucceeded(
    tx: TenantTx,
    jobId: string,
    resultProductId: string,
  ): Promise<ProductCopyJobRow | null> {
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      update product_copy_jobs
      set status = 'SUCCEEDED'::"JobStatus",
          result_product_id = ${resultProductId}::uuid,
          completed_at = now(),
          updated_at = now(),
          error_json = null
      where id = ${jobId}::uuid
      returning *
    `;
    return rows[0] ? mapJobRow(rows[0]) : null;
  },

  async markFailed(
    tx: TenantTx,
    jobId: string,
    errorMessage: string,
  ): Promise<ProductCopyJobRow | null> {
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      update product_copy_jobs
      set status = 'FAILED'::"JobStatus",
          completed_at = now(),
          updated_at = now(),
          error_json = ${JSON.stringify({ message: errorMessage })}::jsonb
      where id = ${jobId}::uuid
      returning *
    `;
    return rows[0] ? mapJobRow(rows[0]) : null;
  },

  async findCourseById(tx: TenantTx, courseId: string) {
    const rows = await tx.$queryRaw<
      Array<{
        id: string;
        title: string;
        slug: string;
        description: string | null;
        metadata_json: unknown;
      }>
    >`
      select id::text, title, slug, description, metadata_json
      from courses
      where id = ${courseId}::uuid
        and deleted_at is null
      limit 1
    `;
    return rows[0] ?? null;
  },

  async courseSlugExists(tx: TenantTx, slug: string): Promise<boolean> {
    const rows = await tx.$queryRaw<Array<{ ok: boolean }>>`
      select exists(
        select 1 from courses
        where slug = ${slug}
          and deleted_at is null
      ) as ok
    `;
    return Boolean(rows[0]?.ok);
  },

  async insertCourseDraft(
    tx: TenantTx,
    args: {
      ownerMembershipId: string;
      slug: string;
      title: string;
      description: string | null;
      metadata: Record<string, unknown>;
    },
  ): Promise<string> {
    const courseId = randomUUID();
    await tx.$executeRaw`
      insert into courses (
        id, tenant_id, slug, title, description, status, metadata_json,
        created_by_membership_id, created_at, updated_at
      )
      values (
        ${courseId}::uuid,
        current_setting('app.tenant_id', true)::uuid,
        ${args.slug},
        ${args.title},
        ${args.description},
        'DRAFT'::"PublishStatus",
        ${JSON.stringify(args.metadata)}::jsonb,
        ${args.ownerMembershipId}::uuid,
        now(),
        now()
      )
    `;
    return courseId;
  },

  async listModulesForCourse(tx: TenantTx, courseId: string, sectionIds: string[] | null) {
    if (sectionIds && sectionIds.length > 0) {
      const rows = await tx.$queryRaw<
        Array<{
          id: string;
          title: string;
          position: number;
          content_kind: string;
          scorm_package_reference_id: string | null;
          scorm_launch_path: string | null;
          scorm_version: string | null;
        }>
      >`
        select
          id::text,
          title,
          position,
          content_kind::text,
          scorm_package_reference_id::text,
          scorm_launch_path,
          scorm_version
        from course_modules
        where course_id = ${courseId}::uuid
          and deleted_at is null
          and id = any(${sectionIds}::uuid[])
        order by position asc
      `;
      return rows;
    }

    const rows = await tx.$queryRaw<
      Array<{
        id: string;
        title: string;
        position: number;
        content_kind: string;
        scorm_package_reference_id: string | null;
        scorm_launch_path: string | null;
        scorm_version: string | null;
      }>
    >`
      select
        id::text,
        title,
        position,
        content_kind::text,
        scorm_package_reference_id::text,
        scorm_launch_path,
        scorm_version
      from course_modules
      where course_id = ${courseId}::uuid
        and deleted_at is null
      order by position asc
    `;
    return rows;
  },

  async insertModule(
    tx: TenantTx,
    args: {
      courseId: string;
      title: string;
      position: number;
      contentKind: string;
      scormPackageReferenceId: string | null;
      scormLaunchPath: string | null;
      scormVersion: string | null;
    },
  ): Promise<string> {
    const moduleId = randomUUID();
    await tx.$executeRaw`
      insert into course_modules (
        id, tenant_id, course_id, title, position, status, content_kind,
        scorm_package_reference_id, scorm_launch_path, scorm_version,
        created_at, updated_at
      )
      values (
        ${moduleId}::uuid,
        current_setting('app.tenant_id', true)::uuid,
        ${args.courseId}::uuid,
        ${args.title},
        ${args.position},
        'DRAFT'::"PublishStatus",
        ${args.contentKind}::"CourseModuleContentKind",
        ${args.scormPackageReferenceId}::uuid,
        ${args.scormLaunchPath},
        ${args.scormVersion},
        now(),
        now()
      )
    `;
    return moduleId;
  },

  async listLessonsForModule(tx: TenantTx, moduleId: string) {
    const rows = await tx.$queryRaw<
      Array<{
        id: string;
        slug: string;
        title: string;
        content_json: unknown;
        video_provider: string | null;
        video_url: string | null;
        duration_seconds: number | null;
        position: number;
      }>
    >`
      select
        id::text,
        slug,
        title,
        content_json,
        video_provider,
        video_url,
        duration_seconds,
        position
      from lessons
      where module_id = ${moduleId}::uuid
        and deleted_at is null
      order by position asc
    `;
    return rows;
  },

  async insertLesson(
    tx: TenantTx,
    args: {
      moduleId: string;
      slug: string;
      title: string;
      contentJson: unknown;
      videoProvider: string | null;
      videoUrl: string | null;
      durationSeconds: number | null;
      position: number;
    },
  ): Promise<string> {
    const lessonId = randomUUID();
    await tx.$executeRaw`
      insert into lessons (
        id, tenant_id, module_id, slug, title, content_json,
        video_provider, video_url, duration_seconds, position, status,
        created_at, updated_at
      )
      values (
        ${lessonId}::uuid,
        current_setting('app.tenant_id', true)::uuid,
        ${args.moduleId}::uuid,
        ${args.slug},
        ${args.title},
        ${args.contentJson == null ? null : JSON.stringify(args.contentJson)}::jsonb,
        ${args.videoProvider},
        ${args.videoUrl},
        ${args.durationSeconds},
        ${args.position},
        'DRAFT'::"PublishStatus",
        now(),
        now()
      )
    `;
    return lessonId;
  },

  async copyLessonAssets(tx: TenantTx, sourceLessonId: string, targetLessonId: string) {
    await tx.$executeRaw`
      insert into lesson_assets (
        id, tenant_id, lesson_id, asset_type, provider, object_key_or_url,
        metadata_json, created_at, deleted_at
      )
      select
        gen_random_uuid(),
        tenant_id,
        ${targetLessonId}::uuid,
        asset_type,
        provider,
        object_key_or_url,
        metadata_json,
        now(),
        null
      from lesson_assets
      where lesson_id = ${sourceLessonId}::uuid
        and deleted_at is null
    `;
  },

  async copyLessonTags(tx: TenantTx, sourceLessonId: string, targetLessonId: string) {
    await tx.$executeRaw`
      insert into lesson_tags (id, tenant_id, lesson_id, tag_id, created_at)
      select
        gen_random_uuid(),
        tenant_id,
        ${targetLessonId}::uuid,
        tag_id,
        now()
      from lesson_tags
      where lesson_id = ${sourceLessonId}::uuid
      on conflict do nothing
    `;
  },

  async copyCourseTags(tx: TenantTx, sourceCourseId: string, targetCourseId: string) {
    await tx.$executeRaw`
      insert into course_tags (id, tenant_id, course_id, tag_id, created_at)
      select
        gen_random_uuid(),
        tenant_id,
        ${targetCourseId}::uuid,
        tag_id,
        now()
      from course_tags
      where course_id = ${sourceCourseId}::uuid
      on conflict do nothing
    `;
  },
};
