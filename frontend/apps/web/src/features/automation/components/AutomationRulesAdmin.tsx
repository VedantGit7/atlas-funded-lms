"use client";

import Link from "next/link";
import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { Bolt, Filter, FolderOpen, Plus, RefreshCw, Search, Trash2, Zap } from "lucide-react";
import type { z } from "zod";
import { AdminConfirmDialog } from "../../../components/shells/admin/AdminConfirmDialog";
import { ClientApiError, clientApi } from "../../../lib/client-api";
import type {
  automationRuleDtoSchema,
  automationRunDtoSchema,
} from "@atlas/contracts/automation/automation.dto";
import type { certificateTemplateDtoSchema } from "@atlas/contracts/certificates/certificate.dto";
import {
  AUTOMATION_TRIGGER_EVENT_TYPES,
  parseAutomationAction,
  parseAutomationCondition,
} from "@atlas/contracts/automation/automation.registry";
import { GamificationSelectField } from "../../gamification/components/GamificationSelectField";
import {
  type AutomationDraft,
  buildAutomationActionJson,
  buildAutomationConditionJson,
  formatRelativeTime,
  formatRuleCode,
  formatRuleTitle,
  formatRunStatus,
  formatTriggerLabel,
  validateAutomationDraft,
} from "../automation-admin-utils";
import {
  automationActionToggleActiveClassName,
  automationActionToggleGroupClassName,
  automationActionToggleInactiveClassName,
  automationEditorInnerClassName,
  automationEditorPanelClassName,
  automationFooterClassName,
  automationHistoryHeadClassName,
  automationHistoryTableClassName,
  automationJsonPreviewClassName,
  automationListHeaderClassName,
  automationListItemClassName,
  automationListItemSelectedClassName,
  automationListPanelClassName,
  automationListScrollClassName,
  automationRuleCodeClassName,
  automationSearchFieldClassName,
  automationStatusBadgeClassName,
  automationStatusLabel,
  automationStepCardClassName,
  automationStepConnectorClassName,
  automationStepIconPrimaryClassName,
  automationStepIconSuccessClassName,
  automationStepIconWarningClassName,
  automationRunStatusBadgeClassName,
  automationWorkspaceClassName,
  fieldClassName,
  ghostButtonClassName,
  labelClassName,
  outlineButtonClassName,
  primaryButtonClassName,
} from "../automation-admin-shared";

type RuleDto = z.infer<typeof automationRuleDtoSchema>;
type RunDto = z.infer<typeof automationRunDtoSchema>;
type CertificateTemplateDto = z.infer<typeof certificateTemplateDtoSchema>;
type EntityStatus = RuleDto["status"];
type TriggerType = (typeof AUTOMATION_TRIGGER_EVENT_TYPES)[number];

type AutomationRulesAdminProps = {
  initialRules?: RuleDto[];
  organizationLabel?: string;
};

const STATUS_OPTIONS = [
  { value: "ACTIVE", label: "Active" },
  { value: "INACTIVE", label: "Inactive" },
  { value: "ARCHIVED", label: "Archived" },
] as const;

const TRIGGER_OPTIONS = AUTOMATION_TRIGGER_EVENT_TYPES.map((trigger) => ({
  value: trigger,
  label: formatTriggerLabel(trigger),
}));

const MEMBERSHIP_FIELD_OPTIONS = [
  { value: "membershipId", label: "membershipId" },
  { value: "learnerMembershipId", label: "learnerMembershipId" },
] as const;

const SOURCE_TYPE_OPTIONS = [
  { value: "course", label: "Course" },
  { value: "learning_path", label: "Learning path" },
  { value: "assessment", label: "Assessment" },
] as const;

const DEFAULT_CREATE_KEY = "completion.notify";

function defaultCreateDraft(): AutomationDraft {
  return {
    key: DEFAULT_CREATE_KEY,
    trigger: "certificate.issued",
    status: "ACTIVE",
    conditionType: "always",
    minScore: 70,
    actionType: "notification.request",
    templateKey: "certificate.issued",
    membershipIdField: "membershipId",
    certificateTemplateId: "",
    recipientMembershipIdField: "learnerMembershipId",
    sourceType: "assessment",
    sourceIdField: "assessmentId",
  };
}

function loadDraftFromRule(rule: RuleDto): AutomationDraft {
  const draft = defaultCreateDraft();
  draft.key = rule.key;
  draft.trigger = rule.triggerEventType;
  draft.status = rule.status;

  try {
    const condition = parseAutomationCondition(rule.conditionJson);
    if (condition.type === "assessmentPassed") {
      draft.conditionType = "assessmentPassed";
      draft.minScore = condition.minScorePercent;
    }
  } catch {
    /* keep defaults */
  }

  try {
    const action = parseAutomationAction(rule.actionJson);
    if (action.type === "certificate.issue") {
      draft.actionType = "certificate.issue";
      draft.certificateTemplateId = action.templateId;
      draft.recipientMembershipIdField = action.recipientMembershipIdField;
      draft.sourceType = action.sourceType;
      draft.sourceIdField = action.sourceIdField;
    } else {
      draft.actionType = "notification.request";
      draft.templateKey = action.templateKey;
      draft.membershipIdField = action.membershipIdField;
    }
  } catch {
    /* keep defaults */
  }

  return draft;
}

function draftsEqual(a: AutomationDraft, b: AutomationDraft): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function FieldError({ message }: { message?: string | undefined }) {
  if (!message) return null;
  return (
    <p className="text-xs text-[var(--admin-danger)]" role="alert">
      {message}
    </p>
  );
}

export function AutomationRulesAdmin({
  initialRules,
  organizationLabel = "Your organization",
}: AutomationRulesAdminProps) {
  const [rules, setRules] = useState<RuleDto[]>(initialRules ?? []);
  const [loadingInitial, setLoadingInitial] = useState(initialRules === undefined);
  const [canManage, setCanManage] = useState(true);
  const [authDenied, setAuthDenied] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadRequestId, setLoadRequestId] = useState<string | null>(null);

  const [selectedId, setSelectedId] = useState<string | null>(initialRules?.[0]?.id ?? null);
  const [creatingNew, setCreatingNew] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [draft, setDraft] = useState(defaultCreateDraft);
  const [savedDraft, setSavedDraft] = useState(defaultCreateDraft);

  const [runs, setRuns] = useState<RunDto[]>([]);
  const [loadingRuns, setLoadingRuns] = useState(false);
  const [expandedRunId, setExpandedRunId] = useState<string | null>(null);

  const [message, setMessage] = useState<string | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<string, string>>>({});
  const [certificateTemplates, setCertificateTemplates] = useState<CertificateTemplateDto[]>([]);

  const certificateTemplateOptions = useMemo(
    () =>
      certificateTemplates.map((template) => ({
        value: template.id,
        label: `${template.name} (${template.key})`,
      })),
    [certificateTemplates],
  );

  const selected = useMemo(
    () => rules.find((rule) => rule.id === selectedId) ?? null,
    [rules, selectedId],
  );

  const filteredRules = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return rules;
    return rules.filter((rule) => {
      const haystack = [
        rule.key,
        rule.triggerEventType,
        formatRuleTitle(rule.key),
        formatRuleCode(rule),
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [rules, searchQuery]);

  const isDirty = useMemo(() => !draftsEqual(draft, savedDraft), [draft, savedDraft]);

  const setError = useCallback((caught: unknown) => {
    if (caught instanceof ClientApiError) {
      setMessage(caught.message);
      setRequestId(caught.requestId);
      return;
    }
    setMessage("Unexpected error.");
    setRequestId(null);
  }, []);

  const refreshRules = useCallback(async () => {
    const response = await clientApi.get<{ data: RuleDto[] }>("/api/v1/automation-rules");
    setRules(response.data);
    return response.data;
  }, []);

  const refreshRuns = useCallback(async (ruleId?: string | null) => {
    setLoadingRuns(true);
    try {
      const params = new URLSearchParams({ limit: "25" });
      if (ruleId) params.set("automationRuleId", ruleId);
      const response = await clientApi.get<{ data: RunDto[] }>(
        `/api/v1/automation-runs?${params.toString()}`,
      );
      setRuns(response.data);
    } finally {
      setLoadingRuns(false);
    }
  }, []);

  useEffect(() => {
    if (initialRules !== undefined) return;
    const cancelled = { current: false };

    void (async () => {
      try {
        const data = await refreshRules();
        if (cancelled.current) return;
        setSelectedId((current) => current ?? data[0]?.id ?? null);
      } catch (caught) {
        if (cancelled.current) return;
        if (caught instanceof ClientApiError && caught.status === 403) {
          setAuthDenied(true);
          setCanManage(false);
          return;
        }
        if (caught instanceof ClientApiError && caught.status === 401) {
          setAuthDenied(true);
          return;
        }
        if (caught instanceof ClientApiError) {
          setLoadError(caught.message);
          setLoadRequestId(caught.requestId);
          return;
        }
        setLoadError("Failed to load automation rules.");
      } finally {
        if (!cancelled.current) setLoadingInitial(false);
      }
    })();

    return () => {
      cancelled.current = true;
    };
  }, [initialRules, refreshRules]);

  useEffect(() => {
    let cancelled = false;
    void clientApi
      .get<{ data: CertificateTemplateDto[] }>("/api/v1/certificate-templates")
      .then((response) => {
        if (cancelled) return;
        setCertificateTemplates(
          response.data.filter((template) => template.status === "PUBLISHED"),
        );
      })
      .catch(() => {
        if (!cancelled) setCertificateTemplates([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (creatingNew) {
      const next = defaultCreateDraft();
      setDraft(next);
      setSavedDraft(next);
      setRuns([]);
      return;
    }
    if (!selected) return;
    const next = loadDraftFromRule(selected);
    setDraft(next);
    setSavedDraft(next);
    void refreshRuns(selected.id).catch(() => {
      setRuns([]);
    });
  }, [creatingNew, selected, refreshRuns]);

  function selectRule(rule: RuleDto) {
    setCreatingNew(false);
    setSelectedId(rule.id);
    setConfirmDeleteOpen(false);
    setMessage(null);
    setRequestId(null);
    setExpandedRunId(null);
  }

  function startCreateRule() {
    setCreatingNew(true);
    setSelectedId(null);
    setConfirmDeleteOpen(false);
    setMessage(null);
    setRequestId(null);
    setExpandedRunId(null);
  }

  function discardChanges() {
    setDraft(savedDraft);
    setMessage(null);
    setRequestId(null);
  }

  async function saveRule() {
    if (!canManage) return;
    setMessage(null);
    setRequestId(null);

    const validation = validateAutomationDraft(draft);
    if (!validation.ok) {
      setFieldErrors({ [validation.field]: validation.message });
      setMessage(validation.message);
      return;
    }
    setFieldErrors({});

    setSaving(true);
    try {
      const payload = {
        key: draft.key.trim(),
        triggerEventType: draft.trigger as TriggerType,
        conditionJson: buildAutomationConditionJson(draft),
        actionJson: buildAutomationActionJson(draft),
        status: draft.status,
      };

      if (creatingNew || !selected) {
        const response = await clientApi.post<{ data: RuleDto }>(
          "/api/v1/automation-rules",
          payload,
          "automation-rule-create",
        );
        await refreshRules();
        setCreatingNew(false);
        setSelectedId(response.data.id);
      } else {
        await clientApi.put(
          "/api/v1/automation-rules",
          { id: selected.id, ...payload },
          "automation-rule-update",
        );
        const data = await refreshRules();
        const updated = data.find((rule) => rule.id === selected.id);
        if (updated) {
          const next = loadDraftFromRule(updated);
          setDraft(next);
          setSavedDraft(next);
        }
      }
    } catch (caught) {
      setError(caught);
    } finally {
      setSaving(false);
    }
  }

  async function deleteRule() {
    if (!canManage || !selected) return;
    setSaving(true);
    setMessage(null);
    setRequestId(null);
    try {
      await clientApi.delete("/api/v1/automation-rules", "automation-rule-delete", {
        id: selected.id,
      });
      const data = await refreshRules();
      setConfirmDeleteOpen(false);
      setSelectedId(data[0]?.id ?? null);
      setCreatingNew(data.length === 0);
    } catch (caught) {
      setError(caught);
    } finally {
      setSaving(false);
    }
  }

  function updateDraft<K extends keyof AutomationDraft>(key: K, value: AutomationDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
    setFieldErrors((current) => {
      if (!current[key]) return current;
      const { [key]: _removed, ...next } = current;
      void _removed;
      return next;
    });
    setMessage(null);
    setRequestId(null);
  }

  if (authDenied) {
    return (
      <section className="rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-8 text-center">
        <p className="text-sm text-[var(--admin-on-surface-variant)]">
          You do not have permission to manage automation rules for {organizationLabel}.
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

  const editorTitle = creatingNew
    ? "Create rule"
    : selected
      ? formatRuleTitle(selected.key)
      : "Select a rule";

  return (
    <>
      <section className={automationWorkspaceClassName} aria-label="Automation rules workspace">
        <aside className={automationListPanelClassName}>
          <div className={automationListHeaderClassName}>
            <h2 className="text-lg font-semibold text-[var(--admin-on-surface)]">Rules</h2>
            {canManage ? (
              <button
                type="button"
                className={`${primaryButtonClassName} inline-flex items-center gap-1.5 px-3 py-2 text-sm`}
                onClick={startCreateRule}
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                New Rule
              </button>
            ) : null}
          </div>

          <div className="px-4 pb-3 sm:px-5">
            <label className="relative block">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--admin-on-surface-variant)]"
                aria-hidden="true"
              />
              <input
                type="search"
                value={searchQuery}
                onChange={(event) => {
                  setSearchQuery(event.target.value);
                }}
                placeholder="Search rules..."
                className={`${automationSearchFieldClassName} pl-9`}
              />
            </label>
          </div>

          <div className={automationListScrollClassName}>
            {loadingInitial ? (
              <div className="space-y-3" aria-hidden="true">
                {[0, 1, 2].map((index) => (
                  <div
                    key={index}
                    className={`${automationListItemClassName} animate-pulse space-y-2 opacity-60`}
                  >
                    <div className="flex justify-between gap-2">
                      <div className="h-4 w-20 rounded bg-[var(--admin-surface-high)]" />
                      <div className="h-4 w-12 rounded bg-[var(--admin-surface-high)]" />
                    </div>
                    <div className="h-5 w-3/4 rounded bg-[var(--admin-surface-high)]" />
                    <div className="h-4 w-1/2 rounded bg-[var(--admin-surface-high)]" />
                  </div>
                ))}
              </div>
            ) : filteredRules.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <FolderOpen
                  className="mb-3 h-12 w-12 text-[var(--admin-outline)]"
                  aria-hidden="true"
                />
                <p className="text-base font-semibold text-[var(--admin-on-surface)]">
                  {searchQuery.trim() ? "No matching rules" : "No rules found"}
                </p>
                <p className="mt-1 max-w-xs text-sm text-[var(--admin-on-surface-variant)]">
                  {searchQuery.trim()
                    ? "Try a different search term."
                    : "Create your first automation to get started."}
                </p>
                {canManage && !searchQuery.trim() ? (
                  <button
                    type="button"
                    className={`${primaryButtonClassName} mt-4 inline-flex items-center gap-1.5 px-4 py-2 text-sm`}
                    onClick={startCreateRule}
                  >
                    <Plus className="h-4 w-4" aria-hidden="true" />
                    New Rule
                  </button>
                ) : null}
              </div>
            ) : (
              <ul className="space-y-3" role="listbox" aria-label="Automation rules">
                {filteredRules.map((rule) => {
                  const isSelected = !creatingNew && selectedId === rule.id;
                  return (
                    <li key={rule.id}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={isSelected}
                        className={`${automationListItemClassName} w-full text-left ${
                          isSelected
                            ? automationListItemSelectedClassName
                            : "hover:bg-[var(--admin-surface-low)]"
                        }`}
                        onClick={() => {
                          selectRule(rule);
                        }}
                      >
                        <div className="mb-2 flex items-start justify-between gap-2">
                          <span className={automationRuleCodeClassName}>
                            {formatRuleCode(rule)}
                          </span>
                          <span className={automationStatusBadgeClassName(rule.status)}>
                            {automationStatusLabel(rule.status)}
                          </span>
                        </div>
                        <h3 className="mb-1 text-sm font-semibold text-[var(--admin-on-surface)]">
                          {formatRuleTitle(rule.key)}
                        </h3>
                        <p className="flex items-center gap-1.5 text-sm text-[var(--admin-on-surface-variant)]">
                          <Bolt className="h-4 w-4 shrink-0" aria-hidden="true" />
                          {formatTriggerLabel(rule.triggerEventType)}
                        </p>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </aside>

        <div className={automationEditorPanelClassName}>
          {!selected && !creatingNew ? (
            <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
              <Zap className="mb-3 h-12 w-12 text-[var(--admin-outline)]" aria-hidden="true" />
              <p className="text-base font-semibold text-[var(--admin-on-surface)]">
                Select a rule to edit
              </p>
              <p className="mt-1 text-sm text-[var(--admin-on-surface-variant)]">
                Choose a rule from the list or create a new automation.
              </p>
            </div>
          ) : (
            <div className={automationEditorInnerClassName}>
              <header className="space-y-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--admin-on-surface-variant)]">
                  {creatingNew ? "New automation" : "Editing rule"}
                </p>
                <h2 className="text-xl font-semibold text-[var(--admin-on-surface)]">
                  {editorTitle}
                </h2>
              </header>

              <div className="space-y-12">
                <div className={automationStepConnectorClassName}>
                  <article className={automationStepCardClassName}>
                    <div className="mb-4 flex items-center gap-3">
                      <div className={automationStepIconPrimaryClassName}>
                        <Bolt className="h-5 w-5" aria-hidden="true" />
                      </div>
                      <h3 className="text-base font-semibold text-[var(--admin-on-surface)]">
                        1. When this happens
                      </h3>
                    </div>
                    <div className="space-y-4">
                      <div className="space-y-1.5">
                        <span className={labelClassName}>Rule key</span>
                        <input
                          className={`${fieldClassName} font-mono text-[13px]`}
                          value={draft.key}
                          onChange={(event) => {
                            updateDraft("key", event.target.value);
                          }}
                          disabled={!canManage}
                          placeholder="completion.notify"
                          aria-invalid={Boolean(fieldErrors["key"])}
                        />
                        <FieldError message={fieldErrors["key"]} />
                      </div>
                      <GamificationSelectField
                        label="Trigger event type"
                        value={draft.trigger}
                        options={TRIGGER_OPTIONS}
                        onChange={(value) => {
                          updateDraft("trigger", value as TriggerType);
                        }}
                        disabled={!canManage}
                      />
                      <GamificationSelectField
                        label="Rule status"
                        value={draft.status}
                        options={[...STATUS_OPTIONS]}
                        onChange={(value) => {
                          updateDraft("status", value as EntityStatus);
                        }}
                        disabled={!canManage}
                      />
                    </div>
                  </article>
                </div>

                <div className={automationStepConnectorClassName}>
                  <article className={automationStepCardClassName}>
                    <div className="mb-4 flex items-center gap-3">
                      <div className={automationStepIconWarningClassName}>
                        <Filter className="h-5 w-5" aria-hidden="true" />
                      </div>
                      <h3 className="text-base font-semibold text-[var(--admin-on-surface)]">
                        2. If this is true
                      </h3>
                    </div>
                    <fieldset className="space-y-2">
                      <legend className="sr-only">Condition</legend>
                      <label className="flex cursor-pointer items-center gap-3 rounded-lg p-2 hover:bg-[var(--admin-surface-low)]">
                        <input
                          type="radio"
                          name="automation-condition"
                          checked={draft.conditionType === "always"}
                          onChange={() => {
                            updateDraft("conditionType", "always");
                          }}
                          disabled={!canManage}
                          className="h-4 w-4 accent-[var(--admin-primary)]"
                        />
                        <span className="text-sm text-[var(--admin-on-surface)]">Always run</span>
                      </label>
                      <label className="flex cursor-pointer items-center gap-3 rounded-lg p-2 hover:bg-[var(--admin-surface-low)]">
                        <input
                          type="radio"
                          name="automation-condition"
                          checked={draft.conditionType === "assessmentPassed"}
                          onChange={() => {
                            updateDraft("conditionType", "assessmentPassed");
                          }}
                          disabled={!canManage}
                          className="h-4 w-4 accent-[var(--admin-primary)]"
                        />
                        <span className="text-sm text-[var(--admin-on-surface)]">
                          Assessment passed with minimum score
                        </span>
                      </label>
                      {draft.conditionType === "assessmentPassed" ? (
                        <div className="space-y-1.5 pl-7 pt-1">
                          <span className={labelClassName}>Minimum score (%)</span>
                          <input
                            type="number"
                            min={0}
                            max={100}
                            className={`${fieldClassName} w-32`}
                            value={draft.minScore}
                            onChange={(event) => {
                              updateDraft("minScore", Number(event.target.value));
                            }}
                            disabled={!canManage}
                            aria-invalid={Boolean(fieldErrors["minScore"])}
                          />
                          <FieldError message={fieldErrors["minScore"]} />
                        </div>
                      ) : null}
                    </fieldset>
                  </article>
                </div>

                <article className={automationStepCardClassName}>
                  <div className="mb-4 flex items-center gap-3">
                    <div className={automationStepIconSuccessClassName}>
                      <Zap className="h-5 w-5" aria-hidden="true" />
                    </div>
                    <h3 className="text-base font-semibold text-[var(--admin-on-surface)]">
                      3. Do this
                    </h3>
                  </div>
                  <div className="space-y-5">
                    <div
                      className={automationActionToggleGroupClassName}
                      role="tablist"
                      aria-label="Action type"
                    >
                      <button
                        type="button"
                        role="tab"
                        aria-selected={draft.actionType === "notification.request"}
                        className={
                          draft.actionType === "notification.request"
                            ? automationActionToggleActiveClassName
                            : automationActionToggleInactiveClassName
                        }
                        onClick={() => {
                          updateDraft("actionType", "notification.request");
                        }}
                        disabled={!canManage}
                      >
                        Send notification
                      </button>
                      <button
                        type="button"
                        role="tab"
                        aria-selected={draft.actionType === "certificate.issue"}
                        className={
                          draft.actionType === "certificate.issue"
                            ? automationActionToggleActiveClassName
                            : automationActionToggleInactiveClassName
                        }
                        onClick={() => {
                          updateDraft("actionType", "certificate.issue");
                        }}
                        disabled={!canManage}
                      >
                        Issue certificate
                      </button>
                    </div>

                    {draft.actionType === "notification.request" ? (
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-1.5">
                          <span className={labelClassName}>Template key</span>
                          <input
                            className={`${fieldClassName} font-mono text-[13px]`}
                            value={draft.templateKey}
                            onChange={(event) => {
                              updateDraft("templateKey", event.target.value);
                            }}
                            disabled={!canManage}
                            aria-invalid={Boolean(fieldErrors["templateKey"])}
                          />
                          <FieldError message={fieldErrors["templateKey"]} />
                        </div>
                        <GamificationSelectField
                          label="Membership ID field"
                          value={draft.membershipIdField}
                          options={[...MEMBERSHIP_FIELD_OPTIONS]}
                          onChange={(value) => {
                            updateDraft(
                              "membershipIdField",
                              value as "membershipId" | "learnerMembershipId",
                            );
                          }}
                          disabled={!canManage}
                        />
                      </div>
                    ) : (
                      <div className="grid gap-4 md:grid-cols-2">
                        {certificateTemplateOptions.length > 0 ? (
                          <div className="space-y-1.5">
                            <GamificationSelectField
                              label="Certificate template"
                              value={draft.certificateTemplateId}
                              options={certificateTemplateOptions}
                              placeholder="Select certificate template…"
                              onChange={(value) => {
                                updateDraft("certificateTemplateId", value);
                              }}
                              disabled={!canManage}
                            />
                            <FieldError message={fieldErrors["certificateTemplateId"]} />
                          </div>
                        ) : (
                          <div className="space-y-1.5 md:col-span-2">
                            <span className={labelClassName}>Template ID</span>
                            <input
                              className={`${fieldClassName} font-mono text-[13px]`}
                              value={draft.certificateTemplateId}
                              onChange={(event) => {
                                updateDraft("certificateTemplateId", event.target.value);
                              }}
                              disabled={!canManage}
                              placeholder="UUID of published certificate template"
                              aria-invalid={Boolean(fieldErrors["certificateTemplateId"])}
                            />
                            <FieldError message={fieldErrors["certificateTemplateId"]} />
                            <p className="text-xs text-[var(--admin-on-surface-variant)]">
                              No published certificate templates were found.{" "}
                              <Link
                                href="/admin/certificates/templates"
                                className="font-semibold text-[var(--admin-primary)] hover:underline"
                              >
                                Create one in Certificate Templates
                              </Link>
                              .
                            </p>
                          </div>
                        )}
                        <GamificationSelectField
                          label="Recipient field"
                          value={draft.recipientMembershipIdField}
                          options={[...MEMBERSHIP_FIELD_OPTIONS]}
                          onChange={(value) => {
                            updateDraft(
                              "recipientMembershipIdField",
                              value as "membershipId" | "learnerMembershipId",
                            );
                          }}
                          disabled={!canManage}
                        />
                        <GamificationSelectField
                          label="Source type"
                          value={draft.sourceType}
                          options={[...SOURCE_TYPE_OPTIONS]}
                          onChange={(value) => {
                            updateDraft(
                              "sourceType",
                              value as "course" | "learning_path" | "assessment",
                            );
                          }}
                          disabled={!canManage}
                        />
                        <div className="space-y-1.5">
                          <span className={labelClassName}>Source ID field</span>
                          <input
                            className={`${fieldClassName} font-mono text-[13px]`}
                            value={draft.sourceIdField}
                            onChange={(event) => {
                              updateDraft("sourceIdField", event.target.value);
                            }}
                            disabled={!canManage}
                            placeholder="assessmentId"
                            aria-invalid={Boolean(fieldErrors["sourceIdField"])}
                          />
                          <FieldError message={fieldErrors["sourceIdField"]} />
                        </div>
                      </div>
                    )}
                  </div>
                </article>
              </div>

              {canManage ? (
                <div className={automationFooterClassName}>
                  {selected && !creatingNew ? (
                    <button
                      type="button"
                      className={`${outlineButtonClassName} border-[var(--admin-danger)] text-[var(--admin-danger)] hover:bg-[color-mix(in_srgb,var(--admin-danger)_8%,transparent)]`}
                      onClick={() => {
                        setConfirmDeleteOpen(true);
                      }}
                      disabled={saving}
                    >
                      Delete rule
                    </button>
                  ) : (
                    <span />
                  )}
                  <div className="flex flex-wrap gap-2 sm:justify-end">
                    <button
                      type="button"
                      className={ghostButtonClassName}
                      onClick={discardChanges}
                      disabled={!isDirty || saving}
                    >
                      Discard
                    </button>
                    <button
                      type="button"
                      className={primaryButtonClassName}
                      onClick={() => void saveRule()}
                      disabled={!isDirty || saving}
                    >
                      {saving ? "Saving..." : creatingNew ? "Create rule" : "Save changes"}
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-[var(--admin-on-surface-variant)]" role="status">
                  You have read-only access to automation rules.
                </p>
              )}

              {message ? (
                <p className="text-sm text-[var(--admin-danger)]" role="status" aria-live="polite">
                  {message}
                  {requestId ? ` (Request ID: ${requestId})` : ""}
                </p>
              ) : null}

              {!creatingNew && selected ? (
                <section className="space-y-4 pb-4" aria-labelledby="execution-history-heading">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                    <div className="space-y-1">
                      <h3
                        id="execution-history-heading"
                        className="text-base font-semibold text-[var(--admin-on-surface)]"
                      >
                        Execution history
                      </h3>
                      <p className="text-sm text-[var(--admin-on-surface-variant)]">
                        Last 25 runs for this rule.
                      </p>
                    </div>
                    <button
                      type="button"
                      className={`${outlineButtonClassName} inline-flex items-center gap-2`}
                      onClick={() => void refreshRuns(selected.id)}
                      disabled={loadingRuns}
                    >
                      <RefreshCw
                        className={`h-4 w-4 ${loadingRuns ? "animate-spin" : ""}`}
                        aria-hidden="true"
                      />
                      Refresh runs
                    </button>
                  </div>

                  <div className="overflow-x-auto">
                    <table className={automationHistoryTableClassName}>
                      <thead className={automationHistoryHeadClassName}>
                        <tr>
                          <th className="px-4 py-2.5">Status</th>
                          <th className="px-4 py-2.5">Occurred at</th>
                          <th className="px-4 py-2.5">Source event ID</th>
                          <th className="px-4 py-2.5 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {loadingRuns && runs.length === 0 ? (
                          <tr className="animate-pulse opacity-50">
                            <td className="px-4 py-3">
                              <div className="h-4 w-16 rounded bg-[var(--admin-surface-high)]" />
                            </td>
                            <td className="px-4 py-3">
                              <div className="h-4 w-24 rounded bg-[var(--admin-surface-high)]" />
                            </td>
                            <td className="px-4 py-3">
                              <div className="h-4 w-32 rounded bg-[var(--admin-surface-high)]" />
                            </td>
                            <td className="px-4 py-3 text-right">
                              <div className="ml-auto h-4 w-12 rounded bg-[var(--admin-surface-high)]" />
                            </td>
                          </tr>
                        ) : runs.length === 0 ? (
                          <tr>
                            <td
                              colSpan={4}
                              className="px-4 py-8 text-center text-sm text-[var(--admin-on-surface-variant)]"
                            >
                              No automation runs recorded for {formatRuleTitle(selected.key)} yet.
                            </td>
                          </tr>
                        ) : (
                          runs.map((run) => {
                            const expanded = expandedRunId === run.id;
                            return (
                              <Fragment key={run.id}>
                                <tr className="border-b border-[var(--admin-border)] hover:bg-[var(--admin-surface-low)]">
                                  <td className="px-4 py-3">
                                    <span className={automationRunStatusBadgeClassName(run.status)}>
                                      {formatRunStatus(run.status)}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3 text-sm text-[var(--admin-on-surface)]">
                                    <time dateTime={run.occurredAt}>
                                      {formatRelativeTime(run.occurredAt)}
                                    </time>
                                  </td>
                                  <td className="px-4 py-3 font-mono text-[12px] text-[var(--admin-on-surface-variant)]">
                                    {run.sourceEventId}
                                  </td>
                                  <td className="px-4 py-3 text-right">
                                    <button
                                      type="button"
                                      className="text-xs font-semibold text-[var(--admin-primary)] hover:underline"
                                      onClick={() => {
                                        setExpandedRunId(expanded ? null : run.id);
                                      }}
                                      aria-expanded={expanded}
                                    >
                                      {expanded ? "Hide JSON" : "View JSON"}
                                    </button>
                                  </td>
                                </tr>
                                {expanded ? (
                                  <tr className="border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)]">
                                    <td colSpan={4} className="px-4 py-3">
                                      <pre className={automationJsonPreviewClassName}>
                                        {JSON.stringify(
                                          {
                                            status: run.status,
                                            result: run.resultJson,
                                            sourceEventId: run.sourceEventId,
                                            occurredAt: run.occurredAt,
                                          },
                                          null,
                                          2,
                                        )}
                                      </pre>
                                    </td>
                                  </tr>
                                ) : null}
                              </Fragment>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </section>
              ) : null}
            </div>
          )}
        </div>
      </section>

      <AdminConfirmDialog
        open={confirmDeleteOpen}
        title="Delete this rule?"
        description="This action cannot be undone. All future events matching this trigger will no longer execute these actions."
        confirmLabel="Delete forever"
        busyLabel="Deleting..."
        cancelLabel="Cancel"
        tone="danger"
        icon={Trash2}
        busy={saving}
        onConfirm={() => void deleteRule()}
        onCancel={() => {
          setConfirmDeleteOpen(false);
        }}
      />
    </>
  );
}
