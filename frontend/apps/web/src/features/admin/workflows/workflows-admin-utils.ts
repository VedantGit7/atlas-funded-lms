export type WorkflowDefinitionItem = {
  id: string;
  key: string;
  name: string;
  definitionJson: Record<string, unknown>;
  status: "ACTIVE" | "ARCHIVED" | "DRAFT";
  updatedAt: string;
};

export type WorkflowStageForm = {
  targetType: string;
  fromState: string;
  reviewState: string;
  approvedState: string;
  rejectedState: string;
  requiresReview: boolean;
  assigneeRoleKey: string;
  actions: string[];
};

export const TARGET_TYPES = [
  "course",
  "assessment",
  "learning_path",
  "certificate",
  "certificate_template",
] as const;

export const WORKFLOW_ACTIONS = ["approve", "reject", "return"] as const;

export const WORKFLOW_STATE_OPTIONS = [
  "DRAFT",
  "REVIEW",
  "IN_REVIEW",
  "PENDING_MODIFICATION",
  "MODERATION_QUEUE",
  "PUBLISHED",
  "APPROVED",
  "REJECTED",
  "REJECTED_PERMANENT",
  "ARCHIVED",
] as const;

const TARGET_TYPE_LABELS: Record<string, string> = {
  course: "Course",
  assessment: "Assessment",
  learning_path: "Learning path",
  certificate: "Certification",
  certificate_template: "Certificate template",
};

const ACTION_LABELS: Record<string, string> = {
  approve: "Approve",
  reject: "Reject",
  return: "Return to draft",
};

export function formatTargetTypeLabel(targetType: string): string {
  return TARGET_TYPE_LABELS[targetType] ?? targetType.replace(/_/g, " ");
}

export function formatActionLabel(action: string): string {
  return ACTION_LABELS[action] ?? action;
}

export function formatWorkflowStatusLabel(status: WorkflowDefinitionItem["status"]): string {
  switch (status) {
    case "ACTIVE":
      return "Active";
    case "DRAFT":
      return "Draft";
    case "ARCHIVED":
      return "Archived";
  }
}

export function formatRelativeTime(iso: string): string {
  const date = new Date(iso);
  const diffMinutes = Math.round((date.getTime() - Date.now()) / (1000 * 60));
  if (Math.abs(diffMinutes) < 60) {
    return new Intl.RelativeTimeFormat(undefined, { numeric: "auto" }).format(diffMinutes, "minute");
  }
  const diffHours = Math.round((date.getTime() - Date.now()) / (1000 * 60 * 60));
  if (Math.abs(diffHours) < 48) {
    return new Intl.RelativeTimeFormat(undefined, { numeric: "auto" }).format(diffHours, "hour");
  }
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function stateOptionsForValue(value: string) {
  const options = WORKFLOW_STATE_OPTIONS.map((state) => ({ value: state, label: state }));
  if (value && !WORKFLOW_STATE_OPTIONS.includes(value as (typeof WORKFLOW_STATE_OPTIONS)[number])) {
    options.unshift({ value, label: value });
  }
  return options;
}

export function targetTypeOptions() {
  return TARGET_TYPES.map((value) => ({ value, label: formatTargetTypeLabel(value) }));
}

export function defaultStageForm(): WorkflowStageForm {
  return parseDefinition({});
}

export function parseDefinition(definitionJson: Record<string, unknown>): WorkflowStageForm {
  const actions = Array.isArray(definitionJson["actions"])
    ? definitionJson["actions"].filter((value): value is string => typeof value === "string")
    : ["approve", "reject", "return"];

  return {
    targetType:
      typeof definitionJson["targetType"] === "string" ? definitionJson["targetType"] : "course",
    fromState: typeof definitionJson["fromState"] === "string" ? definitionJson["fromState"] : "DRAFT",
    reviewState:
      typeof definitionJson["reviewState"] === "string" ? definitionJson["reviewState"] : "REVIEW",
    approvedState:
      typeof definitionJson["approvedState"] === "string" ? definitionJson["approvedState"] : "PUBLISHED",
    rejectedState:
      typeof definitionJson["rejectedState"] === "string" ? definitionJson["rejectedState"] : "REJECTED",
    requiresReview: definitionJson["requiresReview"] === true,
    assigneeRoleKey:
      typeof definitionJson["assigneeRoleKey"] === "string" ? definitionJson["assigneeRoleKey"] : "admin",
    actions: actions.length > 0 ? actions : ["approve", "reject", "return"],
  };
}

export function toDefinitionJson(form: WorkflowStageForm): Record<string, unknown> {
  return {
    targetType: form.targetType,
    fromState: form.fromState.trim(),
    reviewState: form.reviewState.trim(),
    approvedState: form.approvedState.trim(),
    rejectedState: form.rejectedState.trim(),
    requiresReview: form.requiresReview,
    assigneeRoleKey: form.assigneeRoleKey.trim() || "admin",
    actions: form.actions,
  };
}

export type WorkflowDraftValidationResult =
  | { ok: true }
  | { ok: false; field: string; message: string };

export function validateWorkflowDraft(args: {
  key: string;
  name: string;
  stageForm: WorkflowStageForm;
  definitionJson?: string;
  useAdvancedJson: boolean;
}): WorkflowDraftValidationResult {
  const key = args.key.trim();
  if (!/^[a-z][a-z0-9._-]*$/.test(key)) {
    return {
      ok: false,
      field: "key",
      message:
        "Workflow key must start with a lowercase letter and use letters, numbers, dots, hyphens, or underscores.",
    };
  }

  const name = args.name.trim();
  if (name.length < 1 || name.length > 200) {
    return {
      ok: false,
      field: "name",
      message: "Display name is required and must be under 200 characters.",
    };
  }

  if (args.useAdvancedJson) {
    try {
      JSON.parse(args.definitionJson ?? "{}");
    } catch {
      return {
        ok: false,
        field: "definitionJson",
        message: "Definition JSON must be valid JSON.",
      };
    }
    return { ok: true };
  }

  const form = args.stageForm;
  for (const [field, value] of [
    ["fromState", form.fromState],
    ["reviewState", form.reviewState],
    ["approvedState", form.approvedState],
    ["rejectedState", form.rejectedState],
  ] as const) {
    if (!value.trim()) {
      return { ok: false, field, message: "State value is required." };
    }
  }

  if (form.requiresReview && !form.assigneeRoleKey.trim()) {
    return {
      ok: false,
      field: "assigneeRoleKey",
      message: "Assignee role is required when review is enabled.",
    };
  }

  if (form.actions.length === 0) {
    return {
      ok: false,
      field: "actions",
      message: "Select at least one allowed action.",
    };
  }

  return { ok: true };
}
