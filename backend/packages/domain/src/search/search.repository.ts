import { randomUUID } from "node:crypto";
import type { TenantTx } from "@atlas/db";
import type { SearchIndexProjection, SearchIndexRow, SearchSourceType } from "./search.types";

let pgTrgmAvailable: boolean | null = null;

async function canUsePgTrgm(tx: TenantTx): Promise<boolean> {
  if (pgTrgmAvailable !== null) {
    return pgTrgmAvailable;
  }

  const rows = await tx.$queryRaw<Array<{ available: boolean }>>`
    select exists(select 1 from pg_extension where extname = 'pg_trgm') as available
  `;

  pgTrgmAvailable = Boolean(rows[0]?.available);
  return pgTrgmAvailable;
}

export const searchRepository = {
  async upsertIndexEntry(tx: TenantTx, projection: SearchIndexProjection): Promise<SearchIndexRow> {
    const id = randomUUID();
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      insert into search_index_entries (
        id,
        tenant_id,
        source_context,
        source_type,
        source_id,
        title,
        body,
        visibility,
        access_json,
        vector_ref,
        updated_at
      )
      values (
        ${id}::uuid,
        current_setting('app.tenant_id')::uuid,
        ${projection.sourceContext},
        ${projection.sourceType},
        ${projection.sourceId}::uuid,
        ${projection.title},
        ${projection.body},
        ${projection.visibility}::"Visibility",
        ${projection.accessJson ? JSON.stringify(projection.accessJson) : null}::jsonb,
        null,
        now()
      )
      on conflict (tenant_id, source_context, source_type, source_id)
      do update set
        title = excluded.title,
        body = excluded.body,
        visibility = excluded.visibility,
        access_json = excluded.access_json,
        updated_at = now()
      returning *
    `;

    return mapSearchIndexRow(rows[0]);
  },

  async removeIndexEntry(
    tx: TenantTx,
    args: {
      sourceContext: string;
      sourceType: SearchSourceType;
      sourceId: string;
    },
  ): Promise<void> {
    await tx.$executeRaw`
      delete from search_index_entries
      where tenant_id = current_setting('app.tenant_id')::uuid
        and source_context = ${args.sourceContext}
        and source_type = ${args.sourceType}
        and source_id = ${args.sourceId}::uuid
    `;
  },

  async queryIndexEntries(
    tx: TenantTx,
    args: {
      q: string | null;
      sourceType: SearchSourceType | null;
      cursor: string | null;
      limit: number;
    },
  ): Promise<SearchIndexRow[]> {
    if (!args.q) {
      return [];
    }

    const queryText = args.q;
    const useTrigram = await canUsePgTrgm(tx);
    return queryIndexEntriesInternal(
      tx,
      {
        q: queryText,
        sourceType: args.sourceType,
        cursor: args.cursor,
        limit: args.limit,
      },
      useTrigram,
    );
  },

  async findIndexEntryByIdentity(
    tx: TenantTx,
    args: {
      sourceContext: string;
      sourceType: SearchSourceType;
      sourceId: string;
    },
  ): Promise<SearchIndexRow | null> {
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      select *
      from search_index_entries
      where tenant_id = current_setting('app.tenant_id')::uuid
        and source_context = ${args.sourceContext}
        and source_type = ${args.sourceType}
        and source_id = ${args.sourceId}::uuid
      limit 1
    `;

    const row = rows[0];
    return row ? mapSearchIndexRow(row) : null;
  },
};

async function queryIndexEntriesInternal(
  tx: TenantTx,
  args: {
    q: string;
    sourceType: SearchSourceType | null;
    cursor: string | null;
    limit: number;
  },
  useTrigram: boolean,
): Promise<SearchIndexRow[]> {
  const rows = useTrigram
    ? await tx.$queryRaw<Array<Record<string, unknown>>>`
        select *
        from search_index_entries
        where tenant_id = current_setting('app.tenant_id')::uuid
          and (${args.sourceType}::text is null or source_type = ${args.sourceType})
          and (
            to_tsvector('english', coalesce(title, '') || ' ' || coalesce(body, ''))
              @@ websearch_to_tsquery('english', ${args.q})
            or (coalesce(title, '') || ' ' || coalesce(body, '')) %> ${args.q}
          )
          and (
            ${args.cursor}::uuid is null
            or id < ${args.cursor ?? null}::uuid
          )
        order by
          ts_rank(
            to_tsvector('english', coalesce(title, '') || ' ' || coalesce(body, '')),
            websearch_to_tsquery('english', ${args.q})
          ) desc,
          updated_at desc,
          id desc
        limit ${args.limit + 1}
      `
    : await tx.$queryRaw<Array<Record<string, unknown>>>`
        select *
        from search_index_entries
        where tenant_id = current_setting('app.tenant_id')::uuid
          and (${args.sourceType}::text is null or source_type = ${args.sourceType})
          and (
            to_tsvector('english', coalesce(title, '') || ' ' || coalesce(body, ''))
              @@ websearch_to_tsquery('english', ${args.q})
          )
          and (
            ${args.cursor}::uuid is null
            or id < ${args.cursor ?? null}::uuid
          )
        order by
          ts_rank(
            to_tsvector('english', coalesce(title, '') || ' ' || coalesce(body, '')),
            websearch_to_tsquery('english', ${args.q})
          ) desc,
          updated_at desc,
          id desc
        limit ${args.limit + 1}
      `;

  return rows.map(mapSearchIndexRow);
}

function mapSearchIndexRow(row: Record<string, unknown> | undefined): SearchIndexRow {
  if (!row) {
    throw new Error("Expected search index row.");
  }

  const rawBody = row["body"];
  const rawVectorRef = row["vector_ref"];

  return {
    id: String(row["id"]),
    tenant_id: String(row["tenant_id"]),
    source_context: String(row["source_context"]),
    source_type: String(row["source_type"]) as SearchSourceType,
    source_id: String(row["source_id"]),
    title: String(row["title"]),
    body: typeof rawBody === "string" ? rawBody : rawBody == null ? null : null,
    visibility: String(row["visibility"]),
    access_json:
      row["access_json"] && typeof row["access_json"] === "object"
        ? (row["access_json"] as Record<string, unknown>)
        : null,
    vector_ref: typeof rawVectorRef === "string" ? rawVectorRef : null,
    updated_at: row["updated_at"] as Date,
  };
}

export function buildSearchSnippet(title: string, body: string | null, q: string): string {
  const haystack = `${title} ${body ?? ""}`.trim();
  const lowerHaystack = haystack.toLowerCase();
  const lowerQ = q.toLowerCase();
  const index = lowerHaystack.indexOf(lowerQ);

  if (index >= 0) {
    const start = Math.max(0, index - 40);
    const end = Math.min(haystack.length, index + lowerQ.length + 80);
    const prefix = start > 0 ? "…" : "";
    const suffix = end < haystack.length ? "…" : "";
    return `${prefix}${haystack.slice(start, end).trim()}${suffix}`;
  }

  return haystack.slice(0, 160);
}
