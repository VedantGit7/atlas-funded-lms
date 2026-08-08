export type WorkflowStatus = "DRAFT" | "PUBLISHED" | "UNPUBLISHED";

export type WorkflowNode = {
  id: string;
  type: "trigger" | "delay" | "condition" | "action";
  title: string;
  config: Record<string, unknown>;
  next?: string | null;
  onTrue?: string | null;
  onFalse?: string | null;
};

export type WorkflowGraph = {
  entryNodeId: string;
  nodes: Record<string, WorkflowNode>;
};

export type WorkflowDto = {
  id: string;
  title: string;
  description: string | null;
  status: WorkflowStatus;
  allowResubscribe: boolean;
  useCaseKey: string | null;
  graph: WorkflowGraph;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type WorkflowListItemDto = WorkflowDto & {
  stepCount: number;
  triggerLabel: string;
  summaryLabel: string;
  activeRunCount: number;
  useCaseTitle: string | null;
};

export type WorkflowListSummary = {
  publishedCount: number;
  draftCount: number;
  unpublishedCount: number;
  totalActiveRuns: number;
};

export type UseCaseDto = {
  key: string;
  title: string;
  description: string;
};

export type WorkflowRunDto = {
  id: string;
  workflowId: string;
  membershipId: string | null;
  learnerName: string | null;
  learnerEmail: string | null;
  status: string;
  triggerEventType: string;
  currentNodeId: string | null;
  currentNodeTitle: string | null;
  waitUntil: string | null;
  errorMessage: string | null;
  createdAt: string;
  completedAt: string | null;
};

export const WORKFLOWS_LIST_HREF = "/admin/marketing/workflows";
export const WORKFLOWS_CREATE_HREF = "/admin/marketing/workflows/create";
export const MARKETING_HREF = "/admin/marketing";

export const WORKFLOW_TRIGGER_OPTIONS = [
  { value: "learner_signup", label: "Learner signup" },
  { value: "form_submitted", label: "Form submitted" },
  { value: "payment_success", label: "Payment success" },
  { value: "test_evaluation", label: "Test evaluation" },
  { value: "product_expiry_soon", label: "Product expiry soon" },
  { value: "enrollment_created", label: "Enrollment created" },
  { value: "manual_test", label: "Manual test" },
] as const;

export const WORKFLOW_CONDITION_OPERATOR_OPTIONS = [
  { value: "gte", label: "Greater than or equal to" },
  { value: "lte", label: "Less than or equal to" },
  { value: "eq", label: "Equals" },
] as const;

export const WORKFLOW_ACTION_OPTIONS = [
  { value: "send_message", label: "Send message" },
  { value: "send_free_resource", label: "Send free resource" },
  { value: "send_coupon", label: "Send coupon" },
  { value: "send_paid_enrollment_invite", label: "Send paid enrollment invite" },
  { value: "register_marketing_event", label: "Register marketing event" },
  { value: "send_webinar_invite", label: "Send webinar invite" },
] as const;

export function workflowHref(id: string) {
  return `/admin/marketing/workflows/${id}`;
}

export function formatWorkflowDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatWorkflowDate(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatWorkflowCount(value: number): string {
  return new Intl.NumberFormat(undefined).format(value);
}

export function workflowStatusLabel(status: WorkflowStatus): string {
  if (status === "PUBLISHED") return "Published";
  if (status === "DRAFT") return "Draft";
  return "Unpublished";
}

export function orderedGraphNodes(graph: WorkflowGraph): WorkflowNode[] {
  const seen = new Set<string>();
  const result: WorkflowNode[] = [];
  const visit = (id: string | null | undefined) => {
    if (!id || seen.has(id)) return;
    const node = graph.nodes[id];
    if (!node) return;
    seen.add(id);
    result.push(node);
    visit(node.next);
    visit(node.onTrue);
    visit(node.onFalse);
  };
  visit(graph.entryNodeId);
  for (const node of Object.values(graph.nodes)) {
    if (!seen.has(node.id)) result.push(node);
  }
  return result;
}

export function readConfigString(
  config: Record<string, unknown>,
  key: string,
): string {
  const value = config[key];
  return typeof value === "string" ? value : "";
}

export function readConfigNumber(
  config: Record<string, unknown>,
  key: string,
  fallback = 0,
): number {
  const value = config[key];
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export function emailSubject(node: WorkflowNode): string {
  const email = node.config["email"];
  if (email && typeof email === "object" && !Array.isArray(email)) {
    const subject = (email as Record<string, unknown>)["subject"];
    return typeof subject === "string" ? subject : "";
  }
  return "";
}

export function emailBody(node: WorkflowNode): string {
  const email = node.config["email"];
  if (email && typeof email === "object" && !Array.isArray(email)) {
    const bodyHtml = (email as Record<string, unknown>)["bodyHtml"];
    return typeof bodyHtml === "string" ? bodyHtml : "";
  }
  return "";
}

export function formatDelaySummary(config: Record<string, unknown>): string {
  const days = readConfigNumber(config, "days");
  const hours = readConfigNumber(config, "hours");
  const minutes = readConfigNumber(config, "minutes");
  const parts: string[] = [];
  if (days > 0) parts.push(`${String(days)}d`);
  if (hours > 0) parts.push(`${String(hours)}h`);
  if (minutes > 0) parts.push(`${String(minutes)}m`);
  return parts.length > 0 ? `Wait ${parts.join(" ")}` : "Wait";
}

export function formatConditionSummary(config: Record<string, unknown>): string {
  const operator = readConfigString(config, "operator") || "gte";
  const value = readConfigNumber(config, "value", 0);
  const symbol = operator === "lte" ? "≤" : operator === "eq" ? "=" : "≥";
  return `Quiz score ${symbol} ${String(value)}%`;
}

export function triggerTypeLabel(triggerType: string): string {
  return (
    WORKFLOW_TRIGGER_OPTIONS.find((option) => option.value === triggerType)?.label ??
    triggerType.replaceAll("_", " ")
  );
}

export function actionTypeLabel(actionType: string): string {
  return (
    WORKFLOW_ACTION_OPTIONS.find((option) => option.value === actionType)?.label ??
    actionType.replaceAll("_", " ")
  );
}

export function nodeTypeMetaLabel(type: WorkflowNode["type"]): string {
  if (type === "trigger") return "Trigger";
  if (type === "delay") return "Delay";
  if (type === "condition") return "Condition";
  return "Action";
}

export function nodeSubtitle(node: WorkflowNode): string {
  if (node.type === "trigger") {
    return triggerTypeLabel(readConfigString(node.config, "triggerType") || "manual_test");
  }
  if (node.type === "delay") return formatDelaySummary(node.config);
  if (node.type === "condition") return formatConditionSummary(node.config);
  return actionTypeLabel(readConfigString(node.config, "actionType") || "send_message");
}

export function isActiveWorkflowRunStatus(status: string): boolean {
  return status === "RUNNING" || status === "WAITING";
}

export function workflowRunStatusLabel(status: string): string {
  if (status === "RUNNING" || status === "WAITING") return "Active";
  if (status === "COMPLETED") return "Completed";
  if (status === "FAILED") return "Failed";
  return status;
}

export function workflowRunLearnerLabel(run: WorkflowRunDto): string {
  const name = run.learnerName?.trim();
  if (name) return name;
  const email = run.learnerEmail?.trim();
  if (email) return email;
  return "Unknown learner";
}

export function workflowRunCurrentStepLabel(run: WorkflowRunDto): string {
  if (run.currentNodeTitle?.trim()) return run.currentNodeTitle.trim();
  if (run.status === "COMPLETED") return "Completed";
  if (run.status === "FAILED") return run.errorMessage?.trim() || "Failed";
  return "—";
}
