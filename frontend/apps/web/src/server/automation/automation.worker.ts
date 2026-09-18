// Poisons this module for any client bundle. Audit finding M9: nothing at the
// language level stopped a server module being pulled into a client component,
// so a leak of service code -- and whatever secrets or privileged queries it
// closes over -- would only have shown up as a runtime surprise.
import "server-only";

import { randomUUID } from "node:crypto";
import type { TenantTx } from "@atlas/db";
import { withTenantTx } from "@atlas/db";
import { outbox } from "@atlas/events";
import { issueCertificate } from "../certificates/certificate.service";
import type { JobStatus } from "./automation.dto";
import { buildAutomationActionIdempotencyKey } from "./automation.dto";
import { AUTOMATION_RUN_COMPLETED_EVENT, isAutomationCycleEvent } from "./automation.events";
import {
  assertAutomationTriggerEventType,
  evaluateAutomationCondition,
  parseAutomationAction,
  parseAutomationCondition,
  resolveMembershipIdFromPayload,
  resolvePayloadField,
  validateTriggerPayloadShape,
  type AutomationTriggerEventType,
} from "./automation.registry";
import { automationRepository } from "./automation.repository";
import type { AutomationRuleRow, ServiceCtx } from "./automation.types";

export const AUTOMATION_WORKER_DESTINATION = "automation.worker";

const SYSTEM_ACTOR_MEMBERSHIP_ID = "00000000-0000-0000-0000-000000000000";

type RunOutcome = "succeeded" | "skipped" | "failed";

function toJobStatus(outcome: RunOutcome): JobStatus {
  if (outcome === "succeeded") return "SUCCEEDED";
  if (outcome === "failed") return "FAILED";
  return "CANCELLED";
}

async function executeRegisteredAction(args: {
  tx: TenantTx;
  ctx: ServiceCtx;
  rule: AutomationRuleRow;
  triggerEventType: AutomationTriggerEventType;
  sourceEventId: string;
  payload: Record<string, unknown>;
}): Promise<{ outcome: RunOutcome; result: Record<string, unknown> }> {
  const action = parseAutomationAction(args.rule.action_json);

  switch (action.type) {
    case "notification.request": {
      const membershipId = resolveMembershipIdFromPayload(
        args.payload,
        action["membershipIdField"],
      );
      if (!membershipId) {
        return {
          outcome: "skipped",
          result: { actionType: action.type, reason: "MEMBERSHIP_ID_MISSING" },
        };
      }

      await outbox.publish(args.tx, {
        ctx: {
          tenantId: args.ctx.tenantId,
          actorMembershipId: SYSTEM_ACTOR_MEMBERSHIP_ID,
          requestId: args.ctx.requestId,
        },
        eventType: "notification.requested",
        aggregateType: "notification_request",
        aggregateId: randomUUID(),
        payload: {
          templateKey: action["templateKey"],
          membershipId,
          sourceEventId: args.sourceEventId,
          triggerEventType: args.triggerEventType,
        },
        idempotencyKey: buildAutomationActionIdempotencyKey({
          automationRuleId: args.rule.id,
          sourceEventId: args.sourceEventId,
          actionType: action.type,
        }),
      });

      return {
        outcome: "succeeded",
        result: { actionType: action.type, templateKey: action["templateKey"], membershipId },
      };
    }
    case "certificate.issue": {
      const recipientMembershipId = resolveMembershipIdFromPayload(
        args.payload,
        action["recipientMembershipIdField"],
      );
      const sourceIdValue = resolvePayloadField(args.payload, action["sourceIdField"]);
      if (!recipientMembershipId || typeof sourceIdValue !== "string") {
        return {
          outcome: "skipped",
          result: { actionType: action.type, reason: "SOURCE_OR_RECIPIENT_MISSING" },
        };
      }

      const issued = await issueCertificate(
        args.tx,
        {
          tenantId: args.ctx.tenantId,
          actorMembershipId: SYSTEM_ACTOR_MEMBERSHIP_ID,
          requestId: args.ctx.requestId,
        },
        {
          templateId: action["templateId"],
          recipientMembershipId,
          source: { type: action["sourceType"], id: sourceIdValue },
        },
        buildAutomationActionIdempotencyKey({
          automationRuleId: args.rule.id,
          sourceEventId: args.sourceEventId,
          actionType: action.type,
        }),
      );

      return {
        outcome: "succeeded",
        result: {
          actionType: action.type,
          certificateId: issued.data.id,
          credentialId: issued.data.credentialId,
        },
      };
    }
    default:
      return { outcome: "failed", result: { reason: "UNKNOWN_ACTION" } };
  }
}

export async function processAutomationSourceEvent(
  tx: TenantTx,
  ctx: ServiceCtx,
  event: { id: string; eventType: string; payload: unknown },
): Promise<void> {
  if (isAutomationCycleEvent(event.eventType)) {
    return;
  }

  let triggerEventType: AutomationTriggerEventType;
  try {
    triggerEventType = assertAutomationTriggerEventType(event.eventType);
  } catch {
    return;
  }

  const payload =
    typeof event.payload === "object" && event.payload != null
      ? (event.payload as Record<string, unknown>)
      : null;
  if (!payload || !validateTriggerPayloadShape(triggerEventType, payload)) {
    return;
  }

  const rules = await automationRepository.listActiveRulesForTrigger(
    tx,
    ctx.tenantId,
    triggerEventType,
  );

  for (const rule of rules) {
    const existingRun = await automationRepository.findRunByUniqueKey(tx, {
      tenantId: ctx.tenantId,
      automationRuleId: rule.id,
      sourceEventId: event.id,
    });
    if (existingRun) {
      continue;
    }

    const condition = parseAutomationCondition(rule.condition_json);
    const conditionMet = evaluateAutomationCondition({
      triggerEventType,
      condition,
      payload,
    });

    let outcome: RunOutcome = "skipped";
    let result: Record<string, unknown> = { reason: "CONDITION_NOT_MET" };

    if (conditionMet) {
      try {
        const executed = await executeRegisteredAction({
          tx,
          ctx,
          rule,
          triggerEventType,
          sourceEventId: event.id,
          payload,
        });
        outcome = executed.outcome;
        result = executed.result;
      } catch (error) {
        outcome = "failed";
        result = {
          reason: "ACTION_FAILED",
          message: error instanceof Error ? error.message.slice(0, 200) : "Unknown error",
        };
      }
    }

    const inserted = await automationRepository.insertRun(tx, {
      tenantId: ctx.tenantId,
      automationRuleId: rule.id,
      sourceEventId: event.id,
      status: toJobStatus(outcome),
      resultJson: { outcome, ...result },
    });

    if (!inserted) {
      continue;
    }

    await outbox.publish(tx, {
      ctx: {
        tenantId: ctx.tenantId,
        actorMembershipId: SYSTEM_ACTOR_MEMBERSHIP_ID,
        requestId: ctx.requestId,
      },
      eventType: AUTOMATION_RUN_COMPLETED_EVENT,
      aggregateType: "automation_run",
      aggregateId: inserted.id,
      payload: {
        automationRunId: inserted.id,
        automationRuleId: rule.id,
        sourceEventId: event.id,
        triggerEventType,
        outcome,
        result,
      },
      idempotencyKey: `${event.id}:${AUTOMATION_RUN_COMPLETED_EVENT}:${rule.id}`,
    });
  }
}

export async function handleAutomationOutboxEvent(event: {
  id: string;
  eventType: string;
  tenantId: string | null;
  payload: unknown;
  requestId: string;
}): Promise<void> {
  if (event.tenantId == null) {
    throw new Error("Automation worker requires tenant-scoped events.");
  }

  if (isAutomationCycleEvent(event.eventType)) {
    return;
  }

  await withTenantTx(
    {
      tenantId: event.tenantId,
      requestId: event.requestId,
      allowAnonymousTenantRead: true,
    },
    async (tx) => {
      await processAutomationSourceEvent(
        tx,
        {
          tenantId: event.tenantId as string,
          actorMembershipId: SYSTEM_ACTOR_MEMBERSHIP_ID,
          requestId: event.requestId,
        },
        event,
      );
    },
  );
}

export const automationOutboxHandlers = [
  {
    destinationKey: AUTOMATION_WORKER_DESTINATION,
    handle: handleAutomationOutboxEvent,
  },
];
