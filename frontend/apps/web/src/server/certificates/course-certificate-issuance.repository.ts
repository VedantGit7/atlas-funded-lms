// Poisons this module for any client bundle. Audit finding M9: nothing at the
// language level stopped a server module being pulled into a client component,
// so a leak of service code -- and whatever secrets or privileged queries it
// closes over -- would only have shown up as a runtime surprise.
import "server-only";

import type { TenantTx } from "@atlas/db";
import type { AttemptScoreSnapshot } from "./course-certificate-eligibility";

export type CourseCertificateContextRow = {
  courseId: string;
  status: string;
  tags: Record<string, unknown> | null;
};

function parseTags(metadata: unknown): Record<string, unknown> | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const tags = (metadata as Record<string, unknown>)["tags"];
  if (!tags || typeof tags !== "object" || Array.isArray(tags)) return null;
  return tags as Record<string, unknown>;
}

export const courseCertificateIssuanceRepository = {
  async findCourseContext(
    tx: TenantTx,
    courseId: string,
  ): Promise<CourseCertificateContextRow | null> {
    const rows = await tx.$queryRaw<Array<{ id: string; status: string; metadata_json: unknown }>>`
      select id::text, status::text, metadata_json
      from courses
      where id = ${courseId}::uuid
        and deleted_at is null
      limit 1
    `;

    const row = rows[0];
    if (!row) return null;

    return {
      courseId: row.id,
      status: row.status,
      tags: parseTags(row.metadata_json),
    };
  },

  async findCourseIdForLesson(tx: TenantTx, lessonId: string): Promise<string | null> {
    const rows = await tx.$queryRaw<Array<{ course_id: string }>>`
      select m.course_id::text as course_id
      from lessons l
      inner join course_modules m on m.id = l.module_id and m.tenant_id = l.tenant_id
      where l.id = ${lessonId}::uuid
        and l.deleted_at is null
      limit 1
    `;
    return rows[0]?.course_id ?? null;
  },

  async findCourseIdForAssessment(tx: TenantTx, assessmentId: string): Promise<string | null> {
    const rows = await tx.$queryRaw<Array<{ course_id: string }>>`
      select m.course_id::text as course_id
      from lessons l
      inner join course_modules m on m.id = l.module_id and m.tenant_id = l.tenant_id
      where l.deleted_at is null
        and coalesce(l.content_json->>'type', '') = 'section_quiz'
        and coalesce(l.content_json->'content'->>'assessmentId', l.content_json->>'assessmentId') = ${assessmentId}
      limit 1
    `;
    return rows[0]?.course_id ?? null;
  },

  async getCourseCompletionPercent(args: {
    tx: TenantTx;
    tenantId: string;
    courseId: string;
    membershipId: string;
  }): Promise<number> {
    const rows = await args.tx.$queryRaw<
      Array<{ published_total: bigint; completed_total: bigint }>
    >`
      select
        (
          select count(*)::bigint
          from lessons l
          inner join course_modules m on m.id = l.module_id and m.tenant_id = l.tenant_id
          where m.course_id = ${args.courseId}::uuid
            and m.deleted_at is null and m.status = 'PUBLISHED'
            and l.deleted_at is null and l.status = 'PUBLISHED'
        ) as published_total,
        (
          select count(*)::bigint
          from lesson_progress lp
          inner join lessons l on l.id = lp.lesson_id
          inner join course_modules m on m.id = l.module_id and m.tenant_id = l.tenant_id
          where m.course_id = ${args.courseId}::uuid
            and m.deleted_at is null and m.status = 'PUBLISHED'
            and l.deleted_at is null and l.status = 'PUBLISHED'
            and lp.tenant_id = ${args.tenantId}::uuid
            and lp.membership_id = ${args.membershipId}::uuid
            and lp.status = 'completed'
        ) as completed_total
    `;

    const published = Number(rows[0]?.published_total ?? 0n);
    const completed = Number(rows[0]?.completed_total ?? 0n);
    if (published <= 0) return 0;
    return Math.min(100, Math.floor((completed / published) * 100));
  },

  async loadAssessmentIdsForLessons(
    tx: TenantTx,
    lessonIds: string[],
  ): Promise<Map<string, string>> {
    const map = new Map<string, string>();
    if (lessonIds.length === 0) return map;

    const rows = await tx.$queryRaw<Array<{ lesson_id: string; assessment_id: string | null }>>`
      select
        l.id::text as lesson_id,
        coalesce(
          l.content_json->'content'->>'assessmentId',
          l.content_json->>'assessmentId'
        ) as assessment_id
      from lessons l
      where l.id = any(${lessonIds}::uuid[])
        and l.deleted_at is null
    `;

    for (const row of rows) {
      if (row.assessment_id) {
        map.set(row.lesson_id, row.assessment_id);
      }
    }

    return map;
  },

  async loadGradedAttemptsForAssessments(args: {
    tx: TenantTx;
    tenantId: string;
    membershipId: string;
    assessmentIds: string[];
  }): Promise<Map<string, AttemptScoreSnapshot[]>> {
    const map = new Map<string, AttemptScoreSnapshot[]>();
    if (args.assessmentIds.length === 0) return map;

    const rows = await args.tx.$queryRaw<
      Array<{
        assessment_id: string;
        score_pct: unknown;
        submitted_at: Date | null;
        graded_at: Date | null;
      }>
    >`
      select
        assessment_id::text,
        score_pct,
        submitted_at,
        graded_at
      from attempts
      where tenant_id = ${args.tenantId}::uuid
        and membership_id = ${args.membershipId}::uuid
        and assessment_id = any(${args.assessmentIds}::uuid[])
        and status in ('GRADED', 'SUBMITTED')
        and score_pct is not null
      order by coalesce(graded_at, submitted_at, started_at) asc
    `;

    for (const row of rows) {
      const scorePercent = Number(row.score_pct);
      if (!Number.isFinite(scorePercent)) continue;

      const list = map.get(row.assessment_id) ?? [];
      list.push({
        assessmentId: row.assessment_id,
        scorePercent,
        submittedAt: row.submitted_at?.toISOString() ?? null,
        gradedAt: row.graded_at?.toISOString() ?? null,
      });
      map.set(row.assessment_id, list);
    }

    return map;
  },

  async findIssuedCertificateForCourse(args: {
    tx: TenantTx;
    tenantId: string;
    membershipId: string;
    courseId: string;
  }): Promise<{ id: string } | null> {
    const rows = await args.tx.$queryRaw<Array<{ id: string }>>`
      select id::text
      from certificates
      where tenant_id = ${args.tenantId}::uuid
        and membership_id = ${args.membershipId}::uuid
        and status = 'issued'
        and metadata_json->'source'->>'type' = 'course'
        and metadata_json->'source'->>'id' = ${args.courseId}
      limit 1
    `;
    return rows[0] ?? null;
  },

  async findFirstPublishedTemplateId(tx: TenantTx, tenantId: string): Promise<string | null> {
    const rows = await tx.$queryRaw<Array<{ id: string }>>`
      select id::text
      from certificate_templates
      where tenant_id = ${tenantId}::uuid
        and status = 'PUBLISHED'
        and deleted_at is null
      order by updated_at desc
      limit 1
    `;
    return rows[0]?.id ?? null;
  },
};
