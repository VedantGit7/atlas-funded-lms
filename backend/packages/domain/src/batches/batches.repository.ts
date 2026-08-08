import { randomUUID } from "node:crypto";
import type { TenantTx } from "@atlas/db";

export type BatchRow = {
  id: string;
  tenant_id: string;
  key: string;
  name: string;
  course_id: string | null;
  status: string;
  metadata_json: unknown;
  created_at: Date;
  updated_at: Date;
};

function mapBatchRow(row: Record<string, unknown>): BatchRow {
  return {
    id: String(row["id"]),
    tenant_id: String(row["tenant_id"]),
    key: String(row["key"]),
    name: String(row["name"]),
    course_id: typeof row["course_id"] === "string" ? row["course_id"] : null,
    status: String(row["status"]),
    metadata_json: row["metadata_json"] ?? null,
    created_at: row["created_at"] as Date,
    updated_at: row["updated_at"] as Date,
  };
}

export const batchesRepository = {
  async insertBatch(
    tx: TenantTx,
    args: {
      key: string;
      name: string;
      courseId?: string | null;
      status: string;
      metadataJson?: unknown;
    },
  ): Promise<BatchRow> {
    const id = randomUUID();
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      insert into batches (id, tenant_id, key, name, course_id, status, metadata_json, created_at, updated_at)
      values (
        ${id}::uuid,
        current_setting('app.tenant_id', true)::uuid,
        ${args.key},
        ${args.name},
        ${args.courseId ?? null}::uuid,
        ${args.status}::"EntityStatus",
        ${args.metadataJson ? JSON.stringify(args.metadataJson) : null}::jsonb,
        now(),
        now()
      )
      returning *
    `;
    const row = rows[0];
    if (!row) throw new Error("BATCH_INSERT_FAILED");
    return mapBatchRow(row);
  },

  async listBatches(tx: TenantTx): Promise<BatchRow[]> {
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      select * from batches order by created_at desc limit 100
    `;
    return rows.map(mapBatchRow);
  },

  async findBatchById(tx: TenantTx, batchId: string): Promise<BatchRow | null> {
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      select * from batches where id = ${batchId}::uuid limit 1
    `;
    return rows[0] ? mapBatchRow(rows[0]) : null;
  },

  async updateBatch(
    tx: TenantTx,
    batchId: string,
    args: { name?: string; status?: string; metadataJson?: unknown },
  ): Promise<BatchRow | null> {
    const existing = await this.findBatchById(tx, batchId);
    if (!existing) return null;

    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      update batches
      set
        name = ${args.name ?? existing.name},
        status = ${(args.status ?? existing.status)}::"EntityStatus",
        metadata_json = ${args.metadataJson !== undefined ? JSON.stringify(args.metadataJson) : existing.metadata_json}::jsonb,
        updated_at = now()
      where id = ${batchId}::uuid
      returning *
    `;
    return rows[0] ? mapBatchRow(rows[0]) : null;
  },

  async deleteBatch(tx: TenantTx, batchId: string): Promise<boolean> {
    const count = await tx.$executeRaw`
      delete from batches where id = ${batchId}::uuid
    `;
    return count > 0;
  },

  async assignMember(
    tx: TenantTx,
    args: { batchId: string; membershipId: string },
  ): Promise<{ joined_at: Date }> {
    const id = randomUUID();
    const rows = await tx.$queryRaw<Array<{ joined_at: Date }>>`
      insert into batch_memberships (id, tenant_id, batch_id, membership_id, joined_at, created_at, updated_at)
      values (
        ${id}::uuid,
        current_setting('app.tenant_id', true)::uuid,
        ${args.batchId}::uuid,
        ${args.membershipId}::uuid,
        now(),
        now(),
        now()
      )
      on conflict (tenant_id, batch_id, membership_id) do update set updated_at = now()
      returning joined_at
    `;
    const row = rows[0];
    if (!row) throw new Error("BATCH_MEMBER_ASSIGN_FAILED");
    return row;
  },
};
