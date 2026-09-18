// Poisons this module for any client bundle. Audit finding M9: nothing at the
// language level stopped a server module being pulled into a client component,
// so a leak of service code -- and whatever secrets or privileged queries it
// closes over -- would only have shown up as a runtime surprise.
import "server-only";

import type { EntityStatus } from "./automation.dto";
import type { AutomationTriggerEventType } from "./automation.registry";

export type AutomationRuleRow = {
  id: string;
  tenant_id: string;
  key: string;
  trigger_event_type: string;
  condition_json: unknown;
  action_json: unknown;
  status: string;
  created_at: Date;
  updated_at: Date;
};

export type AutomationRunRow = {
  id: string;
  tenant_id: string;
  automation_rule_id: string;
  source_event_id: string;
  status: string;
  result_json: unknown;
  occurred_at: Date;
};

export type ServiceCtx = {
  tenantId: string;
  actorMembershipId: string;
  requestId: string;
};

export type AutomationRuleDto = {
  id: string;
  key: string;
  triggerEventType: AutomationTriggerEventType;
  conditionJson: unknown;
  actionJson: unknown;
  status: EntityStatus;
  createdAt: string;
  updatedAt: string;
};
