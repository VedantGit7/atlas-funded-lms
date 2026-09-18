import type { TenantTx } from "@atlas/db";

/**
 * Retention for the marketing attribution event log.
 *
 * The log accumulated indefinitely: nothing wrote an expiry, nothing deleted a
 * row, and no setting existed to express a policy. Every tracked page view,
 * signup and purchase a tenant ever recorded was kept forever, each linked to a
 * `membership_id` — personal data growing without bound that nobody chose to
 * keep.
 *
 * Two halves, and both are needed. A retention *policy* with no deletion *job*
 * is indistinguishable from having no policy at all; a deletion job with no
 * policy is worse, because it deletes on someone else's judgement.
 */

/**
 * The default is "keep everything".
 *
 * The opposite of the proctoring media policy, and deliberately so: that table
 * was empty when its policy landed, so a 90-day default cost nothing. This one
 * has years of history in live tenants, and a finite default would delete real
 * data the first time the sweep ran. Retention here is a decision a tenant
 * makes, not one a deploy makes for them.
 */
export const DEFAULT_RETENTION_DAYS: number | null = null;

/**
 * The floor is the safety cap here, not a ceiling.
 *
 * Lengthening retention only keeps more history, so it needs no limit.
 * Shortening it past a month leaves a log that cannot answer the question it
 * exists for — campaign performance over a quarter — and "our attribution
 * reporting went blank" is a worse outcome than a larger table. Enforced in the
 * database too, so a direct write cannot go below it either.
 */
export const MIN_RETENTION_DAYS = 30;

/** Ten years. Past this the value is indistinguishable from "keep everything". */
export const MAX_RETENTION_DAYS = 3650;

/** How many rows one purge pass deletes, so a huge backlog cannot hold a lock. */
export const PURGE_BATCH_LIMIT = 5000;

export type AttributionRetentionRow = {
  retention_days: number | null;
  updated_at: Date | null;
  updated_by_name: string | null;
};

/**
 * Whether a proposed window is usable.
 *
 * `null` is always valid — it is the "keep everything" choice, not the absence
 * of one.
 */
export function isValidRetentionDays(value: number | null): boolean {
  if (value === null) return true;
  if (!Number.isInteger(value)) return false;
  return value >= MIN_RETENTION_DAYS && value <= MAX_RETENTION_DAYS;
}

export const attributionRetentionRepository = {
  async get(tx: TenantTx): Promise<AttributionRetentionRow | null> {
    const rows = await tx.$queryRaw<AttributionRetentionRow[]>`
      select
        s.retention_days,
        s.updated_at,
        (
          select coalesce(nullif(trim(mp.display_name), ''), ap.email)
          from memberships m
          left join member_profiles mp on mp.membership_id = m.id
          left join auth_principals ap on ap.id = m.auth_principal_id
          where m.id = s.updated_by_membership_id
          limit 1
        ) as updated_by_name
      from sales_attribution_retention_settings s
      where s.tenant_id = current_setting('app.tenant_id', true)::uuid
      limit 1
    `;
    return rows[0] ?? null;
  },

  async upsert(
    tx: TenantTx,
    args: { retentionDays: number | null; membershipId: string | null },
  ): Promise<void> {
    await tx.$executeRaw`
      insert into sales_attribution_retention_settings (
        tenant_id, retention_days, updated_by_membership_id, created_at, updated_at
      )
      values (
        current_setting('app.tenant_id', true)::uuid,
        ${args.retentionDays}::int,
        ${args.membershipId}::uuid,
        now(),
        now()
      )
      on conflict (tenant_id) do update
        set retention_days = excluded.retention_days,
            updated_by_membership_id = excluded.updated_by_membership_id,
            updated_at = now()
    `;
  },

  /**
   * How much a given window would delete, and what the oldest survivor would be.
   *
   * Read-only, and the whole reason the settings screen can ask before it acts:
   * "this will delete 41,908 events" is a different decision from "save".
   */
  async previewImpact(
    tx: TenantTx,
    retentionDays: number | null,
  ): Promise<{ total: number; deletable: number; oldest: Date | null }> {
    const rows = await tx.$queryRaw<
      Array<{ total: bigint; deletable: bigint; oldest: Date | null }>
    >`
      select
        count(*)::bigint as total,
        count(*) filter (
          where ${retentionDays}::int is not null
            and occurred_at < now() - make_interval(days => ${retentionDays}::int)
        )::bigint as deletable,
        min(occurred_at) as oldest
      from sales_attribution_events
    `;
    const row = rows[0];
    return {
      total: Number(row?.total ?? 0),
      deletable: Number(row?.deletable ?? 0),
      oldest: row?.oldest ?? null,
    };
  },

  /**
   * Deletes one batch of events past the tenant's window.
   *
   * Batched by primary key rather than a single unbounded `delete ... where`,
   * so a tenant switching retention on for the first time cannot hold a write
   * lock over the whole table while the beacon is still posting to it. The
   * sweep calls this repeatedly.
   */
  async purgeBatch(tx: TenantTx, args: { retentionDays: number; limit: number }): Promise<number> {
    return await tx.$executeRaw`
      delete from sales_attribution_events
      where id in (
        select id
        from sales_attribution_events
        where occurred_at < now() - make_interval(days => ${args.retentionDays}::int)
        order by occurred_at asc
        limit ${args.limit}
      )
    `;
  },
};

/**
 * Deletes expired attribution events for the current tenant.
 *
 * Returns 0 without touching the table when the tenant has expressed no
 * retention preference — which is every tenant until one opts in. That is the
 * single most important line in this file: the sweep runs for all tenants, and
 * it must be a no-op for the ones that never asked for deletion.
 */
export async function purgeExpiredAttributionEvents(
  tx: TenantTx,
  limit: number = PURGE_BATCH_LIMIT,
): Promise<number> {
  const settings = await attributionRetentionRepository.get(tx);
  const retentionDays = settings?.retention_days ?? null;
  if (retentionDays === null) return 0;

  // A stored value below the floor should not widen the deletion; clamp up.
  const effective = Math.max(MIN_RETENTION_DAYS, retentionDays);
  return await attributionRetentionRepository.purgeBatch(tx, {
    retentionDays: effective,
    limit,
  });
}
