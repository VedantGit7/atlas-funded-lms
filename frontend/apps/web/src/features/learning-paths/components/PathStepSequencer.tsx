"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronUp, ListOrdered, PlusCircle, Save, Trash2 } from "lucide-react";
import { primaryButtonClassName } from "../../../app/admin/branding/_components/branding-admin-shared";
import {
  resourcesForStepType,
  useLearningPathStepResources,
} from "../hooks/use-learning-path-step-resources";
import {
  createStepId,
  defaultGatesForPosition,
  moveStep,
  normalizeStepPositions,
  resourceLabel,
  type PathStepDraft,
  type PathStepType,
} from "../learning-path-step-utils";
import {
  STEP_TYPE_CONFIG,
  badgeClassName,
  cardSectionTitleClassName,
  inputClass,
  insetFormInnerClassName,
  insetFormShellClassName,
  labelClass,
  panelClassName,
  sectionHeaderClassName,
  secondaryButtonClassName,
} from "../learning-path-studio-shared";
import { PathGateEditor } from "./PathGateEditor";
import { PathGateEditorForm } from "./PathGateEditorForm";
import { PathStepResourcePicker } from "./PathStepResourcePicker";

type PathStepSequencerProps = {
  pathId: string;
  steps: PathStepDraft[];
  onSaveSteps: (steps: PathStepDraft[]) => Promise<void>;
  busy?: boolean;
};

const STEP_TYPE_OPTIONS = [
  { value: "course" as const, label: "Course" },
  { value: "assessment" as const, label: "Assessment" },
  { value: "path" as const, label: "Path" },
];

const stepTypeSegmentGroupClassName =
  "grid grid-cols-3 gap-1 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-1";

const stepTypeSegmentButtonBase =
  "flex flex-col items-center gap-1 rounded-lg px-1 py-2.5 text-[11px] font-semibold transition-[background-color,color,box-shadow] duration-200 motion-safe:active:scale-[0.98]";

function stepTypeSegmentButtonClassName(isSelected: boolean): string {
  if (isSelected) {
    return `${stepTypeSegmentButtonBase} bg-[var(--admin-surface)] text-[var(--admin-primary)] shadow-sm`;
  }
  return `${stepTypeSegmentButtonBase} text-[var(--admin-on-surface-variant)] hover:bg-[var(--admin-surface-high)]`;
}

function stepsEqual(left: PathStepDraft[], right: PathStepDraft[]): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function PathStepSequencer({
  pathId,
  steps: initialSteps,
  onSaveSteps,
  busy = false,
}: PathStepSequencerProps) {
  const [steps, setSteps] = useState(initialSteps);
  const [expandedStepId, setExpandedStepId] = useState<string | null>(null);
  const [newStepTitle, setNewStepTitle] = useState("");
  const [newStepType, setNewStepType] = useState<PathStepType>("course");
  const [newStepRefId, setNewStepRefId] = useState("");
  const [saving, setSaving] = useState(false);

  const {
    courses,
    assessments,
    paths,
    loading: resourcesLoading,
    error: resourcesError,
  } = useLearningPathStepResources(pathId);

  const resources = useMemo(() => ({ courses, assessments, paths }), [courses, assessments, paths]);

  useEffect(() => {
    setSteps(initialSteps);
  }, [initialSteps]);

  const isDirty = !stepsEqual(steps, initialSteps);
  const pending = busy || saving;

  function updateStep(stepId: string, patch: Partial<PathStepDraft>) {
    setSteps((current) =>
      current.map((step) => (step.id === stepId ? { ...step, ...patch } : step)),
    );
  }

  function removeStep(stepId: string) {
    setSteps((current) => normalizeStepPositions(current.filter((step) => step.id !== stepId)));
    if (expandedStepId === stepId) {
      setExpandedStepId(null);
    }
  }

  function reorderStep(stepId: string, direction: "up" | "down") {
    setSteps((current) => moveStep(current, stepId, direction));
  }

  function addStep() {
    const title = newStepTitle.trim();
    if (!title) return;

    const refId = newStepRefId.trim();
    const nextStep: PathStepDraft = {
      id: createStepId(),
      stepType: newStepType,
      refId: refId.length > 0 ? refId : null,
      title,
      position: steps.length + 1,
      gates: defaultGatesForPosition(steps.length + 1),
    };

    setSteps((current) => normalizeStepPositions([...current, nextStep]));
    setExpandedStepId(nextStep.id);
    setNewStepTitle("");
    setNewStepRefId("");
  }

  async function handleSave() {
    const normalized = normalizeStepPositions(steps);
    setSaving(true);
    try {
      await onSaveSteps(normalized);
      setSteps(normalized);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={panelClassName}>
      <div className={sectionHeaderClassName}>
        <h2 className={cardSectionTitleClassName}>Steps</h2>
        <div className="flex items-center gap-2">
          {isDirty ? (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:bg-amber-950/50 dark:text-amber-300">
              Unsaved
            </span>
          ) : null}
          <span className="rounded-full bg-[color-mix(in_srgb,var(--admin-primary-container)_55%,var(--admin-surface))] px-2 py-0.5 text-[10px] font-bold text-[var(--admin-primary)]">
            {steps.length}
          </span>
        </div>
      </div>

      <div className="flex min-h-0 flex-col">
        {resourcesError ? (
          <p
            role="alert"
            className="mx-5 mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300"
          >
            {resourcesError}
          </p>
        ) : null}

        <div className="p-5">
          {steps.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--admin-surface-high)]">
                <ListOrdered
                  className="h-5 w-5 text-[var(--admin-on-surface-variant)]"
                  aria-hidden="true"
                />
              </div>
              <div>
                <p className="text-sm font-semibold text-[var(--admin-on-surface)]">
                  No steps configured
                </p>
                <p className="mt-0.5 max-w-sm text-xs text-[var(--admin-on-surface-variant)]">
                  Add steps below to define the sequence learners follow on this path.
                </p>
              </div>
            </div>
          ) : (
            <ol className="space-y-3">
              {steps.map((step, index) => {
                const isExpanded = expandedStepId === step.id;
                const stepResources = resourcesForStepType(step.stepType, resources);
                const linkedTitle = resourceLabel(stepResources, step.refId);

                return (
                  <li
                    key={step.id}
                    className="rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface-low)] shadow-sm transition-[border-color,box-shadow] duration-200 hover:border-[color-mix(in_srgb,var(--admin-primary)_22%,var(--admin-border))] hover:shadow-md"
                  >
                    <div className="p-4">
                      <div className="flex items-start gap-3">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--admin-primary)] text-xs font-bold text-[var(--admin-on-primary)]">
                          {step.position}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-[var(--admin-on-surface)]">
                                {step.title}
                              </p>
                              {linkedTitle ? (
                                <p className="mt-0.5 text-xs text-[var(--admin-on-surface-variant)]">
                                  {linkedTitle}
                                </p>
                              ) : step.refId ? (
                                <p className="mt-0.5 font-mono text-[11px] text-[var(--admin-on-surface-variant)]">
                                  {step.refId}
                                </p>
                              ) : (
                                <p className="mt-0.5 text-[11px] italic text-amber-600 dark:text-amber-400">
                                  No resource linked
                                </p>
                              )}
                            </div>
                            <div className="flex flex-wrap items-center gap-1">
                              <span
                                className={`${badgeClassName} ${STEP_TYPE_CONFIG[step.stepType] ?? "bg-[var(--admin-surface-high)] text-[var(--admin-on-surface-variant)]"}`}
                              >
                                {step.stepType}
                              </span>
                              <button
                                type="button"
                                aria-label={`Move step ${step.title} up`}
                                disabled={pending || index === 0}
                                onClick={() => {
                                  reorderStep(step.id, "up");
                                }}
                                className="rounded-lg p-1 text-[var(--admin-on-surface-variant)] transition-colors hover:bg-[var(--admin-surface-high)] disabled:opacity-30"
                              >
                                <ChevronUp className="h-4 w-4" aria-hidden="true" />
                              </button>
                              <button
                                type="button"
                                aria-label={`Move step ${step.title} down`}
                                disabled={pending || index === steps.length - 1}
                                onClick={() => {
                                  reorderStep(step.id, "down");
                                }}
                                className="rounded-lg p-1 text-[var(--admin-on-surface-variant)] transition-colors hover:bg-[var(--admin-surface-high)] disabled:opacity-30"
                              >
                                <ChevronDown className="h-4 w-4" aria-hidden="true" />
                              </button>
                              <button
                                type="button"
                                aria-expanded={isExpanded}
                                aria-label={isExpanded ? "Collapse step editor" : "Edit step"}
                                disabled={pending}
                                onClick={() => {
                                  setExpandedStepId(isExpanded ? null : step.id);
                                }}
                                className={`${secondaryButtonClassName} px-2 py-1 text-xs`}
                              >
                                {isExpanded ? "Close" : "Edit"}
                              </button>
                              <button
                                type="button"
                                aria-label={`Remove step ${step.title}`}
                                disabled={pending}
                                onClick={() => {
                                  removeStep(step.id);
                                }}
                                className="rounded-lg p-1 text-[var(--admin-on-surface-variant)] transition-colors hover:bg-destructive/10 hover:text-destructive-text disabled:opacity-40 dark:hover:bg-red-950/40 dark:hover:text-red-400"
                              >
                                <Trash2 className="h-4 w-4" aria-hidden="true" />
                              </button>
                            </div>
                          </div>
                          {!isExpanded ? <PathGateEditor gates={step.gates} /> : null}
                        </div>
                      </div>

                      {isExpanded ? (
                        <div className="mt-4 space-y-4 border-t border-[var(--admin-border)] pt-4 pl-10">
                          <div>
                            <label className={labelClass} htmlFor={`step-title-${step.id}`}>
                              Title
                            </label>
                            <input
                              id={`step-title-${step.id}`}
                              value={step.title}
                              disabled={pending}
                              onChange={(event) => {
                                updateStep(step.id, { title: event.target.value });
                              }}
                              className={inputClass}
                            />
                          </div>

                          <div>
                            <span className={labelClass}>Step type</span>
                            <div
                              className={stepTypeSegmentGroupClassName}
                              role="group"
                              aria-label="Step type"
                            >
                              {STEP_TYPE_OPTIONS.map((option) => {
                                const isSelected = step.stepType === option.value;
                                return (
                                  <button
                                    key={option.value}
                                    type="button"
                                    aria-pressed={isSelected}
                                    disabled={pending}
                                    onClick={() => {
                                      updateStep(step.id, {
                                        stepType: option.value,
                                        refId: null,
                                      });
                                    }}
                                    className={stepTypeSegmentButtonClassName(isSelected)}
                                  >
                                    {option.label}
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          <PathStepResourcePicker
                            stepType={step.stepType}
                            value={step.refId ?? ""}
                            options={stepResources}
                            loading={resourcesLoading}
                            disabled={pending}
                            onChange={(refId) => {
                              updateStep(step.id, { refId: refId.length > 0 ? refId : null });
                            }}
                          />

                          <PathGateEditorForm
                            gates={step.gates}
                            disabled={pending}
                            onChange={(gates) => {
                              updateStep(step.id, { gates });
                            }}
                          />
                        </div>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}

          {isDirty ? (
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  void handleSave();
                }}
                className={`${primaryButtonClassName} px-4 py-2`}
              >
                <Save className="h-4 w-4" aria-hidden="true" />
                {saving ? "Saving steps..." : "Save steps"}
              </button>
            </div>
          ) : null}
        </div>

        <div className={insetFormShellClassName}>
          <div className={insetFormInnerClassName}>
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-[var(--admin-on-surface-variant)]">
              Add step
            </p>
            <div className="space-y-3">
              <div>
                <label className={labelClass} htmlFor="new-step-title">
                  Title
                </label>
                <input
                  id="new-step-title"
                  value={newStepTitle}
                  disabled={pending}
                  onChange={(event) => {
                    setNewStepTitle(event.target.value);
                  }}
                  className={inputClass}
                  placeholder="e.g. Foundations module"
                />
              </div>
              <div>
                <span className={labelClass}>Step type</span>
                <div className={stepTypeSegmentGroupClassName} role="group" aria-label="Step type">
                  {STEP_TYPE_OPTIONS.map((option) => {
                    const isSelected = newStepType === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        aria-pressed={isSelected}
                        disabled={pending}
                        onClick={() => {
                          setNewStepType(option.value);
                          setNewStepRefId("");
                        }}
                        className={stepTypeSegmentButtonClassName(isSelected)}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <PathStepResourcePicker
                stepType={newStepType}
                value={newStepRefId}
                options={resourcesForStepType(newStepType, resources)}
                loading={resourcesLoading}
                disabled={pending}
                onChange={setNewStepRefId}
              />
              <button
                type="button"
                disabled={pending || !newStepTitle.trim()}
                onClick={addStep}
                className={`${primaryButtonClassName} w-full justify-center py-2.5`}
              >
                <PlusCircle className="h-4 w-4" aria-hidden="true" />
                Add step
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
