// Poisons this module for any client bundle. Audit finding M9: nothing at the
// language level stopped a server module being pulled into a client component,
// so a leak of service code -- and whatever secrets or privileged queries it
// closes over -- would only have shown up as a runtime surprise.
import "server-only";

import type { TenantTx } from "@atlas/db";
import { outbox } from "@atlas/events";
import {
  createAutomationRuleBodySchema,
  type CreateAutomationRuleBody,
  type DeleteAutomationRuleBody,
  type EntityStatus,
  type JobStatus,
  type UpdateAutomationRuleBody,
} from "./automation.dto";
import { AUTOMATION_RULE_CREATED_EVENT, AUTOMATION_RULE_UPDATED_EVENT } from "./automation.events";
import { automationRuleKeyConflict, automationRuleNotFound } from "./automation.errors";
import {
  assertAutomationTriggerEventType,
  parseAutomationAction,
  parseAutomationCondition,
} from "./automation.registry";
import { automationRepository } from "./automation.repository";
import type { AutomationRuleDto, AutomationRuleRow, ServiceCtx } from "./automation.types";
import type { AutomationTriggerEventType } from "./automation.registry";

function mapRuleDto(row: AutomationRuleRow): AutomationRuleDto {
  assertAutomationTriggerEventType(row.trigger_event_type);
  parseAutomationCondition(row.condition_json);
  parseAutomationAction(row.action_json);

  return {
    id: row.id,
    key: row.key,
    triggerEventType: row.trigger_event_type as AutomationTriggerEventType,
    conditionJson: row.condition_json ?? { type: "always" },
    actionJson: row.action_json,
    status: row.status as EntityStatus,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

export async function listAutomationRules(tx: TenantTx, ctx: ServiceCtx) {
  const rows = await automationRepository.listRules(tx, ctx.tenantId);
  return { data: rows.map(mapRuleDto) };
}

export async function listAutomationRuns(
  tx: TenantTx,
  ctx: ServiceCtx,
  input: { limit: number; automationRuleId?: string | undefined },
) {
  const rows = await automationRepository.listRuns(tx, ctx.tenantId, input);
  return {
    data: rows.map((row) => ({
      id: row.id,
      automationRuleId: row.automation_rule_id,
      sourceEventId: row.source_event_id,
      status: row.status as JobStatus,
      resultJson: row.result_json ?? null,
      occurredAt: row.occurred_at.toISOString(),
    })),
  };
}

export async function createAutomationRule(
  tx: TenantTx,
  ctx: ServiceCtx,
  input: CreateAutomationRuleBody,
) {
  const body = createAutomationRuleBodySchema.parse(input);
  assertAutomationTriggerEventType(body.triggerEventType);
  const conditionJson = parseAutomationCondition(body.conditionJson);
  const actionJson = parseAutomationAction(body.actionJson);

  const existing = await automationRepository.findRuleByKey(tx, ctx.tenantId, body.key);
  if (existing) {
    throw automationRuleKeyConflict();
  }

  const created = await automationRepository.insertRule(tx, {
    tenantId: ctx.tenantId,
    key: body.key,
    triggerEventType: body.triggerEventType,
    conditionJson,
    actionJson,
    status: body.status,
  });

  await outbox.publish(tx, {
    ctx: {
      tenantId: ctx.tenantId,
      actorMembershipId: ctx.actorMembershipId,
      requestId: ctx.requestId,
    },
    eventType: AUTOMATION_RULE_CREATED_EVENT,
    aggregateType: "automation_rule",
    aggregateId: created.id,
    payload: {
      ruleId: created.id,
      key: created.key,
      triggerEventType: created.trigger_event_type,
      status: created.status,
    },
    idempotencyKey: `${ctx.requestId}:${AUTOMATION_RULE_CREATED_EVENT}:${created.id}`,
  });

  return { data: mapRuleDto(created) };
}

export async function updateAutomationRule(
  tx: TenantTx,
  ctx: ServiceCtx,
  input: UpdateAutomationRuleBody,
) {
  const existing = await automationRepository.findRuleById(tx, input.id);
  if (!existing || existing.tenant_id !== ctx.tenantId) {
    throw automationRuleNotFound();
  }

  const nextKey = input.key ?? existing.key;
  if (nextKey !== existing.key) {
    const conflict = await automationRepository.findRuleByKey(tx, ctx.tenantId, nextKey);
    if (conflict && conflict.id !== existing.id) {
      throw automationRuleKeyConflict();
    }
  }

  if (input.triggerEventType) {
    assertAutomationTriggerEventType(input.triggerEventType);
  }

  const conditionJson =
    input.conditionJson !== undefined ? parseAutomationCondition(input.conditionJson) : undefined;
  const actionJson =
    input.actionJson !== undefined ? parseAutomationAction(input.actionJson) : undefined;

  const updated = await automationRepository.updateRule(tx, {
    ruleId: input.id,
    ...(input.key !== undefined ? { key: input.key } : {}),
    ...(input.triggerEventType !== undefined ? { triggerEventType: input.triggerEventType } : {}),
    ...(conditionJson !== undefined ? { conditionJson } : {}),
    ...(actionJson !== undefined ? { actionJson } : {}),
    ...(input.status !== undefined ? { status: input.status } : {}),
  });

  if (!updated) {
    throw automationRuleNotFound();
  }

  await outbox.publish(tx, {
    ctx: {
      tenantId: ctx.tenantId,
      actorMembershipId: ctx.actorMembershipId,
      requestId: ctx.requestId,
    },
    eventType: AUTOMATION_RULE_UPDATED_EVENT,
    aggregateType: "automation_rule",
    aggregateId: updated.id,
    payload: {
      ruleId: updated.id,
      key: updated.key,
      triggerEventType: updated.trigger_event_type,
      status: updated.status,
    },
    idempotencyKey: `${ctx.requestId}:${AUTOMATION_RULE_UPDATED_EVENT}:${updated.id}`,
  });

  return { data: mapRuleDto(updated) };
}

export async function deleteAutomationRule(
  tx: TenantTx,
  ctx: ServiceCtx,
  input: DeleteAutomationRuleBody,
) {
  const existing = await automationRepository.findRuleById(tx, input.id);
  if (!existing || existing.tenant_id !== ctx.tenantId) {
    throw automationRuleNotFound();
  }

  await automationRepository.deleteRule(tx, input.id);
  return { data: { id: input.id, deleted: true as const } };
}
