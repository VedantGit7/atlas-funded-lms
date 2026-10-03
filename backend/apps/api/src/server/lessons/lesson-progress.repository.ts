import { createUuidV7 } from "@atlas/core/id/uuid-v7";
import type { ProgressStatus } from "./lesson-progress-guards";

type Tx = {
  $queryRaw<T = unknown>(query: TemplateStringsArray, ...values: unknown[]): Promise<T>;
  $executeRaw(query: TemplateStringsArray, ...values: unknown[]): Promise<unknown>;
};

export type LessonProgressRow = {
  id: string;
  lessonId: string;
  membershipId: string;
  status: ProgressStatus;
  progressPct: number;
  lastSeenAt: Date | null;
  completedAt: Date | null;
};

/** Serialize progress and course completion before reading possibly missing progress. */
export async function lockEnrollmentForProgress(args: {
  tx: Tx;
  tenantId: string;
  membershipId: string;
  enrollmentId: string;
}): Promise<boolean> {
  const rows = await args.tx.$queryRaw<Array<{ id: string }>>`
    select id::text
    from enrollments
    where id = ${args.enrollmentId}::uuid
      and tenant_id = ${args.tenantId}::uuid
      and membership_id = ${args.membershipId}::uuid
      and status = 'active'
    for update
  `;
  return rows.length > 0;
}

export async function findLessonProgress(args: {
  tx: Tx;
  lessonId: string;
  membershipId: string;
}): Promise<LessonProgressRow | null> {
  const rows = await args.tx.$queryRaw<
    Array<{
      id: string;
      lesson_id: string;
      membership_id: string;
      status: string;
      progress_pct: number;
      last_seen_at: Date | null;
      completed_at: Date | null;
    }>
  >`
    select
      id::text,
      lesson_id::text,
      membership_id::text,
      status,
      progress_pct,
      last_seen_at,
      completed_at
    from lesson_progress
    where lesson_id = ${args.lessonId}::uuid
      and membership_id = ${args.membershipId}::uuid
    limit 1
  `;

  const row = rows[0];
  if (!row) return null;

  return {
    id: row.id,
    lessonId: row.lesson_id,
    membershipId: row.membership_id,
    status: row.status as ProgressStatus,
    progressPct: row.progress_pct,
    lastSeenAt: row.last_seen_at,
    completedAt: row.completed_at,
  };
}

export async function upsertLessonProgress(args: {
  tx: Tx;
  tenantId: string;
  lessonId: string;
  membershipId: string;
  status: ProgressStatus;
  progressPct: number;
  completedAt: Date | null;
}): Promise<LessonProgressRow> {
  const existing = await findLessonProgress({
    tx: args.tx,
    lessonId: args.lessonId,
    membershipId: args.membershipId,
  });

  if (existing) {
    await args.tx.$executeRaw`
      update lesson_progress
      set
        status = ${args.status},
        progress_pct = ${args.progressPct},
        last_seen_at = now(),
        completed_at = coalesce(${args.completedAt}, completed_at),
        updated_at = now()
      where id = ${existing.id}::uuid
    `;

    return {
      ...existing,
      status: args.status,
      progressPct: args.progressPct,
      lastSeenAt: new Date(),
      completedAt: args.completedAt ?? existing.completedAt,
    };
  }

  const id = createUuidV7();

  await args.tx.$executeRaw`
    insert into lesson_progress (
      id,
      tenant_id,
      lesson_id,
      membership_id,
      status,
      progress_pct,
      last_seen_at,
      completed_at,
      updated_at
    )
    values (
      ${id}::uuid,
      ${args.tenantId}::uuid,
      ${args.lessonId}::uuid,
      ${args.membershipId}::uuid,
      ${args.status},
      ${args.progressPct},
      now(),
      ${args.completedAt},
      now()
    )
  `;

  return {
    id,
    lessonId: args.lessonId,
    membershipId: args.membershipId,
    status: args.status,
    progressPct: args.progressPct,
    lastSeenAt: new Date(),
    completedAt: args.completedAt,
  };
}

/**
 * When a member has completed every published lesson in a course, stamp their
 * enrollment's `completed_at`. Returns true when this call transitioned the
 * enrollment to completed. No-op when the course has no published lessons, when
 * lessons remain, or when the enrollment is already completed/inactive.
 */
export async function markEnrollmentCompletedIfAllLessonsDone(args: {
  tx: Tx;
  tenantId: string;
  courseId: string;
  membershipId: string;
  enrollmentId: string;
}): Promise<boolean> {
  const rows = await args.tx.$queryRaw<Array<{ published_total: bigint; completed_total: bigint }>>`
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

  const row = rows[0];
  if (!row) return false;

  const publishedTotal = Number(row.published_total);
  const completedTotal = Number(row.completed_total);

  if (publishedTotal === 0 || completedTotal < publishedTotal) {
    return false;
  }

  const updated = await args.tx.$queryRaw<Array<{ id: string }>>`
    update enrollments
    set completed_at = now()
    where id = ${args.enrollmentId}::uuid
      and tenant_id = ${args.tenantId}::uuid
      and status = 'active'
      and completed_at is null
    returning id::text
  `;

  return updated.length > 0;
}

export async function countOutboxLessonCompletedEvents(args: {
  tx: Tx;
  lessonId: string;
  membershipId: string;
}): Promise<number> {
  const rows = await args.tx.$queryRaw<Array<{ count: bigint }>>`
    select count(*)::bigint as count
    from outbox_events
    where event_type = 'lesson.completed'
      and aggregate_type = 'lesson'
      and aggregate_id = ${args.lessonId}::text
      and payload_json->>'membershipId' = ${args.membershipId}
  `;

  return Number(rows[0]?.count ?? 0n);
}
