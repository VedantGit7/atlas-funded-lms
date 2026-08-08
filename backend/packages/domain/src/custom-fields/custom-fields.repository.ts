import { randomUUID } from "node:crypto";
import type { TenantTx } from "@atlas/db";

export type CustomFieldDefinitionRow = {
  id: string;
  key: string;
  label: string;
  field_type: string;
  status: string;
  created_at: Date;
};

export type CustomFieldValueRow = {
  custom_field_definition_id: string;
  membership_id: string;
  value_json: unknown;
  updated_at: Date;
  updated_by_membership_id: string | null;
};

export const customFieldsRepository = {
  async insertDefinition(
    tx: TenantTx,
    args: {
      key: string;
      label: string;
      fieldType: string;
      optionsJson?: unknown;
      status: string;
    },
  ): Promise<CustomFieldDefinitionRow> {
    const id = randomUUID();
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      insert into custom_field_definitions (id, tenant_id, key, label, field_type, options_json, status, created_at, updated_at)
      values (
        ${id}::uuid,
        current_setting('app.tenant_id', true)::uuid,
        ${args.key},
        ${args.label},
        ${args.fieldType},
        ${args.optionsJson ? JSON.stringify(args.optionsJson) : null}::jsonb,
        ${args.status}::"EntityStatus",
        now(),
        now()
      )
      returning id, key, label, field_type, status, created_at
    `;
    const row = rows[0];
    if (!row) throw new Error("CUSTOM_FIELD_DEFINITION_INSERT_FAILED");
    return {
      id: String(row["id"]),
      key: String(row["key"]),
      label: String(row["label"]),
      field_type: String(row["field_type"]),
      status: String(row["status"]),
      created_at: row["created_at"] as Date,
    };
  },

  async listDefinitions(tx: TenantTx): Promise<CustomFieldDefinitionRow[]> {
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      select id, key, label, field_type, status, created_at
      from custom_field_definitions
      order by key asc
    `;
    return rows.map((row) => ({
      id: String(row["id"]),
      key: String(row["key"]),
      label: String(row["label"]),
      field_type: String(row["field_type"]),
      status: String(row["status"]),
      created_at: row["created_at"] as Date,
    }));
  },

  async findDefinitionById(tx: TenantTx, definitionId: string): Promise<CustomFieldDefinitionRow | null> {
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      select id, key, label, field_type, status, created_at
      from custom_field_definitions where id = ${definitionId}::uuid limit 1
    `;
    const row = rows[0];
    if (!row) return null;
    return {
      id: String(row["id"]),
      key: String(row["key"]),
      label: String(row["label"]),
      field_type: String(row["field_type"]),
      status: String(row["status"]),
      created_at: row["created_at"] as Date,
    };
  },

  async updateDefinition(
    tx: TenantTx,
    definitionId: string,
    args: { label?: string; status?: string; optionsJson?: unknown },
  ): Promise<CustomFieldDefinitionRow | null> {
    const existing = await this.findDefinitionById(tx, definitionId);
    if (!existing) return null;

    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      update custom_field_definitions
      set
        label = ${args.label ?? existing.label},
        status = ${(args.status ?? existing.status)}::"EntityStatus",
        options_json = ${args.optionsJson !== undefined ? JSON.stringify(args.optionsJson) : null}::jsonb,
        updated_at = now()
      where id = ${definitionId}::uuid
      returning id, key, label, field_type, status, created_at
    `;
    const row = rows[0];
    if (!row) return null;
    return {
      id: String(row["id"]),
      key: String(row["key"]),
      label: String(row["label"]),
      field_type: String(row["field_type"]),
      status: String(row["status"]),
      created_at: row["created_at"] as Date,
    };
  },

  async deleteDefinition(tx: TenantTx, definitionId: string): Promise<boolean> {
    const count = await tx.$executeRaw`
      delete from custom_field_definitions where id = ${definitionId}::uuid
    `;
    return count > 0;
  },

  async upsertValue(
    tx: TenantTx,
    args: {
      definitionId: string;
      membershipId: string;
      valueJson: unknown;
      updatedByMembershipId?: string | null;
    },
  ): Promise<CustomFieldValueRow> {
    const existingRows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      select value_json
      from custom_field_values
      where tenant_id = current_setting('app.tenant_id', true)::uuid
        and custom_field_definition_id = ${args.definitionId}::uuid
        and membership_id = ${args.membershipId}::uuid
      limit 1
    `;
    const oldValue = existingRows[0]?.["value_json"] ?? null;

    const id = randomUUID();
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      insert into custom_field_values (
        id,
        tenant_id,
        custom_field_definition_id,
        membership_id,
        value_json,
        updated_by_membership_id,
        created_at,
        updated_at
      )
      values (
        ${id}::uuid,
        current_setting('app.tenant_id', true)::uuid,
        ${args.definitionId}::uuid,
        ${args.membershipId}::uuid,
        ${JSON.stringify(args.valueJson)}::jsonb,
        ${args.updatedByMembershipId ?? null}::uuid,
        now(),
        now()
      )
      on conflict (tenant_id, custom_field_definition_id, membership_id) do update
      set
        value_json = excluded.value_json,
        updated_by_membership_id = excluded.updated_by_membership_id,
        updated_at = now()
      returning
        custom_field_definition_id,
        membership_id,
        value_json,
        updated_at,
        updated_by_membership_id
    `;
    const row = rows[0];
    if (!row) throw new Error("CUSTOM_FIELD_VALUE_UPSERT_FAILED");

    const oldSerialized = JSON.stringify(oldValue);
    const newSerialized = JSON.stringify(args.valueJson);
    if (oldSerialized !== newSerialized) {
      await tx.$executeRaw`
        insert into custom_field_value_history (
          id,
          tenant_id,
          custom_field_definition_id,
          membership_id,
          old_value_json,
          new_value_json,
          changed_by_membership_id,
          changed_at
        )
        values (
          ${randomUUID()}::uuid,
          current_setting('app.tenant_id', true)::uuid,
          ${args.definitionId}::uuid,
          ${args.membershipId}::uuid,
          ${oldValue == null ? null : JSON.stringify(oldValue)}::jsonb,
          ${JSON.stringify(args.valueJson)}::jsonb,
          ${args.updatedByMembershipId ?? null}::uuid,
          now()
        )
      `;
    }

    return {
      custom_field_definition_id: String(row["custom_field_definition_id"]),
      membership_id: String(row["membership_id"]),
      value_json: row["value_json"],
      updated_at: row["updated_at"] as Date,
      updated_by_membership_id:
        row["updated_by_membership_id"] == null
          ? null
          : String(row["updated_by_membership_id"]),
    };
  },

  async clearValue(
    tx: TenantTx,
    args: {
      definitionId: string;
      membershipId: string;
      updatedByMembershipId?: string | null;
    },
  ): Promise<boolean> {
    const existingRows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      select value_json
      from custom_field_values
      where tenant_id = current_setting('app.tenant_id', true)::uuid
        and custom_field_definition_id = ${args.definitionId}::uuid
        and membership_id = ${args.membershipId}::uuid
      limit 1
    `;
    const existing = existingRows[0];
    if (!existing) return false;

    await tx.$executeRaw`
      insert into custom_field_value_history (
        id,
        tenant_id,
        custom_field_definition_id,
        membership_id,
        old_value_json,
        new_value_json,
        changed_by_membership_id,
        changed_at
      )
      values (
        ${randomUUID()}::uuid,
        current_setting('app.tenant_id', true)::uuid,
        ${args.definitionId}::uuid,
        ${args.membershipId}::uuid,
        ${JSON.stringify(existing["value_json"])}::jsonb,
        null,
        ${args.updatedByMembershipId ?? null}::uuid,
        now()
      )
    `;

    const count = await tx.$executeRaw`
      delete from custom_field_values
      where tenant_id = current_setting('app.tenant_id', true)::uuid
        and custom_field_definition_id = ${args.definitionId}::uuid
        and membership_id = ${args.membershipId}::uuid
    `;
    return count > 0;
  },

  async listValuesForDefinition(tx: TenantTx, definitionId: string): Promise<CustomFieldValueRow[]> {
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      select
        custom_field_definition_id,
        membership_id,
        value_json,
        updated_at,
        updated_by_membership_id
      from custom_field_values
      where custom_field_definition_id = ${definitionId}::uuid
      order by updated_at desc
    `;
    return rows.map((row) => ({
      custom_field_definition_id: String(row["custom_field_definition_id"]),
      membership_id: String(row["membership_id"]),
      value_json: row["value_json"],
      updated_at: row["updated_at"] as Date,
      updated_by_membership_id:
        row["updated_by_membership_id"] == null
          ? null
          : String(row["updated_by_membership_id"]),
    }));
  },
};
