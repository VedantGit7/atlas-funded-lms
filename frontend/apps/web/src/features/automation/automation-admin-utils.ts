import type { z } from "zod";
import { automationRuleKeySchema } from "@atlas/contracts/automation/automation.registry";
import {
  parseAutomationAction,
  parseAutomationCondition,
} from "@atlas/contracts/automation/automation.registry";
import type { automationRuleDtoSchema } from "@atlas/contracts/automation/automation.dto";

type RuleDto = z.infer<typeof automationRuleDtoSchema>;

export type AutomationDraft = {
  key: string;
  trigger: string;
  status: RuleDto["status"];
  conditionType: "always" | "assessmentPassed";
  minScore: number;
  actionType: "notification.request" | "certificate.issue";
  templateKey: string;
  membershipIdField: "membershipId" | "learnerMembershipId";
  certificateTemplateId: string;
  recipientMembershipIdField: "membershipId" | "learnerMembershipId";
  sourceType: "course" | "learning_path" | "assessment";
  sourceIdField: string;
};

export type AutomationDraftValidationResult =
  | { ok: true }
  | { ok: false; field: keyof AutomationDraft | "action"; message: string };

export function buildAutomationConditionJson(draft: AutomationDraft) {
  if (draft.conditionType === "assessmentPassed") {
    return { type: "assessmentPassed", minScorePercent: draft.minScore };
  }
  return { type: "always" };
}

export function buildAutomationActionJson(draft: AutomationDraft) {
  if (draft.actionType === "certificate.issue") {
    return {
      type: "certificate.issue",
      templateId: draft.certificateTemplateId.trim(),
      recipientMembershipIdField: draft.recipientMembershipIdField,
      sourceType: draft.sourceType,
      sourceIdField: draft.sourceIdField.trim(),
    };
  }
  return {
    type: "notification.request",
    templateKey: draft.templateKey.trim(),
    membershipIdField: draft.membershipIdField,
  };
}

export function validateAutomationDraft(draft: AutomationDraft): AutomationDraftValidationResult {
  const keyResult = automationRuleKeySchema.safeParse(draft.key.trim());
  if (!keyResult.success) {
    return {
      ok: false,
      field: "key",
      message:
        "Rule key must start with a lowercase letter and use letters, numbers, dots, hyphens, or underscores.",
    };
  }

  if (draft.conditionType === "assessmentPassed") {
    if (!Number.isFinite(draft.minScore) || draft.minScore < 0 || draft.minScore > 100) {
      return {
        ok: false,
        field: "minScore",
        message: "Minimum score must be between 0 and 100.",
      };
    }
  }

  try {
    parseAutomationCondition(buildAutomationConditionJson(draft));
  } catch (error) {
    return {
      ok: false,
      field: "conditionType",
      message: error instanceof Error ? error.message : "Invalid condition configuration.",
    };
  }

  if (draft.actionType === "notification.request") {
    if (!draft.templateKey.trim()) {
      return {
        ok: false,
        field: "templateKey",
        message: "Template key is required for notification actions.",
      };
    }
  }

  if (draft.actionType === "certificate.issue") {
    if (!draft.certificateTemplateId.trim()) {
      return {
        ok: false,
        field: "certificateTemplateId",
        message: "Select a certificate template before saving.",
      };
    }
    if (!draft.sourceIdField.trim()) {
      return {
        ok: false,
        field: "sourceIdField",
        message: "Source ID field is required for certificate actions.",
      };
    }
  }

  try {
    parseAutomationAction(buildAutomationActionJson(draft));
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Invalid action configuration.";
    if (draft.actionType === "certificate.issue" && message.toLowerCase().includes("uuid")) {
      return {
        ok: false,
        field: "certificateTemplateId",
        message: "Certificate template must be a valid published template.",
      };
    }
    return {
      ok: false,
      field: "actionType",
      message,
    };
  }

  return { ok: true };
}

export function formatRuleCode(rule: RuleDto): string {
  return rule.key.toUpperCase().replace(/\./g, "-");
}

export function formatTriggerLabel(trigger: string): string {
  return trigger
    .split(".")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function formatRuleTitle(key: string): string {
  return key
    .split(/[._-]/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function formatRunStatus(status: string): string {
  switch (status) {
    case "SUCCEEDED":
      return "Success";
    case "FAILED":
      return "Failed";
    case "RUNNING":
      return "Running";
    case "QUEUED":
      return "Queued";
    case "CANCELLED":
      return "Cancelled";
    default:
      return status;
  }
}

export function formatRelativeTime(iso: string): string {
  const date = new Date(iso);
  const diffMinutes = Math.round((date.getTime() - Date.now()) / (1000 * 60));
  if (Math.abs(diffMinutes) < 60) {
    return new Intl.RelativeTimeFormat(undefined, { numeric: "auto" }).format(diffMinutes, "minute");
  }
  const diffHours = Math.round((date.getTime() - Date.now()) / (1000 * 60 * 60));
  if (Math.abs(diffHours) < 24) {
    return new Intl.RelativeTimeFormat(undefined, { numeric: "auto" }).format(diffHours, "hour");
  }
  return date.toLocaleString();
}

export function summarizeCondition(rule: RuleDto): string {
  try {
    const condition = parseAutomationCondition(rule.conditionJson);
    if (condition.type === "always") {
      return "Always run";
    }
    return `Minimum score ${String(condition.minScorePercent)}%`;
  } catch {
    return "Custom condition";
  }
}

export function summarizeAction(rule: RuleDto): string {
  try {
    const action = parseAutomationAction(rule.actionJson);
    if (action.type === "certificate.issue") {
      return "Issue certificate";
    }
    return `Notify via ${action.templateKey}`;
  } catch {
    return "Custom action";
  }
}
