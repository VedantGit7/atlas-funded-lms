import { randomUUID } from "node:crypto";
import type { TenantTx } from "@atlas/db";
import type {
  LocaleCanonicalKeyRow,
  LocaleMetadataRow,
  LocaleQaCheckRunRow,
  LocaleQaIssueRow,
  LocaleResourceRow,
  LocaleReviewStatus,
} from "./locale.types";

export const localeRepository = {
  async getTenantDefaultLocale(tx: TenantTx, tenantId: string): Promise<string> {
    const rows = await tx.$queryRaw<Array<{ default_locale: string }>>`
      select default_locale
      from tenants
      where id = ${tenantId}::uuid
      limit 1
    `;
    return rows[0]?.default_locale ?? "en";
  },

  async listResources(tx: TenantTx, tenantId: string): Promise<LocaleResourceRow[]> {
    return tx.$queryRaw<LocaleResourceRow[]>`
      select
        id::text,
        tenant_id::text,
        locale,
        key,
        value,
        review_status,
        reviewed_at,
        reviewed_by::text,
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
        review_status,
        reviewed_at,
        reviewed_by::text,
        updated_at
      from locale_resources
      where tenant_id = ${tenantId}::uuid
        and locale = ${locale}
      order by key asc
    `;
  },

  async getResource(
    tx: TenantTx,
    tenantId: string,
    locale: string,
    key: string,
  ): Promise<LocaleResourceRow | null> {
    const rows = await tx.$queryRaw<LocaleResourceRow[]>`
      select
        id::text,
        tenant_id::text,
        locale,
        key,
        value,
        review_status,
        reviewed_at,
        reviewed_by::text,
        updated_at
      from locale_resources
      where tenant_id = ${tenantId}::uuid
        and locale = ${locale}
        and key = ${key}
      limit 1
    `;
    return rows[0] ?? null;
  },

  async upsertResource(
    tx: TenantTx,
    args: {
      tenantId: string;
      locale: string;
      key: string;
      value: string;
      resetReview?: boolean;
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
          review_status = case
            when ${args.resetReview ?? true} then 'pending'
            else review_status
          end,
          reviewed_at = case
            when ${args.resetReview ?? true} then null
            else reviewed_at
          end,
          reviewed_by = case
            when ${args.resetReview ?? true} then null
            else reviewed_by
          end,
          updated_at = now()
        where id = ${existing[0].id}::uuid
        returning
          id::text,
          tenant_id::text,
          locale,
          key,
          value,
          review_status,
          reviewed_at,
          reviewed_by::text,
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
        review_status,
        updated_at
      )
      values (
        ${id}::uuid,
        ${args.tenantId}::uuid,
        ${args.locale},
        ${args.key},
        ${args.value},
        'pending',
        now()
      )
      returning
        id::text,
        tenant_id::text,
        locale,
        key,
        value,
        review_status,
        reviewed_at,
        reviewed_by::text,
        updated_at
    `;
    const row = rows[0];
    if (!row) throw new Error("Failed to create locale resource.");
    return row;
  },

  async deleteResource(
    tx: TenantTx,
    tenantId: string,
    locale: string,
    key: string,
  ): Promise<boolean> {
    const rows = await tx.$queryRaw<Array<{ id: string }>>`
      delete from locale_resources
      where tenant_id = ${tenantId}::uuid
        and locale = ${locale}
        and key = ${key}
      returning id::text
    `;
    return rows.length > 0;
  },

  async updateReviewStatus(
    tx: TenantTx,
    args: {
      tenantId: string;
      locale: string;
      key: string;
      status: Exclude<LocaleReviewStatus, "pending">;
      reviewedBy: string;
    },
  ): Promise<LocaleResourceRow | null> {
    const rows = await tx.$queryRaw<LocaleResourceRow[]>`
      update locale_resources
      set
        review_status = ${args.status},
        reviewed_at = now(),
        reviewed_by = ${args.reviewedBy}::uuid,
        updated_at = now()
      where tenant_id = ${args.tenantId}::uuid
        and locale = ${args.locale}
        and key = ${args.key}
      returning
        id::text,
        tenant_id::text,
        locale,
        key,
        value,
        review_status,
        reviewed_at,
        reviewed_by::text,
        updated_at
    `;
    return rows[0] ?? null;
  },

  async listReviewQueue(tx: TenantTx, tenantId: string): Promise<LocaleResourceRow[]> {
    return tx.$queryRaw<LocaleResourceRow[]>`
      select
        id::text,
        tenant_id::text,
        locale,
        key,
        value,
        review_status,
        reviewed_at,
        reviewed_by::text,
        updated_at
      from locale_resources
      where tenant_id = ${tenantId}::uuid
        and review_status = 'pending'
      order by updated_at desc, locale asc, key asc
    `;
  },

  async countPendingReviews(tx: TenantTx, tenantId: string): Promise<number> {
    const rows = await tx.$queryRaw<Array<{ count: bigint }>>`
      select count(*)::bigint as count
      from locale_resources
      where tenant_id = ${tenantId}::uuid
        and review_status = 'pending'
    `;
    return Number(rows[0]?.count ?? 0n);
  },

  async listMetadata(tx: TenantTx, tenantId: string): Promise<LocaleMetadataRow[]> {
    return tx.$queryRaw<LocaleMetadataRow[]>`
      select
        id::text,
        tenant_id::text,
        locale,
        native_name,
        is_rtl,
        is_default,
        is_fallback,
        created_at,
        updated_at
      from locale_metadata
      where tenant_id = ${tenantId}::uuid
      order by locale asc
    `;
  },

  async getMetadataByLocale(
    tx: TenantTx,
    tenantId: string,
    locale: string,
  ): Promise<LocaleMetadataRow | null> {
    const rows = await tx.$queryRaw<LocaleMetadataRow[]>`
      select
        id::text,
        tenant_id::text,
        locale,
        native_name,
        is_rtl,
        is_default,
        is_fallback,
        created_at,
        updated_at
      from locale_metadata
      where tenant_id = ${tenantId}::uuid
        and locale = ${locale}
      limit 1
    `;
    return rows[0] ?? null;
  },

  async deleteMetadata(tx: TenantTx, tenantId: string, locale: string): Promise<boolean> {
    const rows = await tx.$queryRaw<Array<{ locale: string }>>`
      delete from locale_metadata
      where tenant_id = ${tenantId}::uuid
        and locale = ${locale}
      returning locale
    `;
    return rows.length > 0;
  },

  async clearDefaultLocaleFlags(tx: TenantTx, tenantId: string): Promise<void> {
    await tx.$executeRaw`
      update locale_metadata
      set is_default = false, updated_at = now()
      where tenant_id = ${tenantId}::uuid
        and is_default = true
    `;
  },

  async clearFallbackLocaleFlags(tx: TenantTx, tenantId: string): Promise<void> {
    await tx.$executeRaw`
      update locale_metadata
      set is_fallback = false, updated_at = now()
      where tenant_id = ${tenantId}::uuid
        and is_fallback = true
    `;
  },

  async upsertMetadata(
    tx: TenantTx,
    args: {
      tenantId: string;
      locale: string;
      nativeName: string | null;
      isRtl: boolean;
      isDefault: boolean;
      isFallback: boolean;
    },
  ): Promise<LocaleMetadataRow> {
    const existing = await this.getMetadataByLocale(tx, args.tenantId, args.locale);

    if (existing) {
      const rows = await tx.$queryRaw<LocaleMetadataRow[]>`
        update locale_metadata
        set
          native_name = ${args.nativeName},
          is_rtl = ${args.isRtl},
          is_default = ${args.isDefault},
          is_fallback = ${args.isFallback},
          updated_at = now()
        where id = ${existing.id}::uuid
        returning
          id::text,
          tenant_id::text,
          locale,
          native_name,
          is_rtl,
          is_default,
          is_fallback,
          created_at,
          updated_at
      `;
      const row = rows[0];
      if (!row) throw new Error("Failed to update locale metadata.");
      return row;
    }

    const id = randomUUID();
    const rows = await tx.$queryRaw<LocaleMetadataRow[]>`
      insert into locale_metadata (
        id,
        tenant_id,
        locale,
        native_name,
        is_rtl,
        is_default,
        is_fallback,
        created_at,
        updated_at
      )
      values (
        ${id}::uuid,
        ${args.tenantId}::uuid,
        ${args.locale},
        ${args.nativeName},
        ${args.isRtl},
        ${args.isDefault},
        ${args.isFallback},
        now(),
        now()
      )
      returning
        id::text,
        tenant_id::text,
        locale,
        native_name,
        is_rtl,
        is_default,
        is_fallback,
        created_at,
        updated_at
    `;
    const row = rows[0];
    if (!row) throw new Error("Failed to create locale metadata.");
    return row;
  },

  async listCanonicalKeys(tx: TenantTx, tenantId: string): Promise<LocaleCanonicalKeyRow[]> {
    return tx.$queryRaw<LocaleCanonicalKeyRow[]>`
      select
        id::text,
        tenant_id::text,
        key,
        source_locale,
        description,
        created_at,
        updated_at
      from locale_canonical_keys
      where tenant_id = ${tenantId}::uuid
      order by key asc
    `;
  },

  async upsertCanonicalKey(
    tx: TenantTx,
    args: {
      tenantId: string;
      key: string;
      sourceLocale: string;
    },
  ): Promise<LocaleCanonicalKeyRow> {
    const existing = await tx.$queryRaw<LocaleCanonicalKeyRow[]>`
      select id::text
      from locale_canonical_keys
      where tenant_id = ${args.tenantId}::uuid
        and key = ${args.key}
      limit 1
    `;

    if (existing[0]) {
      const rows = await tx.$queryRaw<LocaleCanonicalKeyRow[]>`
        update locale_canonical_keys
        set
          source_locale = ${args.sourceLocale},
          updated_at = now()
        where id = ${existing[0].id}::uuid
        returning
          id::text,
          tenant_id::text,
          key,
          source_locale,
          description,
          created_at,
          updated_at
      `;
      const row = rows[0];
      if (!row) throw new Error("Failed to update canonical key.");
      return row;
    }

    const id = randomUUID();
    const rows = await tx.$queryRaw<LocaleCanonicalKeyRow[]>`
      insert into locale_canonical_keys (
        id,
        tenant_id,
        key,
        source_locale,
        created_at,
        updated_at
      )
      values (
        ${id}::uuid,
        ${args.tenantId}::uuid,
        ${args.key},
        ${args.sourceLocale},
        now(),
        now()
      )
      returning
        id::text,
        tenant_id::text,
        key,
        source_locale,
        description,
        created_at,
        updated_at
    `;
    const row = rows[0];
    if (!row) throw new Error("Failed to create canonical key.");
    return row;
  },

  async createQaCheckRun(
    tx: TenantTx,
    args: {
      tenantId: string;
      startedBy: string;
      issueCount: number;
    },
  ): Promise<LocaleQaCheckRunRow> {
    const id = randomUUID();
    const rows = await tx.$queryRaw<LocaleQaCheckRunRow[]>`
      insert into locale_qa_check_runs (
        id,
        tenant_id,
        issue_count,
        started_at,
        completed_at,
        started_by
      )
      values (
        ${id}::uuid,
        ${args.tenantId}::uuid,
        ${args.issueCount},
        now(),
        now(),
        ${args.startedBy}::uuid
      )
      returning
        id::text,
        tenant_id::text,
        issue_count,
        started_at,
        completed_at,
        started_by::text
    `;
    const row = rows[0];
    if (!row) throw new Error("Failed to create QA check run.");
    return row;
  },

  async insertQaIssues(
    tx: TenantTx,
    args: {
      tenantId: string;
      runId: string;
      issues: Array<{
        locale: string;
        key: string;
        severity: string;
        issueType: string;
        message: string;
      }>;
    },
  ): Promise<LocaleQaIssueRow[]> {
    if (args.issues.length === 0) return [];

    const inserted: LocaleQaIssueRow[] = [];
    for (const issue of args.issues) {
      const id = randomUUID();
      const rows = await tx.$queryRaw<LocaleQaIssueRow[]>`
        insert into locale_qa_issues (
          id,
          tenant_id,
          run_id,
          locale,
          key,
          severity,
          issue_type,
          message,
          created_at
        )
        values (
          ${id}::uuid,
          ${args.tenantId}::uuid,
          ${args.runId}::uuid,
          ${issue.locale},
          ${issue.key},
          ${issue.severity},
          ${issue.issueType},
          ${issue.message},
          now()
        )
        returning
          id::text,
          tenant_id::text,
          run_id::text,
          locale,
          key,
          severity,
          issue_type,
          message,
          created_at
      `;
      const row = rows[0];
      if (row) inserted.push(row);
    }
    return inserted;
  },

  async getLatestQaCheckRun(
    tx: TenantTx,
    tenantId: string,
  ): Promise<LocaleQaCheckRunRow | null> {
    const rows = await tx.$queryRaw<LocaleQaCheckRunRow[]>`
      select
        id::text,
        tenant_id::text,
        issue_count,
        started_at,
        completed_at,
        started_by::text
      from locale_qa_check_runs
      where tenant_id = ${tenantId}::uuid
      order by completed_at desc
      limit 1
    `;
    return rows[0] ?? null;
  },

  async listQaIssuesForRun(
    tx: TenantTx,
    tenantId: string,
    runId: string,
  ): Promise<LocaleQaIssueRow[]> {
    return tx.$queryRaw<LocaleQaIssueRow[]>`
      select
        id::text,
        tenant_id::text,
        run_id::text,
        locale,
        key,
        severity,
        issue_type,
        message,
        created_at
      from locale_qa_issues
      where tenant_id = ${tenantId}::uuid
        and run_id = ${runId}::uuid
      order by
        case severity when 'error' then 0 when 'warning' then 1 else 2 end,
        locale asc,
        key asc
    `;
  },
};
