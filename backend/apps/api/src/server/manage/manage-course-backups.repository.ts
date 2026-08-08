import { randomBytes, randomUUID } from "node:crypto";
import type { TenantTx } from "@atlas/db";

export type CourseBackupJobRow = {
  id: string;
  course_id: string;
  course_title: string;
  requested_by_membership_id: string;
  scope_json: unknown;
  status: string;
  r2_object_key: string | null;
  download_token: string | null;
  error_json: unknown;
  otp_verified_at: Date | null;
  started_at: Date | null;
  completed_at: Date | null;
  expires_at: Date | null;
  created_at: Date;
  updated_at: Date;
};

export type CourseBackupSource = {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  metadata_json: unknown;
};

export type CourseBackupModule = {
  id: string;
  title: string;
  position: number;
};

export type CourseBackupLesson = {
  id: string;
  module_id: string;
  title: string;
  slug: string;
  position: number;
  content_json: unknown;
  video_provider: string | null;
  video_url: string | null;
  duration_seconds: number | null;
};

export const manageCourseBackupsRepository = {
  async listJobs(tx: TenantTx, limit = 50): Promise<CourseBackupJobRow[]> {
    return tx.$queryRaw<CourseBackupJobRow[]>`
      select
        id::text,
        course_id::text,
        course_title,
        requested_by_membership_id::text,
        scope_json,
        status::text,
        r2_object_key,
        download_token,
        error_json,
        otp_verified_at,
        started_at,
        completed_at,
        expires_at,
        created_at,
        updated_at
      from course_backup_jobs
      order by created_at desc
      limit ${limit}
    `;
  },

  async findById(tx: TenantTx, jobId: string): Promise<CourseBackupJobRow | null> {
    const rows = await tx.$queryRaw<CourseBackupJobRow[]>`
      select
        id::text,
        course_id::text,
        course_title,
        requested_by_membership_id::text,
        scope_json,
        status::text,
        r2_object_key,
        download_token,
        error_json,
        otp_verified_at,
        started_at,
        completed_at,
        expires_at,
        created_at,
        updated_at
      from course_backup_jobs
      where id = ${jobId}::uuid
      limit 1
    `;
    return rows[0] ?? null;
  },

  async findCourse(tx: TenantTx, courseId: string): Promise<CourseBackupSource | null> {
    const rows = await tx.$queryRaw<CourseBackupSource[]>`
      select id::text, title, slug, description, metadata_json
      from courses
      where id = ${courseId}::uuid
        and deleted_at is null
      limit 1
    `;
    return rows[0] ?? null;
  },

  async listModules(tx: TenantTx, courseId: string, sectionIds: string[] | null) {
    if (sectionIds && sectionIds.length > 0) {
      return tx.$queryRaw<CourseBackupModule[]>`
        select id::text, title, position
        from course_modules
        where course_id = ${courseId}::uuid
          and deleted_at is null
          and id = any(${sectionIds}::uuid[])
        order by position asc, created_at asc
      `;
    }
    return tx.$queryRaw<CourseBackupModule[]>`
      select id::text, title, position
      from course_modules
      where course_id = ${courseId}::uuid
        and deleted_at is null
      order by position asc, created_at asc
    `;
  },

  async listLessons(tx: TenantTx, moduleIds: string[]) {
    if (moduleIds.length === 0) return [] as CourseBackupLesson[];
    return tx.$queryRaw<CourseBackupLesson[]>`
      select
        id::text,
        module_id::text,
        title,
        slug,
        position,
        content_json,
        video_provider,
        video_url,
        duration_seconds
      from lessons
      where module_id = any(${moduleIds}::uuid[])
        and deleted_at is null
      order by position asc, created_at asc
    `;
  },

  async insertSucceededJob(
    tx: TenantTx,
    args: {
      courseId: string;
      courseTitle: string;
      requestedByMembershipId: string;
      scopeJson: unknown;
      snapshot: unknown;
    },
  ): Promise<string> {
    const id = randomUUID();
    const downloadToken = randomBytes(24).toString("base64url");
    const objectKey = `course-backups/${args.courseId}/${id}.json`;
    await tx.$executeRaw`
      insert into course_backup_jobs (
        id,
        tenant_id,
        course_id,
        requested_by_membership_id,
        course_title,
        scope_json,
        status,
        r2_object_key,
        download_token,
        error_json,
        otp_verified_at,
        started_at,
        completed_at,
        expires_at,
        created_at,
        updated_at
      )
      values (
        ${id}::uuid,
        current_setting('app.tenant_id', true)::uuid,
        ${args.courseId}::uuid,
        ${args.requestedByMembershipId}::uuid,
        ${args.courseTitle},
        ${JSON.stringify({
          ...(args.scopeJson as object),
          snapshot: args.snapshot,
        })}::jsonb,
        'SUCCEEDED'::"JobStatus",
        ${objectKey},
        ${downloadToken},
        null,
        now(),
        now(),
        now(),
        now() + interval '2 days',
        now(),
        now()
      )
    `;
    return id;
  },
};
