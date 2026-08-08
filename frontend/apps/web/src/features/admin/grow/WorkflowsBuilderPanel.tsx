"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  BarChart3,
  BookOpen,
  ChevronDown,
  ChevronLeft,
  ChevronUp,
  Clock3,
  HelpCircle,
  Library,
  Mail,
  Settings2,
  Split,
  Trash2,
  UserPlus,
  X,
  Zap,
} from "lucide-react";
import { ClientApiError, clientApi, toast } from "../../../lib/client-api";
import { AdminSelectDropdown } from "../../readiness/components/AdminSelectDropdown";
import {
  dropdownPanelSurfaceClassName,
  memberInitials,
} from "../../studio/courses/admin-form-dropdown-shared";
import { MESSENGER_WIZARD_FIELD_CLASS, MESSENGER_WIZARD_LABEL_CLASS } from "./push-wizard-chrome";
import {
  emailBody,
  emailSubject,
  formatWorkflowCount,
  formatWorkflowDateTime,
  isActiveWorkflowRunStatus,
  nodeSubtitle,
  nodeTypeMetaLabel,
  orderedGraphNodes,
  readConfigNumber,
  readConfigString,
  WORKFLOW_ACTION_OPTIONS,
  WORKFLOW_CONDITION_OPERATOR_OPTIONS,
  WORKFLOW_TRIGGER_OPTIONS,
  WORKFLOWS_LIST_HREF,
  workflowRunCurrentStepLabel,
  workflowRunLearnerLabel,
  workflowRunStatusLabel,
  workflowStatusLabel,
  type UseCaseDto,
  type WorkflowDto,
  type WorkflowNode,
  type WorkflowRunDto,
} from "./workflows-shared";

type WorkflowResponse = { data: WorkflowDto };
type UseCasesResponse = { data: { items: UseCaseDto[] } };
type RunsResponse = { data: { items: WorkflowRunDto[] } };
type TestFireResponse = { data: { started: number } };

type InspectorTab = "node" | "basics";

const FIELD_CLASS = MESSENGER_WIZARD_FIELD_CLASS;
const LABEL_CLASS = `${MESSENGER_WIZARD_LABEL_CLASS} !mb-2 text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--admin-on-surface-variant)]`;

function StatusPill({ status }: { status: WorkflowDto["status"] }) {
  const tone = status === "PUBLISHED" ? "success" : status === "DRAFT" ? "neutral" : "warning";
  return (
    <span
      className={[
        "inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-tight",
        tone === "success"
          ? "border-[color-mix(in_srgb,var(--admin-success)_22%,transparent)] bg-[color-mix(in_srgb,var(--admin-success)_12%,var(--admin-surface))] text-[var(--admin-success)]"
          : tone === "warning"
            ? "border-[color-mix(in_srgb,var(--admin-warning)_22%,transparent)] bg-[color-mix(in_srgb,var(--admin-warning)_12%,var(--admin-surface))] text-[var(--admin-warning)]"
            : "border-[var(--admin-border)] bg-[var(--admin-surface-high)] text-[var(--admin-on-surface-variant)]",
      ].join(" ")}
    >
      {workflowStatusLabel(status)}
    </span>
  );
}

function RunStatusChip({ status }: { status: string }) {
  const active = isActiveWorkflowRunStatus(status);
  const failed = status === "FAILED";
  return (
    <span
      className={[
        "inline-flex rounded px-2 py-1 text-[11px] font-bold",
        active
          ? "bg-[color-mix(in_srgb,var(--admin-success)_12%,var(--admin-surface))] text-[var(--admin-success)]"
          : failed
            ? "bg-[color-mix(in_srgb,var(--admin-danger)_12%,var(--admin-surface))] text-[var(--admin-danger)]"
            : "bg-[var(--admin-surface-high)] text-[var(--admin-on-surface-variant)]",
      ].join(" ")}
    >
      {workflowRunStatusLabel(status)}
    </span>
  );
}

function NodeGlyph({
  type,
  selected,
  size = "md",
}: {
  type: WorkflowNode["type"];
  selected?: boolean;
  size?: "md" | "lg";
}) {
  const iconClass = size === "lg" ? "h-8 w-8" : "h-7 w-7";
  if (type === "trigger") {
    return (
      <div
        className={[
          "flex items-center justify-center rounded-full bg-[var(--admin-primary)] text-[var(--admin-on-primary)] shadow-lg ring-4 ring-[color-mix(in_srgb,var(--admin-primary)_18%,transparent)] transition-transform motion-safe:group-hover:scale-105",
          size === "lg" ? "h-16 w-16" : "h-14 w-14",
          selected ? "workflow-node-selected" : "",
        ].join(" ")}
      >
        <UserPlus className={iconClass} aria-hidden="true" />
      </div>
    );
  }
  if (type === "condition") {
    return (
      <div
        className={[
          "flex h-24 w-24 items-center justify-center overflow-hidden rounded-xl border-2 border-[var(--admin-primary)] bg-[var(--admin-surface)] rotate-45 transition-all",
          selected ? "workflow-node-selected" : "",
        ].join(" ")}
      >
        <div className="-rotate-45 text-[var(--admin-primary)]">
          <HelpCircle className="h-8 w-8" aria-hidden="true" />
        </div>
      </div>
    );
  }
  const Icon = type === "delay" ? Clock3 : Mail;
  return (
    <div
      className={[
        "flex h-14 w-14 items-center justify-center rounded-xl border-2 bg-[var(--admin-surface)] shadow-sm transition-colors",
        selected
          ? "border-[var(--admin-primary)] text-[var(--admin-primary)] workflow-node-selected"
          : "border-[var(--admin-outline)] text-[var(--admin-on-surface-variant)] group-hover:border-[var(--admin-primary)]",
      ].join(" ")}
    >
      <Icon className="h-7 w-7" aria-hidden="true" />
    </div>
  );
}

function NodeCard({
  node,
  selected,
  onSelect,
}: {
  node: WorkflowNode;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="group z-10 flex flex-col items-center text-left outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/40"
      aria-pressed={selected}
      aria-label={`${nodeTypeMetaLabel(node.type)}: ${node.title}`}
    >
      <NodeGlyph
        type={node.type}
        selected={selected}
        size={node.type === "trigger" ? "lg" : "md"}
      />
      <div
        className={[
          "mt-2 min-w-[9rem] max-w-[14rem] rounded-lg border bg-[var(--admin-surface)] px-4 py-2 shadow-sm",
          selected ? "border-[var(--admin-primary)] shadow-lg" : "border-[var(--admin-border)]",
          node.type === "condition" ? "mt-8" : "",
        ].join(" ")}
      >
        <p className="text-center text-sm font-bold text-[var(--admin-on-surface)]">{node.title}</p>
        <p
          className={[
            "mt-0.5 text-center text-[10px] font-bold uppercase tracking-wider",
            selected || node.type === "condition"
              ? "text-[var(--admin-primary)]"
              : "text-[var(--admin-on-surface-variant)]",
          ].join(" ")}
        >
          {nodeTypeMetaLabel(node.type)}
        </p>
      </div>
    </button>
  );
}

function FlowConnector() {
  return <div className="h-12 w-px bg-[var(--admin-outline)]" aria-hidden="true" />;
}

function FlowBranch({
  nodeId,
  graph,
  selectedNodeId,
  onSelect,
  visited,
}: {
  nodeId: string | null | undefined;
  graph: WorkflowDto["graph"];
  selectedNodeId: string | null;
  onSelect: (id: string) => void;
  visited: Set<string>;
}) {
  if (!nodeId || visited.has(nodeId)) return null;
  const node = graph.nodes[nodeId];
  if (!node) return null;
  const nextVisited = new Set(visited);
  nextVisited.add(nodeId);

  if (node.type === "condition") {
    return (
      <div className="relative z-10 flex flex-col items-center">
        <NodeCard
          node={node}
          selected={node.id === selectedNodeId}
          onSelect={() => {
            onSelect(node.id);
          }}
        />
        <div className="mt-6 flex flex-col items-center gap-2 sm:mt-10 sm:flex-row sm:items-start sm:gap-16 lg:gap-24">
          <div className="flex flex-col items-center">
            <span className="mb-3 rounded border border-[color-mix(in_srgb,var(--admin-success)_30%,transparent)] bg-[var(--admin-surface)] px-3 py-1 text-[10px] font-bold text-[var(--admin-success)]">
              Yes / True
            </span>
            <FlowConnector />
            <FlowBranch
              nodeId={node.onTrue}
              graph={graph}
              selectedNodeId={selectedNodeId}
              onSelect={onSelect}
              visited={nextVisited}
            />
          </div>
          <div className="flex flex-col items-center">
            <span className="mb-3 rounded border border-[color-mix(in_srgb,var(--admin-danger)_30%,transparent)] bg-[var(--admin-surface)] px-3 py-1 text-[10px] font-bold text-[var(--admin-danger)]">
              No / False
            </span>
            <FlowConnector />
            <FlowBranch
              nodeId={node.onFalse}
              graph={graph}
              selectedNodeId={selectedNodeId}
              onSelect={onSelect}
              visited={nextVisited}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="z-10 flex flex-col items-center">
      <NodeCard
        node={node}
        selected={node.id === selectedNodeId}
        onSelect={() => {
          onSelect(node.id);
        }}
      />
      {node.next ? (
        <>
          <FlowConnector />
          <FlowBranch
            nodeId={node.next}
            graph={graph}
            selectedNodeId={selectedNodeId}
            onSelect={onSelect}
            visited={nextVisited}
          />
        </>
      ) : null}
    </div>
  );
}

function InspectorIcon({ type }: { type: WorkflowNode["type"] | "basics" }) {
  if (type === "basics") return <Settings2 className="h-5 w-5" aria-hidden="true" />;
  if (type === "trigger") return <Zap className="h-5 w-5" aria-hidden="true" />;
  if (type === "delay") return <Clock3 className="h-5 w-5" aria-hidden="true" />;
  if (type === "condition") return <Split className="h-5 w-5" aria-hidden="true" />;
  return <Mail className="h-5 w-5" aria-hidden="true" />;
}

function LiveToggle({
  published,
  disabled,
  onToggle,
}: {
  published: boolean;
  disabled: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="flex items-center gap-2 rounded-full border border-[color-mix(in_srgb,var(--admin-outline)_35%,transparent)] bg-[var(--admin-surface-low)] p-1">
      <span className="px-2 text-[11px] font-bold uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
        Live
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={published}
        aria-label={published ? "Unpublish workflow" : "Publish workflow"}
        disabled={disabled}
        onClick={onToggle}
        className={[
          "relative h-5 w-10 rounded-full transition-colors duration-300 disabled:opacity-50",
          published ? "bg-[var(--admin-primary)]" : "bg-[var(--admin-outline)]",
        ].join(" ")}
      >
        <span
          className={[
            "absolute top-1 h-3 w-3 rounded-full bg-[var(--admin-on-primary)] transition-transform duration-300",
            published ? "right-1" : "left-1",
          ].join(" ")}
        />
      </button>
    </div>
  );
}

export function WorkflowsBuilderPanel({ workflowId }: { workflowId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pickUseCase = searchParams.get("pickUseCase") === "1";

  const [workflow, setWorkflow] = useState<WorkflowDto | null>(null);
  const [useCases, setUseCases] = useState<UseCaseDto[]>([]);
  const [runs, setRuns] = useState<WorkflowRunDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUseCases, setShowUseCases] = useState(pickUseCase);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>("node");
  const [runsOpen, setRunsOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [allowResubscribe, setAllowResubscribe] = useState(false);
  const [nodeTitle, setNodeTitle] = useState("");
  const [triggerType, setTriggerType] = useState("manual_test");
  const [formLabel, setFormLabel] = useState("");
  const [productLabel, setProductLabel] = useState("");
  const [testLabel, setTestLabel] = useState("");
  const [daysBeforeExpiry, setDaysBeforeExpiry] = useState("3");
  const [delayDays, setDelayDays] = useState("0");
  const [delayHours, setDelayHours] = useState("0");
  const [delayMinutes, setDelayMinutes] = useState("0");
  const [conditionOperator, setConditionOperator] = useState("gte");
  const [conditionValue, setConditionValue] = useState("80");
  const [actionType, setActionType] = useState("send_message");
  const [subject, setSubject] = useState("");
  const [bodyHtml, setBodyHtml] = useState("");
  const [couponCode, setCouponCode] = useState("");
  const [resourceLabel, setResourceLabel] = useState("");
  const [actionProductLabel, setActionProductLabel] = useState("");
  const [eventLabel, setEventLabel] = useState("");
  const [webinarLabel, setWebinarLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [wf, cases, runList] = await Promise.all([
        clientApi.get<WorkflowResponse>(
          `/api/v1/marketing/workflows/${workflowId}`,
          "workflow-get",
        ),
        clientApi.get<UseCasesResponse>(
          "/api/v1/marketing/workflows/use-cases",
          "workflow-use-cases",
        ),
        clientApi.get<RunsResponse>(
          `/api/v1/marketing/workflows/${workflowId}/runs`,
          "workflow-runs",
        ),
      ]);
      setWorkflow(wf.data);
      setTitle(wf.data.title);
      setDescription(wf.data.description ?? "");
      setAllowResubscribe(wf.data.allowResubscribe);
      setUseCases(cases.data.items);
      setRuns(runList.data.items);
      const first = orderedGraphNodes(wf.data.graph)[0];
      setSelectedNodeId((prev) => prev ?? first?.id ?? null);
    } catch (caught) {
      toast.error(caught instanceof ClientApiError ? caught.message : "Could not load workflow.");
    } finally {
      setLoading(false);
    }
  }, [workflowId]);

  useEffect(() => {
    void load();
  }, [load]);

  const selectedNode = useMemo(
    () => (workflow && selectedNodeId ? (workflow.graph.nodes[selectedNodeId] ?? null) : null),
    [workflow, selectedNodeId],
  );

  useEffect(() => {
    if (!selectedNode) return;
    setNodeTitle(selectedNode.title);
    setTriggerType(readConfigString(selectedNode.config, "triggerType") || "manual_test");
    setFormLabel(readConfigString(selectedNode.config, "formLabel"));
    setProductLabel(readConfigString(selectedNode.config, "productLabel"));
    setTestLabel(readConfigString(selectedNode.config, "testLabel"));
    setDaysBeforeExpiry(String(readConfigNumber(selectedNode.config, "daysBeforeExpiry", 3)));
    setDelayDays(String(readConfigNumber(selectedNode.config, "days")));
    setDelayHours(String(readConfigNumber(selectedNode.config, "hours")));
    setDelayMinutes(String(readConfigNumber(selectedNode.config, "minutes")));
    setConditionOperator(readConfigString(selectedNode.config, "operator") || "gte");
    setConditionValue(String(readConfigNumber(selectedNode.config, "value", 80)));
    setActionType(readConfigString(selectedNode.config, "actionType") || "send_message");
    setSubject(emailSubject(selectedNode));
    setBodyHtml(emailBody(selectedNode));
    setCouponCode(readConfigString(selectedNode.config, "couponCode"));
    setResourceLabel(readConfigString(selectedNode.config, "resourceLabel"));
    setActionProductLabel(readConfigString(selectedNode.config, "productLabel"));
    setEventLabel(readConfigString(selectedNode.config, "eventLabel"));
    setWebinarLabel(readConfigString(selectedNode.config, "webinarLabel"));
    setInspectorTab("node");
  }, [selectedNode]);

  const published = workflow?.status === "PUBLISHED";
  const activeRunCount = useMemo(
    () => runs.filter((run) => isActiveWorkflowRunStatus(run.status)).length,
    [runs],
  );

  async function saveBasics() {
    if (!workflow) return;
    setBusy(true);
    try {
      const response = await clientApi.patch<WorkflowResponse>(
        `/api/v1/marketing/workflows/${workflow.id}`,
        {
          title: title.trim(),
          description: description.trim() || null,
          allowResubscribe,
        },
        "workflow-basics",
        { successMessage: "Workflow saved." },
      );
      setWorkflow(response.data);
    } catch (caught) {
      toast.error(caught instanceof ClientApiError ? caught.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  }

  async function applyUseCase(key: string) {
    if (!workflow) return;
    setBusy(true);
    try {
      const response = await clientApi.post<WorkflowResponse>(
        `/api/v1/marketing/workflows/${workflow.id}/apply-use-case`,
        { useCaseKey: key },
        "workflow-apply-use-case",
        { successMessage: "Use case applied." },
      );
      setWorkflow(response.data);
      setShowUseCases(false);
      router.replace(`/admin/marketing/workflows/${workflow.id}`);
      const first = orderedGraphNodes(response.data.graph)[0];
      setSelectedNodeId(first?.id ?? null);
    } catch (caught) {
      toast.error(caught instanceof ClientApiError ? caught.message : "Could not apply use case.");
    } finally {
      setBusy(false);
    }
  }

  async function saveNode() {
    if (!workflow || !selectedNode) return;
    if (published) {
      toast.error("Unpublish before editing nodes.");
      return;
    }
    setBusy(true);
    try {
      const nextNode: WorkflowNode = {
        ...selectedNode,
        title: nodeTitle.trim() || selectedNode.title,
        config: { ...selectedNode.config },
      };

      if (selectedNode.type === "trigger") {
        nextNode.config = {
          triggerType,
          formLabel: formLabel.trim() || null,
          productLabel: productLabel.trim() || null,
          testLabel: testLabel.trim() || null,
          daysBeforeExpiry:
            triggerType === "product_expiry_soon"
              ? Math.max(1, Math.min(90, Number(daysBeforeExpiry) || 3))
              : null,
        };
      } else if (selectedNode.type === "delay") {
        nextNode.config = {
          days: Math.max(0, Math.min(365, Number(delayDays) || 0)),
          hours: Math.max(0, Math.min(23, Number(delayHours) || 0)),
          minutes: Math.max(0, Math.min(59, Number(delayMinutes) || 0)),
        };
      } else if (selectedNode.type === "condition") {
        nextNode.config = {
          conditionType: "test_percentage",
          operator: conditionOperator,
          value: Math.max(0, Math.min(100, Number(conditionValue) || 0)),
        };
      } else {
        nextNode.config = {
          actionType,
          channel: "email",
          couponCode: couponCode.trim() || null,
          resourceLabel: resourceLabel.trim() || null,
          productLabel: actionProductLabel.trim() || null,
          eventLabel: eventLabel.trim() || null,
          webinarLabel: webinarLabel.trim() || null,
          email: {
            subject: subject.trim() || "Workflow message",
            bodyHtml: bodyHtml.trim() || "<p>Hello</p>",
          },
        };
      }

      const response = await clientApi.patch<WorkflowResponse>(
        `/api/v1/marketing/workflows/${workflow.id}/node`,
        { node: nextNode },
        "workflow-node",
        { successMessage: "Node updated." },
      );
      setWorkflow(response.data);
    } catch (caught) {
      toast.error(caught instanceof ClientApiError ? caught.message : "Could not update node.");
    } finally {
      setBusy(false);
    }
  }

  async function togglePublish() {
    if (!workflow) return;
    setBusy(true);
    const path = published ? "unpublish" : "publish";
    try {
      const response = await clientApi.post<WorkflowResponse>(
        `/api/v1/marketing/workflows/${workflow.id}/${path}`,
        {},
        `workflow-${path}`,
        { successMessage: published ? "Workflow unpublished." : "Workflow published." },
      );
      setWorkflow(response.data);
    } catch (caught) {
      toast.error(caught instanceof ClientApiError ? caught.message : "Publish action failed.");
    } finally {
      setBusy(false);
    }
  }

  async function testFire() {
    if (!workflow) return;
    setBusy(true);
    try {
      const response = await clientApi.post<TestFireResponse>(
        `/api/v1/marketing/workflows/${workflow.id}/test-fire`,
        {},
        "workflow-test-fire",
        { successMessage: "Test run started." },
      );
      toast.success(`Started ${String(response.data.started)} run(s).`);
      const runsResponse = await clientApi.get<RunsResponse>(
        `/api/v1/marketing/workflows/${workflow.id}/runs`,
        "workflow-runs-refresh",
      );
      setRuns(runsResponse.data.items);
      setRunsOpen(true);
    } catch (caught) {
      toast.error(caught instanceof ClientApiError ? caught.message : "Test fire failed.");
    } finally {
      setBusy(false);
    }
  }

  async function onDelete() {
    if (!workflow) return;
    if (deleteConfirm.trim() !== workflow.title.trim()) {
      toast.error("Type the workflow title to confirm delete.");
      return;
    }
    setBusy(true);
    try {
      await clientApi.post(
        `/api/v1/marketing/workflows/${workflow.id}/delete`,
        { titleConfirmation: deleteConfirm.trim() },
        "workflow-delete",
        { successMessage: "Workflow deleted." },
      );
      router.push(WORKFLOWS_LIST_HREF);
    } catch (caught) {
      toast.error(caught instanceof ClientApiError ? caught.message : "Could not delete.");
    } finally {
      setBusy(false);
    }
  }

  async function saveAll() {
    if (inspectorTab === "basics") {
      await saveBasics();
      return;
    }
    if (selectedNode) {
      await saveNode();
      return;
    }
    await saveBasics();
  }

  if (loading) {
    return (
      <div className="space-y-4" aria-busy="true">
        <div className="h-10 w-48 animate-pulse rounded-lg bg-[var(--admin-surface-high)]" />
        <div className="h-[28rem] animate-pulse rounded-xl bg-[var(--admin-surface-high)]" />
      </div>
    );
  }

  if (!workflow) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-[var(--admin-on-surface-variant)]">Workflow not found.</p>
        <Link
          href={WORKFLOWS_LIST_HREF}
          prefetch={false}
          className="inline-flex items-center gap-2 rounded-xl border border-[var(--admin-border)] px-4 py-2 text-sm font-semibold text-[var(--admin-on-surface)]"
        >
          Back to list
        </Link>
      </div>
    );
  }

  const inspectorHeading =
    inspectorTab === "basics"
      ? "Workflow settings"
      : selectedNode
        ? `${nodeTypeMetaLabel(selectedNode.type)} node`
        : "Node settings";

  const inspectorSubheading =
    inspectorTab === "basics"
      ? "Title, description, and re-entry"
      : selectedNode
        ? nodeSubtitle(selectedNode)
        : "Select a node on the canvas";

  let nodeFields: ReactNode = null;
  if (selectedNode?.type === "trigger") {
    nodeFields = (
      <>
        <AdminSelectDropdown
          id="wf-trigger-type"
          label="Trigger event"
          ariaLabel="Trigger event"
          value={triggerType}
          disabled={published}
          options={[...WORKFLOW_TRIGGER_OPTIONS]}
          onChange={setTriggerType}
        />
        {triggerType === "form_submitted" ? (
          <div>
            <label htmlFor="wf-form-label" className={LABEL_CLASS}>
              Form label
            </label>
            <input
              id="wf-form-label"
              value={formLabel}
              disabled={published}
              onChange={(event) => {
                setFormLabel(event.target.value);
              }}
              className={FIELD_CLASS}
            />
          </div>
        ) : null}
        {triggerType === "payment_success" || triggerType === "product_expiry_soon" ? (
          <div>
            <label htmlFor="wf-product-label" className={LABEL_CLASS}>
              Product label
            </label>
            <input
              id="wf-product-label"
              value={productLabel}
              disabled={published}
              onChange={(event) => {
                setProductLabel(event.target.value);
              }}
              className={FIELD_CLASS}
            />
          </div>
        ) : null}
        {triggerType === "test_evaluation" ? (
          <div>
            <label htmlFor="wf-test-label" className={LABEL_CLASS}>
              Test label
            </label>
            <input
              id="wf-test-label"
              value={testLabel}
              disabled={published}
              onChange={(event) => {
                setTestLabel(event.target.value);
              }}
              className={FIELD_CLASS}
            />
          </div>
        ) : null}
        {triggerType === "product_expiry_soon" ? (
          <div>
            <label htmlFor="wf-days-before" className={LABEL_CLASS}>
              Days before expiry
            </label>
            <input
              id="wf-days-before"
              type="number"
              min={1}
              max={90}
              value={daysBeforeExpiry}
              disabled={published}
              onChange={(event) => {
                setDaysBeforeExpiry(event.target.value);
              }}
              className={FIELD_CLASS}
            />
          </div>
        ) : null}
      </>
    );
  } else if (selectedNode?.type === "delay") {
    nodeFields = (
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label htmlFor="wf-delay-days" className={LABEL_CLASS}>
            Days
          </label>
          <input
            id="wf-delay-days"
            type="number"
            min={0}
            max={365}
            value={delayDays}
            disabled={published}
            onChange={(event) => {
              setDelayDays(event.target.value);
            }}
            className={FIELD_CLASS}
          />
        </div>
        <div>
          <label htmlFor="wf-delay-hours" className={LABEL_CLASS}>
            Hours
          </label>
          <input
            id="wf-delay-hours"
            type="number"
            min={0}
            max={23}
            value={delayHours}
            disabled={published}
            onChange={(event) => {
              setDelayHours(event.target.value);
            }}
            className={FIELD_CLASS}
          />
        </div>
        <div>
          <label htmlFor="wf-delay-minutes" className={LABEL_CLASS}>
            Minutes
          </label>
          <input
            id="wf-delay-minutes"
            type="number"
            min={0}
            max={59}
            value={delayMinutes}
            disabled={published}
            onChange={(event) => {
              setDelayMinutes(event.target.value);
            }}
            className={FIELD_CLASS}
          />
        </div>
      </div>
    );
  } else if (selectedNode?.type === "condition") {
    nodeFields = (
      <>
        <div>
          <p className={LABEL_CLASS}>Property to check</p>
          <div className="rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-4 py-2.5 text-sm text-[var(--admin-on-surface)]">
            test_percentage
          </div>
          <p className="mt-2 text-[11px] italic text-[var(--admin-on-surface-variant)]">
            Quiz / test score as a percentage (0-100).
          </p>
        </div>
        <AdminSelectDropdown
          id="wf-condition-operator"
          label="Comparison"
          ariaLabel="Comparison operator"
          value={conditionOperator}
          disabled={published}
          options={[...WORKFLOW_CONDITION_OPERATOR_OPTIONS]}
          onChange={setConditionOperator}
        />
        <div>
          <label htmlFor="wf-condition-value" className={LABEL_CLASS}>
            Value threshold
          </label>
          <input
            id="wf-condition-value"
            type="number"
            min={0}
            max={100}
            value={conditionValue}
            disabled={published}
            onChange={(event) => {
              setConditionValue(event.target.value);
            }}
            className={FIELD_CLASS}
          />
          <p className="mt-2 text-[11px] italic text-[var(--admin-on-surface-variant)]">
            Enter a value between 0 and 100.
          </p>
        </div>
      </>
    );
  } else if (selectedNode?.type === "action") {
    nodeFields = (
      <>
        <AdminSelectDropdown
          id="wf-action-type"
          label="Action type"
          ariaLabel="Action type"
          value={actionType}
          disabled={published}
          options={[...WORKFLOW_ACTION_OPTIONS]}
          onChange={setActionType}
        />
        {actionType === "send_coupon" || actionType === "send_paid_enrollment_invite" ? (
          <div>
            <label htmlFor="wf-coupon" className={LABEL_CLASS}>
              Coupon code
            </label>
            <input
              id="wf-coupon"
              value={couponCode}
              disabled={published}
              onChange={(event) => {
                setCouponCode(event.target.value);
              }}
              className={FIELD_CLASS}
            />
          </div>
        ) : null}
        {actionType === "send_free_resource" ? (
          <div>
            <label htmlFor="wf-resource" className={LABEL_CLASS}>
              Resource label
            </label>
            <input
              id="wf-resource"
              value={resourceLabel}
              disabled={published}
              onChange={(event) => {
                setResourceLabel(event.target.value);
              }}
              className={FIELD_CLASS}
            />
          </div>
        ) : null}
        {actionType === "send_paid_enrollment_invite" ? (
          <div>
            <label htmlFor="wf-action-product" className={LABEL_CLASS}>
              Product label
            </label>
            <input
              id="wf-action-product"
              value={actionProductLabel}
              disabled={published}
              onChange={(event) => {
                setActionProductLabel(event.target.value);
              }}
              className={FIELD_CLASS}
            />
          </div>
        ) : null}
        {actionType === "register_marketing_event" ? (
          <div>
            <label htmlFor="wf-event-label" className={LABEL_CLASS}>
              Event label
            </label>
            <input
              id="wf-event-label"
              value={eventLabel}
              disabled={published}
              onChange={(event) => {
                setEventLabel(event.target.value);
              }}
              className={FIELD_CLASS}
            />
          </div>
        ) : null}
        {actionType === "send_webinar_invite" ? (
          <div>
            <label htmlFor="wf-webinar-label" className={LABEL_CLASS}>
              Webinar label
            </label>
            <input
              id="wf-webinar-label"
              value={webinarLabel}
              disabled={published}
              onChange={(event) => {
                setWebinarLabel(event.target.value);
              }}
              className={FIELD_CLASS}
            />
          </div>
        ) : null}
        <div>
          <label htmlFor="wf-email-subject" className={LABEL_CLASS}>
            Email subject
          </label>
          <input
            id="wf-email-subject"
            value={subject}
            disabled={published}
            onChange={(event) => {
              setSubject(event.target.value);
            }}
            className={FIELD_CLASS}
          />
        </div>
        <div>
          <label htmlFor="wf-email-body" className={LABEL_CLASS}>
            Email body (HTML)
          </label>
          <textarea
            id="wf-email-body"
            value={bodyHtml}
            disabled={published}
            onChange={(event) => {
              setBodyHtml(event.target.value);
            }}
            className={`${FIELD_CLASS} min-h-32 font-mono text-xs`}
          />
        </div>
      </>
    );
  }

  return (
    <div className="-mx-1 flex min-h-[calc(100vh-8rem)] flex-col overflow-hidden rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] lg:-mx-0">
      <header className="flex shrink-0 flex-col gap-4 border-b border-[var(--admin-border)] bg-[var(--admin-surface)] px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 flex-wrap items-center gap-3">
          <Link
            href={WORKFLOWS_LIST_HREF}
            prefetch={false}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--admin-primary-container)] text-[var(--admin-on-primary-container)] transition-colors hover:bg-[color-mix(in_srgb,var(--admin-primary-container)_85%,var(--admin-primary))]"
            aria-label="Back to workflows"
          >
            <ChevronLeft className="h-5 w-5" aria-hidden="true" />
          </Link>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="truncate text-lg font-semibold tracking-tight text-[var(--admin-on-surface)]">
                Workflow Builder: {workflow.title}
              </h1>
              <StatusPill status={workflow.status} />
            </div>
            <p className="mt-0.5 text-xs text-[var(--admin-on-surface-variant)]">
              Configure trigger, delays, conditions, and actions - then publish.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <LiveToggle published={published} disabled={busy} onToggle={() => void togglePublish()} />
          <button
            type="button"
            disabled={busy || published}
            onClick={() => {
              setShowUseCases(true);
            }}
            className="rounded-lg border border-[color-mix(in_srgb,var(--admin-primary)_20%,transparent)] px-3 py-2 text-sm font-bold text-[var(--admin-primary)] transition-colors hover:bg-[color-mix(in_srgb,var(--admin-primary)_6%,transparent)] disabled:opacity-50"
          >
            Use cases
          </button>
          <button
            type="button"
            disabled={busy || !published}
            onClick={() => void testFire()}
            className="rounded-lg border border-[color-mix(in_srgb,var(--admin-primary)_20%,transparent)] px-3 py-2 text-sm font-bold text-[var(--admin-primary)] transition-colors hover:bg-[color-mix(in_srgb,var(--admin-primary)_6%,transparent)] disabled:opacity-50"
          >
            Test fire
          </button>
          <button
            type="button"
            disabled={busy || (published && inspectorTab === "node")}
            onClick={() => void saveAll()}
            className="rounded-lg bg-[var(--admin-primary)] px-4 py-2 text-sm font-bold text-[var(--admin-on-primary)] transition-colors hover:bg-[var(--admin-primary-strong)] disabled:opacity-50"
          >
            Save
          </button>
          <div
            className="mx-1 hidden h-8 w-px bg-[var(--admin-border)] sm:block"
            aria-hidden="true"
          />
          <button
            type="button"
            onClick={() => {
              setInspectorTab("basics");
            }}
            className="rounded-lg p-2 text-[var(--admin-on-surface-variant)] transition-colors hover:text-[var(--admin-primary)]"
            aria-label="Workflow settings"
          >
            <Settings2 className="h-5 w-5" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => {
              setDeleteOpen(true);
              setDeleteConfirm("");
            }}
            className="rounded-lg p-2 text-[var(--admin-on-surface-variant)] transition-colors hover:text-[var(--admin-danger)]"
            aria-label="Delete workflow"
          >
            <Trash2 className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
      </header>

      <div className="relative flex min-h-0 flex-1 flex-col xl:flex-row">
        <main className="workflow-builder-grid relative min-h-[22rem] flex-1 overflow-auto pb-16">
          <div className="relative flex min-h-full w-full flex-col items-center px-4 pb-24 pt-10">
            {Object.keys(workflow.graph.nodes).length === 0 ? (
              <div className="mt-16 max-w-sm rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-6 text-center shadow-sm">
                <Library
                  className="mx-auto h-8 w-8 text-[var(--admin-primary)]"
                  aria-hidden="true"
                />
                <p className="mt-3 font-semibold text-[var(--admin-on-surface)]">No flow yet</p>
                <p className="mt-1 text-sm text-[var(--admin-on-surface-variant)]">
                  Apply a use case to seed a starter graph you can edit.
                </p>
                <button
                  type="button"
                  disabled={busy || published}
                  onClick={() => {
                    setShowUseCases(true);
                  }}
                  className="mt-4 rounded-lg bg-[var(--admin-primary)] px-4 py-2 text-sm font-bold text-[var(--admin-on-primary)] disabled:opacity-50"
                >
                  Choose use case
                </button>
              </div>
            ) : (
              <FlowBranch
                nodeId={workflow.graph.entryNodeId}
                graph={workflow.graph}
                selectedNodeId={selectedNodeId}
                onSelect={setSelectedNodeId}
                visited={new Set()}
              />
            )}
          </div>
        </main>

        <aside className="flex w-full shrink-0 flex-col border-t border-[var(--admin-border)] bg-[var(--admin-surface)] xl:w-[320px] xl:border-l xl:border-t-0">
          <div className="border-b border-[var(--admin-border)] p-5">
            <div className="mb-4 flex items-center justify-between gap-2">
              <h2 className="text-lg font-semibold text-[var(--admin-on-surface)]">
                {inspectorTab === "basics" ? "Workflow settings" : "Node settings"}
              </h2>
              {inspectorTab === "basics" ? (
                <button
                  type="button"
                  className="text-[var(--admin-on-surface-variant)] hover:text-[var(--admin-on-surface)]"
                  onClick={() => {
                    setInspectorTab("node");
                  }}
                  aria-label="Close workflow settings"
                >
                  <X className="h-5 w-5" aria-hidden="true" />
                </button>
              ) : null}
            </div>
            <div className="flex items-center gap-3 rounded-lg bg-[var(--admin-surface-low)] p-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[color-mix(in_srgb,var(--admin-primary)_12%,var(--admin-surface))] text-[var(--admin-primary)]">
                <InspectorIcon
                  type={inspectorTab === "basics" ? "basics" : (selectedNode?.type ?? "basics")}
                />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-[var(--admin-on-surface)]">
                  {inspectorHeading}
                </p>
                <p className="truncate text-[11px] text-[var(--admin-on-surface-variant)]">
                  {inspectorSubheading}
                </p>
              </div>
            </div>
          </div>

          <div className="flex-1 space-y-5 overflow-y-auto p-5">
            {inspectorTab === "basics" ? (
              <>
                <div>
                  <label htmlFor="wf-edit-title" className={LABEL_CLASS}>
                    Title
                  </label>
                  <input
                    id="wf-edit-title"
                    value={title}
                    disabled={published}
                    onChange={(event) => {
                      setTitle(event.target.value);
                    }}
                    className={FIELD_CLASS}
                  />
                </div>
                <div>
                  <label htmlFor="wf-edit-description" className={LABEL_CLASS}>
                    Description
                  </label>
                  <textarea
                    id="wf-edit-description"
                    value={description}
                    disabled={published}
                    onChange={(event) => {
                      setDescription(event.target.value);
                    }}
                    className={`${FIELD_CLASS} min-h-20`}
                  />
                </div>
                <label className="flex items-start gap-3 text-sm text-[var(--admin-on-surface)]">
                  <input
                    type="checkbox"
                    checked={allowResubscribe}
                    disabled={published}
                    onChange={(event) => {
                      setAllowResubscribe(event.target.checked);
                    }}
                    className="mt-1"
                  />
                  Allow re-entry for learners who already completed this journey
                </label>
                {published ? (
                  <p className="text-xs text-[var(--admin-on-surface-variant)]">
                    Unpublish to edit workflow basics.
                  </p>
                ) : null}
              </>
            ) : selectedNode ? (
              <>
                <div>
                  <label htmlFor="wf-node-title" className={LABEL_CLASS}>
                    Node title
                  </label>
                  <input
                    id="wf-node-title"
                    value={nodeTitle}
                    disabled={published}
                    onChange={(event) => {
                      setNodeTitle(event.target.value);
                    }}
                    className={FIELD_CLASS}
                  />
                </div>
                {nodeFields}
                {published ? (
                  <p className="text-xs text-[var(--admin-on-surface-variant)]">
                    Unpublish to edit this node.
                  </p>
                ) : null}
              </>
            ) : (
              <p className="text-sm text-[var(--admin-on-surface-variant)]">
                Select a node on the canvas to inspect and edit its settings.
              </p>
            )}
          </div>

          <div className="border-t border-[var(--admin-border)] p-5">
            <button
              type="button"
              disabled={busy || published || (inspectorTab === "node" && !selectedNode)}
              onClick={() => void saveAll()}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--admin-primary)] py-3 text-sm font-bold text-[var(--admin-on-primary)] transition-colors hover:bg-[var(--admin-primary-strong)] disabled:opacity-50"
            >
              {inspectorTab === "basics" ? "Update workflow" : "Update node"}
            </button>
          </div>
        </aside>

        <div
          className={[
            "absolute inset-x-0 bottom-0 z-20 border-t border-[var(--admin-border)] bg-[var(--admin-surface)] transition-transform duration-300 xl:right-[320px]",
            runsOpen ? "translate-y-0" : "translate-y-[calc(100%-3rem)]",
          ].join(" ")}
        >
          <button
            type="button"
            className="flex h-12 w-full items-center justify-between px-4 transition-colors hover:bg-[var(--admin-surface-low)] sm:px-6"
            onClick={() => {
              setRunsOpen((open) => !open);
            }}
            aria-expanded={runsOpen}
          >
            <div className="flex items-center gap-3">
              <BarChart3 className="h-5 w-5 text-[var(--admin-primary)]" aria-hidden="true" />
              <span className="text-sm font-bold text-[var(--admin-on-surface)]">
                Recent journey runs
              </span>
              <span className="rounded bg-[var(--admin-surface-high)] px-2 py-0.5 text-[11px] font-bold text-[var(--admin-on-surface-variant)]">
                {formatWorkflowCount(activeRunCount)} active
              </span>
            </div>
            {runsOpen ? (
              <ChevronDown
                className="h-5 w-5 text-[var(--admin-on-surface-variant)]"
                aria-hidden="true"
              />
            ) : (
              <ChevronUp
                className="h-5 w-5 text-[var(--admin-on-surface-variant)]"
                aria-hidden="true"
              />
            )}
          </button>
          <div className="h-64 overflow-y-auto px-4 pb-5 sm:px-6">
            {runs.length === 0 ? (
              <p className="py-8 text-sm text-[var(--admin-on-surface-variant)]">
                No runs yet. Publish and use Test fire to see activity.
              </p>
            ) : (
              <table className="w-full text-left text-sm">
                <thead className="border-b border-[var(--admin-border)] text-[var(--admin-on-surface-variant)]">
                  <tr>
                    <th className="pb-3 font-semibold">Learner</th>
                    <th className="pb-3 font-semibold">Status</th>
                    <th className="hidden pb-3 font-semibold sm:table-cell">Current node</th>
                    <th className="pb-3 text-right font-semibold">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--admin-border)]">
                  {runs.map((run) => {
                    const label = workflowRunLearnerLabel(run);
                    return (
                      <tr
                        key={run.id}
                        className="transition-colors hover:bg-[var(--admin-surface-low)]"
                      >
                        <td className="py-3">
                          <div className="flex items-center gap-2">
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--admin-primary)_12%,var(--admin-surface))] text-xs font-bold text-[var(--admin-primary)]">
                              {memberInitials(run.learnerName, run.learnerEmail)}
                            </div>
                            <span className="font-bold text-[var(--admin-on-surface)]">
                              {label}
                            </span>
                          </div>
                        </td>
                        <td className="py-3">
                          <RunStatusChip status={run.status} />
                        </td>
                        <td className="hidden py-3 text-[var(--admin-on-surface-variant)] sm:table-cell">
                          {workflowRunCurrentStepLabel(run)}
                        </td>
                        <td className="py-3 text-right text-[var(--admin-on-surface-variant)]">
                          {formatWorkflowDateTime(run.createdAt)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {showUseCases ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-[var(--admin-scrim)] p-4">
          <div
            className={`admin-theme w-full max-w-3xl space-y-4 bg-[var(--admin-surface)] p-5 shadow-xl ${dropdownPanelSurfaceClassName}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="wf-use-cases-title"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2
                  id="wf-use-cases-title"
                  className="text-lg font-semibold text-[var(--admin-on-surface)]"
                >
                  Choose a use case
                </h2>
                <p className="mt-1 text-sm text-[var(--admin-on-surface-variant)]">
                  Applies a starter graph you can edit before publishing.
                </p>
              </div>
              <button
                type="button"
                className="rounded-lg p-2 text-[var(--admin-on-surface-variant)] hover:bg-[var(--admin-surface-high)]"
                onClick={() => {
                  setShowUseCases(false);
                }}
                aria-label="Close use cases"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
            <div className="grid max-h-[60vh] gap-3 overflow-y-auto md:grid-cols-2">
              {useCases.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  disabled={busy || published}
                  onClick={() => void applyUseCase(item.key)}
                  className="rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-4 text-left transition-colors hover:border-[var(--admin-primary)] hover:bg-[var(--admin-surface)] disabled:opacity-50"
                >
                  <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-lg bg-[color-mix(in_srgb,var(--admin-primary)_12%,var(--admin-surface))] text-[var(--admin-primary)]">
                    <BookOpen className="h-4 w-4" aria-hidden="true" />
                  </div>
                  <p className="font-medium text-[var(--admin-on-surface)]">{item.title}</p>
                  <p className="mt-1 text-sm text-[var(--admin-on-surface-variant)]">
                    {item.description}
                  </p>
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {deleteOpen ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-[var(--admin-scrim)] p-4">
          <div
            className={`admin-theme w-full max-w-md space-y-4 bg-[var(--admin-surface)] p-5 shadow-xl ${dropdownPanelSurfaceClassName}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="wf-delete-title"
          >
            <h2
              id="wf-delete-title"
              className="text-lg font-semibold text-[var(--admin-on-surface)]"
            >
              Delete workflow
            </h2>
            <p className="text-sm text-[var(--admin-on-surface-variant)]">
              Type{" "}
              <span className="font-semibold text-[var(--admin-on-surface)]">{workflow.title}</span>{" "}
              to confirm.
            </p>
            <input
              value={deleteConfirm}
              onChange={(event) => {
                setDeleteConfirm(event.target.value);
              }}
              className={FIELD_CLASS}
              aria-label="Confirm workflow title"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="rounded-xl border border-[var(--admin-border)] px-4 py-2 text-sm font-semibold text-[var(--admin-on-surface)]"
                onClick={() => {
                  setDeleteOpen(false);
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded-xl bg-[var(--admin-danger)] px-4 py-2 text-sm font-semibold text-[var(--admin-on-primary)] disabled:opacity-50"
                disabled={busy}
                onClick={() => void onDelete()}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
