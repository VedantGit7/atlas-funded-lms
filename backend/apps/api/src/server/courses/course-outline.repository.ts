type Tx = {
  $queryRaw<T = unknown>(query: TemplateStringsArray, ...values: unknown[]): Promise<T>;
};

export type LearnerOutlineRow = {
  module_id: string;
  module_title: string;
  module_position: number;
  module_content_kind: string;
  lesson_id: string | null;
  lesson_title: string | null;
  lesson_position: number | null;
  duration_seconds: number | null;
  video_url: string | null;
  video_provider: string | null;
  /** The lesson's content settings without the article body, which can be large. */
  content_meta: unknown;
  has_body: boolean | null;
  in_syllabus: boolean | null;
  progress_status: string | null;
  last_seen_at: Date | null;
};

/**
 * Published chapters of a published course, each with its published lessons
 * and this member's progress on them, in course order. A chapter with no
 * published lessons still comes back, as one row with no lesson.
 */
export async function listLearnerOutlineRows(args: {
  tx: Tx;
  courseId: string;
  membershipId: string;
}): Promise<LearnerOutlineRow[]> {
  return args.tx.$queryRaw<LearnerOutlineRow[]>`
    select
      m.id::text as module_id,
      m.title as module_title,
      m.position as module_position,
      m.content_kind::text as module_content_kind,
      l.id::text as lesson_id,
      l.title as lesson_title,
      l.position as lesson_position,
      l.duration_seconds,
      l.video_url,
      l.video_provider,
      l.content_json - 'body' as content_meta,
      coalesce(length(btrim(l.content_json->>'body')), 0) > 0 as has_body,
      coalesce((l.content_json->>'displayInSyllabus')::boolean, true) as in_syllabus,
      lp.status as progress_status,
      lp.last_seen_at
    from course_modules m
    left join lessons l
      on l.module_id = m.id
     and l.tenant_id = m.tenant_id
     and l.deleted_at is null
     and l.status = 'PUBLISHED'
    left join lesson_progress lp
      on lp.lesson_id = l.id
     and lp.tenant_id = l.tenant_id
     and lp.membership_id = ${args.membershipId}::uuid
    where m.course_id = ${args.courseId}::uuid
      and m.deleted_at is null
      and m.status = 'PUBLISHED'
    order by m.position asc, l.position asc nulls last
  `;
}
