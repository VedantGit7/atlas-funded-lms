import { TRASH_RETENTION_DAYS, type ContentTrashKind } from "./content-trash.contract";

type Tx = {
  $queryRaw<T = unknown>(query: TemplateStringsArray, ...values: unknown[]): Promise<T>;
  $executeRaw(query: TemplateStringsArray, ...values: unknown[]): Promise<unknown>;
};

export type ContentTrashRow = {
  id: string;
  title: string;
  subtitle: string | null;
  deleted_at: Date;
};

function expiresAt(deletedAt: Date): Date {
  return new Date(deletedAt.getTime() + TRASH_RETENTION_DAYS * 24 * 60 * 60 * 1000);
}

export function toTrashItem(row: ContentTrashRow, kind: ContentTrashKind) {
  const deletedAt = row.deleted_at;
  const expires = expiresAt(deletedAt);
  const msRemaining = expires.getTime() - Date.now();
  const daysRemaining = Math.max(0, Math.ceil(msRemaining / (24 * 60 * 60 * 1000)));

  return {
    id: row.id,
    kind,
    title: row.title,
    subtitle: row.subtitle,
    deletedAt: deletedAt.toISOString(),
    expiresAt: expires.toISOString(),
    daysRemaining,
    restoreEligible: msRemaining > 0,
  };
}

export async function listTrashedCourses(args: { tx: Tx }): Promise<ContentTrashRow[]> {
  return args.tx.$queryRaw<ContentTrashRow[]>`
    select
      c.id::text as id,
      c.title,
      null::text as subtitle,
      c.deleted_at
    from courses c
    where c.deleted_at is not null
      and c.deleted_at > now() - (${TRASH_RETENTION_DAYS}::text || ' days')::interval
    order by c.deleted_at desc
  `;
}

export async function listTrashedSections(args: { tx: Tx }): Promise<ContentTrashRow[]> {
  return args.tx.$queryRaw<ContentTrashRow[]>`
    select
      m.id::text as id,
      m.title,
      c.title as subtitle,
      m.deleted_at
    from course_modules m
    join courses c on c.id = m.course_id
    where m.deleted_at is not null
      and m.deleted_at > now() - (${TRASH_RETENTION_DAYS}::text || ' days')::interval
    order by m.deleted_at desc
  `;
}

export async function listTrashedLessons(args: { tx: Tx }): Promise<ContentTrashRow[]> {
  return args.tx.$queryRaw<ContentTrashRow[]>`
    select
      l.id::text as id,
      l.title,
      concat(c.title, ' · ', m.title) as subtitle,
      l.deleted_at
    from lessons l
    join course_modules m on m.id = l.module_id
    join courses c on c.id = m.course_id
    where l.deleted_at is not null
      and l.deleted_at > now() - (${TRASH_RETENTION_DAYS}::text || ' days')::interval
    order by l.deleted_at desc
  `;
}

export async function restoreTrashedCourse(args: { tx: Tx; id: string }): Promise<boolean> {
  const result = await args.tx.$executeRaw`
    update courses
    set
      deleted_at = null,
      status = 'DRAFT'::"PublishStatus",
      updated_at = now()
    where id = ${args.id}::uuid
      and deleted_at is not null
      and deleted_at > now() - (${TRASH_RETENTION_DAYS}::text || ' days')::interval
  `;
  return Number(result) > 0;
}

export async function restoreTrashedSection(args: { tx: Tx; id: string }): Promise<boolean> {
  const result = await args.tx.$executeRaw`
    update course_modules
    set
      deleted_at = null,
      updated_at = now()
    where id = ${args.id}::uuid
      and deleted_at is not null
      and deleted_at > now() - (${TRASH_RETENTION_DAYS}::text || ' days')::interval
  `;
  return Number(result) > 0;
}

export async function restoreTrashedLesson(args: { tx: Tx; id: string }): Promise<boolean> {
  const result = await args.tx.$executeRaw`
    with target as (
      select id, module_id
      from lessons
      where id = ${args.id}::uuid
        and deleted_at is not null
        and deleted_at > now() - (${TRASH_RETENTION_DAYS}::text || ' days')::interval
    ),
    next_pos as (
      select coalesce(max(l.position), -1) + 1 as position
      from lessons l
      join target t on t.module_id = l.module_id
      where l.deleted_at is null
    )
    update lessons l
    set
      deleted_at = null,
      position = (select position from next_pos),
      updated_at = now()
    from target t
    where l.id = t.id
  `;
  return Number(result) > 0;
}

/**
 * Permanent purge tombstones the row outside the retention window so it leaves
 * Trash without hard-deleting dependents (enrollments, progress, etc.).
 */
export async function purgeTrashedCourse(args: { tx: Tx; id: string }): Promise<boolean> {
  const result = await args.tx.$executeRaw`
    update courses
    set
      deleted_at = '1970-01-01T00:00:00Z'::timestamptz,
      updated_at = now()
    where id = ${args.id}::uuid
      and deleted_at is not null
  `;
  return Number(result) > 0;
}

export async function purgeTrashedSection(args: { tx: Tx; id: string }): Promise<boolean> {
  await args.tx.$executeRaw`
    update lessons
    set
      deleted_at = coalesce(deleted_at, '1970-01-01T00:00:00Z'::timestamptz),
      updated_at = now()
    where module_id = ${args.id}::uuid
      and deleted_at is not null
  `;

  const result = await args.tx.$executeRaw`
    update course_modules
    set
      deleted_at = '1970-01-01T00:00:00Z'::timestamptz,
      updated_at = now()
    where id = ${args.id}::uuid
      and deleted_at is not null
  `;
  return Number(result) > 0;
}

export async function purgeTrashedLesson(args: { tx: Tx; id: string }): Promise<boolean> {
  const result = await args.tx.$executeRaw`
    update lessons
    set
      deleted_at = '1970-01-01T00:00:00Z'::timestamptz,
      updated_at = now()
    where id = ${args.id}::uuid
      and deleted_at is not null
  `;
  return Number(result) > 0;
}

export type TrashActivityRow = {
  id: string;
  occurred_at: Date;
  action: string;
  target_type: string;
  target_id: string | null;
  actor_membership_id: string | null;
  admin_name: string | null;
};

export async function listTrashActivity(args: {
  tx: Tx;
  q?: string;
  limit: number;
}): Promise<TrashActivityRow[]> {
  const needle = args.q?.trim() ? `%${args.q.trim().toLowerCase()}%` : null;

  return args.tx.$queryRaw<TrashActivityRow[]>`
    select
      ae.id::text as id,
      ae.occurred_at,
      ae.action,
      ae.target_type,
      ae.target_id::text as target_id,
      ae.actor_membership_id::text as actor_membership_id,
      coalesce(nullif(mp.display_name, ''), m.invited_email_normalized, 'Admin') as admin_name
    from audit_entries ae
    left join memberships m on m.id = ae.actor_membership_id
    left join member_profiles mp on mp.membership_id = ae.actor_membership_id
    where ae.action in (
      'course.archived',
      'course.module.deleted',
      'course.lesson.deleted',
      'content.trash.restored',
      'content.trash.purged'
    )
      and (
        ${needle}::text is null
        or lower(coalesce(mp.display_name, '')) like ${needle}
        or lower(coalesce(m.invited_email_normalized, '')) like ${needle}
      )
    order by ae.occurred_at desc, ae.id desc
    limit ${args.limit}
  `;
}
