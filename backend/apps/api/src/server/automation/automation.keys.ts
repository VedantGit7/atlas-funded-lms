import { createHash } from "node:crypto";
import type { REGISTERED_AUTOMATION_ACTION_TYPES } from "./automation.registry";

type AutomationActionType = (typeof REGISTERED_AUTOMATION_ACTION_TYPES)[number];

export function buildAutomationActionIdempotencyKey(args: {
  automationRuleId: string;
  sourceEventId: string;
  actionType: AutomationActionType;
}): string {
  return createHash("sha256")
    .update(`${args.automationRuleId}:${args.sourceEventId}:${args.actionType}`)
    .digest("hex");
}
