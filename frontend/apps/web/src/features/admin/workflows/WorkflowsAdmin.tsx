"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Braces,
  CheckCircle2,
  ChevronDown,
  FileEdit,
  Filter,
  Info,
  PlusCircle,
  Save,
  Search,
  Trash2,
  XCircle,
  ClipboardCheck,
} from "lucide-react";
import { AdminConfirmDialog } from "../../../components/shells/admin/AdminConfirmDialog";
import { ClientApiError, clientApi } from "../../../lib/client-api";
import { GamificationSelectField } from "../../gamification/components/GamificationSelectField";
import {
  fieldClassName,
  ghostButtonClassName,
  labelClassName,
  outlineButtonClassName,
  primaryButtonClassName,
  workflowCanvasClassName,
  workflowCanvasHeaderClassName,
  workflowCanvasWrapperClassName,
  workflowEditorHeaderClassName,
  workflowEditorPanelClassName,
  workflowFooterClassName,
  workflowJsonPanelClassName,
  workflowJsonTextareaClassName,
  workflowKeyInputClassName,
  workflowListFooterClassName,
  workflowListHeaderClassName,
  workflowListItemClassName,
  workflowListItemSelectedClassName,
  workflowListPanelClassName,
  workflowListScrollClassName,
  workflowLogicPanelClassName,
  workflowNewDefinitionButtonClassName,
  workflowSearchFieldClassName,
  workflowSectionHeadingClassName,
  workflowStatusBadgeClassName,
  workflowTargetChipClassName,
  workflowWorkspaceClassName,
} from "./workflows-admin-shared";
import {
  WORKFLOW_ACTIONS,
  defaultStageForm,
  formatActionLabel,
  formatRelativeTime,
  formatTargetTypeLabel,
  formatWorkflowStatusLabel,
  parseDefinition,
  stateOptionsForValue,
  targetTypeOptions,
  toDefinitionJson,
  validateWorkflowDraft,
  type WorkflowDefinitionItem,
  type WorkflowStageForm,
} from "./workflows-admin-utils";

type WorkflowsAdminProps = {
  initialDefinitions?: WorkflowDefinitionItem[];
  organizationLabel?: string;
};

type RoleOption = { value: string; label: string };

type EditorSnapshot = {
  key: string;
  name: string;
  stageForm: WorkflowStageForm;
  definitionJson: string;
  showAdvancedJson: boolean;
};

function formatError(error: unknown): string {
  if (error instanceof ClientApiError) return error.message;
  return "Request failed.";
}

function snapshotFromDefinition(item: WorkflowDefinitionItem): EditorSnapshot {
  const stageForm = parseDefinition(item.definitionJson);
  return {
    key: item.key,
    name: item.name,
    stageForm,
    definitionJson: JSON.stringify(item.definitionJson, null, 2),
    showAdvancedJson: false,
  };
}

function defaultCreateSnapshot(): EditorSnapshot {
  const stageForm = defaultStageForm();
  return {
    key: "course.approval",
    name: "New workflow",
    stageForm,
    definitionJson: JSON.stringify(toDefinitionJson(stageForm), null, 2),
    showAdvancedJson: false,
  };
}

function snapshotsEqual(a: EditorSnapshot, b: EditorSnapshot): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p className="text-xs text-[var(--admin-danger)]" role="alert">
      {message}
    </p>
  );
}

function FlowNode({
  icon: Icon,
  label,
  sublabel,
  tone,
  badge,
  dimmed = false,
}: {
  icon: typeof FileEdit;
  label: string;
  sublabel: string;
  tone: "neutral" | "warning" | "success" | "danger";
  badge?: string;
  dimmed?: boolean;
}) {
  const toneClasses = {
    neutral: "border-[var(--admin-outline)] text-[var(--admin-outline)]",
    warning: "border-[var(--admin-warning)] text-[var(--admin-warning)] shadow-[var(--admin-warning)]/10",
    success: "border-[var(--admin-success)] text-[var(--admin-success)] shadow-[var(--admin-success)]/10",
    danger: "border-[var(--admin-danger)] text-[var(--admin-danger)] shadow-[var(--admin-danger)]/10",
  } as const;

  return (
    <div
      className={`relative flex flex-col items-center gap-3 motion-safe:transition-opacity ${dimmed ? "opacity-35" : "opacity-100"}`}
    >
      {badge ? (
        <span className="absolute -top-8 rounded bg-[color-mix(in_srgb,var(--admin-warning)_18%,var(--admin-surface))] px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-[var(--admin-warning)]">
          {badge}
        </span>
      ) : null}
      <div
        className={`flex h-16 w-16 items-center justify-center rounded-2xl border-4 bg-[var(--admin-surface)] shadow-xl ${toneClasses[tone]}`}
      >
        <Icon className="h-8 w-8" aria-hidden="true" />
      </div>
      <div className="text-center">
        <p className="text-sm font-semibold text-[var(--admin-on-surface)]">{label}</p>
        <p className="text-[10px] text-[var(--admin-on-surface-variant)]">{sublabel}</p>
      </div>
    </div>
  );
}

function WorkflowStateFlowDiagram({ form }: { form: WorkflowStageForm }) {
  return (
    <div className={workflowCanvasWrapperClassName}>
      <div className={workflowCanvasHeaderClassName}>
        <span className="text-sm font-semibold text-[var(--admin-on-surface)]">Visual state flow</span>
        <span className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-[var(--admin-on-surface-variant)]">
          <Info className="h-3.5 w-3.5" aria-hidden="true" />
          Read-only visualization
        </span>
      </div>
      <div className={workflowCanvasClassName}>
        <div
          className="pointer-events-none absolute left-[10%] right-[10%] top-1/2 hidden h-0.5 -translate-y-1/2 bg-[var(--admin-border)] lg:block"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute right-[14%] hidden h-[88px] w-[160px] rounded-tr-3xl border-r-2 border-t-2 border-dashed border-[var(--admin-primary)] lg:block"
          style={{ bottom: "calc(50% - 12px)" }}
          aria-hidden="true"
        />

        <div className="relative z-10 flex w-full min-w-[720px] items-center justify-between gap-8 px-2">
          <FlowNode icon={FileEdit} label={form.fromState} sublabel="Entry state" tone="neutral" />
          <FlowNode
            icon={ClipboardCheck}
            label={form.reviewState}
            sublabel="Manual task"
            tone="warning"
            badge={form.requiresReview ? "Conditional" : undefined}
            dimmed={!form.requiresReview}
          />
          <div className="flex flex-col gap-10">
            <FlowNode
              icon={CheckCircle2}
              label={form.approvedState}
              sublabel="Final success"
              tone="success"
            />
            <FlowNode
              icon={XCircle}
              label={form.rejectedState}
              sublabel="Final fail"
              tone="danger"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export function WorkflowsAdmin({
  initialDefinitions,
  organizationLabel = "Your organization",
}: WorkflowsAdminProps) {
  const [definitionList, setDefinitionList] = useState<WorkflowDefinitionItem[]>(
    initialDefinitions ?? [],
  );
  const [loadingInitial, setLoadingInitial] = useState(initialDefinitions === undefined);
  const [authDenied, setAuthDenied] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadRequestId, setLoadRequestId] = useState<string | null>(null);

  const [selectedId, setSelectedId] = useState<string | null>(initialDefinitions?.[0]?.id ?? null);
  const [creatingNew, setCreatingNew] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | WorkflowDefinitionItem["status"]>("all");

  const [draftKey, setDraftKey] = useState("");
  const [draftName, setDraftName] = useState("");
  const [stageForm, setStageForm] = useState<WorkflowStageForm>(defaultStageForm());
  const [showAdvancedJson, setShowAdvancedJson] = useState(false);
  const [definitionJson, setDefinitionJson] = useState("{}");
  const [savedSnapshot, setSavedSnapshot] = useState<EditorSnapshot>(defaultCreateSnapshot());

  const [roleOptions, setRoleOptions] = useState<RoleOption[]>([{ value: "admin", label: "admin" }]);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<string, string>>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmArchiveOpen, setConfirmArchiveOpen] = useState(false);

  const selected = useMemo(
    () => definitionList.find((item) => item.id === selectedId) ?? null,
    [definitionList, selectedId],
  );

  const currentSnapshot = useMemo<EditorSnapshot>(
    () => ({
      key: draftKey,
      name: draftName,
      stageForm,
      definitionJson,
      showAdvancedJson,
    }),
    [draftKey, draftName, stageForm, definitionJson, showAdvancedJson],
  );

  const isDirty = useMemo(
    () => !snapshotsEqual(currentSnapshot, savedSnapshot),
    [currentSnapshot, savedSnapshot],
  );

  const filteredDefinitions = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return definitionList.filter((item) => {
      if (statusFilter !== "all" && item.status !== statusFilter) return false;
      if (!query) return true;
      const haystack = [item.key, item.name, formatTargetTypeLabel(parseDefinition(item.definitionJson).targetType)]
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [definitionList, searchQuery, statusFilter]);

  const resolvedDefinitionJson = useMemo(() => {
    if (showAdvancedJson) {
      try {
        return JSON.parse(definitionJson) as Record<string, unknown>;
      } catch {
        return toDefinitionJson(stageForm);
      }
    }
    return toDefinitionJson(stageForm);
  }, [definitionJson, showAdvancedJson, stageForm]);

  const refreshDefinitions = useCallback(async () => {
    const response = await clientApi.get<{ data: WorkflowDefinitionItem[] }>(
      "/api/v1/workflows?view=definitions",
    );
    setDefinitionList(response.data);
    return response.data;
  }, []);

  useEffect(() => {
    if (initialDefinitions !== undefined) return;
    let cancelled = false;
    void (async () => {
      try {
        const data = await refreshDefinitions();
        if (cancelled) return;
        setSelectedId((current) => current ?? data[0]?.id ?? null);
      } catch (error) {
        if (cancelled) return;
        if (error instanceof ClientApiError && (error.status === 401 || error.status === 403)) {
          setAuthDenied(true);
          return;
        }
        if (error instanceof ClientApiError) {
          setLoadError(error.message);
          setLoadRequestId(error.requestId);
          return;
        }
        setLoadError("Failed to load workflow definitions.");
      } finally {
        if (!cancelled) setLoadingInitial(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [initialDefinitions, refreshDefinitions]);

  useEffect(() => {
    void clientApi
      .get<{ data: { items: Array<{ key: string; name: string }> } }>("/api/v1/roles?limit=100")
      .then((response) => {
        const options = response.data.items.map((role) => ({
          value: role.key,
          label: role.name,
        }));
        if (options.length > 0) setRoleOptions(options);
      })
      .catch(() => {
        /* keep default admin option */
      });
  }, []);

  useEffect(() => {
    if (creatingNew) {
      const next = defaultCreateSnapshot();
      setDraftKey(next.key);
      setDraftName(next.name);
      setStageForm(next.stageForm);
      setDefinitionJson(next.definitionJson);
      setShowAdvancedJson(false);
      setSavedSnapshot(next);
      return;
    }
    if (!selected) return;
    const next = snapshotFromDefinition(selected);
    setDraftKey(next.key);
    setDraftName(next.name);
    setStageForm(next.stageForm);
    setDefinitionJson(next.definitionJson);
    setShowAdvancedJson(false);
    setSavedSnapshot(next);
  }, [creatingNew, selected]);

  function selectDefinition(item: WorkflowDefinitionItem) {
    setCreatingNew(false);
    setSelectedId(item.id);
    setFieldErrors({});
    setMessage(null);
    setRequestId(null);
  }

  function startCreateDefinition() {
    setCreatingNew(true);
    setSelectedId(null);
    setFieldErrors({});
    setMessage(null);
    setRequestId(null);
  }

  function discardChanges() {
    setDraftKey(savedSnapshot.key);
    setDraftName(savedSnapshot.name);
    setStageForm(savedSnapshot.stageForm);
    setDefinitionJson(savedSnapshot.definitionJson);
    setShowAdvancedJson(savedSnapshot.showAdvancedJson);
    setFieldErrors({});
    setMessage(null);
    setRequestId(null);
  }

  function updateStageForm(updater: (current: WorkflowStageForm) => WorkflowStageForm) {
    setStageForm((current) => {
      const next = updater(current);
      if (!showAdvancedJson) {
        setDefinitionJson(JSON.stringify(toDefinitionJson(next), null, 2));
      }
      return next;
    });
    setFieldErrors({});
    setMessage(null);
    setRequestId(null);
  }

  function validateBeforeSave() {
    const validation = validateWorkflowDraft({
      key: draftKey,
      name: draftName,
      stageForm,
      definitionJson,
      useAdvancedJson: showAdvancedJson,
    });
    if (!validation.ok) {
      setFieldErrors({ [validation.field]: validation.message });
      setMessage(validation.message);
      return false;
    }
    setFieldErrors({});
    return true;
  }

  async function saveDefinition() {
    if (!selected) return;
    if (!validateBeforeSave()) return;

    setBusy(true);
    setMessage(null);
    setRequestId(null);

    try {
      await clientApi.put(
        `/api/v1/workflows/${selected.id}`,
        {
          name: draftName.trim(),
          definitionJson: resolvedDefinitionJson,
        },
        `workflow-definition-${selected.id}`,
      );
      const data = await refreshDefinitions();
      const updated = data.find((item) => item.id === selected.id);
      if (updated) {
        const next = snapshotFromDefinition(updated);
        setSavedSnapshot(next);
        setDraftKey(next.key);
        setDraftName(next.name);
        setStageForm(next.stageForm);
        setDefinitionJson(next.definitionJson);
      }
    } catch (error) {
      setMessage(formatError(error));
      if (error instanceof ClientApiError) setRequestId(error.requestId);
    } finally {
      setBusy(false);
    }
  }

  async function createDefinition() {
    if (!validateBeforeSave()) return;

    setBusy(true);
    setMessage(null);
    setRequestId(null);

    try {
      const response = await clientApi.post<{ data: WorkflowDefinitionItem }>(
        "/api/v1/workflows",
        {
          key: draftKey.trim(),
          name: draftName.trim(),
          definitionJson: resolvedDefinitionJson,
        },
        "workflow-definition-create",
      );
      const data = await refreshDefinitions();
      setCreatingNew(false);
      setSelectedId(response.data.id ?? data.find((item) => item.key === draftKey.trim())?.id ?? null);
      const created = data.find((item) => item.key === draftKey.trim()) ?? response.data;
      const next = snapshotFromDefinition(created);
      setSavedSnapshot(next);
    } catch (error) {
      setMessage(formatError(error));
      if (error instanceof ClientApiError) setRequestId(error.requestId);
    } finally {
      setBusy(false);
    }
  }

  async function archiveDefinition() {
    if (!selected) return;
    setBusy(true);
    setMessage(null);
    setRequestId(null);
    try {
      await clientApi.put(
        `/api/v1/workflows/${selected.id}`,
        { status: "ARCHIVED" },
        `workflow-definition-archive-${selected.id}`,
      );
      const data = await refreshDefinitions();
      setConfirmArchiveOpen(false);
      setSelectedId(data.find((item) => item.status !== "ARCHIVED")?.id ?? null);
      setCreatingNew(data.filter((item) => item.status !== "ARCHIVED").length === 0);
    } catch (error) {
      setMessage(formatError(error));
      if (error instanceof ClientApiError) setRequestId(error.requestId);
    } finally {
      setBusy(false);
    }
  }

  if (authDenied) {
    return (
      <section className="rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-8 text-center">
        <p className="text-sm text-[var(--admin-on-surface-variant)]">
          You do not have permission to manage workflows for {organizationLabel}.
        </p>
      </section>
    );
  }

  if (loadError) {
    return (
      <section className="rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-8 text-center">
        <p className="text-sm text-[var(--admin-danger)]">{loadError}</p>
        {loadRequestId ? (
          <p className="mt-2 text-xs text-[var(--admin-on-surface-variant)]">
            Request ID: {loadRequestId}
          </p>
        ) : null}
      </section>
    );
  }

  return (
    <>
      <section className={workflowWorkspaceClassName} aria-label="Workflow definitions workspace">
        <aside className={workflowListPanelClassName}>
          <div className={workflowListHeaderClassName}>
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-[var(--admin-on-surface)]">Definitions</h2>
              <GamificationSelectField
                label={<span className="sr-only">Filter definitions by status</span>}
                value={statusFilter}
                options={[
                  { value: "all", label: "All statuses" },
                  { value: "ACTIVE", label: "Active" },
                  { value: "DRAFT", label: "Draft" },
                  { value: "ARCHIVED", label: "Archived" },
                ]}
                onChange={(value) =>
                  setStatusFilter(value as "all" | WorkflowDefinitionItem["status"])
                }
                className="w-[140px]"
              />
            </div>
            <label className="relative block">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--admin-on-surface-variant)]"
                aria-hidden="true"
              />
              <input
                type="search"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search definitions..."
                className={`${workflowSearchFieldClassName} pl-9`}
              />
            </label>
          </div>

          <div className={workflowListScrollClassName}>
            {loadingInitial ? (
              <div className="space-y-2" aria-hidden="true">
                {[0, 1, 2].map((index) => (
                  <div
                    key={index}
                    className={`${workflowListItemClassName} animate-pulse space-y-3 bg-[var(--admin-surface-low)] opacity-60`}
                  >
                    <div className="flex justify-between gap-2">
                      <div className="h-4 w-32 rounded bg-[var(--admin-surface-high)]" />
                      <div className="h-4 w-12 rounded-full bg-[var(--admin-surface-high)]" />
                    </div>
                    <div className="flex justify-between gap-2">
                      <div className="h-6 w-16 rounded bg-[var(--admin-surface-high)]" />
                      <div className="h-3 w-20 rounded bg-[var(--admin-surface-high)]" />
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredDefinitions.length === 0 ? (
              <div className="py-10 text-center">
                <Filter className="mx-auto mb-3 h-10 w-10 text-[var(--admin-outline)]" aria-hidden="true" />
                <p className="text-sm font-semibold text-[var(--admin-on-surface)]">No definitions found</p>
                <p className="mt-1 text-xs text-[var(--admin-on-surface-variant)]">
                  {searchQuery.trim() || statusFilter !== "all"
                    ? "Try adjusting your search or filter."
                    : "Create your first workflow definition."}
                </p>
              </div>
            ) : (
              <ul className="space-y-2" role="listbox" aria-label="Workflow definitions">
                {filteredDefinitions.map((item) => {
                  const parsed = parseDefinition(item.definitionJson);
                  const isSelected = !creatingNew && selectedId === item.id;
                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={isSelected}
                        className={`${workflowListItemClassName} w-full text-left ${
                          isSelected ? workflowListItemSelectedClassName : ""
                        } ${item.status === "ARCHIVED" ? "opacity-70" : ""}`}
                        onClick={() => selectDefinition(item)}
                      >
                        <div className="mb-2 flex items-start justify-between gap-2">
                          <span className="text-sm font-semibold text-[var(--admin-on-surface)]">
                            {item.name}
                          </span>
                          <span className={workflowStatusBadgeClassName(item.status)}>
                            {formatWorkflowStatusLabel(item.status)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <span className={workflowTargetChipClassName}>
                            {formatTargetTypeLabel(parsed.targetType)}
                          </span>
                          <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--admin-on-surface-variant)]">
                            {item.status === "ARCHIVED"
                              ? `Archived ${formatRelativeTime(item.updatedAt)}`
                              : `Modified ${formatRelativeTime(item.updatedAt)}`}
                          </span>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className={workflowListFooterClassName}>
            <button type="button" className={workflowNewDefinitionButtonClassName} onClick={startCreateDefinition}>
              <PlusCircle className="h-4 w-4" aria-hidden="true" />
              New definition
            </button>
          </div>
        </aside>

        <div className={workflowEditorPanelClassName}>
          {!selected && !creatingNew ? (
            <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
              <ClipboardCheck className="mb-3 h-12 w-12 text-[var(--admin-outline)]" aria-hidden="true" />
              <p className="text-base font-semibold text-[var(--admin-on-surface)]">
                Select a workflow to configure
              </p>
              <p className="mt-1 max-w-sm text-sm text-[var(--admin-on-surface-variant)]">
                Human review transitions run on the{" "}
                <Link href="/review" className="font-semibold text-[var(--admin-primary)] hover:underline">
                  Review &amp; Approvals
                </Link>{" "}
                screen.
              </p>
            </div>
          ) : (
            <>
              <div className={workflowEditorHeaderClassName}>
                <div className="space-y-1.5 sm:col-span-3">
                  <span className="text-[11px] font-semibold uppercase tracking-widest text-[var(--admin-on-surface-variant)]">
                    Workflow key
                  </span>
                  <input
                    className={workflowKeyInputClassName}
                    value={draftKey}
                    onChange={(event) => {
                      setDraftKey(event.target.value);
                      setFieldErrors({});
                      setMessage(null);
                    }}
                    disabled={!creatingNew || busy}
                    aria-invalid={Boolean(fieldErrors.key)}
                  />
                  <FieldError message={fieldErrors.key} />
                </div>
                <div className="space-y-1.5 sm:col-span-5">
                  <span className="text-[11px] font-semibold uppercase tracking-widest text-[var(--admin-on-surface-variant)]">
                    Display name
                  </span>
                  <input
                    className={fieldClassName}
                    value={draftName}
                    onChange={(event) => {
                      setDraftName(event.target.value);
                      setFieldErrors({});
                      setMessage(null);
                    }}
                    disabled={busy}
                    aria-invalid={Boolean(fieldErrors.name)}
                  />
                  <FieldError message={fieldErrors.name} />
                </div>
                <div className="space-y-1.5 sm:col-span-4">
                  <GamificationSelectField
                    label={
                      <span className="text-[11px] font-semibold uppercase tracking-widest text-[var(--admin-on-surface-variant)]">
                        Target type
                      </span>
                    }
                    value={stageForm.targetType}
                    options={targetTypeOptions()}
                    onChange={(value) => updateStageForm((current) => ({ ...current, targetType: value }))}
                    disabled={busy || showAdvancedJson}
                  />
                </div>
              </div>

              <div className="space-y-8 px-4 py-6 sm:px-8">
                <WorkflowStateFlowDiagram form={stageForm} />

                <div className="grid gap-8 xl:grid-cols-2">
                  <section className="space-y-4">
                    <h3 className={`${workflowSectionHeadingClassName} border-[var(--admin-primary)]`}>
                      State assignments
                    </h3>
                    <div className="grid gap-4">
                      {(
                        [
                          ["fromState", "From state"],
                          ["reviewState", "Review state"],
                          ["approvedState", "Approved state"],
                          ["rejectedState", "Rejected state"],
                        ] as const
                      ).map(([field, labelText]) => (
                        <GamificationSelectField
                          key={field}
                          label={labelText}
                          value={stageForm[field]}
                          options={stateOptionsForValue(stageForm[field])}
                          onChange={(value) =>
                            updateStageForm((current) => ({ ...current, [field]: value }))
                          }
                          disabled={busy || showAdvancedJson}
                        />
                      ))}
                    </div>
                  </section>

                  <section className="space-y-4">
                    <h3 className={`${workflowSectionHeadingClassName} border-[var(--admin-warning)]`}>
                      Workflow logic
                    </h3>
                    <div className={workflowLogicPanelClassName}>
                      <label className="flex items-center justify-between gap-4">
                        <span>
                          <span className="block text-sm font-semibold text-[var(--admin-on-surface)]">
                            Requires review
                          </span>
                          <span className="text-xs text-[var(--admin-on-surface-variant)]">
                            Adds a manual verification step before publish
                          </span>
                        </span>
                        <input
                          type="checkbox"
                          className="h-5 w-5 accent-[var(--admin-primary)]"
                          checked={stageForm.requiresReview}
                          onChange={(event) =>
                            updateStageForm((current) => ({
                              ...current,
                              requiresReview: event.target.checked,
                            }))
                          }
                          disabled={busy || showAdvancedJson}
                        />
                      </label>

                      <GamificationSelectField
                        label="Assignee role"
                        value={stageForm.assigneeRoleKey}
                        options={roleOptions}
                        onChange={(value) =>
                          updateStageForm((current) => ({ ...current, assigneeRoleKey: value }))
                        }
                        disabled={busy || showAdvancedJson || !stageForm.requiresReview}
                      />
                      <FieldError message={fieldErrors.assigneeRoleKey} />

                      <div className="border-t border-[var(--admin-border)] pt-4">
                        <span className={labelClassName}>Allowed actions</span>
                        <div className="mt-3 grid grid-cols-2 gap-2">
                          {WORKFLOW_ACTIONS.map((action) => (
                            <label
                              key={action}
                              className="flex items-center gap-2 text-sm text-[var(--admin-on-surface)]"
                            >
                              <input
                                type="checkbox"
                                className="rounded border-[var(--admin-border)] accent-[var(--admin-primary)]"
                                checked={stageForm.actions.includes(action)}
                                onChange={(event) =>
                                  updateStageForm((current) => ({
                                    ...current,
                                    actions: event.target.checked
                                      ? [...current.actions, action]
                                      : current.actions.filter((value) => value !== action),
                                  }))
                                }
                                disabled={busy || showAdvancedJson}
                              />
                              {formatActionLabel(action)}
                            </label>
                          ))}
                        </div>
                        <FieldError message={fieldErrors.actions} />
                      </div>
                    </div>
                  </section>
                </div>

                <details className="group overflow-hidden rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)]">
                  <summary className="flex cursor-pointer list-none items-center justify-between px-5 py-4 select-none [&::-webkit-details-marker]:hidden">
                    <span className="flex items-center gap-2 text-sm font-semibold text-[var(--admin-on-surface)]">
                      <Braces className="h-4 w-4 text-[var(--admin-outline)]" aria-hidden="true" />
                      Advanced: definition JSON
                    </span>
                    <ChevronDown
                      className="h-5 w-5 text-[var(--admin-on-surface-variant)] motion-safe:transition-transform group-open:rotate-180"
                      aria-hidden="true"
                    />
                  </summary>
                  <div className={workflowJsonPanelClassName}>
                    <textarea
                      className={workflowJsonTextareaClassName}
                      value={definitionJson}
                      onChange={(event) => {
                        setDefinitionJson(event.target.value);
                        setShowAdvancedJson(true);
                        setFieldErrors({});
                        setMessage(null);
                      }}
                      spellCheck={false}
                      aria-label="Workflow definition JSON"
                    />
                    <FieldError message={fieldErrors.definitionJson} />
                  </div>
                </details>

                {message ? (
                  <p className="text-sm text-[var(--admin-danger)]" role="status" aria-live="polite">
                    {message}
                    {requestId ? ` (Request ID: ${requestId})` : ""}
                  </p>
                ) : null}
              </div>

              <div className={workflowFooterClassName}>
                {selected && !creatingNew && selected.status !== "ARCHIVED" ? (
                  <button
                    type="button"
                    className={`${outlineButtonClassName} inline-flex items-center gap-2 border-[var(--admin-danger)] text-[var(--admin-danger)] hover:bg-[color-mix(in_srgb,var(--admin-danger)_8%,transparent)]`}
                    onClick={() => setConfirmArchiveOpen(true)}
                    disabled={busy}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                    Archive workflow
                  </button>
                ) : (
                  <span />
                )}
                <div className="flex flex-wrap gap-2 sm:justify-end">
                  <button
                    type="button"
                    className={ghostButtonClassName}
                    onClick={discardChanges}
                    disabled={!isDirty || busy}
                  >
                    Discard changes
                  </button>
                  <button
                    type="button"
                    className={`${primaryButtonClassName} inline-flex items-center gap-2`}
                    disabled={(!isDirty && !creatingNew) || busy}
                    onClick={() => {
                      void (creatingNew ? createDefinition() : saveDefinition());
                    }}
                  >
                    <Save className="h-4 w-4" aria-hidden="true" />
                    {busy
                      ? "Saving..."
                      : creatingNew
                        ? "Create definition"
                        : "Save configuration"}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </section>

      <AdminConfirmDialog
        open={confirmArchiveOpen}
        title="Archive this workflow?"
        description="Archived workflows stay in history but no longer drive new review transitions."
        confirmLabel="Archive workflow"
        busyLabel="Archiving..."
        tone="danger"
        icon={Trash2}
        busy={busy}
        onConfirm={() => void archiveDefinition()}
        onCancel={() => setConfirmArchiveOpen(false)}
      />
    </>
  );
}
