import { randomUUID } from "node:crypto";
import type { TenantTx } from "@atlas/db";
import {
  buildItemPsychometrics,
  mergeDistractorCount,
  psychometricsToMetricsJson,
  type DistractorRate,
} from "./analytics-psychometrics";
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
    metrics_json:
      row["metrics_json"] && typeof row["metrics_json"] === "object"
        ? (row["metrics_json"] as Record<string, unknown>)
        : null,
    calculated_at: row["calculated_at"] as Date,
  };
}

function parseDistractorCounts(metricsJson: Record<string, unknown> | null): Record<string, number> {
  const raw = metricsJson?.["distractorCounts"];
  if (!raw || typeof raw !== "object") {
    return {};
  }

  const counts: Record<string, number> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof value === "number" && Number.isFinite(value)) {
      counts[key] = value;
    }
  }
  return counts;
}

async function refreshItemStatisticMetricsJson(
  tx: TenantTx,
  args: { itemId: string; windowKey: string; selectedOptionId?: string | null },
): Promise<void> {
  const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
    select attempts_count, correct_count, metrics_json
    from item_statistics
    where tenant_id = current_setting('app.tenant_id')::uuid
      and item_id = ${args.itemId}::uuid
      and window_key = ${args.windowKey}
    limit 1
  `;

  const row = rows[0];
  if (!row) {
    return;
  }

  const attemptsCount = Number(row["attempts_count"]);
  const correctCount = Number(row["correct_count"]);
  const existingMetrics =
    row["metrics_json"] && typeof row["metrics_json"] === "object"
      ? (row["metrics_json"] as Record<string, unknown>)
      : null;
  const distractorCounts = mergeDistractorCount(
    parseDistractorCounts(existingMetrics),
    args.selectedOptionId,
  );

  const psychometrics = buildItemPsychometrics({
    attemptsCount,
    correctCount,
    distractorCounts,
  });
  const metricsJson = psychometricsToMetricsJson(psychometrics, distractorCounts);

  await tx.$executeRaw`
    update item_statistics
    set metrics_json = ${JSON.stringify(metricsJson)}::jsonb,
        calculated_at = now()
    where tenant_id = current_setting('app.tenant_id')::uuid
      and item_id = ${args.itemId}::uuid
      and window_key = ${args.windowKey}
  `;
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
      selectedOptionId?: string | null;
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

    if (args.windowKey === "all_time") {
      await refreshItemStatisticMetricsJson(tx, {
        itemId: args.itemId,
        windowKey: args.windowKey,
        ...(args.selectedOptionId != null ? { selectedOptionId: args.selectedOptionId } : {}),
      });
    }
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
      /** When set, derive rolling stats from attempt answers since this cutoff. */
      rollingCutoff: Date | null;
    },
  ): Promise<ItemStatisticRow[]> {
    if (args.itemIds.length === 0) {
      return [];
    }

    if (args.rollingCutoff) {
      const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
        select
          ai.item_id::text as id,
          ai.item_id::text as item_id,
          ${args.windowKey} as window_key,
          count(*)::int as attempts_count,
          count(*) filter (where aa.is_correct = true)::int as correct_count,
          avg(
            case
              when jsonb_typeof(aa.answer_json -> 'latencyMs') = 'number'
                then (aa.answer_json ->> 'latencyMs')::float
              else null
            end
          )::int as avg_latency_ms,
          max(aa.occurred_at) as calculated_at
        from attempt_answers aa
        inner join assessment_items ai on ai.id = aa.assessment_item_id
        where aa.tenant_id = current_setting('app.tenant_id')::uuid
          and ai.item_id = any(${args.itemIds}::uuid[])
          and aa.occurred_at >= ${args.rollingCutoff}::timestamptz
          and (${args.cursor}::uuid is null or ai.item_id < ${args.cursor ?? null}::uuid)
        group by ai.item_id
        order by attempts_count desc, ai.item_id desc
        limit ${args.limit + 1}
      `;

      return rows.map(mapItemStatisticRow);
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

  async getItemLatencyDiscrimination(
    tx: TenantTx,
    itemIds: string[],
    rollingCutoff: Date | null,
  ): Promise<Map<string, { meanCorrectLatencyMs: number | null; meanIncorrectLatencyMs: number | null }>> {
    if (itemIds.length === 0) {
      return new Map();
    }

    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      select
        ai.item_id::text as item_id,
        avg(
          case
            when aa.is_correct = true
              and jsonb_typeof(aa.answer_json -> 'latencyMs') = 'number'
              then (aa.answer_json ->> 'latencyMs')::float
            else null
          end
        ) as mean_correct_latency_ms,
        avg(
          case
            when aa.is_correct = false
              and jsonb_typeof(aa.answer_json -> 'latencyMs') = 'number'
              then (aa.answer_json ->> 'latencyMs')::float
            else null
          end
        ) as mean_incorrect_latency_ms
      from attempt_answers aa
      inner join assessment_items ai on ai.id = aa.assessment_item_id
      where aa.tenant_id = current_setting('app.tenant_id')::uuid
        and ai.item_id = any(${itemIds}::uuid[])
        and (${rollingCutoff}::timestamptz is null or aa.occurred_at >= ${rollingCutoff}::timestamptz)
      group by ai.item_id
    `;

    const map = new Map<string, { meanCorrectLatencyMs: number | null; meanIncorrectLatencyMs: number | null }>();
    for (const row of rows) {
      map.set(String(row["item_id"]), {
        meanCorrectLatencyMs:
          row["mean_correct_latency_ms"] == null ? null : Number(row["mean_correct_latency_ms"]),
        meanIncorrectLatencyMs:
          row["mean_incorrect_latency_ms"] == null ? null : Number(row["mean_incorrect_latency_ms"]),
      });
    }
    return map;
  },

  async getItemDistractorRatesFromAnswers(
    tx: TenantTx,
    itemIds: string[],
    rollingCutoff: Date | null,
  ): Promise<Map<string, DistractorRate[]>> {
    if (itemIds.length === 0) {
      return new Map();
    }

    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      with answers as (
        select
          ai.item_id::text as item_id,
          coalesce(
            aa.answer_json ->> 'selectedOptionId',
            aa.answer_json ->> 'optionId'
          ) as option_id
        from attempt_answers aa
        inner join assessment_items ai on ai.id = aa.assessment_item_id
        where aa.tenant_id = current_setting('app.tenant_id')::uuid
          and ai.item_id = any(${itemIds}::uuid[])
          and (${rollingCutoff}::timestamptz is null or aa.occurred_at >= ${rollingCutoff}::timestamptz)
          and coalesce(
            aa.answer_json ->> 'selectedOptionId',
            aa.answer_json ->> 'optionId'
          ) is not null
      ),
      totals as (
        select item_id, count(*)::float as total
        from answers
        group by item_id
      )
      select
        a.item_id,
        a.option_id,
        count(*)::float / t.total as rate
      from answers a
      inner join totals t on t.item_id = a.item_id
      group by a.item_id, a.option_id, t.total
      order by a.item_id asc, rate desc
    `;

    const map = new Map<string, DistractorRate[]>();
    for (const row of rows) {
      const itemId = String(row["item_id"]);
      const optionId = String(row["option_id"]);
      const rate = Number(row["rate"]);
      const existing = map.get(itemId) ?? [];
      existing.push({ optionId, rate });
      map.set(itemId, existing);
    }
    return map;
  },

  async listDrillDownMembers(
    tx: TenantTx,
    args: {
      rollupKey: string;
      day: string;
      courseId: string | null;
      limit: number;
    },
  ): Promise<{ members: Array<{ membershipId: string; displayName: string }>; capped: boolean }> {
    const dayStart = `${args.day}T00:00:00.000Z`;
    const dayEnd = `${args.day}T23:59:59.999Z`;
    const fetchLimit = args.limit + 1;

    let rows: Array<Record<string, unknown>>;

    if (args.rollupKey === "lessons_completed") {
      rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
        select distinct
          lp.membership_id::text as membership_id,
          coalesce(mp.display_name, 'Member ' || left(lp.membership_id::text, 8)) as display_name
        from lesson_progress lp
        left join member_profiles mp
          on mp.membership_id = lp.membership_id
          and mp.tenant_id = lp.tenant_id
        left join lessons l on l.id = lp.lesson_id and l.tenant_id = lp.tenant_id
        left join course_modules cm on cm.id = l.module_id and cm.tenant_id = lp.tenant_id
        where lp.tenant_id = current_setting('app.tenant_id')::uuid
          and lp.status = 'completed'
          and lp.completed_at >= ${dayStart}::timestamptz
          and lp.completed_at <= ${dayEnd}::timestamptz
          and (${args.courseId}::uuid is null or cm.course_id = ${args.courseId}::uuid)
        order by display_name asc
        limit ${fetchLimit}
      `;
    } else if (
      args.rollupKey === "assessments_submitted" ||
      args.rollupKey === "assessments_passed"
    ) {
      rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
        select distinct
          a.membership_id::text as membership_id,
          coalesce(mp.display_name, 'Member ' || left(a.membership_id::text, 8)) as display_name
        from attempts a
        left join member_profiles mp
          on mp.membership_id = a.membership_id
          and mp.tenant_id = a.tenant_id
        where a.tenant_id = current_setting('app.tenant_id')::uuid
          and a.submitted_at >= ${dayStart}::timestamptz
          and a.submitted_at <= ${dayEnd}::timestamptz
          and (
            ${args.rollupKey} = 'assessments_submitted'
            or (a.score_pct is not null and a.score_pct >= 70)
          )
        order by display_name asc
        limit ${fetchLimit}
      `;
    } else if (args.rollupKey === "practice_sessions_completed") {
      rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
        select distinct
          ps.membership_id::text as membership_id,
          coalesce(mp.display_name, 'Member ' || left(ps.membership_id::text, 8)) as display_name
        from practice_sessions ps
        left join member_profiles mp
          on mp.membership_id = ps.membership_id
          and mp.tenant_id = ps.tenant_id
        where ps.tenant_id = current_setting('app.tenant_id')::uuid
          and ps.completed_at >= ${dayStart}::timestamptz
          and ps.completed_at <= ${dayEnd}::timestamptz
        order by display_name asc
        limit ${fetchLimit}
      `;
    } else {
      rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
        select distinct
          m.id::text as membership_id,
          coalesce(mp.display_name, 'Member ' || left(m.id::text, 8)) as display_name
        from memberships m
        left join member_profiles mp
          on mp.membership_id = m.id
          and mp.tenant_id = m.tenant_id
        where m.tenant_id = current_setting('app.tenant_id')::uuid
          and m.status = 'ACTIVE'
          and m.last_active_at >= ${dayStart}::timestamptz
          and m.last_active_at <= ${dayEnd}::timestamptz
        order by display_name asc
        limit ${fetchLimit}
      `;
    }

    const capped = rows.length > args.limit;
    const pageRows = rows.slice(0, args.limit);

    return {
      members: pageRows.map((row) => ({
        membershipId: String(row["membership_id"]),
        displayName: String(row["display_name"]),
      })),
      capped,
    };
  },
};
