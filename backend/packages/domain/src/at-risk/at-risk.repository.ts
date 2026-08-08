import { randomUUID } from "node:crypto";
import type { TenantTx } from "@atlas/db";
import { DEFAULT_AT_RISK_RULES, type AtRiskAlertRow, type AtRiskRuleRow } from "./at-risk.types";

function mapRuleRow(row: Record<string, unknown>): AtRiskRuleRow {
  return {
    id: String(row["id"]),
    key: String(row["key"]),
    name: String(row["name"]),
    rule_type: String(row["rule_type"]) as AtRiskRuleRow["rule_type"],
    config_json:
      row["config_json"] && typeof row["config_json"] === "object"
        ? (row["config_json"] as Record<string, unknown>)
        : {},
    status: String(row["status"]),
    created_at: row["created_at"] as Date,
    updated_at: row["updated_at"] as Date,
  };
}

function mapAlertRow(row: Record<string, unknown>): AtRiskAlertRow {
  return {
    id: String(row["id"]),
    at_risk_rule_id: String(row["at_risk_rule_id"]),
    membership_id: String(row["membership_id"]),
    status: String(row["status"]),
    context_json:
      row["context_json"] && typeof row["context_json"] === "object"
        ? (row["context_json"] as Record<string, unknown>)
        : null,
    triggered_at: row["triggered_at"] as Date,
    acknowledged_at: row["acknowledged_at"] == null ? null : (row["acknowledged_at"] as Date),
    created_at: row["created_at"] as Date,
    updated_at: row["updated_at"] as Date,
    rule_key: String(row["rule_key"]),
    rule_name: String(row["rule_name"]),
    display_name: row["display_name"] == null ? null : String(row["display_name"]),
  };
}

export const atRiskRepository = {
  async ensureDefaultRules(tx: TenantTx): Promise<void> {
    for (const rule of DEFAULT_AT_RISK_RULES) {
      const id = randomUUID();
      await tx.$executeRaw`
        insert into at_risk_rules (
          id,
          tenant_id,
          key,
          name,
          rule_type,
          config_json,
          status,
          created_at,
          updated_at
        )
        values (
          ${id}::uuid,
          current_setting('app.tenant_id')::uuid,
          ${rule.key},
          ${rule.name},
          ${rule.ruleType},
          ${JSON.stringify(rule.config)}::jsonb,
          'ACTIVE',
          now(),
          now()
        )
        on conflict (tenant_id, key) do nothing
      `;
    }
  },

  async listRules(tx: TenantTx): Promise<AtRiskRuleRow[]> {
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      select *
      from at_risk_rules
      where tenant_id = current_setting('app.tenant_id')::uuid
      order by key asc
    `;
    return rows.map(mapRuleRow);
  },

  async findRuleById(tx: TenantTx, ruleId: string): Promise<AtRiskRuleRow | null> {
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      select *
      from at_risk_rules
      where tenant_id = current_setting('app.tenant_id')::uuid
        and id = ${ruleId}::uuid
      limit 1
    `;
    const row = rows[0];
    return row ? mapRuleRow(row) : null;
  },

  async updateRule(
    tx: TenantTx,
    args: {
      ruleId: string;
      name?: string;
      config?: Record<string, unknown>;
      status?: string;
    },
  ): Promise<AtRiskRuleRow | null> {
    const existing = await this.findRuleById(tx, args.ruleId);
    if (!existing) {
      return null;
    }

    const name = args.name ?? existing.name;
    const configJson = args.config ?? existing.config_json;
    const status = args.status ?? existing.status;

    await tx.$executeRaw`
      update at_risk_rules
      set
        name = ${name},
        config_json = ${JSON.stringify(configJson)}::jsonb,
        status = ${status},
        updated_at = now()
      where tenant_id = current_setting('app.tenant_id')::uuid
        and id = ${args.ruleId}::uuid
    `;

    return this.findRuleById(tx, args.ruleId);
  },

  async listAlerts(
    tx: TenantTx,
    args: {
      status: string | null;
      cursor: string | null;
      limit: number;
    },
  ): Promise<AtRiskAlertRow[]> {
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      select
        aa.*,
        ar.key as rule_key,
        ar.name as rule_name,
        mp.display_name
      from at_risk_alerts aa
      inner join at_risk_rules ar
        on ar.id = aa.at_risk_rule_id
        and ar.tenant_id = aa.tenant_id
      left join member_profiles mp
        on mp.membership_id = aa.membership_id
        and mp.tenant_id = aa.tenant_id
      where aa.tenant_id = current_setting('app.tenant_id')::uuid
        and (${args.status}::text is null or aa.status = ${args.status})
        and (${args.cursor}::uuid is null or aa.id < ${args.cursor ?? null}::uuid)
      order by aa.triggered_at desc, aa.id desc
      limit ${args.limit + 1}
    `;
    return rows.map(mapAlertRow);
  },

  async findAlertById(tx: TenantTx, alertId: string): Promise<AtRiskAlertRow | null> {
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      select
        aa.*,
        ar.key as rule_key,
        ar.name as rule_name,
        mp.display_name
      from at_risk_alerts aa
      inner join at_risk_rules ar
        on ar.id = aa.at_risk_rule_id
        and ar.tenant_id = aa.tenant_id
      left join member_profiles mp
        on mp.membership_id = aa.membership_id
        and mp.tenant_id = aa.tenant_id
      where aa.tenant_id = current_setting('app.tenant_id')::uuid
        and aa.id = ${alertId}::uuid
      limit 1
    `;
    const row = rows[0];
    return row ? mapAlertRow(row) : null;
  },

  async acknowledgeAlert(tx: TenantTx, alertId: string): Promise<AtRiskAlertRow | null> {
    await tx.$executeRaw`
      update at_risk_alerts
      set
        status = 'acknowledged',
        acknowledged_at = now(),
        updated_at = now()
      where tenant_id = current_setting('app.tenant_id')::uuid
        and id = ${alertId}::uuid
        and status = 'open'
    `;
    return this.findAlertById(tx, alertId);
  },

  async upsertOpenAlert(
    tx: TenantTx,
    args: {
      ruleId: string;
      membershipId: string;
      context: Record<string, unknown>;
    },
  ): Promise<"created" | "updated" | "unchanged"> {
    const existing = await tx.$queryRaw<Array<{ id: string }>>`
      select id::text
      from at_risk_alerts
      where tenant_id = current_setting('app.tenant_id')::uuid
        and at_risk_rule_id = ${args.ruleId}::uuid
        and membership_id = ${args.membershipId}::uuid
        and status = 'open'
      limit 1
    `;

    if (existing[0]) {
      await tx.$executeRaw`
        update at_risk_alerts
        set
          context_json = ${JSON.stringify(args.context)}::jsonb,
          triggered_at = now(),
          updated_at = now()
        where id = ${existing[0].id}::uuid
      `;
      return "updated";
    }

    const id = randomUUID();
    await tx.$executeRaw`
      insert into at_risk_alerts (
        id,
        tenant_id,
        at_risk_rule_id,
        membership_id,
        status,
        context_json,
        triggered_at,
        created_at,
        updated_at
      )
      values (
        ${id}::uuid,
        current_setting('app.tenant_id')::uuid,
        ${args.ruleId}::uuid,
        ${args.membershipId}::uuid,
        'open',
        ${JSON.stringify(args.context)}::jsonb,
        now(),
        now(),
        now()
      )
    `;
    return "created";
  },

  async findInactiveMemberships(
    tx: TenantTx,
    inactivityDays: number,
  ): Promise<Array<{ membership_id: string; last_seen_at: Date | null }>> {
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      select
        e.membership_id::text as membership_id,
        max(lp.last_seen_at) as last_seen_at
      from enrollments e
      left join lesson_progress lp
        on lp.membership_id = e.membership_id
        and lp.tenant_id = e.tenant_id
      where e.tenant_id = current_setting('app.tenant_id')::uuid
        and e.status = 'active'
      group by e.membership_id
      having
        coalesce(max(lp.last_seen_at), 'epoch'::timestamptz)
          < now() - (${inactivityDays}::int || ' days')::interval
    `;

    return rows.map((row) => ({
      membership_id: String(row["membership_id"]),
      last_seen_at: row["last_seen_at"] == null ? null : (row["last_seen_at"] as Date),
    }));
  },

  async findBelowGradeMemberships(
    tx: TenantTx,
    gradeThreshold: number,
  ): Promise<Array<{ membership_id: string; score_pct: number | null }>> {
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      select distinct on (a.membership_id)
        a.membership_id::text as membership_id,
        a.score_pct::float as score_pct
      from attempts a
      inner join enrollments e
        on e.membership_id = a.membership_id
        and e.tenant_id = a.tenant_id
        and e.status = 'active'
      where a.tenant_id = current_setting('app.tenant_id')::uuid
        and a.status in ('SUBMITTED', 'GRADED')
        and a.score_pct is not null
      order by a.membership_id, a.submitted_at desc nulls last
    `;

    return rows
      .map((row) => ({
        membership_id: String(row["membership_id"]),
        score_pct: row["score_pct"] == null ? null : Number(row["score_pct"]),
      }))
      .filter((row) => row.score_pct != null && row.score_pct < gradeThreshold);
  },

  async findLowActivityMemberships(
    tx: TenantTx,
    lookbackDays: number,
    cohortPercentile: number,
  ): Promise<Array<{ membership_id: string; activity_count: number }>> {
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      with activity as (
        select
          e.membership_id,
          count(lp.id)::int as activity_count
        from enrollments e
        left join lesson_progress lp
          on lp.membership_id = e.membership_id
          and lp.tenant_id = e.tenant_id
          and lp.last_seen_at >= now() - (${lookbackDays}::int || ' days')::interval
        where e.tenant_id = current_setting('app.tenant_id')::uuid
          and e.status = 'active'
        group by e.membership_id
      ),
      threshold as (
        select percentile_cont(${cohortPercentile / 100}::float)
          within group (order by activity_count) as cutoff
        from activity
      )
      select
        a.membership_id::text as membership_id,
        a.activity_count
      from activity a
      cross join threshold t
      where a.activity_count <= coalesce(t.cutoff, 0)
        and a.activity_count >= 0
    `;

    return rows.map((row) => ({
      membership_id: String(row["membership_id"]),
      activity_count: Number(row["activity_count"]),
    }));
  },
};
