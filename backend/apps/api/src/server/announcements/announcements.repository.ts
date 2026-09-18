import { randomUUID } from "node:crypto";
import type { TenantTx } from "@atlas/db";

export type AnnouncementRow = {
  id: string;
  title: string;
  message: string;
  type: string;
  audience_batch_id: string | null;
  audience_batch_name: string | null;
  deep_link: string | null;
  image_url: string | null;
  status: string;
  recipient_count: number;
  sent_at: Date | null;
  created_by_membership_id: string;
  created_at: Date;
  updated_at: Date;
};

export const announcementsRepository = {
  async list(
    tx: TenantTx,
    args: {
      type?: string;
      q?: string;
      createdOn?: string;
      createdMonth?: string;
      limit: number;
    },
  ): Promise<AnnouncementRow[]> {
    const type = args.type && args.type !== "ALL" ? args.type : null;
    const q = args.q?.trim() ?? "";
    const createdOn = args.createdOn ?? null;
    const createdMonth = args.createdMonth ?? null;
    const monthStart = createdMonth ? `${createdMonth}-01` : null;
    const monthEndExclusive = createdMonth
      ? (() => {
          const [yearRaw, monthRaw] = createdMonth.split("-");
          const year = Number(yearRaw);
          const month = Number(monthRaw);
          const next = month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 };
          return `${String(next.year).padStart(4, "0")}-${String(next.month).padStart(2, "0")}-01`;
        })()
      : null;

    return tx.$queryRaw<AnnouncementRow[]>`
      select
        a.id::text,
        a.title,
        a.message,
        a.type,
        a.audience_batch_id::text,
        b.name as audience_batch_name,
        a.deep_link,
        a.image_url,
        a.status,
        a.recipient_count,
        a.sent_at,
        a.created_by_membership_id::text,
        a.created_at,
        a.updated_at
      from announcements a
      left join batches b
        on b.id = a.audience_batch_id
       and b.tenant_id = a.tenant_id
      where (
        ${type}::text is null or a.type = ${type}
      )
      and (
        ${q} = ''
        or a.title ilike '%' || ${q} || '%'
        or a.message ilike '%' || ${q} || '%'
      )
      and (
        ${createdOn}::text is null
        or a.created_at::date = ${createdOn}::date
      )
      and (
        ${monthStart}::text is null
        or (
          a.created_at >= ${monthStart}::date
          and a.created_at < ${monthEndExclusive}::date
        )
      )
      order by a.created_at desc
      limit ${args.limit}
    `;
  },

  async findById(tx: TenantTx, id: string): Promise<AnnouncementRow | null> {
    const rows = await tx.$queryRaw<AnnouncementRow[]>`
      select
        a.id::text,
        a.title,
        a.message,
        a.type,
        a.audience_batch_id::text,
        b.name as audience_batch_name,
        a.deep_link,
        a.image_url,
        a.status,
        a.recipient_count,
        a.sent_at,
        a.created_by_membership_id::text,
        a.created_at,
        a.updated_at
      from announcements a
      left join batches b
        on b.id = a.audience_batch_id
       and b.tenant_id = a.tenant_id
      where a.id = ${id}::uuid
      limit 1
    `;
    return rows[0] ?? null;
  },

  async insertSent(
    tx: TenantTx,
    args: {
      title: string;
      message: string;
      type: string;
      audienceBatchId: string | null;
      deepLink: string | null;
      imageUrl: string | null;
      recipientCount: number;
      createdByMembershipId: string;
    },
  ): Promise<string> {
    const id = randomUUID();
    await tx.$executeRaw`
      insert into announcements (
        id,
        tenant_id,
        title,
        message,
        type,
        audience_batch_id,
        deep_link,
        image_url,
        status,
        recipient_count,
        sent_at,
        created_by_membership_id,
        created_at,
        updated_at
      )
      values (
        ${id}::uuid,
        current_setting('app.tenant_id', true)::uuid,
        ${args.title},
        ${args.message},
        ${args.type},
        ${args.audienceBatchId}::uuid,
        ${args.deepLink},
        ${args.imageUrl},
        'SENT',
        ${args.recipientCount},
        now(),
        ${args.createdByMembershipId}::uuid,
        now(),
        now()
      )
    `;
    return id;
  },

  async deleteById(tx: TenantTx, id: string): Promise<boolean> {
    const rows = await tx.$queryRaw<Array<{ id: string }>>`
      delete from announcements where id = ${id}::uuid returning id::text
    `;
    return rows.length > 0;
  },

  async listActiveMembershipIds(tx: TenantTx, limit = 2000): Promise<string[]> {
    const rows = await tx.$queryRaw<Array<{ id: string }>>`
      select id::text
      from memberships
      where status = 'ACTIVE'
        and archived_at is null
      order by created_at desc
      limit ${limit}
    `;
    return rows.map((row) => row.id);
  },

  async listBatchMembershipIds(tx: TenantTx, batchId: string, limit = 2000): Promise<string[]> {
    const rows = await tx.$queryRaw<Array<{ membership_id: string }>>`
      select bm.membership_id::text
      from batch_memberships bm
      join memberships m
        on m.id = bm.membership_id
       and m.tenant_id = bm.tenant_id
      where bm.batch_id = ${batchId}::uuid
        and m.status = 'ACTIVE'
        and m.archived_at is null
      order by bm.joined_at desc
      limit ${limit}
    `;
    return rows.map((row) => row.membership_id);
  },

  async batchExists(tx: TenantTx, batchId: string): Promise<boolean> {
    const rows = await tx.$queryRaw<Array<{ id: string }>>`
      select id::text from batches where id = ${batchId}::uuid limit 1
    `;
    return rows.length > 0;
  },
};
