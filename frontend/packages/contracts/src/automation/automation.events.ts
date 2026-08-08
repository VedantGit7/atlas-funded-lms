export const AUTOMATION_RULE_CREATED_EVENT = "automation.rule.created" as const;
export const AUTOMATION_RULE_UPDATED_EVENT = "automation.rule.updated" as const;
export const AUTOMATION_RUN_COMPLETED_EVENT = "automation.run.completed" as const;

export const AUTOMATION_CYCLE_EVENT_TYPES = [
  AUTOMATION_RULE_CREATED_EVENT,
  AUTOMATION_RULE_UPDATED_EVENT,
  AUTOMATION_RUN_COMPLETED_EVENT,
  "locale.updated",
] as const;

export type AutomationCycleEventType = (typeof AUTOMATION_CYCLE_EVENT_TYPES)[number];

export function isAutomationCycleEvent(eventType: string): boolean {
  return (AUTOMATION_CYCLE_EVENT_TYPES as readonly string[]).includes(eventType);
}
