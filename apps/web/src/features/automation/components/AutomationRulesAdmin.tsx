"use client";

import { useMemo, useRef, useState } from "react";
import type { z } from "zod";
import { ClientApiError, clientApi } from "../../../lib/client-api";
import type { automationRuleDtoSchema } from "../../../server/automation/automation.dto";
import { AUTOMATION_TRIGGER_EVENT_TYPES } from "../../../server/automation/automation.registry";

type RuleDto = z.infer<typeof automationRuleDtoSchema>;

type AutomationRulesAdminProps = {
  initialRules: RuleDto[];
  canManage: boolean;
};

export function AutomationRulesAdmin({ initialRules, canManage }: AutomationRulesAdminProps) {
  const [rules, setRules] = useState(initialRules);
  const [selectedId, setSelectedId] = useState<string | null>(initialRules[0]?.id ?? null);
  const [draftKey, setDraftKey] = useState("completion.notify");
  const [draftTrigger, setDraftTrigger] =
    useState<(typeof AUTOMATION_TRIGGER_EVENT_TYPES)[number]>("certificate.issued");
  const [draftConditionType, setDraftConditionType] = useState<"always" | "assessmentPassed">(
    "always",
  );
  const [draftMinScore, setDraftMinScore] = useState(70);
  const [draftActionType, setDraftActionType] = useState<
    "notification.request" | "certificate.issue"
  >("notification.request");
  const [draftTemplateKey, setDraftTemplateKey] = useState("certificate.issued");
  const [draftCertificateTemplateId, setDraftCertificateTemplateId] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const deleteButtonRef = useRef<HTMLButtonElement>(null);

  const selected = useMemo(
    () => rules.find((rule) => rule.id === selectedId) ?? null,
    [rules, selectedId],
  );

  function buildConditionJson() {
    if (draftConditionType === "assessmentPassed") {
      return { type: "assessmentPassed", minScorePercent: draftMinScore };
    }
    return { type: "always" };
  }

  function buildActionJson() {
    if (draftActionType === "certificate.issue") {
      return {
        type: "certificate.issue",
        templateId: draftCertificateTemplateId,
        recipientMembershipIdField: "learnerMembershipId",
        sourceType: "assessment",
        sourceIdField: "assessmentId",
      };
    }
    return {
      type: "notification.request",
      templateKey: draftTemplateKey,
      membershipIdField: "membershipId",
    };
  }

  function setError(caught: unknown) {
    if (caught instanceof ClientApiError) {
      setMessage(caught.message);
      setRequestId(caught.requestId);
      return;
    }
    setMessage("Unexpected error.");
    setRequestId(null);
  }

  async function refreshRules() {
    const response = await clientApi.get<{ data: RuleDto[] }>("/api/v1/automation-rules");
    setRules(response.data);
  }

  function loadDraftFromRule(rule: RuleDto) {
    setDraftKey(rule.key);
    setDraftTrigger(rule.triggerEventType);
    const condition = rule.conditionJson as { type?: string; minScorePercent?: number };
    if (condition.type === "assessmentPassed") {
      setDraftConditionType("assessmentPassed");
      setDraftMinScore(condition.minScorePercent ?? 70);
    } else {
      setDraftConditionType("always");
    }
    const action = rule.actionJson as { type?: string; templateKey?: string; templateId?: string };
    if (action.type === "certificate.issue") {
      setDraftActionType("certificate.issue");
      setDraftCertificateTemplateId(action.templateId ?? "");
    } else {
      setDraftActionType("notification.request");
      setDraftTemplateKey(action.templateKey ?? "certificate.issued");
    }
  }

  async function createRule() {
    if (!canManage) return;
    setMessage(null);
    setRequestId(null);
    try {
      const response = await clientApi.post<{ data: RuleDto }>(
        "/api/v1/automation-rules",
        {
          key: draftKey,
          triggerEventType: draftTrigger,
          conditionJson: buildConditionJson(),
          actionJson: buildActionJson(),
          status: "ACTIVE",
        },
        "automation-rule-create",
      );
      await refreshRules();
      setSelectedId(response.data.id);
      setMessage("Rule created.");
    } catch (caught) {
      setError(caught);
    }
  }

  async function saveSelected() {
    if (!canManage || !selected) return;
    setMessage(null);
    setRequestId(null);
    try {
      await clientApi.put(
        "/api/v1/automation-rules",
        {
          id: selected.id,
          key: draftKey,
          triggerEventType: draftTrigger,
          conditionJson: buildConditionJson(),
          actionJson: buildActionJson(),
        },
        "automation-rule-update",
      );
      await refreshRules();
      setMessage("Rule saved.");
    } catch (caught) {
      setError(caught);
    }
  }

  async function deleteSelected() {
    if (!canManage || !selected || !confirmDelete) return;
    setMessage(null);
    setRequestId(null);
    try {
      await clientApi.delete("/api/v1/automation-rules", "automation-rule-delete", {
        id: selected.id,
      });
      await refreshRules();
      setSelectedId(null);
      setConfirmDelete(false);
      setMessage("Rule deleted.");
      deleteButtonRef.current?.focus();
    } catch (caught) {
      setError(caught);
    }
  }

  if (rules.length === 0 && !canManage) {
    return (
      <section className="rounded border p-6">
        <p>No automation rules configured.</p>
      </section>
    );
  }

  return (
    <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
      <div className="space-y-4 rounded border p-4">
        <h2 className="text-lg font-semibold">Rules</h2>
        {rules.length === 0 ? (
          <p className="text-sm text-muted-foreground">No rules yet. Create your first rule.</p>
        ) : (
          <ul className="space-y-2">
            {rules.map((rule) => (
              <li key={rule.id}>
                <button
                  type="button"
                  className={`w-full rounded border px-3 py-2 text-left ${selectedId === rule.id ? "border-primary" : ""}`}
                  onClick={() => {
                    setSelectedId(rule.id);
                    loadDraftFromRule(rule);
                    setConfirmDelete(false);
                  }}
                >
                  <div className="font-medium">{rule.key}</div>
                  <div className="text-sm text-muted-foreground">{rule.triggerEventType}</div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="space-y-4 rounded border p-4">
        <h2 className="text-lg font-semibold">{selected ? "Edit rule" : "Create rule"}</h2>
        {!canManage ? <p role="status">You have read-only access to automation rules.</p> : null}

        <label className="block space-y-1">
          <span className="text-sm font-medium">Key</span>
          <input
            className="w-full rounded border px-3 py-2"
            value={draftKey}
            onChange={(event) => {
              setDraftKey(event.target.value);
            }}
            disabled={!canManage}
          />
        </label>

        <label className="block space-y-1">
          <span className="text-sm font-medium">Trigger event</span>
          <select
            className="w-full rounded border px-3 py-2"
            value={draftTrigger}
            onChange={(event) => {
              setDraftTrigger(
                event.target.value as (typeof AUTOMATION_TRIGGER_EVENT_TYPES)[number],
              );
            }}
            disabled={!canManage}
          >
            {AUTOMATION_TRIGGER_EVENT_TYPES.map((trigger) => (
              <option key={trigger} value={trigger}>
                {trigger}
              </option>
            ))}
          </select>
        </label>

        <fieldset className="space-y-2 rounded border p-3">
          <legend className="px-1 text-sm font-medium">Condition</legend>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              checked={draftConditionType === "always"}
              onChange={() => {
                setDraftConditionType("always");
              }}
              disabled={!canManage}
            />
            Always
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              checked={draftConditionType === "assessmentPassed"}
              onChange={() => {
                setDraftConditionType("assessmentPassed");
              }}
              disabled={!canManage}
            />
            Assessment passed
          </label>
          {draftConditionType === "assessmentPassed" ? (
            <label className="block space-y-1">
              <span className="text-sm">Minimum score percent</span>
              <input
                type="number"
                min={0}
                max={100}
                className="w-full rounded border px-3 py-2"
                value={draftMinScore}
                onChange={(event) => {
                  setDraftMinScore(Number(event.target.value));
                }}
                disabled={!canManage}
              />
            </label>
          ) : null}
        </fieldset>

        <fieldset className="space-y-2 rounded border p-3">
          <legend className="px-1 text-sm font-medium">Action</legend>
          <select
            className="w-full rounded border px-3 py-2"
            value={draftActionType}
            onChange={(event) => {
              setDraftActionType(
                event.target.value as "notification.request" | "certificate.issue",
              );
            }}
            disabled={!canManage}
          >
            <option value="notification.request">Request notification</option>
            <option value="certificate.issue">Issue certificate</option>
          </select>
          {draftActionType === "notification.request" ? (
            <label className="block space-y-1">
              <span className="text-sm">Template key</span>
              <input
                className="w-full rounded border px-3 py-2"
                value={draftTemplateKey}
                onChange={(event) => {
                  setDraftTemplateKey(event.target.value);
                }}
                disabled={!canManage}
              />
            </label>
          ) : (
            <label className="block space-y-1">
              <span className="text-sm">Certificate template ID</span>
              <input
                className="w-full rounded border px-3 py-2"
                value={draftCertificateTemplateId}
                onChange={(event) => {
                  setDraftCertificateTemplateId(event.target.value);
                }}
                disabled={!canManage}
              />
            </label>
          )}
        </fieldset>

        {canManage ? (
          <div className="flex flex-wrap gap-2">
            {selected ? (
              <button
                type="button"
                className="rounded border px-4 py-2"
                onClick={() => {
                  void saveSelected();
                }}
              >
                Save changes
              </button>
            ) : (
              <button
                type="button"
                className="rounded border px-4 py-2"
                onClick={() => {
                  void createRule();
                }}
              >
                Create rule
              </button>
            )}
            {selected ? (
              <button
                ref={deleteButtonRef}
                type="button"
                className="rounded border px-4 py-2"
                onClick={() => {
                  setConfirmDelete(true);
                }}
              >
                Delete rule
              </button>
            ) : null}
          </div>
        ) : null}

        {confirmDelete && selected ? (
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-rule-title"
            className="space-y-3 rounded border border-destructive p-4"
          >
            <h3 id="delete-rule-title" className="font-semibold">
              Delete automation rule?
            </h3>
            <p>This removes the rule permanently. Existing run history remains append-only.</p>
            <div className="flex gap-2">
              <button
                type="button"
                className="rounded border px-4 py-2"
                onClick={() => {
                  void deleteSelected();
                }}
              >
                Confirm delete
              </button>
              <button
                type="button"
                className="rounded border px-4 py-2"
                onClick={() => {
                  setConfirmDelete(false);
                  deleteButtonRef.current?.focus();
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : null}

        {message ? (
          <p role="status" aria-live="polite">
            {message}
            {requestId ? ` (Request ID: ${requestId})` : ""}
          </p>
        ) : null}
      </div>
    </section>
  );
}
