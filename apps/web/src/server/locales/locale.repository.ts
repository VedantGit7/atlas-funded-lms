import { randomUUID } from "node:crypto";
import type { TenantTx } from "@atlas/db";
import type { LocaleResourceRow } from "./locale.types";

export const localeRepository = {
  async listResources(tx: TenantTx, tenantId: string): Promise<LocaleResourceRow[]> {
    return tx.$queryRaw<LocaleResourceRow[]>`
      select
        id::text,
        tenant_id::text,
        locale,
        key,
        value,
        updated_at
      from locale_resources
      where tenant_id = ${tenantId}::uuid
      order by locale asc, key asc
    `;
  },

  async listResourcesByLocale(
    tx: TenantTx,
    tenantId: string,
    locale: string,
  ): Promise<LocaleResourceRow[]> {
    return tx.$queryRaw<LocaleResourceRow[]>`
      select
        id::text,
        tenant_id::text,
        locale,
        key,
        value,
        updated_at
      from locale_resources
      where tenant_id = ${tenantId}::uuid
        and locale = ${locale}
      order by key asc
    `;
  },

  async upsertResource(
    tx: TenantTx,
    args: {
      tenantId: string;
      locale: string;
      key: string;
      value: string;
    },
  ): Promise<LocaleResourceRow> {
    const existing = await tx.$queryRaw<LocaleResourceRow[]>`
      select id::text
      from locale_resources
      where tenant_id = ${args.tenantId}::uuid
        and locale = ${args.locale}
        and key = ${args.key}
      limit 1
    `;

    if (existing[0]) {
      const rows = await tx.$queryRaw<LocaleResourceRow[]>`
        update locale_resources
        set
          value = ${args.value},
          updated_at = now()
        where id = ${existing[0].id}::uuid
        returning
          id::text,
          tenant_id::text,
          locale,
          key,
          value,
          updated_at
      `;
      const row = rows[0];
      if (!row) throw new Error("Failed to update locale resource.");
      return row;
    }

    const id = randomUUID();
    const rows = await tx.$queryRaw<LocaleResourceRow[]>`
      insert into locale_resources (
        id,
        tenant_id,
        locale,
        key,
        value,
        updated_at
      )
      values (
        ${id}::uuid,
        ${args.tenantId}::uuid,
        ${args.locale},
        ${args.key},
        ${args.value},
        now()
      )
      returning
        id::text,
        tenant_id::text,
        locale,
        key,
        value,
        updated_at
    `;
    const row = rows[0];
    if (!row) throw new Error("Failed to create locale resource.");
    return row;
  },
};
