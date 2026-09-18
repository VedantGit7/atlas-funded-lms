// Poisons this module for any client bundle. Audit finding M9: nothing at the
// language level stopped a server module being pulled into a client component,
// so a leak of service code -- and whatever secrets or privileged queries it
// closes over -- would only have shown up as a runtime surprise.
import "server-only";

type Tx = {
  $queryRaw<T = unknown>(query: TemplateStringsArray, ...values: unknown[]): Promise<T>;
};

function decodeListCursor(cursor: string): { progressPct: number; membershipId: string } {
  const parsed = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as {
    progressPct: number;
    membershipId: string;
  };
  return { progressPct: parsed.progressPct, membershipId: parsed.membershipId };
}

function encodeListCursor(value: { progressPct: number; membershipId: string }): string {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

export async function countLessonsInCourse(args: { tx: Tx; courseId: string }): Promise<number> {
  const rows = await args.tx.$queryRaw<Array<{ count: bigint }>>`
    select count(*)::bigint as count
    from lessons l
    inner join course_modules m on m.id = l.module_id
    where m.course_id = ${args.courseId}::uuid
      and l.deleted_at is null
      and m.deleted_at is null
  `;
  return Number(rows[0]?.count ?? 0n);
}

export async function listCourseLearnerProgress(args: {
  tx: Tx;
  courseId: string;
  limit: number;
  cursor?: string;
}): Promise<{
  items: Array<{
    membershipId: string;
    displayName: string | null;
    progressPct: number;
    completedLessons: number;
    totalLessons: number;
  }>;
  pageInfo: { nextCursor: string | null; hasNextPage: boolean };
}> {
  const cursor = args.cursor ? decodeListCursor(args.cursor) : null;
  const limit = args.limit;

  const rows = await args.tx.$queryRaw<
    Array<{
      membership_id: string;
      display_name: string | null;
      completed_lessons: bigint;
      total_lessons: bigint;
    }>
  >`
    with course_lessons as (
      select l.id
      from lessons l
      inner join course_modules m on m.id = l.module_id
      where m.course_id = ${args.courseId}::uuid
        and l.deleted_at is null
        and m.deleted_at is null
    ),
    roster as (
      select
        e.membership_id,
        mp.display_name,
        (
          select count(*)::bigint
          from lesson_progress lp
          inner join course_lessons cl on cl.id = lp.lesson_id
          where lp.membership_id = e.membership_id
            and lp.status = 'completed'
        ) as completed_lessons,
        (select count(*)::bigint from course_lessons) as total_lessons
      from enrollments e
      left join member_profiles mp
        on mp.membership_id = e.membership_id
       and mp.tenant_id = e.tenant_id
      where e.course_id = ${args.courseId}::uuid
        and e.status = 'active'
    )
    select
      membership_id::text,
      display_name,
      completed_lessons,
      total_lessons
    from roster
    where (
      ${cursor?.membershipId ?? null}::text is null
      or membership_id::text < ${cursor?.membershipId ?? null}::text
    )
    order by membership_id desc
    limit ${limit + 1}
  `;

  const hasNextPage = rows.length > limit;
  const pageRows = hasNextPage ? rows.slice(0, limit) : rows;
  const last = pageRows[pageRows.length - 1];

  const items = pageRows.map((row) => {
    const totalLessons = Number(row.total_lessons);
    const completedLessons = Number(row.completed_lessons);
    const progressPct = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;

    return {
      membershipId: row.membership_id,
      displayName: row.display_name,
      progressPct,
      completedLessons,
      totalLessons,
    };
  });

  return {
    items,
    pageInfo: {
      hasNextPage,
      nextCursor:
        hasNextPage && last
          ? encodeListCursor({
              progressPct:
                Number(last.total_lessons) > 0
                  ? Math.round((Number(last.completed_lessons) / Number(last.total_lessons)) * 100)
                  : 0,
              membershipId: last.membership_id,
            })
          : null,
    },
  };
}
