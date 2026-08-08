import { AtlasHttpError } from "@atlas/core/http/errors";
import type { TenantTx } from "@atlas/db";
import type { ServiceCtx } from "@atlas/domain/shared/domain.types";
import {
  applyUseCaseBodySchema,
  createMarketingWorkflowBodySchema,
  deleteMarketingWorkflowBodySchema,
  deleteMarketingWorkflowResponseSchema,
  marketingUseCasesResponseSchema,
  marketingWorkflowResponseSchema,
  marketingWorkflowRunsResponseSchema,
  marketingWorkflowsListQuerySchema,
  marketingWorkflowsListResponseSchema,
  testFireWorkflowBodySchema,
  testFireWorkflowResponseSchema,
  updateMarketingWorkflowBasicsBodySchema,
  updateMarketingWorkflowGraphBodySchema,
  updateWorkflowNodeBodySchema,
} from "./marketing-workflow.schemas";
import { blankWorkflowGraph } from "./marketing-workflow.use-cases";
import { getUseCaseByKey, MARKETING_WORKFLOW_USE_CASES } from "./marketing-workflow.use-cases";
import {
  parseGraph,
  processDueMarketingWorkflowRuns,
  startSingleWorkflowRun,
  startWorkflowRunsForEvent,
} from "./marketing-workflow.engine";
import {
  marketingWorkflowRepository,
  type MarketingWorkflowRow,
} from "./marketing-workflow.repository";
import { workflowGraphSchema } from "./marketing-workflow.graph";

function notFound(message = "Workflow not found.") {
  return new AtlasHttpError({
    code: "PERMISSION_DENIED",
    status: 404,
    message,
  });
}

function validationError(message: string) {
  return new AtlasHttpError({
    code: "VALIDATION_ERROR",
    status: 400,
    message,
  });
}

function toDto(row: MarketingWorkflowRow) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    status: row.status as "DRAFT" | "PUBLISHED" | "UNPUBLISHED",
    allowResubscribe: row.allow_resubscribe,
    useCaseKey: row.use_case_key,
    graph: parseGraph(row.graph_json),
    publishedAt: row.published_at?.toISOString() ?? null,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

async function requireWorkflow(tx: TenantTx, id: string) {
  const row = await marketingWorkflowRepository.findById(tx, id);
  if (!row) throw notFound();
  return row;
}

function triggerTypeLabel(triggerType: unknown): string {
  if (typeof triggerType !== "string") return "Trigger";
  switch (triggerType) {
    case "learner_signup":
      return "Learner signup";
    case "form_submitted":
      return "Form submitted";
    case "payment_success":
      return "Payment success";
    case "test_evaluation":
      return "Test evaluation";
    case "product_expiry_soon":
      return "Product expiry soon";
    case "enrollment_created":
      return "Enrollment created";
    case "manual_test":
      return "Manual test";
    default:
      return triggerType.replaceAll("_", " ");
  }
}

function summarizeGraph(graph: ReturnType<typeof parseGraph>) {
  const nodes = Object.values(graph.nodes);
  const stepCount = nodes.length;
  const entry = graph.nodes[graph.entryNodeId];
  const formLabel =
    entry && typeof entry.config["formLabel"] === "string" ? entry.config["formLabel"].trim() : "";
  const testLabel =
    entry && typeof entry.config["testLabel"] === "string" ? entry.config["testLabel"].trim() : "";
  const productLabel =
    entry && typeof entry.config["productLabel"] === "string"
      ? entry.config["productLabel"].trim()
      : "";
  const triggerLabel =
    entry?.type === "trigger"
      ? formLabel ||
        testLabel ||
        productLabel ||
        entry.title?.trim() ||
        triggerTypeLabel(entry.config["triggerType"])
      : "No trigger";

  const channels = new Set<string>();
  let hasCondition = false;
  let hasDelay = false;
  for (const node of nodes) {
    if (node.type === "condition") hasCondition = true;
    if (node.type === "delay") hasDelay = true;
    if (node.type === "action") {
      const channel = node.config["channel"];
      if (typeof channel === "string" && channel.trim()) {
        channels.add(channel.trim().toLowerCase() === "email" ? "Email" : channel);
      } else {
        channels.add("Email");
      }
    }
  }

  const parts: string[] = [];
  if (stepCount === 0) parts.push("No steps defined");
  else parts.push(`${stepCount} step${stepCount === 1 ? "" : "s"}`);
  if (channels.size > 0) parts.push([...channels].join(" & "));
  else if (hasCondition) parts.push("Conditional");
  if (hasDelay && !parts.some((part) => part === "Conditional")) parts.push("Timed");

  return {
    stepCount,
    triggerLabel,
    summaryLabel: parts.join(" · "),
  };
}

export async function listMarketingWorkflows(tx: TenantTx, ctx: ServiceCtx, rawQuery: unknown) {
  await processDueMarketingWorkflowRuns(tx, ctx);
  const query = marketingWorkflowsListQuerySchema.parse(rawQuery ?? {});
  const [rows, statusCounts, totalActiveRuns] = await Promise.all([
    marketingWorkflowRepository.list(tx, {
      ...(query.status ? { status: query.status } : {}),
      ...(query.q ? { q: query.q } : {}),
      limit: query.limit,
    }),
    marketingWorkflowRepository.countByStatus(tx),
    marketingWorkflowRepository.countActiveRuns(tx),
  ]);

  const activeByWorkflow = await marketingWorkflowRepository.countActiveRunsByWorkflowIds(
    tx,
    rows.map((row) => row.id),
  );

  const items = rows.map((row) => {
    const dto = toDto(row);
    const graphSummary = summarizeGraph(dto.graph);
    const useCase = row.use_case_key ? getUseCaseByKey(row.use_case_key) : null;
    return {
      ...dto,
      ...graphSummary,
      activeRunCount: activeByWorkflow.get(row.id) ?? 0,
      useCaseTitle: useCase?.title ?? null,
    };
  });

  return marketingWorkflowsListResponseSchema.parse({
    data: {
      items,
      summary: {
        ...statusCounts,
        totalActiveRuns,
      },
    },
  });
}

export async function getMarketingWorkflow(tx: TenantTx, _ctx: ServiceCtx, id: string) {
  const row = await requireWorkflow(tx, id);
  return marketingWorkflowResponseSchema.parse({ data: toDto(row) });
}

export async function createMarketingWorkflow(tx: TenantTx, ctx: ServiceCtx, rawBody: unknown) {
  const body = createMarketingWorkflowBodySchema.parse(rawBody);
  const id = await marketingWorkflowRepository.insert(tx, {
    title: body.title,
    description: body.description ?? null,
    allowResubscribe: body.allowResubscribe,
    graph: blankWorkflowGraph(),
    createdByMembershipId: ctx.actorMembershipId,
  });
  const row = await requireWorkflow(tx, id);
  return marketingWorkflowResponseSchema.parse({ data: toDto(row) });
}

export async function updateMarketingWorkflowBasics(
  tx: TenantTx,
  _ctx: ServiceCtx,
  id: string,
  rawBody: unknown,
) {
  const body = updateMarketingWorkflowBasicsBodySchema.parse(rawBody);
  await requireWorkflow(tx, id);
  await marketingWorkflowRepository.updateBasics(tx, {
    id,
    title: body.title,
    description: body.description ?? null,
    allowResubscribe: body.allowResubscribe,
  });
  const row = await requireWorkflow(tx, id);
  return marketingWorkflowResponseSchema.parse({ data: toDto(row) });
}

export async function listMarketingUseCases(_tx: TenantTx, _ctx: ServiceCtx) {
  return marketingUseCasesResponseSchema.parse({
    data: {
      items: MARKETING_WORKFLOW_USE_CASES.map((item) => ({
        key: item.key,
        title: item.title,
        description: item.description,
      })),
    },
  });
}

export async function applyMarketingUseCase(
  tx: TenantTx,
  _ctx: ServiceCtx,
  id: string,
  rawBody: unknown,
) {
  const body = applyUseCaseBodySchema.parse(rawBody);
  const workflow = await requireWorkflow(tx, id);
  if (workflow.status === "PUBLISHED") {
    throw validationError("Unpublish the workflow before changing its use case.");
  }
  const useCase = getUseCaseByKey(body.useCaseKey);
  if (!useCase) throw validationError("Unknown use case.");
  await marketingWorkflowRepository.updateGraph(tx, {
    id,
    graph: useCase.graph,
    useCaseKey: useCase.key,
  });
  const row = await requireWorkflow(tx, id);
  return marketingWorkflowResponseSchema.parse({ data: toDto(row) });
}

export async function updateMarketingWorkflowGraph(
  tx: TenantTx,
  _ctx: ServiceCtx,
  id: string,
  rawBody: unknown,
) {
  const body = updateMarketingWorkflowGraphBodySchema.parse(rawBody);
  const workflow = await requireWorkflow(tx, id);
  if (workflow.status === "PUBLISHED") {
    throw validationError("Unpublish the workflow before editing the graph.");
  }
  const graph = workflowGraphSchema.parse(body.graph);
  await marketingWorkflowRepository.updateGraph(tx, {
    id,
    graph,
    useCaseKey: workflow.use_case_key,
  });
  const row = await requireWorkflow(tx, id);
  return marketingWorkflowResponseSchema.parse({ data: toDto(row) });
}

export async function updateMarketingWorkflowNode(
  tx: TenantTx,
  _ctx: ServiceCtx,
  id: string,
  rawBody: unknown,
) {
  const body = updateWorkflowNodeBodySchema.parse(rawBody);
  const workflow = await requireWorkflow(tx, id);
  if (workflow.status === "PUBLISHED") {
    throw validationError("Unpublish the workflow before editing nodes.");
  }
  const graph = parseGraph(workflow.graph_json);
  graph.nodes[body.node.id] = body.node;
  await marketingWorkflowRepository.updateGraph(tx, {
    id,
    graph,
    useCaseKey: workflow.use_case_key,
  });
  const row = await requireWorkflow(tx, id);
  return marketingWorkflowResponseSchema.parse({ data: toDto(row) });
}

export async function publishMarketingWorkflow(tx: TenantTx, _ctx: ServiceCtx, id: string) {
  const workflow = await requireWorkflow(tx, id);
  const graph = parseGraph(workflow.graph_json);
  const entry = graph.nodes[graph.entryNodeId];
  if (!entry || entry.type !== "trigger") {
    throw validationError("Workflow must start with a subscribe trigger.");
  }
  await marketingWorkflowRepository.setStatus(tx, id, "PUBLISHED");
  const row = await requireWorkflow(tx, id);
  return marketingWorkflowResponseSchema.parse({ data: toDto(row) });
}

export async function unpublishMarketingWorkflow(tx: TenantTx, _ctx: ServiceCtx, id: string) {
  await requireWorkflow(tx, id);
  await marketingWorkflowRepository.setStatus(tx, id, "UNPUBLISHED");
  const row = await requireWorkflow(tx, id);
  return marketingWorkflowResponseSchema.parse({ data: toDto(row) });
}

export async function cloneMarketingWorkflow(tx: TenantTx, ctx: ServiceCtx, id: string) {
  const source = await requireWorkflow(tx, id);
  const cloneId = await marketingWorkflowRepository.clone(tx, source, ctx.actorMembershipId);
  const row = await requireWorkflow(tx, cloneId);
  return marketingWorkflowResponseSchema.parse({ data: toDto(row) });
}

export async function deleteMarketingWorkflow(
  tx: TenantTx,
  _ctx: ServiceCtx,
  id: string,
  rawBody: unknown,
) {
  const body = deleteMarketingWorkflowBodySchema.parse(rawBody);
  const existing = await requireWorkflow(tx, id);
  if (existing.title.trim() !== body.titleConfirmation.trim()) {
    throw validationError("Title confirmation does not match.");
  }
  const deleted = await marketingWorkflowRepository.deleteById(tx, id);
  if (!deleted) throw notFound();
  return deleteMarketingWorkflowResponseSchema.parse({
    data: { id, deleted: true as const },
  });
}

export async function listMarketingWorkflowRuns(tx: TenantTx, _ctx: ServiceCtx, id: string) {
  const workflow = await requireWorkflow(tx, id);
  const graph = parseGraph(workflow.graph_json);
  const rows = await marketingWorkflowRepository.listRuns(tx, id);
  return marketingWorkflowRunsResponseSchema.parse({
    data: {
      items: rows.map((row) => {
        const currentNode =
          row.current_node_id != null ? graph.nodes[row.current_node_id] : undefined;
        return {
          id: row.id,
          workflowId: row.workflow_id,
          membershipId: row.membership_id,
          learnerName: row.learner_name,
          learnerEmail: row.learner_email,
          status: row.status,
          triggerEventType: row.trigger_event_type,
          currentNodeId: row.current_node_id,
          currentNodeTitle: currentNode?.title?.trim() || row.current_node_id,
          waitUntil: row.wait_until?.toISOString() ?? null,
          errorMessage: row.error_message,
          createdAt: row.created_at.toISOString(),
          completedAt: row.completed_at?.toISOString() ?? null,
        };
      }),
    },
  });
}

export async function testFireMarketingWorkflow(
  tx: TenantTx,
  ctx: ServiceCtx,
  id: string,
  rawBody: unknown,
) {
  const body = testFireWorkflowBodySchema.parse(rawBody ?? {});
  const workflow = await requireWorkflow(tx, id);
  if (workflow.status !== "PUBLISHED") {
    throw validationError("Publish the workflow before test firing.");
  }
  const membershipId = body.membershipId ?? ctx.actorMembershipId;
  const graph = parseGraph(workflow.graph_json);
  const entry = graph.nodes[graph.entryNodeId];
  const triggerType =
    entry?.type === "trigger" && typeof entry.config["triggerType"] === "string"
      ? String(entry.config["triggerType"])
      : "manual_test";
  const eventType =
    body.eventType ??
    (triggerType === "learner_signup"
      ? "membership.created"
      : triggerType === "enrollment_created"
        ? "learning.enrollment.created"
        : triggerType === "test_evaluation"
          ? "assessment.graded"
          : "marketing.workflow_manual_test");
  const result = await startSingleWorkflowRun(tx, ctx, {
    workflowId: id,
    membershipId,
    eventType,
    payload: {
      membershipId,
      scorePercent: 85,
      ...(body.payload ?? {}),
    },
    sourceEventId: `test-${Date.now()}`,
  });
  return testFireWorkflowResponseSchema.parse({ data: result });
}

export async function handleMarketingWorkflowOutboxEvent(
  tx: TenantTx,
  ctx: ServiceCtx,
  args: {
    eventType: string;
    eventId: string;
    payload: Record<string, unknown>;
  },
) {
  const membershipId =
    (typeof args.payload["membershipId"] === "string" && args.payload["membershipId"]) ||
    (typeof args.payload["learnerMembershipId"] === "string" &&
      args.payload["learnerMembershipId"]) ||
    null;
  return startWorkflowRunsForEvent(tx, ctx, {
    eventType: args.eventType,
    membershipId,
    payload: args.payload,
    sourceEventId: args.eventId,
  });
}
