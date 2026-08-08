import { randomUUID } from "node:crypto";
import type { TenantTx } from "@atlas/db";

export type SubSchoolRow = {
  id: string;
  tenant_id: string;
  key: string;
  name: string;
  description: string | null;
  mobile_number: string | null;
  email: string | null;
  password_hash: string | null;
  status: string;
  created_at: Date;
  updated_at: Date;
};

function mapSubSchoolRow(row: Record<string, unknown>): SubSchoolRow {
  return {
    id: String(row["id"]),
    tenant_id: String(row["tenant_id"]),
    key: String(row["key"]),
    name: String(row["name"]),
    description: typeof row["description"] === "string" ? row["description"] : null,
    mobile_number: typeof row["mobile_number"] === "string" ? row["mobile_number"] : null,
    email: typeof row["email"] === "string" ? row["email"] : null,
    password_hash: typeof row["password_hash"] === "string" ? row["password_hash"] : null,
    status: String(row["status"]),
    created_at: row["created_at"] as Date,
    updated_at: row["updated_at"] as Date,
  };
}

export const subSchoolsRepository = {
  async insertSubSchool(
    tx: TenantTx,
    args: {
      key: string;
      name: string;
      description?: string | null;
      mobileNumber: string;
      email: string;
      passwordHash: string;
      status: string;
    },
  ): Promise<SubSchoolRow> {
    const id = randomUUID();
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      insert into sub_schools (
        id, tenant_id, key, name, description, mobile_number, email, password_hash, status, created_at, updated_at
      )
      values (
        ${id}::uuid,
        current_setting('app.tenant_id', true)::uuid,
        ${args.key},
        ${args.name},
        ${args.description ?? null},
        ${args.mobileNumber},
        ${args.email},
        ${args.passwordHash},
        ${args.status}::"EntityStatus",
        now(),
        now()
      )
      returning *
    `;
    const row = rows[0];
    if (!row) throw new Error("SUB_SCHOOL_INSERT_FAILED");
    return mapSubSchoolRow(row);
  },

  async listSubSchools(tx: TenantTx): Promise<SubSchoolRow[]> {
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      select * from sub_schools order by name asc limit 500
    `;
    return rows.map(mapSubSchoolRow);
  },

  async findSubSchoolById(tx: TenantTx, subSchoolId: string): Promise<SubSchoolRow | null> {
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      select * from sub_schools where id = ${subSchoolId}::uuid limit 1
    `;
    return rows[0] ? mapSubSchoolRow(rows[0]) : null;
  },

  async findSubSchoolByKey(tx: TenantTx, key: string): Promise<SubSchoolRow | null> {
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      select * from sub_schools where key = ${key} limit 1
    `;
    return rows[0] ? mapSubSchoolRow(rows[0]) : null;
  },

  async findSubSchoolByEmail(tx: TenantTx, email: string): Promise<SubSchoolRow | null> {
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      select * from sub_schools where lower(email) = lower(${email}) limit 1
    `;
    return rows[0] ? mapSubSchoolRow(rows[0]) : null;
  },

  async updateSubSchool(
    tx: TenantTx,
    subSchoolId: string,
    args: {
      name?: string;
      description?: string | null;
      mobileNumber?: string;
      email?: string;
      passwordHash?: string;
      status?: string;
    },
  ): Promise<SubSchoolRow | null> {
    const existing = await this.findSubSchoolById(tx, subSchoolId);
    if (!existing) return null;

    const nextDescription =
      args.description !== undefined ? args.description : existing.description;
    const nextMobile =
      args.mobileNumber !== undefined ? args.mobileNumber : existing.mobile_number;
    const nextEmail = args.email !== undefined ? args.email : existing.email;
    const nextPasswordHash =
      args.passwordHash !== undefined ? args.passwordHash : existing.password_hash;

    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      update sub_schools
      set
        name = ${args.name ?? existing.name},
        description = ${nextDescription},
        mobile_number = ${nextMobile},
        email = ${nextEmail},
        password_hash = ${nextPasswordHash},
        status = ${(args.status ?? existing.status)}::"EntityStatus",
        updated_at = now()
      where id = ${subSchoolId}::uuid
      returning *
    `;
    return rows[0] ? mapSubSchoolRow(rows[0]) : null;
  },

  async deleteSubSchool(tx: TenantTx, subSchoolId: string): Promise<boolean> {
    // Prefer RETURNING over $executeRaw rowCount — PrismaPg adapters often report 0
    // affected rows for DELETE, which would falsely fail and roll the delete back.
    const rows = await tx.$queryRaw<Array<{ id: string }>>`
      delete from sub_schools where id = ${subSchoolId}::uuid
      returning id::text as id
    `;
    return rows.length > 0;
  },
};
