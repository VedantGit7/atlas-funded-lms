"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Plus, RefreshCw, Trash2, X } from "lucide-react";
import {
  ghostButtonClassName,
  primaryButtonClassName,
} from "../../analytics/analytics-admin-shared";
import { ClientApiError } from "../../../lib/client-api";
import {
  createCustomFieldSegment,
  emptyConditionsTree,
  fetchCustomFieldSegment,
  fetchSegmentFieldOptions,
  isSegmentConditionComplete,
  newConditionId,
  newGroupId,
  operatorsForFieldType,
  previewCustomFieldSegment,
  updateCustomFieldSegment,
  type SegmentCondition,
  type SegmentConditionGroup,
  type SegmentConditionsTree,
  type SegmentFieldOption,
  type SegmentPreviewLearner,
} from "./admin-custom-field-segments-api";

function isAborted(signal: AbortSignal): boolean {
  return signal.aborted;
}

function defined<T>(value: T, message = "Expected value to be defined"): NonNullable<T> {
  if (value == null) {
    throw new Error(message);
  }
  return value;
}

const filterInputClassName =
  "h-9 w-full rounded-sm border border-[var(--admin-outline)] bg-[var(--admin-surface-low)] px-3 text-[13px] text-[var(--admin-on-surface)] outline-none transition-colors placeholder:text-[var(--admin-on-surface-variant)]/70 focus:border-[var(--admin-primary)] focus:ring-1 focus:ring-[var(--admin-primary)]";

const selectClassName =
  "h-9 w-full rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface)] text-xs font-medium text-[var(--admin-on-surface)] hover:border-[var(--admin-outline)] focus-visible:border-[var(--admin-primary)] focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30";

const labelClassName =
  "mb-1 font-mono text-[10px] font-medium uppercase tracking-[0.08em] text-[var(--admin-on-surface-variant)]";

function fieldKey(field: SegmentFieldOption): string {
  return `${field.source}:${field.key}`;
}

function findField(
  fields: SegmentFieldOption[],
  source: "learner" | "custom",
  key: string,
): SegmentFieldOption | undefined {
  return fields.find((field) => field.source === source && field.key === key);
}

function ValueControl({
  condition,
  field,
  incomplete,
  onChange,
}: {
  condition: SegmentCondition;
  field: SegmentFieldOption;
  incomplete: boolean;
  onChange: (value: unknown) => void;
}) {
  const op = condition.operator;
  const ring = incomplete ? "ring-1 ring-[var(--admin-warning)] border-[var(--admin-warning)]" : "";

  if (op === "is_empty" || op === "is_not_empty") {
    return (
      <div className="flex h-9 flex-1 items-center px-2 text-xs text-[var(--admin-on-surface-variant)]">
        No value needed
      </div>
    );
  }

  if (field.fieldType === "boolean") {
    return (
      <div className="flex flex-1 gap-2">
        <button
          type="button"
          className={`flex-1 rounded-sm border py-1.5 font-mono text-[11px] uppercase transition-colors ${
            op === "is_true"
              ? "border-[var(--admin-success)] bg-[color-mix(in_srgb,var(--admin-success)_10%,var(--admin-surface))] text-[var(--admin-success)]"
              : "border-[var(--admin-border)] bg-[var(--admin-surface)]"
          }`}
          onClick={() => {
            onChange(true);
          }}
        >
          Yes
        </button>
        <button
          type="button"
          className={`flex-1 rounded-sm border py-1.5 font-mono text-[11px] uppercase transition-colors ${
            op === "is_false"
              ? "border-[var(--admin-outline)] bg-[var(--admin-surface-high)] text-[var(--admin-on-surface-variant)]"
              : "border-[var(--admin-border)] bg-[var(--admin-surface)]"
          }`}
          onClick={() => {
            onChange(false);
          }}
        >
          No
        </button>
      </div>
    );
  }

  if (op === "between" && field.fieldType === "number") {
    const pair = Array.isArray(condition.value) ? condition.value : ["", ""];
    return (
      <div className={`flex flex-1 gap-2 ${ring}`}>
        <input
          type="number"
          className={filterInputClassName}
          value={typeof pair[0] === "string" || typeof pair[0] === "number" ? String(pair[0]) : ""}
          onChange={(event) => {
            onChange([Number(event.target.value), Number(pair[1] ?? 0)]);
          }}
          placeholder="Min"
        />
        <input
          type="number"
          className={filterInputClassName}
          value={typeof pair[1] === "string" || typeof pair[1] === "number" ? String(pair[1]) : ""}
          onChange={(event) => {
            onChange([Number(pair[0] ?? 0), Number(event.target.value)]);
          }}
          placeholder="Max"
        />
      </div>
    );
  }

  if (op === "between" && field.fieldType === "date") {
    const pair = Array.isArray(condition.value) ? condition.value : ["", ""];
    return (
      <div className={`flex flex-1 gap-2 ${ring}`}>
        <input
          type="date"
          className={filterInputClassName}
          value={String(pair[0] ?? "")}
          onChange={(event) => {
            onChange([event.target.value, String(pair[1] ?? "")]);
          }}
        />
        <input
          type="date"
          className={filterInputClassName}
          value={String(pair[1] ?? "")}
          onChange={(event) => {
            onChange([String(pair[0] ?? ""), event.target.value]);
          }}
        />
      </div>
    );
  }

  if (op === "in_last_n_days") {
    const days =
      condition.value && typeof condition.value === "object" && "days" in condition.value
        ? (condition.value as { days: number }).days
        : typeof condition.value === "number"
          ? condition.value
          : "";
    return (
      <input
        type="number"
        min={1}
        className={`${filterInputClassName} flex-1 ${ring}`}
        value={days}
        onChange={(event) => {
          onChange({ days: Number(event.target.value) });
        }}
        placeholder="Days"
      />
    );
  }

  if (op === "is_any_of" || op === "is_none_of") {
    const selected = Array.isArray(condition.value)
      ? condition.value.map(String)
      : ([] as string[]);
    if (field.options.length > 0) {
      return (
        <div
          className={`flex flex-1 flex-wrap gap-1 rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface)] p-2 ${ring}`}
        >
          {field.options.map((option) => {
            const active = selected.includes(option);
            return (
              <button
                key={option}
                type="button"
                className={`rounded-sm border px-2 py-0.5 text-[11px] transition-colors ${
                  active
                    ? "border-[var(--admin-primary)] bg-[color-mix(in_srgb,var(--admin-primary)_12%,var(--admin-surface))] text-[var(--admin-primary)]"
                    : "border-[var(--admin-border)] text-[var(--admin-on-surface-variant)]"
                }`}
                onClick={() => {
                  onChange(
                    active ? selected.filter((item) => item !== option) : [...selected, option],
                  );
                }}
              >
                {option}
              </button>
            );
          })}
        </div>
      );
    }
    return (
      <input
        className={`${filterInputClassName} flex-1 ${ring}`}
        value={selected.join(", ")}
        onChange={(event) => {
          onChange(
            event.target.value
              .split(",")
              .map((part) => part.trim())
              .filter(Boolean),
          );
        }}
        placeholder="Comma-separated values"
      />
    );
  }

  if (field.fieldType === "number") {
    return (
      <input
        type="number"
        className={`${filterInputClassName} flex-1 ${ring}`}
        value={typeof condition.value === "number" ? condition.value : ""}
        onChange={(event) => {
          onChange(Number(event.target.value));
        }}
      />
    );
  }

  if (field.fieldType === "date") {
    return (
      <input
        type="date"
        className={`${filterInputClassName} flex-1 ${ring}`}
        value={typeof condition.value === "string" ? condition.value : ""}
        onChange={(event) => {
          onChange(event.target.value);
        }}
      />
    );
  }

  if (field.fieldType === "select" && field.options.length > 0) {
    return (
      <select
        className={`${selectClassName} flex-1 ${ring}`}
        value={typeof condition.value === "string" ? condition.value : ""}
        onChange={(event) => {
          onChange(event.target.value);
        }}
      >
        <option value="">Select…</option>
        {field.options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    );
  }

  return (
    <input
      className={`${filterInputClassName} flex-1 ${ring}`}
      value={typeof condition.value === "string" ? condition.value : ""}
      onChange={(event) => {
        onChange(event.target.value);
      }}
      placeholder="Value"
    />
  );
}

function ResultsRail({
  matchedCount,
  incomplete,
  incompleteMessage,
  learners,
  loading,
}: {
  matchedCount: number;
  incomplete: boolean;
  incompleteMessage: string | null;
  learners: SegmentPreviewLearner[];
  loading: boolean;
}) {
  return (
    <aside className="hidden w-[300px] shrink-0 flex-col overflow-hidden rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface)] lg:flex">
      <div className="border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-4 text-center">
        <div className="mb-1 font-mono text-[10px] uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
          Live Results
        </div>
        {incomplete ? (
          <div className="flex items-start gap-2 text-left text-sm text-[var(--admin-warning)]">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{incompleteMessage ?? "Finish the highlighted condition to see matches."}</span>
          </div>
        ) : (
          <>
            <div className="font-mono text-2xl font-semibold leading-tight text-[var(--admin-on-surface)]">
              {loading ? "…" : matchedCount.toLocaleString()}
            </div>
            <div className="text-xs text-[var(--admin-on-surface-variant)]">learners match</div>
          </>
        )}
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        <div className="mb-4 flex items-center justify-between">
          <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--admin-on-surface)]">
            Preview List
          </span>
          <Link
            href="/admin/reports/custom-field"
            className="text-xs text-[var(--admin-primary)] hover:underline"
          >
            View all
          </Link>
        </div>
        <ul className="space-y-3">
          {learners.map((learner) => {
            const initials = (learner.learnerName ?? learner.email ?? "?")
              .split(/\s+/)
              .map((part) => part[0])
              .join("")
              .slice(0, 2)
              .toUpperCase();
            return (
              <li
                key={learner.membershipId}
                className="-mx-2 flex items-center gap-3 rounded-sm p-2 hover:bg-[var(--admin-surface-low)]"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[var(--admin-border)] bg-[var(--admin-surface-high)] font-mono text-[11px] text-[var(--admin-on-surface-variant)]">
                  {initials}
                </div>
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-[var(--admin-on-surface)]">
                    {learner.learnerName ?? "—"}
                  </div>
                  <div className="truncate text-xs text-[var(--admin-on-surface-variant)]">
                    {learner.email ?? "—"}
                  </div>
                </div>
              </li>
            );
          })}
          {!incomplete && learners.length === 0 && !loading ? (
            <li className="text-sm text-[var(--admin-on-surface-variant)]">No matches yet.</li>
          ) : null}
        </ul>
      </div>
      <div className="border-t border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-3 text-center">
        <span className="inline-flex items-center justify-center gap-1 font-mono text-[10px] uppercase text-[var(--admin-on-surface-variant)]">
          <RefreshCw className="h-3.5 w-3.5" />
          Recalculated as you edit
        </span>
      </div>
    </aside>
  );
}

export function AdminCustomFieldSegmentBuilderPage({ segmentId }: { segmentId?: string }) {
  const router = useRouter();
  const isEdit = Boolean(segmentId);
  const [fields, setFields] = useState<SegmentFieldOption[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<"shared" | "private">("shared");
  const [refreshMode, setRefreshMode] = useState<"live" | "snapshot">("live");
  const [conditions, setConditions] = useState<SegmentConditionsTree>(emptyConditionsTree);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [matchedCount, setMatchedCount] = useState(0);
  const [incomplete, setIncomplete] = useState(false);
  const [incompleteMessage, setIncompleteMessage] = useState<string | null>(null);
  const [incompleteIds, setIncompleteIds] = useState<Set<string>>(new Set());
  const [learners, setLearners] = useState<SegmentPreviewLearner[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);

  useEffect(() => {
    const ac = new AbortController();
    async function boot() {
      setLoading(true);
      setError(null);
      try {
        const fieldOptions = await fetchSegmentFieldOptions();
        if (isAborted(ac.signal)) return;
        setFields(fieldOptions);
        if (segmentId) {
          const detail = await fetchCustomFieldSegment(segmentId);
          if (isAborted(ac.signal)) return;
          setName(detail.data.name);
          setDescription(detail.data.description ?? "");
          setVisibility(detail.data.visibility);
          setRefreshMode(detail.data.refreshMode);
          setConditions(detail.data.conditions);
        }
      } catch (err) {
        if (!isAborted(ac.signal)) {
          setError(err instanceof ClientApiError ? err.message : "Failed to load builder.");
        }
      } finally {
        if (!isAborted(ac.signal)) setLoading(false);
      }
    }
    void boot();
    return () => {
      ac.abort();
    };
  }, [segmentId]);

  const canSave = useMemo(() => {
    if (!name.trim()) return false;
    for (const group of conditions.groups) {
      for (const condition of group.conditions) {
        const field = findField(fields, condition.fieldSource, condition.fieldKey);
        if (!field || !isSegmentConditionComplete(condition, field.fieldType)) return false;
      }
    }
    return conditions.groups.length > 0;
  }, [name, conditions, fields]);

  useEffect(() => {
    if (loading || fields.length === 0) return;
    const incompleteSet = new Set<string>();
    for (const group of conditions.groups) {
      for (const condition of group.conditions) {
        const field = findField(fields, condition.fieldSource, condition.fieldKey);
        if (!field || !isSegmentConditionComplete(condition, field.fieldType)) {
          incompleteSet.add(condition.id);
        }
      }
    }
    setIncompleteIds(incompleteSet);

    const handle = window.setTimeout(() => {
      void (async () => {
        setPreviewLoading(true);
        try {
          const response = await previewCustomFieldSegment({ conditions, limit: 6 });
          setMatchedCount(response.data.matchedCount);
          setIncomplete(response.data.incomplete);
          setIncompleteMessage(response.data.incompleteMessage);
          setLearners(response.data.learners);
        } catch {
          setMatchedCount(0);
          setLearners([]);
        } finally {
          setPreviewLoading(false);
        }
      })();
    }, 300);
    return () => {
      window.clearTimeout(handle);
    };
  }, [conditions, fields, loading]);

  const updateGroup = useCallback(
    (groupId: string, updater: (group: SegmentConditionGroup) => SegmentConditionGroup) => {
      setConditions((prev) => ({
        ...prev,
        groups: prev.groups.map((group) => (group.id === groupId ? updater(group) : group)),
      }));
    },
    [],
  );

  function updateCondition(groupId: string, conditionId: string, patch: Partial<SegmentCondition>) {
    updateGroup(groupId, (group) => ({
      ...group,
      conditions: group.conditions.map((condition) =>
        condition.id === conditionId ? { ...condition, ...patch } : condition,
      ),
    }));
  }

  async function onSave() {
    if (!canSave) return;
    setSaving(true);
    setError(null);
    try {
      if (isEdit && segmentId) {
        await updateCustomFieldSegment(segmentId, {
          name: name.trim(),
          description: description.trim() || null,
          visibility,
          refreshMode,
          conditions,
        });
        router.push(`/admin/reports/custom-field/segments/${segmentId}`);
      } else {
        const created = await createCustomFieldSegment({
          name: name.trim(),
          description: description.trim() || null,
          visibility,
          refreshMode,
          conditions,
        });
        router.push(`/admin/reports/custom-field/segments/${created.data.id}`);
      }
    } catch (err) {
      setError(err instanceof ClientApiError ? err.message : "Could not save segment.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface)] p-8 text-sm text-[var(--admin-on-surface-variant)]">
        Loading builder…
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-24 lg:pb-0">
      <div className="flex items-center gap-2 text-xs text-[var(--admin-on-surface-variant)]">
        <Link
          href="/admin/reports/custom-field/segments"
          className="hover:text-[var(--admin-primary)]"
        >
          All segments
        </Link>
        <span>/</span>
        <span>{isEdit ? "Edit segment" : "New segment"}</span>
      </div>

      {error ? (
        <div className="flex items-center gap-2 rounded-sm border border-[color-mix(in_srgb,var(--admin-danger)_30%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-danger)_8%,var(--admin-surface))] p-3 text-sm text-[var(--admin-danger)]">
          <AlertTriangle className="h-4 w-4" />
          {error}
        </div>
      ) : null}

      <div className="flex gap-6">
        <div className="flex max-w-[960px] flex-1 flex-col overflow-hidden rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-sm">
          <div className="border-b border-[var(--admin-border)] p-6">
            <h1 className="text-2xl font-semibold tracking-[-0.01em] text-[var(--admin-on-surface)]">
              {isEdit ? "Edit Segment" : "New Segment"}
            </h1>
            <p className="mt-1 text-xs text-[var(--admin-on-surface-variant)]">
              Define conditions to dynamically group learners.
            </p>
          </div>

          <div className="flex-1 space-y-8 overflow-y-auto p-6">
            <section className="space-y-4">
              <h2 className="border-b border-[var(--admin-border)] pb-2 text-base font-semibold text-[var(--admin-on-surface)]">
                Segment Details
              </h2>
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <div>
                  <label className={labelClassName} htmlFor="segment-name">
                    Name <span className="text-[var(--admin-danger)]">*</span>
                  </label>
                  <input
                    id="segment-name"
                    className={filterInputClassName}
                    value={name}
                    onChange={(event) => {
                      setName(event.target.value);
                    }}
                    placeholder="e.g., Active Enterprise Users"
                  />
                </div>
                <div>
                  <div className={labelClassName}>Visibility</div>
                  <div className="flex gap-4 pt-1">
                    <label className="flex items-center gap-2 text-sm text-[var(--admin-on-surface)]">
                      <input
                        type="radio"
                        checked={visibility === "shared"}
                        onChange={() => {
                          setVisibility("shared");
                        }}
                      />
                      Shared
                    </label>
                    <label className="flex items-center gap-2 text-sm text-[var(--admin-on-surface)]">
                      <input
                        type="radio"
                        checked={visibility === "private"}
                        onChange={() => {
                          setVisibility("private");
                        }}
                      />
                      Private
                    </label>
                  </div>
                </div>
              </div>
              <div>
                <label className={labelClassName} htmlFor="segment-desc">
                  Description{" "}
                  <span className="normal-case tracking-normal text-[var(--admin-on-surface-variant)]">
                    (Optional)
                  </span>
                </label>
                <textarea
                  id="segment-desc"
                  rows={2}
                  className={`${filterInputClassName} h-auto py-2`}
                  value={description}
                  onChange={(event) => {
                    setDescription(event.target.value);
                  }}
                  placeholder="Purpose of this segment…"
                />
              </div>
            </section>

            <section className="space-y-4">
              <div className="flex items-center justify-between border-b border-[var(--admin-border)] pb-2">
                <h2 className="text-base font-semibold text-[var(--admin-on-surface)]">
                  Conditions Builder
                </h2>
                <div className="flex items-center gap-2 text-xs text-[var(--admin-on-surface-variant)]">
                  <span>Match</span>
                  <select
                    className={selectClassName}
                    value={conditions.rootCombinator}
                    onChange={(event) => {
                      setConditions((prev) => ({
                        ...prev,
                        rootCombinator: event.target.value as "and" | "or",
                      }));
                    }}
                  >
                    <option value="and">ALL groups (AND)</option>
                    <option value="or">ANY group (OR)</option>
                  </select>
                </div>
              </div>

              {conditions.groups.map((group, groupIndex) => (
                <div key={group.id}>
                  {groupIndex > 0 ? (
                    <div className="relative z-10 -my-2 flex justify-center">
                      <span className="rounded-full border border-[var(--admin-outline)] bg-[var(--admin-surface-high)] px-3 py-1 font-mono text-[11px] font-semibold uppercase text-[var(--admin-on-surface)] shadow-sm">
                        {conditions.rootCombinator}
                      </span>
                    </div>
                  ) : null}
                  <div className="relative space-y-4 rounded-sm border border-[var(--admin-outline)] bg-[var(--admin-surface-low)] p-4">
                    <div className="absolute right-4 top-4">
                      <button
                        type="button"
                        className="text-[var(--admin-on-surface-variant)] hover:text-[var(--admin-danger)]"
                        title="Remove group"
                        disabled={conditions.groups.length === 1}
                        onClick={() => {
                          setConditions((prev) => ({
                            ...prev,
                            groups: prev.groups.filter((item) => item.id !== group.id),
                          }));
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="rounded-sm bg-[var(--admin-surface-high)] px-2 py-0.5 font-mono text-[10px] uppercase text-[var(--admin-on-surface-variant)]">
                        Group {groupIndex + 1}
                      </span>
                      <select
                        className={`${selectClassName} w-auto min-w-[120px]`}
                        value={group.combinator}
                        onChange={(event) => {
                          updateGroup(group.id, (current) => ({
                            ...current,
                            combinator: event.target.value as "and" | "or",
                          }));
                        }}
                      >
                        <option value="and">AND</option>
                        <option value="or">OR</option>
                      </select>
                    </div>

                    {group.conditions.map((condition, conditionIndex) => {
                      const field =
                        findField(fields, condition.fieldSource, condition.fieldKey) ??
                        defined(fields[0]);
                      const ops = operatorsForFieldType(field.fieldType);
                      const isIncomplete = incompleteIds.has(condition.id);
                      return (
                        <div key={condition.id} className="space-y-2">
                          {conditionIndex > 0 ? (
                            <div className="w-8 text-center">
                              <span className="rounded-sm bg-[color-mix(in_srgb,var(--admin-primary)_12%,var(--admin-surface))] px-1 font-mono text-[11px] font-semibold uppercase text-[var(--admin-primary)]">
                                {group.combinator}
                              </span>
                            </div>
                          ) : null}
                          <div
                            className={`flex flex-wrap items-center gap-3 ${
                              isIncomplete
                                ? "rounded-sm bg-[color-mix(in_srgb,var(--admin-warning)_8%,transparent)] p-2"
                                : ""
                            }`}
                          >
                            <select
                              className={`${selectClassName} min-w-[200px] flex-1`}
                              value={fieldKey(field)}
                              onChange={(event) => {
                                const [source, ...keyParts] = event.target.value.split(":");
                                const key = keyParts.join(":");
                                const nextField = findField(
                                  fields,
                                  source as "learner" | "custom",
                                  key,
                                );
                                if (!nextField) return;
                                const nextOps = operatorsForFieldType(nextField.fieldType);
                                updateCondition(group.id, condition.id, {
                                  fieldSource: source as "learner" | "custom",
                                  fieldKey: key,
                                  operator: defined(nextOps[0]).value,
                                  value:
                                    defined(nextOps[0]).value === "is_empty" ||
                                    defined(nextOps[0]).value === "is_true" ||
                                    defined(nextOps[0]).value === "is_false"
                                      ? null
                                      : nextField.fieldType === "select"
                                        ? []
                                        : "",
                                });
                              }}
                            >
                              <optgroup label="Learner columns">
                                {fields
                                  .filter((item) => item.source === "learner")
                                  .map((item) => (
                                    <option key={fieldKey(item)} value={fieldKey(item)}>
                                      {item.label}
                                    </option>
                                  ))}
                              </optgroup>
                              <optgroup label="Custom fields">
                                {fields
                                  .filter((item) => item.source === "custom")
                                  .map((item) => (
                                    <option key={fieldKey(item)} value={fieldKey(item)}>
                                      {item.label} [{item.fieldType.slice(0, 3)}]
                                    </option>
                                  ))}
                              </optgroup>
                            </select>
                            <select
                              className={`${selectClassName} w-[140px]`}
                              value={condition.operator}
                              onChange={(event) => {
                                const operator = event.target.value as SegmentCondition["operator"];
                                updateCondition(group.id, condition.id, {
                                  operator,
                                  value:
                                    operator === "is_empty" ||
                                    operator === "is_not_empty" ||
                                    operator === "is_true" ||
                                    operator === "is_false"
                                      ? null
                                      : operator === "is_any_of" || operator === "is_none_of"
                                        ? []
                                        : operator === "between"
                                          ? field.fieldType === "number"
                                            ? [0, 0]
                                            : ["", ""]
                                          : operator === "in_last_n_days"
                                            ? { days: 30 }
                                            : "",
                                });
                              }}
                            >
                              {ops.map((item) => (
                                <option key={item.value} value={item.value}>
                                  {item.label}
                                </option>
                              ))}
                            </select>
                            <ValueControl
                              condition={
                                condition.operator === "is_true" ||
                                condition.operator === "is_false"
                                  ? condition
                                  : condition
                              }
                              field={field}
                              incomplete={isIncomplete}
                              onChange={(value) => {
                                if (field.fieldType === "boolean") {
                                  updateCondition(group.id, condition.id, {
                                    operator: value === true ? "is_true" : "is_false",
                                    value: null,
                                  });
                                  return;
                                }
                                updateCondition(group.id, condition.id, { value });
                              }}
                            />
                            <button
                              type="button"
                              className="p-2 text-[var(--admin-on-surface-variant)] hover:text-[var(--admin-danger)]"
                              title="Remove condition"
                              disabled={group.conditions.length === 1}
                              onClick={() => {
                                updateGroup(group.id, (current) => ({
                                  ...current,
                                  conditions: current.conditions.filter(
                                    (item) => item.id !== condition.id,
                                  ),
                                }));
                              }}
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })}

                    <button
                      type="button"
                      className="inline-flex items-center gap-1 text-sm font-medium text-[var(--admin-primary)] hover:underline"
                      onClick={() => {
                        updateGroup(group.id, (current) => ({
                          ...current,
                          conditions: [
                            ...current.conditions,
                            {
                              id: newConditionId(),
                              fieldSource: "learner",
                              fieldKey: "status",
                              operator: "is",
                              value: "ACTIVE",
                            },
                          ],
                        }));
                      }}
                    >
                      <Plus className="h-4 w-4" />
                      Add condition
                    </button>
                  </div>
                </div>
              ))}

              <button
                type="button"
                className="w-full rounded-sm border-2 border-dashed border-[var(--admin-outline)] p-3 text-center text-sm text-[var(--admin-on-surface-variant)] transition-colors hover:bg-[var(--admin-surface-high)] hover:text-[var(--admin-on-surface)]"
                onClick={() => {
                  setConditions((prev) => ({
                    ...prev,
                    groups: [
                      ...prev.groups,
                      {
                        id: newGroupId(),
                        combinator: "and",
                        conditions: [
                          {
                            id: newConditionId(),
                            fieldSource: "learner",
                            fieldKey: "status",
                            operator: "is",
                            value: "ACTIVE",
                          },
                        ],
                      },
                    ],
                  }));
                }}
              >
                + Add Condition Group
              </button>
            </section>

            <section className="space-y-4 border-t border-[var(--admin-border)] pt-4">
              <h2 className="text-base font-semibold text-[var(--admin-on-surface)]">
                Refresh Mode
              </h2>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <label
                  className={`flex cursor-pointer items-start gap-3 rounded-sm border p-4 transition-colors ${
                    refreshMode === "live"
                      ? "border-[var(--admin-primary)] bg-[color-mix(in_srgb,var(--admin-primary)_8%,var(--admin-surface))]"
                      : "border-[var(--admin-border)] bg-[var(--admin-surface)] hover:bg-[var(--admin-surface-low)]"
                  }`}
                >
                  <input
                    type="radio"
                    className="mt-1"
                    checked={refreshMode === "live"}
                    onChange={() => {
                      setRefreshMode("live");
                    }}
                  />
                  <div>
                    <div className="text-sm font-semibold text-[var(--admin-on-surface)]">Live</div>
                    <div className="mt-1 text-xs text-[var(--admin-on-surface-variant)]">
                      Learners are added or removed dynamically as their data changes.
                    </div>
                  </div>
                </label>
                <label
                  className={`flex cursor-pointer items-start gap-3 rounded-sm border p-4 transition-colors ${
                    refreshMode === "snapshot"
                      ? "border-[var(--admin-primary)] bg-[color-mix(in_srgb,var(--admin-primary)_8%,var(--admin-surface))]"
                      : "border-[var(--admin-border)] bg-[var(--admin-surface)] hover:bg-[var(--admin-surface-low)]"
                  }`}
                >
                  <input
                    type="radio"
                    className="mt-1"
                    checked={refreshMode === "snapshot"}
                    onChange={() => {
                      setRefreshMode("snapshot");
                    }}
                  />
                  <div>
                    <div className="text-sm font-semibold text-[var(--admin-on-surface)]">
                      Snapshot
                    </div>
                    <div className="mt-1 text-xs text-[var(--admin-on-surface-variant)]">
                      Learners matching conditions right now are locked in permanently.
                    </div>
                  </div>
                </label>
              </div>
            </section>
          </div>

          <div className="mt-auto flex justify-end gap-3 border-t border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-4">
            <Link href="/admin/reports/custom-field/segments" className={ghostButtonClassName}>
              Cancel
            </Link>
            <button
              type="button"
              className={`${primaryButtonClassName} ${
                !canSave || saving ? "cursor-not-allowed opacity-50" : ""
              }`}
              disabled={!canSave || saving}
              onClick={() => void onSave()}
            >
              {saving ? "Saving…" : "Save Segment"}
            </button>
          </div>
        </div>

        <ResultsRail
          matchedCount={matchedCount}
          incomplete={incomplete}
          incompleteMessage={incompleteMessage}
          learners={learners}
          loading={previewLoading}
        />
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-[var(--admin-border)] bg-[var(--admin-surface)] p-3 lg:hidden">
        <div className="mx-auto flex max-w-max-width items-center justify-between gap-3">
          <div>
            <div className="font-mono text-[10px] uppercase text-[var(--admin-on-surface-variant)]">
              Learners match
            </div>
            <div className="font-mono text-lg font-semibold text-[var(--admin-on-surface)]">
              {incomplete ? "—" : matchedCount.toLocaleString()}
            </div>
          </div>
          {incomplete ? (
            <div className="text-xs text-[var(--admin-warning)]">Finish conditions</div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
