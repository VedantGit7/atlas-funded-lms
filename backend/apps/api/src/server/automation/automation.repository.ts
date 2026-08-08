import { randomUUID } from "node:crypto";
import type { TenantTx } from "@atlas/db";
import type { AutomationRuleRow, AutomationRunRow } from "./automation.types";
import type { EntityStatus, JobStatus } from "./automation.dto";

export const automationRepository = {
  async listRules(tx: TenantTx, tenantId: string): Promise<AutomationRuleRow[]> {
    return tx.$queryRaw<AutomationRuleRow[]>`
      select
        id::text,
        tenant_id::text,
        key,
        trigger_event_type,
        condition_json,
        action_json,
        status::text,
        created_at,
        updated_at
      from automation_rules
      where tenant_id = ${tenantId}::uuid
      order by key asc
    `;
  },

  async findRuleById(tx: TenantTx, ruleId: string): Promise<AutomationRuleRow | null> {
    const rows = await tx.$queryRaw<AutomationRuleRow[]>`
      select
        id::text,
        tenant_id::text,
        key,
        trigger_event_type,
        condition_json,
        action_json,
        status::text,
        created_at,
        updated_at
      from automation_rules
      where id = ${ruleId}::uuid
      limit 1
    `;
    return rows[0] ?? null;
  },

  async findRuleByKey(
    tx: TenantTx,
    tenantId: string,
    key: string,
  ): Promise<AutomationRuleRow | null> {
    const rows = await tx.$queryRaw<AutomationRuleRow[]>`
      select
        id::text,
        tenant_id::text,
        key,
        trigger_event_type,
        condition_json,
        action_json,
        status::text,
        created_at,
        updated_at
      from automation_rules
      where tenant_id = ${tenantId}::uuid
        and key = ${key}
      limit 1
    `;
    return rows[0] ?? null;
  },

  async listActiveRulesForTrigger(
    tx: TenantTx,
    tenantId: string,
    triggerEventType: string,
  ): Promise<AutomationRuleRow[]> {
    return tx.$queryRaw<AutomationRuleRow[]>`
      select
        id::text,
        tenant_id::text,
        key,
        trigger_event_type,
        condition_json,
        action_json,
        status::text,
        created_at,
        updated_at
      from automation_rules
      where tenant_id = ${tenantId}::uuid
        and trigger_event_type = ${triggerEventType}
        and status = 'ACTIVE'::"EntityStatus"
      order by created_at asc
    `;
  },

  async insertRule(
    tx: TenantTx,
    args: {
      tenantId: string;
      key: string;
      triggerEventType: string;
      conditionJson: unknown;
      actionJson: unknown;
      status: EntityStatus;
    },
  ): Promise<AutomationRuleRow> {
    const id = randomUUID();
    const rows = await tx.$queryRaw<AutomationRuleRow[]>`
      insert into automation_rules (
        id,
        tenant_id,
        key,
        trigger_event_type,
        condition_json,
        action_json,
        status,
        created_at,
        updated_at
      )
      values (
        ${id}::uuid,
        ${args.tenantId}::uuid,
        ${args.key},
        ${args.triggerEventType},
        ${JSON.stringify(args.conditionJson ?? { type: "always" })}::jsonb,
        ${JSON.stringify(args.actionJson)}::jsonb,
        ${args.status}::"EntityStatus",
        now(),
        now()
      )
      returning
        id::text,
        tenant_id::text,
        key,
        trigger_event_type,
        condition_json,
        action_json,
        status::text,
        created_at,
        updated_at
    `;
    const row = rows[0];
    if (!row) throw new Error("Failed to create automation rule.");
    return row;
  },

  async updateRule(
    tx: TenantTx,
    args: {
      ruleId: string;
      key?: string;
      triggerEventType?: string;
      conditionJson?: unknown;
      actionJson?: unknown;
      status?: EntityStatus;
    },
  ): Promise<AutomationRuleRow | null> {
    const existing = await automationRepository.findRuleById(tx, args.ruleId);
    if (!existing) return null;

    const rows = await tx.$queryRaw<AutomationRuleRow[]>`
      update automation_rules
      set
        key = coalesce(${args.key ?? null}, key),
        trigger_event_type = coalesce(${args.triggerEventType ?? null}, trigger_event_type),
        condition_json = coalesce(${args.conditionJson != null ? JSON.stringify(args.conditionJson) : null}::jsonb, condition_json),
        action_json = coalesce(${args.actionJson != null ? JSON.stringify(args.actionJson) : null}::jsonb, action_json),
        status = coalesce(${args.status ?? null}::"EntityStatus", status),
        updated_at = now()
      where id = ${args.ruleId}::uuid
      returning
        id::text,
        tenant_id::text,
        key,
        trigger_event_type,
        condition_json,
        action_json,
        status::text,
        created_at,
        updated_at
    `;
    return rows[0] ?? null;
  },

  async deleteRule(tx: TenantTx, ruleId: string): Promise<boolean> {
    const count = await tx.$executeRaw`
      delete from automation_rules where id = ${ruleId}::uuid
    `;
    return count > 0;
  },

  async findRunByUniqueKey(
    tx: TenantTx,
    args: {
      tenantId: string;
      automationRuleId: string;
      sourceEventId: string;
    },
  ): Promise<AutomationRunRow | null> {
    const rows = await tx.$queryRaw<AutomationRunRow[]>`
      select
        id::text,
        tenant_id::text,
        automation_rule_id::text,
        source_event_id::text,
        status::text,
        result_json,
        occurred_at
      from automation_runs
      where tenant_id = ${args.tenantId}::uuid
        and automation_rule_id = ${args.automationRuleId}::uuid
        and source_event_id = ${args.sourceEventId}::uuid
      limit 1
    `;
    return rows[0] ?? null;
  },

  async listRuns(
    tx: TenantTx,
    tenantId: string,
    args: { limit: number; automationRuleId?: string | undefined },
  ): Promise<AutomationRunRow[]> {
    if (args.automationRuleId) {
      return tx.$queryRaw<AutomationRunRow[]>`
        select
          id::text,
          tenant_id::text,
          automation_rule_id::text,
          source_event_id::text,
          status::text,
          result_json,
          occurred_at
        from automation_runs
        where tenant_id = ${tenantId}::uuid
          and automation_rule_id = ${args.automationRuleId}::uuid
        order by occurred_at desc
        limit ${args.limit}
      `;
    }

    return tx.$queryRaw<AutomationRunRow[]>`
      select
        id::text,
        tenant_id::text,
        automation_rule_id::text,
        source_event_id::text,
        status::text,
        result_json,
        occurred_at
      from automation_runs
      where tenant_id = ${tenantId}::uuid
      order by occurred_at desc
      limit ${args.limit}
    `;
  },

  async insertRun(
    tx: TenantTx,
    args: {
      tenantId: string;
      automationRuleId: string;
      sourceEventId: string;
      status: JobStatus;
      resultJson: unknown;
    },
  ): Promise<AutomationRunRow | null> {
    const id = randomUUID();
    const rows = await tx.$queryRaw<AutomationRunRow[]>`
      insert into automation_runs (
        id,
        tenant_id,
        automation_rule_id,
        source_event_id,
        status,
        result_json,
        occurred_at
      )
      values (
        ${id}::uuid,
        ${args.tenantId}::uuid,
        ${args.automationRuleId}::uuid,
        ${args.sourceEventId}::uuid,
        ${args.status}::"JobStatus",
        ${JSON.stringify(args.resultJson ?? {})}::jsonb,
        now()
      )
      on conflict (tenant_id, automation_rule_id, source_event_id) do nothing
      returning
        id::text,
        tenant_id::text,
        automation_rule_id::text,
        source_event_id::text,
        status::text,
        result_json,
        occurred_at
    `;
    return rows[0] ?? null;
  },
};
