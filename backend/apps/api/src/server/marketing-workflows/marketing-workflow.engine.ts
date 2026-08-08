import type { TenantTx } from "@atlas/db";
import type { ServiceCtx } from "@atlas/domain/shared/domain.types";
import { notificationRepository } from "../notifications/notification.repository";
import { getEmailProvider } from "../notifications/notification.email-provider";
import { readTenantEmailChannel } from "../tenant-settings/tenant-settings.service";
import { buildSafeInboxPayload } from "../notifications/notification.service";
import { registerMarketingEventFromWorkflow } from "../marketing-events/marketing-events.service";
import {
  TRIGGER_EVENT_MAP,
  workflowActionConfigSchema,
  workflowConditionConfigSchema,
  workflowDelayConfigSchema,
  workflowGraphSchema,
  workflowTriggerConfigSchema,
  type WorkflowGraph,
  type WorkflowNode,
} from "./marketing-workflow.graph";
import {
  marketingWorkflowRepository,
  type MarketingWorkflowRow,
  type MarketingWorkflowRunRow,
} from "./marketing-workflow.repository";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function parseGraph(raw: unknown): WorkflowGraph {
  return workflowGraphSchema.parse(
    raw && Object.keys(asRecord(raw)).length > 0
      ? raw
      : {
          entryNodeId: "trigger_1",
          nodes: {
            trigger_1: {
              id: "trigger_1",
              type: "trigger",
              title: "Subscribe trigger",
              config: { triggerType: "manual_test" },
              next: null,
            },
          },
        },
  );
}

function triggerMatches(
  node: WorkflowNode,
  eventType: string,
  payload: Record<string, unknown> = {},
): boolean {
  const config = workflowTriggerConfigSchema.safeParse(node.config);
  if (!config.success) return false;
  const mapped = TRIGGER_EVENT_MAP[config.data.triggerType];
  if (!(mapped.includes(eventType) || config.data.triggerType === "manual_test")) {
    return false;
  }
  if (config.data.triggerType === "form_submitted" && config.data.formId) {
    const payloadFormId =
      (typeof payload["formId"] === "string" && payload["formId"]) ||
      (typeof payload["form_id"] === "string" && payload["form_id"]) ||
      "";
    if (payloadFormId && payloadFormId !== config.data.formId) return false;
  }
  return true;
}

function evaluateCondition(node: WorkflowNode, payload: Record<string, unknown>): boolean {
  const config = workflowConditionConfigSchema.parse(node.config);
  const scoreRaw =
    payload["scorePercent"] ?? payload["percentage"] ?? payload["score"] ?? payload["percent"];
  const score = typeof scoreRaw === "number" ? scoreRaw : Number(scoreRaw);
  if (!Number.isFinite(score)) return false;
  if (config.operator === "gte") return score >= config.value;
  if (config.operator === "lte") return score <= config.value;
  return score === config.value;
}

function delayMs(config: { days: number; hours: number; minutes: number }) {
  return ((config.days * 24 + config.hours) * 60 + config.minutes) * 60_000;
}

async function sendActionEmail(args: {
  tx: TenantTx;
  ctx: ServiceCtx;
  run: MarketingWorkflowRunRow;
  node: WorkflowNode;
  subject: string;
  bodyHtml: string;
}) {
  const payload = asRecord(args.run.trigger_payload_json);
  const profile = args.run.membership_id
    ? await marketingWorkflowRepository.resolveMembershipEmail(args.tx, args.run.membership_id)
    : null;
  const email =
    profile?.email?.trim() ||
    (typeof payload["contactEmail"] === "string" ? payload["contactEmail"].trim() : "") ||
    (typeof payload["email"] === "string" ? payload["email"].trim() : "");
  if (!email) {
    await marketingWorkflowRepository.insertLog(args.tx, {
      runId: args.run.id,
      nodeId: args.node.id,
      nodeType: args.node.type,
      status: "SKIPPED",
      message: "No email address available for this run.",
    });
    return;
  }

  const provider = getEmailProvider();
  const channel = await readTenantEmailChannel(args.tx, "marketingEmail");
  const idempotencyKey = `marketing.workflow:${args.run.id}:${args.node.id}`;
  const existing = await notificationRepository.findDispatchByIdempotencyKey(args.tx, {
    tenantId: args.ctx.tenantId,
    idempotencyKey,
  });
  if (existing) return;

  if (provider.isConfigured()) {
    await provider.send({
      to: email,
      subject: args.subject,
      body: args.bodyHtml,
      requestId: args.ctx.requestId,
      fromName: channel.fromName,
      fromEmail: channel.fromEmail,
      replyToEmail: channel.replyToEmail,
    });
  }

  if (args.run.membership_id) {
    await notificationRepository.insertDispatch(args.tx, {
      tenantId: args.ctx.tenantId,
      membershipId: args.run.membership_id,
      channel: "email",
      templateKey: "marketing.workflow",
      destination: email,
      idempotencyKey,
      status: "SENT",
      payloadJson: {
        ...buildSafeInboxPayload({
          title: args.subject,
          body: args.bodyHtml.replace(/<[^>]+>/g, " ").slice(0, 500),
          actionPath: "/",
        }),
        workflow: {
          runId: args.run.id,
          nodeId: args.node.id,
          actionTitle: args.node.title,
        },
      },
      sentAt: new Date(),
    });
  }

  await marketingWorkflowRepository.insertLog(args.tx, {
    runId: args.run.id,
    nodeId: args.node.id,
    nodeType: args.node.type,
    status: "SENT",
    message: `Email sent to ${email}`,
  });
}

async function executeAction(args: {
  tx: TenantTx;
  ctx: ServiceCtx;
  run: MarketingWorkflowRunRow;
  node: WorkflowNode;
}) {
  const config = workflowActionConfigSchema.parse(args.node.config);
  const payload = asRecord(args.run.trigger_payload_json);
  const profile = args.run.membership_id
    ? await marketingWorkflowRepository.resolveMembershipEmail(args.tx, args.run.membership_id)
    : null;
  const email =
    profile?.email?.trim() ||
    (typeof payload["contactEmail"] === "string" ? payload["contactEmail"].trim() : "") ||
    (typeof payload["email"] === "string" ? payload["email"].trim() : "");
  const name =
    (typeof payload["contactName"] === "string" ? payload["contactName"].trim() : "") ||
    (typeof payload["name"] === "string" ? payload["name"].trim() : "") ||
    profile?.display_name?.trim() ||
    null;

  if (config.actionType === "register_marketing_event") {
    if (!config.eventId) {
      await marketingWorkflowRepository.insertLog(args.tx, {
        runId: args.run.id,
        nodeId: args.node.id,
        nodeType: args.node.type,
        status: "SKIPPED",
        message: "Register for Marketing Event has no eventId configured.",
      });
    } else if (!email) {
      await marketingWorkflowRepository.insertLog(args.tx, {
        runId: args.run.id,
        nodeId: args.node.id,
        nodeType: args.node.type,
        status: "SKIPPED",
        message: "No email available to register for the marketing event.",
      });
    } else {
      const result = await registerMarketingEventFromWorkflow(args.tx, {
        eventId: config.eventId,
        email,
        name,
        membershipId: args.run.membership_id,
        contactId: typeof payload["contactId"] === "string" ? payload["contactId"] : null,
      });
      await marketingWorkflowRepository.insertLog(args.tx, {
        runId: args.run.id,
        nodeId: args.node.id,
        nodeType: args.node.type,
        status: result.ok ? "OK" : "SKIPPED",
        message: result.ok
          ? result.alreadyRegistered
            ? `Already registered for event ${config.eventId}`
            : `Registered for event ${config.eventId}`
          : result.reason,
      });
    }
  }

  const emailConfig = config.email;
  if (!emailConfig) {
    if (config.actionType !== "register_marketing_event") {
      await marketingWorkflowRepository.insertLog(args.tx, {
        runId: args.run.id,
        nodeId: args.node.id,
        nodeType: args.node.type,
        status: "SKIPPED",
        message: "Action has no email content configured.",
      });
    }
    return;
  }

  const subject = emailConfig.subject;
  let bodyHtml = emailConfig.bodyHtml;
  if (config.couponCode) {
    bodyHtml += `<p><strong>Coupon:</strong> ${config.couponCode}</p>`;
  }
  if (config.resourceLabel) {
    bodyHtml += `<p><strong>Resource:</strong> ${config.resourceLabel}</p>`;
  }
  if (config.attachmentUrl) {
    bodyHtml += `<p><a href="${config.attachmentUrl}">Download attachment</a></p>`;
  }
  if (config.productLabel) {
    bodyHtml += `<p><strong>Product:</strong> ${config.productLabel}</p>`;
  }
  if (config.webinarLabel) {
    bodyHtml += `<p><strong>Webinar:</strong> ${config.webinarLabel}</p>`;
  }
  if (config.eventLabel) {
    bodyHtml += `<p><strong>Event:</strong> ${config.eventLabel}</p>`;
  }

  await sendActionEmail({
    tx: args.tx,
    ctx: args.ctx,
    run: args.run,
    node: args.node,
    subject,
    bodyHtml,
  });
}

async function advanceRun(
  tx: TenantTx,
  ctx: ServiceCtx,
  workflow: MarketingWorkflowRow,
  run: MarketingWorkflowRunRow,
): Promise<void> {
  const graph = parseGraph(workflow.graph_json);
  const payload = asRecord(run.trigger_payload_json);
  let currentId: string | null = run.current_node_id ?? graph.entryNodeId;
  let guard = 0;

  while (currentId && guard < 50) {
    guard += 1;
    const node: WorkflowNode | undefined = graph.nodes[currentId];
    if (!node) {
      await marketingWorkflowRepository.updateRun(tx, {
        id: run.id,
        status: "FAILED",
        currentNodeId: currentId,
        waitUntil: null,
        errorMessage: `Missing node ${currentId}`,
        completed: true,
      });
      return;
    }

    if (node.type === "trigger") {
      await marketingWorkflowRepository.insertLog(tx, {
        runId: run.id,
        nodeId: node.id,
        nodeType: node.type,
        status: "OK",
        message: `Trigger matched: ${typeof node.config["triggerType"] === "string" || typeof node.config["triggerType"] === "number" || typeof node.config["triggerType"] === "boolean" ? String(node.config["triggerType"]) : ""}`,
      });
      currentId = node.next ?? null;
      continue;
    }

    if (node.type === "delay") {
      const config = workflowDelayConfigSchema.parse(node.config);
      const waitUntil = new Date(Date.now() + delayMs(config));
      await marketingWorkflowRepository.insertLog(tx, {
        runId: run.id,
        nodeId: node.id,
        nodeType: node.type,
        status: "WAITING",
        message: `Waiting until ${waitUntil.toISOString()}`,
      });
      await marketingWorkflowRepository.updateRun(tx, {
        id: run.id,
        status: "WAITING",
        currentNodeId: node.next ?? null,
        waitUntil,
      });
      return;
    }

    if (node.type === "condition") {
      const passed = evaluateCondition(node, payload);
      await marketingWorkflowRepository.insertLog(tx, {
        runId: run.id,
        nodeId: node.id,
        nodeType: node.type,
        status: passed ? "TRUE" : "FALSE",
        message: passed ? "Condition passed" : "Condition failed",
      });
      currentId = (passed ? node.onTrue : node.onFalse) ?? node.next ?? null;
      continue;
    }

    // Remaining node types are actions after trigger/delay/condition handling.

    {
      try {
        await executeAction({ tx, ctx, run, node });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Action failed";
        await marketingWorkflowRepository.insertLog(tx, {
          runId: run.id,
          nodeId: node.id,
          nodeType: node.type,
          status: "FAILED",
          message,
        });
        await marketingWorkflowRepository.updateRun(tx, {
          id: run.id,
          status: "FAILED",
          currentNodeId: node.id,
          waitUntil: null,
          errorMessage: message,
          completed: true,
        });
        return;
      }
      currentId = node.next ?? null;
      continue;
    }

    currentId = null;
  }

  await marketingWorkflowRepository.updateRun(tx, {
    id: run.id,
    status: "COMPLETED",
    currentNodeId: null,
    waitUntil: null,
    completed: true,
  });
  await marketingWorkflowRepository.insertLog(tx, {
    runId: run.id,
    nodeId: null,
    nodeType: null,
    status: "COMPLETED",
    message: "Workflow run completed.",
  });
}

export async function startWorkflowRunsForEvent(
  tx: TenantTx,
  ctx: ServiceCtx,
  args: {
    eventType: string;
    membershipId: string | null;
    payload: Record<string, unknown>;
    sourceEventId?: string;
  },
) {
  const contactEmail =
    (typeof args.payload["contactEmail"] === "string" && args.payload["contactEmail"]) ||
    (typeof args.payload["email"] === "string" && args.payload["email"]) ||
    "";
  if (!args.membershipId && !contactEmail) return { started: 0 };

  const subjectKey = args.membershipId ?? `email:${contactEmail.toLowerCase()}`;
  const published = await marketingWorkflowRepository.listPublished(tx);
  let started = 0;

  for (const workflow of published) {
    const graph = parseGraph(workflow.graph_json);
    const entry = graph.nodes[graph.entryNodeId];
    if (!entry || entry.type !== "trigger") continue;
    if (!triggerMatches(entry, args.eventType, args.payload)) continue;

    if (!workflow.allow_resubscribe && args.membershipId) {
      const completed = await marketingWorkflowRepository.hasCompletedRun(
        tx,
        workflow.id,
        args.membershipId,
      );
      if (completed) continue;
      const active = await marketingWorkflowRepository.countActiveRunsForMembership(
        tx,
        workflow.id,
        args.membershipId,
      );
      if (active > 0) continue;
    }

    const idempotencyKey = [
      "mwf",
      workflow.id,
      subjectKey,
      args.eventType,
      args.sourceEventId ?? "manual",
    ].join(":");

    const existing = await marketingWorkflowRepository.findRunByIdempotency(tx, idempotencyKey);
    if (existing) continue;

    const runId = await marketingWorkflowRepository.insertRun(tx, {
      workflowId: workflow.id,
      membershipId: args.membershipId,
      triggerEventType: args.eventType,
      triggerPayload: args.payload,
      currentNodeId: graph.entryNodeId,
      idempotencyKey,
    });
    const run = await marketingWorkflowRepository.findRun(tx, runId);
    if (!run) continue;
    await advanceRun(tx, ctx, workflow, run);
    started += 1;
  }

  return { started };
}

export async function resumeWorkflowRun(tx: TenantTx, ctx: ServiceCtx, runId: string) {
  const run = await marketingWorkflowRepository.findRun(tx, runId);
  if (!run) return;
  if (run.status !== "WAITING" && run.status !== "RUNNING") return;
  const workflow = await marketingWorkflowRepository.findById(tx, run.workflow_id);
  if (!workflow) return;

  await marketingWorkflowRepository.updateRun(tx, {
    id: run.id,
    status: "RUNNING",
    currentNodeId: run.current_node_id,
    waitUntil: null,
  });
  const refreshed = await marketingWorkflowRepository.findRun(tx, run.id);
  if (!refreshed) return;
  await advanceRun(tx, ctx, workflow, refreshed);
}

export async function processDueMarketingWorkflowRuns(tx: TenantTx, ctx: ServiceCtx) {
  const due = await marketingWorkflowRepository.listDueWaiting(tx);
  for (const run of due) {
    await resumeWorkflowRun(tx, ctx, run.id);
  }
  return { processed: due.length };
}

export async function startSingleWorkflowRun(
  tx: TenantTx,
  ctx: ServiceCtx,
  args: {
    workflowId: string;
    membershipId: string;
    eventType: string;
    payload: Record<string, unknown>;
    sourceEventId: string;
  },
) {
  const workflow = await marketingWorkflowRepository.findById(tx, args.workflowId);
  if (!workflow || workflow.status !== "PUBLISHED") {
    return { started: 0 };
  }
  const graph = parseGraph(workflow.graph_json);
  const idempotencyKey = [
    "mwf",
    workflow.id,
    args.membershipId,
    args.eventType,
    args.sourceEventId,
  ].join(":");
  const existing = await marketingWorkflowRepository.findRunByIdempotency(tx, idempotencyKey);
  if (existing) return { started: 0 };

  const runId = await marketingWorkflowRepository.insertRun(tx, {
    workflowId: workflow.id,
    membershipId: args.membershipId,
    triggerEventType: args.eventType,
    triggerPayload: args.payload,
    currentNodeId: graph.entryNodeId,
    idempotencyKey,
  });
  const run = await marketingWorkflowRepository.findRun(tx, runId);
  if (!run) return { started: 0 };
  await advanceRun(tx, ctx, workflow, run);
  return { started: 1 };
}
