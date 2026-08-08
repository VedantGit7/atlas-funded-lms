import { randomUUID } from "node:crypto";
import type { TenantTx } from "@atlas/db";

export type ManageReviewRow = {
  id: string;
  course_id: string;
  course_title: string;
  membership_id: string;
  author_name: string | null;
  author_email: string | null;
  rating: number;
  comment: string | null;
  status: string;
  admin_note: string | null;
  created_at: Date;
  updated_at: Date;
};

export const manageReviewsRepository = {
  async listReviews(
    tx: TenantTx,
    args: { q?: string; status?: string; limit: number },
  ): Promise<ManageReviewRow[]> {
    const q = args.q?.trim() ?? "";
    const status = args.status ?? null;

    return tx.$queryRaw<ManageReviewRow[]>`
      select
        cr.id::text,
        cr.course_id::text,
        c.title as course_title,
        cr.membership_id::text,
        mp.display_name as author_name,
        ap.email as author_email,
        cr.rating,
        cr.comment,
        coalesce(cr.status, 'APPROVED') as status,
        cr.admin_note,
        cr.created_at,
        cr.updated_at
      from course_reviews cr
      join courses c on c.id = cr.course_id and c.tenant_id = cr.tenant_id
      left join member_profiles mp
        on mp.membership_id = cr.membership_id and mp.tenant_id = cr.tenant_id
      left join memberships m
        on m.id = cr.membership_id and m.tenant_id = cr.tenant_id
      left join auth_principals ap
        on ap.id = m.auth_principal_id
      where (
        ${status}::text is null
        or coalesce(cr.status, 'APPROVED') = ${status}
      )
      and (
        ${q} = ''
        or c.title ilike '%' || ${q} || '%'
        or coalesce(mp.display_name, '') ilike '%' || ${q} || '%'
        or coalesce(ap.email, '') ilike '%' || ${q} || '%'
        or coalesce(cr.comment, '') ilike '%' || ${q} || '%'
      )
      order by cr.created_at desc
      limit ${args.limit}
    `;
  },

  async findById(tx: TenantTx, reviewId: string): Promise<ManageReviewRow | null> {
    const rows = await tx.$queryRaw<ManageReviewRow[]>`
      select
        cr.id::text,
        cr.course_id::text,
        c.title as course_title,
        cr.membership_id::text,
        mp.display_name as author_name,
        ap.email as author_email,
        cr.rating,
        cr.comment,
        coalesce(cr.status, 'APPROVED') as status,
        cr.admin_note,
        cr.created_at,
        cr.updated_at
      from course_reviews cr
      join courses c on c.id = cr.course_id and c.tenant_id = cr.tenant_id
      left join member_profiles mp
        on mp.membership_id = cr.membership_id and mp.tenant_id = cr.tenant_id
      left join memberships m
        on m.id = cr.membership_id and m.tenant_id = cr.tenant_id
      left join auth_principals ap
        on ap.id = m.auth_principal_id
      where cr.id = ${reviewId}::uuid
      limit 1
    `;
    return rows[0] ?? null;
  },

  async updateReview(
    tx: TenantTx,
    reviewId: string,
    args: {
      rating?: number;
      comment?: string | null;
      status?: string;
      adminNote?: string | null;
    },
  ): Promise<ManageReviewRow | null> {
    await tx.$executeRaw`
      update course_reviews
      set
        rating = coalesce(${args.rating ?? null}, rating),
        comment = case
          when ${args.comment !== undefined}::boolean then ${args.comment ?? null}
          else comment
        end,
        status = coalesce(${args.status ?? null}, status),
        admin_note = case
          when ${args.adminNote !== undefined}::boolean then ${args.adminNote ?? null}
          else admin_note
        end,
        updated_at = now()
      where id = ${reviewId}::uuid
    `;
    return this.findById(tx, reviewId);
  },

  async deleteReview(tx: TenantTx, reviewId: string): Promise<boolean> {
    const rows = await tx.$queryRaw<Array<{ id: string }>>`
      delete from course_reviews where id = ${reviewId}::uuid returning id::text
    `;
    return rows.length > 0;
  },

  async insertAdminReview(
    tx: TenantTx,
    args: {
      courseId: string;
      membershipId: string;
      rating: number;
      comment: string | null;
      status: string;
    },
  ): Promise<string> {
    const id = randomUUID();
    await tx.$executeRaw`
      insert into course_reviews (
        id, tenant_id, course_id, membership_id, rating, comment, status, created_at, updated_at
      )
      values (
        ${id}::uuid,
        current_setting('app.tenant_id', true)::uuid,
        ${args.courseId}::uuid,
        ${args.membershipId}::uuid,
        ${args.rating},
        ${args.comment},
        ${args.status},
        now(),
        now()
      )
      on conflict (tenant_id, course_id, membership_id)
      do update set
        rating = excluded.rating,
        comment = excluded.comment,
        status = excluded.status,
        updated_at = now()
    `;
    const existing = await tx.$queryRaw<Array<{ id: string }>>`
      select id::text from course_reviews
      where course_id = ${args.courseId}::uuid
        and membership_id = ${args.membershipId}::uuid
      limit 1
    `;
    return existing[0]?.id ?? id;
  },
};
