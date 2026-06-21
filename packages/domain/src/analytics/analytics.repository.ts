import { randomUUID } from "node:crypto";
import type { TenantTx } from "@atlas/db";
import type {
  AnalyticsRollupRow,
  AnalyticsSubjectScope,
  FunnelDailyRollupRow,
  ItemStatisticRow,
} from "./analytics.types";

function mapRollupRow(row: Record<string, unknown>): AnalyticsRollupRow {
  return {
    id: String(row["id"]),
    rollup_key: String(row["rollup_key"]),
    subject_type: String(row["subject_type"]),
    subject_id: typeof row["subject_id"] === "string" ? row["subject_id"] : null,
    period_start: row["period_start"] as Date,
    period_end: row["period_end"] as Date,
    metrics_json:
      row["metrics_json"] && typeof row["metrics_json"] === "object"
        ? (row["metrics_json"] as Record<string, unknown>)
        : {},
    calculated_at: row["calculated_at"] as Date,
  };
}

function mapFunnelRow(row: Record<string, unknown>): FunnelDailyRollupRow {
  return {
    id: String(row["id"]),
    funnel_key: String(row["funnel_key"]),
    stage_key: String(row["stage_key"]),
    day: row["day"] as Date,
    count: Number(row["count"]),
    calculated_at: row["calculated_at"] as Date,
  };
}

function mapItemStatisticRow(row: Record<string, unknown>): ItemStatisticRow {
  return {
    id: String(row["id"]),
    item_id: String(row["item_id"]),
    window_key: String(row["window_key"]),
    attempts_count: Number(row["attempts_count"]),
    correct_count: Number(row["correct_count"]),
    avg_latency_ms: row["avg_latency_ms"] == null ? null : Number(row["avg_latency_ms"]),
    calculated_at: row["calculated_at"] as Date,
  };
}

export const analyticsRepository = {
  async incrementRollupCount(
    tx: TenantTx,
    args: {
      rollupKey: string;
      subject: AnalyticsSubjectScope;
      periodStart: Date;
      periodEnd: Date;
      countDelta: number;
    },
  ): Promise<void> {
    if (!Number.isFinite(args.countDelta) || args.countDelta < 0) {
      throw new Error("Invalid rollup count delta.");
    }

    if (args.countDelta === 0) {
      return;
    }

    const id = randomUUID();
    await tx.$executeRaw`
      insert into analytics_rollups (
        id,
        tenant_id,
        rollup_key,
        subject_type,
        subject_id,
        period_start,
        period_end,
        metrics_json,
        calculated_at
      )
      values (
        ${id}::uuid,
        current_setting('app.tenant_id')::uuid,
        ${args.rollupKey},
        ${args.subject.subjectType},
        ${args.subject.subjectId},
        ${args.periodStart}::timestamptz,
        ${args.periodEnd}::timestamptz,
        jsonb_build_object('count', ${args.countDelta}::int),
        now()
      )
      on conflict (tenant_id, rollup_key, subject_type, subject_id, period_start)
      do update set
        metrics_json = jsonb_build_object(
          'count',
          coalesce((analytics_rollups.metrics_json->>'count')::int, 0) + ${args.countDelta}::int
        ),
        calculated_at = now()
    `;
  },

  async incrementFunnelStageCount(
    tx: TenantTx,
    args: {
      funnelKey: string;
      stageKey: string;
      day: Date;
      countDelta: number;
    },
  ): Promise<void> {
    if (!Number.isFinite(args.countDelta) || args.countDelta < 0) {
      throw new Error("Invalid funnel count delta.");
    }

    if (args.countDelta === 0) {
      return;
    }

    const id = randomUUID();
    await tx.$executeRaw`
      insert into funnel_daily_rollups (
        id,
        tenant_id,
        funnel_key,
        stage_key,
        day,
        count,
        calculated_at
      )
      values (
        ${id}::uuid,
        current_setting('app.tenant_id')::uuid,
        ${args.funnelKey},
        ${args.stageKey},
        ${args.day}::date,
        ${args.countDelta}::int,
        now()
      )
      on conflict (tenant_id, funnel_key, stage_key, day)
      do update set
        count = funnel_daily_rollups.count + ${args.countDelta}::int,
        calculated_at = now()
    `;
  },

  async incrementItemStatistic(
    tx: TenantTx,
    args: {
      itemId: string;
      windowKey: string;
      attemptsDelta: number;
      correctDelta: number;
      latencyMs: number | null;
    },
  ): Promise<void> {
    if (
      !Number.isFinite(args.attemptsDelta) ||
      args.attemptsDelta < 0 ||
      !Number.isFinite(args.correctDelta) ||
      args.correctDelta < 0
    ) {
      throw new Error("Invalid item statistic delta.");
    }

    if (args.attemptsDelta === 0 && args.correctDelta === 0) {
      return;
    }

    const id = randomUUID();
    const latency = args.latencyMs ?? 0;
    const hasLatency = args.latencyMs != null && args.latencyMs >= 0;

    await tx.$executeRaw`
      insert into item_statistics (
        id,
        tenant_id,
        item_id,
        window_key,
        attempts_count,
        correct_count,
        avg_latency_ms,
        calculated_at
      )
      values (
        ${id}::uuid,
        current_setting('app.tenant_id')::uuid,
        ${args.itemId}::uuid,
        ${args.windowKey},
        ${args.attemptsDelta},
        ${args.correctDelta},
        ${hasLatency ? args.latencyMs : null},
        now()
      )
      on conflict (tenant_id, item_id, window_key)
      do update set
        attempts_count = item_statistics.attempts_count + ${args.attemptsDelta},
        correct_count = item_statistics.correct_count + ${args.correctDelta},
        avg_latency_ms = case
          when ${hasLatency} and item_statistics.attempts_count + ${args.attemptsDelta} > 0 then
            (
              (coalesce(item_statistics.avg_latency_ms, 0) * item_statistics.attempts_count)
              + ${latency} * ${args.attemptsDelta}
            ) / (item_statistics.attempts_count + ${args.attemptsDelta})
          else item_statistics.avg_latency_ms
        end,
        calculated_at = now()
    `;
  },

  async listRollups(
    tx: TenantTx,
    args: {
      rollupKeys: readonly string[];
      subject: AnalyticsSubjectScope;
      from: Date;
      to: Date;
      cursor: string | null;
      limit: number;
    },
  ): Promise<AnalyticsRollupRow[]> {
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      select *
      from analytics_rollups
      where tenant_id = current_setting('app.tenant_id')::uuid
        and subject_type = ${args.subject.subjectType}
        and subject_id = ${args.subject.subjectId}
        and rollup_key = any(${args.rollupKeys}::text[])
        and period_start >= ${args.from}::timestamptz
        and period_start <= ${args.to}::timestamptz
        and (${args.cursor}::uuid is null or id < ${args.cursor ?? null}::uuid)
      order by period_start desc, id desc
      limit ${args.limit + 1}
    `;

    return rows.map(mapRollupRow);
  },

  async listFunnelRollups(
    tx: TenantTx,
    args: {
      funnelKey: string;
      stageKeys: readonly string[];
      from: Date;
      to: Date;
    },
  ): Promise<FunnelDailyRollupRow[]> {
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      select *
      from funnel_daily_rollups
      where tenant_id = current_setting('app.tenant_id')::uuid
        and funnel_key = ${args.funnelKey}
        and stage_key = any(${args.stageKeys}::text[])
        and day >= ${args.from}::date
        and day <= ${args.to}::date
      order by day asc, stage_key asc
    `;

    return rows.map(mapFunnelRow);
  },

  async listItemStatisticsForAssessment(
    tx: TenantTx,
    args: {
      itemIds: string[];
      windowKey: string;
      cursor: string | null;
      limit: number;
    },
  ): Promise<ItemStatisticRow[]> {
    if (args.itemIds.length === 0) {
      return [];
    }

    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      select *
      from item_statistics
      where tenant_id = current_setting('app.tenant_id')::uuid
        and window_key = ${args.windowKey}
        and item_id = any(${args.itemIds}::uuid[])
        and (${args.cursor}::uuid is null or id < ${args.cursor ?? null}::uuid)
      order by attempts_count desc, id desc
      limit ${args.limit + 1}
    `;

    return rows.map(mapItemStatisticRow);
  },
};
