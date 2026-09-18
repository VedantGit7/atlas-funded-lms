"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { z } from "zod";
import {
  AlertCircle,
  AlertTriangle,
  Award,
  Check,
  ChevronRight,
  Plus,
  Send,
  X,
} from "lucide-react";
import {
  outlineButtonClassName,
  primaryButtonClassName,
} from "../../../app/admin/branding/_components/branding-admin-shared";
import { AdminConfirmDialog } from "../../../components/shells/admin/AdminConfirmDialog";
import {
  ClientApiError,
  clientApi,
  createClientUuid,
  type ClientApiMutationOptions,
} from "../../../lib/client-api";
import type { assessmentDetailSchema } from "../assessment-response-schemas";
import {
  ASSESSMENT_TYPE_CONFIG,
  DEFAULT_ASSESSMENT_TYPE,
  STATUS_CONFIG,
  STATUS_LABELS,
  badgeClassName,
  cardSectionTitleClassName,
  inputClass,
  itemDisplayTitle,
  labelClass,
  panelClassName,
  sectionHeaderClassName,
  toggleThumbClassName,
  toggleTrackClassName,
} from "../assessment-studio-shared";
import { AssessmentBuilderPreview } from "./assessment-builder-preview";

type AssessmentDetail = z.infer<typeof assessmentDetailSchema>;
type ItemOption = {
  id: string;
  itemTypeKey: string;
  contentJson: Record<string, unknown>;
};

type AssessmentBuilderProps = {
  initialAssessment: AssessmentDetail;
  availableItems: ItemOption[];
};

function formatError(error: unknown): string {
  if (error instanceof ClientApiError) return error.message;
  return "Request failed.";
}

function ToggleRow({
  label,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3">
      <span className="text-sm text-[var(--admin-on-surface)]">{label}</span>
      <span className="relative inline-flex h-[18px] w-8 shrink-0 items-center">
        <input
          type="checkbox"
          className="peer sr-only"
          checked={checked}
          disabled={disabled}
          onChange={(event) => {
            onChange(event.target.checked);
          }}
        />
        <span className={toggleTrackClassName} aria-hidden="true" />
        <span className={toggleThumbClassName} aria-hidden="true" />
      </span>
    </label>
  );
}

export function AssessmentBuilder({ initialAssessment, availableItems }: AssessmentBuilderProps) {
  const router = useRouter();
  const [assessment, setAssessment] = useState(initialAssessment);
  const [title, setTitle] = useState(assessment.title);
  const [description, setDescription] = useState(assessment.description ?? "");
  const [attemptsAllowed, setAttemptsAllowed] = useState(assessment.config.attemptsAllowed);
  const [timeLimitMinutes, setTimeLimitMinutes] = useState(
    assessment.config.timeLimitSeconds
      ? String(Math.round(assessment.config.timeLimitSeconds / 60))
      : "",
  );
  const [passMarkPercent, setPassMarkPercent] = useState(assessment.config.passMarkPercent);
  const [shuffleItems, setShuffleItems] = useState(assessment.config.shuffleItems);
  const [shuffleOptions, setShuffleOptions] = useState(assessment.config.shuffleOptions);
  const [secureMode, setSecureMode] = useState(assessment.config.secureMode);
  const [proctoringLevel, setProctoringLevel] = useState<0 | 1 | 2 | 3>(
    assessment.config.proctoringLevel,
  );
  const [showAnswersPolicy, setShowAnswersPolicy] = useState(assessment.config.showAnswersPolicy);
  const [selectedItemId, setSelectedItemId] = useState(availableItems[0]?.id ?? "");
  const [items, setItems] = useState(assessment.items);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingConfirm, setPendingConfirm] = useState<"submit" | "delete" | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);

  const editable = assessment.status === "DRAFT" || assessment.status === "REVIEW";
  const typeCfg = ASSESSMENT_TYPE_CONFIG[assessment.assessmentType] ?? DEFAULT_ASSESSMENT_TYPE;

  const nextPosition = useMemo(
    () => (items.length > 0 ? Math.max(...items.map((item) => item.position)) + 1 : 1),
    [items],
  );

  const publishChecks = [
    { label: "Title configured", passed: title.trim().length >= 2 },
    { label: "Items added", passed: items.length > 0, detail: `${String(items.length)} items` },
    { label: "Pass mark set", passed: passMarkPercent >= 0 && passMarkPercent <= 100 },
  ] as const;

  const allChecksPassed = publishChecks.every((check) => check.passed);

  function buildSavePayload() {
    return {
      title,
      description: description || null,
      config: {
        attemptsAllowed,
        ...(timeLimitMinutes.trim()
          ? { timeLimitSeconds: Number(timeLimitMinutes) * 60 }
          : { timeLimitSeconds: null }),
        passMarkPercent,
        shuffleItems,
        shuffleOptions,
        secureMode,
        proctoringLevel,
        l1ProctoringEnabled: proctoringLevel >= 1,
        showAnswersPolicy,
      },
      items: items.map((item) => ({
        itemId: item.itemId,
        position: item.position,
        points: item.points,
        required: item.required,
      })),
    };
  }

  async function persistAssessment(options?: ClientApiMutationOptions) {
    const response = await clientApi.put<{ data: AssessmentDetail }>(
      `/api/v1/assessments/${assessment.id}`,
      buildSavePayload(),
      "assessment-save",
      options,
    );
    setAssessment(response.data);
    setItems(response.data.items);
    return response.data;
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      await persistAssessment();
      router.refresh();
    } catch (err) {
      setError(formatError(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleSubmitForReview() {
    setPublishing(true);
    setConfirmError(null);
    setError(null);
    try {
      await persistAssessment({ silent: true });
      const response = await clientApi.post<{ data: { status: AssessmentDetail["status"] } }>(
        `/api/v1/assessments/${assessment.id}/publish`,
        {},
        "assessment-publish",
      );
      setAssessment((current) => ({ ...current, status: response.data.status }));
      setPendingConfirm(null);
      router.refresh();
    } catch (err) {
      const message = formatError(err);
      setConfirmError(message);
      setError(message);
    } finally {
      setPublishing(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    setConfirmError(null);
    setError(null);
    try {
      await clientApi.delete(`/api/v1/assessments/${assessment.id}`, "assessment-delete");
      router.push("/studio/assessments");
      router.refresh();
    } catch (err) {
      const message = formatError(err);
      setConfirmError(message);
      setError(message);
      setDeleting(false);
    }
  }

  function addItem() {
    if (!selectedItemId) return;
    if (items.some((item) => item.itemId === selectedItemId)) {
      setError("Item already added to assessment.");
      return;
    }

    const source = availableItems.find((item) => item.id === selectedItemId);
    if (!source) return;

    setItems((current) => [
      ...current,
      {
        id: createClientUuid(),
        itemId: source.id,
        position: nextPosition,
        points: 1,
        required: true,
        itemTypeKey: source.itemTypeKey,
        contentJson: source.contentJson,
      },
    ]);
    setError(null);
  }

  function removeItem(itemId: string) {
    setItems((current) =>
      current
        .filter((item) => item.itemId !== itemId)
        .map((item, index) => ({ ...item, position: index + 1 })),
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0">
          <nav
            aria-label="Breadcrumb"
            className="mb-1 flex flex-wrap items-center gap-1 text-xs text-[var(--admin-on-surface-variant)]"
          >
            <Link href="/studio" className="hover:text-[var(--admin-primary)]">
              Studio
            </Link>
            <ChevronRight className="h-3 w-3 shrink-0 opacity-50" aria-hidden="true" />
            <Link href="/studio/assessments" className="hover:text-[var(--admin-primary)]">
              Assessments
            </Link>
            <ChevronRight className="h-3 w-3 shrink-0 opacity-50" aria-hidden="true" />
            <span className="truncate text-[var(--admin-on-surface)]">{assessment.title}</span>
          </nav>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-[var(--admin-on-surface)] md:text-2xl">
              {assessment.title}
            </h1>
            <span className={`${badgeClassName} ${typeCfg.className}`}>{typeCfg.label}</span>
            <span
              className={`${badgeClassName} ${STATUS_CONFIG[assessment.status] ?? "bg-[var(--admin-surface-high)] text-[var(--admin-on-surface-variant)]"}`}
            >
              {STATUS_LABELS[assessment.status] ?? assessment.status}
            </span>
            {assessment.assessmentType === "readiness_review" ? (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase text-[var(--admin-warning)]">
                <Award className="h-3.5 w-3.5" aria-hidden="true" />
                Certification level
              </span>
            ) : null}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {editable ? (
            <button
              type="button"
              className="rounded-lg border border-[var(--admin-danger)] px-4 py-2 text-sm font-semibold text-[var(--admin-danger)] transition-colors hover:bg-[color-mix(in_srgb,var(--admin-danger)_8%,var(--admin-surface))] disabled:opacity-40"
              disabled={deleting}
              onClick={() => {
                setConfirmError(null);
                setPendingConfirm("delete");
              }}
            >
              Delete
            </button>
          ) : null}
          {assessment.status === "DRAFT" ? (
            <button
              type="button"
              className={outlineButtonClassName}
              disabled={publishing}
              onClick={() => {
                setConfirmError(null);
                setPendingConfirm("submit");
              }}
            >
              {publishing ? "Submitting..." : "Submit for review"}
            </button>
          ) : null}
          {editable ? (
            <button
              type="button"
              className={primaryButtonClassName}
              disabled={saving}
              onClick={() => {
                void handleSave();
              }}
            >
              {saving ? "Saving..." : "Save"}
            </button>
          ) : null}
        </div>
      </header>

      {error ? (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300"
        >
          <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
          {error}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
        <section className="space-y-4">
          <div className={panelClassName}>
            <div className={sectionHeaderClassName}>
              <h2 className={cardSectionTitleClassName}>Assessment items</h2>
              <span className="text-xs font-medium text-[var(--admin-on-surface-variant)]">
                {items.length} total
              </span>
            </div>

            {items.length === 0 ? (
              <div className="px-5 py-10 text-center text-sm text-[var(--admin-on-surface-variant)]">
                No items added yet. Select an item from the item bank below.
              </div>
            ) : (
              <ol className="divide-y divide-[var(--admin-border)]">
                {items.map((item, index) => (
                  <li
                    key={`${item.itemId}-${String(item.position)}`}
                    className="group flex items-start gap-3 p-4 transition-colors hover:bg-[var(--admin-surface-low)]"
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[var(--admin-border)] bg-[var(--admin-surface)] text-xs font-semibold text-[var(--admin-on-surface-variant)]">
                      {index + 1}
                    </span>
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded bg-[color-mix(in_srgb,var(--admin-primary-container)_55%,var(--admin-surface))] px-1.5 py-0.5 text-[10px] font-bold uppercase text-[var(--admin-primary)]">
                          {item.itemTypeKey ?? "item"}
                        </span>
                        <p className="text-sm font-medium text-[var(--admin-on-surface)]">
                          {itemDisplayTitle(item.contentJson)}
                        </p>
                      </div>
                      {editable ? (
                        <div className="flex items-center gap-2">
                          <label className="text-xs text-[var(--admin-on-surface-variant)]">
                            Points
                          </label>
                          <input
                            className={`${inputClass} w-16 py-1.5 text-center text-xs`}
                            type="number"
                            min={0}
                            value={item.points}
                            onChange={(event) => {
                              const points = Number(event.target.value);
                              setItems((current) =>
                                current.map((entry) =>
                                  entry.itemId === item.itemId ? { ...entry, points } : entry,
                                ),
                              );
                            }}
                          />
                        </div>
                      ) : (
                        <p className="text-xs text-[var(--admin-on-surface-variant)]">
                          {item.points} points
                        </p>
                      )}
                    </div>
                    {editable ? (
                      <button
                        type="button"
                        aria-label="Remove item"
                        onClick={() => {
                          removeItem(item.itemId);
                        }}
                        className="rounded-lg p-1 text-[var(--admin-on-surface-variant)] opacity-0 transition-all group-hover:opacity-100 hover:bg-destructive/10 hover:text-[var(--admin-danger)] dark:hover:bg-red-950/40"
                      >
                        <X className="h-4 w-4" aria-hidden="true" />
                      </button>
                    ) : null}
                  </li>
                ))}
              </ol>
            )}

            {editable ? (
              <div className="flex flex-col gap-3 border-t border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-4 sm:flex-row sm:items-center">
                <select
                  className={`${inputClass} min-w-0 flex-1`}
                  value={selectedItemId}
                  onChange={(event) => {
                    setSelectedItemId(event.target.value);
                  }}
                >
                  {availableItems.length === 0 ? (
                    <option value="">No items in item bank</option>
                  ) : (
                    availableItems.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.itemTypeKey} — {itemDisplayTitle(item.contentJson)}
                      </option>
                    ))
                  )}
                </select>
                <button
                  type="button"
                  className={`${primaryButtonClassName} shrink-0`}
                  disabled={!selectedItemId}
                  onClick={addItem}
                >
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  Add item
                </button>
              </div>
            ) : null}
          </div>

          <AssessmentBuilderPreview title={title} description={description} items={items} />
        </section>

        <aside className="space-y-4">
          <div className={panelClassName}>
            <div className={sectionHeaderClassName}>
              <h3 className={cardSectionTitleClassName}>Metadata</h3>
            </div>
            <div className="space-y-3 p-4">
              <div>
                <label className={labelClass} htmlFor="assessment-title">
                  Title
                </label>
                <input
                  id="assessment-title"
                  className={inputClass}
                  value={title}
                  disabled={!editable}
                  onChange={(event) => {
                    setTitle(event.target.value);
                  }}
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="assessment-description">
                  Description
                </label>
                <textarea
                  id="assessment-description"
                  className={`${inputClass} min-h-[88px] resize-none`}
                  rows={3}
                  value={description}
                  disabled={!editable}
                  onChange={(event) => {
                    setDescription(event.target.value);
                  }}
                />
              </div>
            </div>
          </div>

          <div className={panelClassName}>
            <div className={sectionHeaderClassName}>
              <h3 className={cardSectionTitleClassName}>Scoring</h3>
            </div>
            <div className="space-y-3 p-4">
              <div className="flex items-center justify-between gap-3">
                <label className="text-xs font-medium text-[var(--admin-on-surface-variant)]">
                  Pass mark
                </label>
                <div className="flex items-center gap-1">
                  <input
                    className={`${inputClass} w-14 py-1.5 text-center text-xs`}
                    type="number"
                    min={0}
                    max={100}
                    value={passMarkPercent}
                    disabled={!editable}
                    onChange={(event) => {
                      setPassMarkPercent(Number(event.target.value));
                    }}
                  />
                  <span className="text-xs text-[var(--admin-on-surface-variant)]">%</span>
                </div>
              </div>
              <div className="flex items-center justify-between gap-3">
                <label className="text-xs font-medium text-[var(--admin-on-surface-variant)]">
                  Attempts
                </label>
                <input
                  className={`${inputClass} w-14 py-1.5 text-center text-xs`}
                  type="number"
                  min={1}
                  value={attemptsAllowed}
                  disabled={!editable}
                  onChange={(event) => {
                    setAttemptsAllowed(Number(event.target.value));
                  }}
                />
              </div>
              <div className="flex items-center justify-between gap-3">
                <label className="text-xs font-medium text-[var(--admin-on-surface-variant)]">
                  Time limit
                </label>
                <div className="flex items-center gap-1">
                  <input
                    className={`${inputClass} w-14 py-1.5 text-center text-xs`}
                    type="number"
                    min={1}
                    value={timeLimitMinutes}
                    disabled={!editable}
                    placeholder="—"
                    onChange={(event) => {
                      setTimeLimitMinutes(event.target.value);
                    }}
                  />
                  <span className="text-xs text-[var(--admin-on-surface-variant)]">min</span>
                </div>
              </div>
              <div>
                <label className={labelClass} htmlFor="show-answers-policy">
                  Show answers
                </label>
                <select
                  id="show-answers-policy"
                  className={inputClass}
                  value={showAnswersPolicy}
                  disabled={!editable}
                  onChange={(event) => {
                    setShowAnswersPolicy(
                      event.target.value as AssessmentDetail["config"]["showAnswersPolicy"],
                    );
                  }}
                >
                  <option value="after_submit">Immediately after submit</option>
                  <option value="after_pass">After pass</option>
                  <option value="after_graded">After graded</option>
                  <option value="never">Never</option>
                </select>
              </div>
            </div>
          </div>

          <div className={panelClassName}>
            <div className={sectionHeaderClassName}>
              <h3 className={cardSectionTitleClassName}>Options</h3>
            </div>
            <div className="space-y-3 p-4">
              <ToggleRow
                label="Shuffle items"
                checked={shuffleItems}
                disabled={!editable}
                onChange={setShuffleItems}
              />
              <ToggleRow
                label="Shuffle options"
                checked={shuffleOptions}
                disabled={!editable}
                onChange={setShuffleOptions}
              />
              <ToggleRow
                label="Secure mode"
                checked={secureMode}
                disabled={!editable}
                onChange={setSecureMode}
              />
              <label className="flex items-center justify-between gap-3 text-sm">
                <span className="text-[var(--admin-on-surface)]">Proctoring level</span>
                <select
                  className="rounded border border-[var(--admin-border)] bg-[var(--admin-surface)] px-2 py-1 text-sm"
                  disabled={!editable}
                  value={String(proctoringLevel)}
                  onChange={(event) => {
                    const next = Number(event.target.value);
                    if (next === 0 || next === 1 || next === 2 || next === 3) {
                      setProctoringLevel(next);
                    }
                  }}
                >
                  <option value="0">Off</option>
                  <option value="1">L1</option>
                  <option value="2">L2</option>
                  <option value="3">L3</option>
                </select>
              </label>
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border-2 border-[color-mix(in_srgb,var(--admin-primary)_20%,var(--admin-border))] bg-[var(--admin-surface)] shadow-sm">
            <div className="border-b border-[color-mix(in_srgb,var(--admin-primary)_12%,var(--admin-border))] bg-[var(--admin-surface-low)] px-4 py-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--admin-primary)]">
                Publish
              </h3>
            </div>
            <div className="space-y-3 p-4">
              {publishChecks.map((check) => (
                <div key={check.label} className="flex items-center gap-2 text-sm">
                  <Check
                    className={`h-4 w-4 shrink-0 ${check.passed ? "text-[var(--admin-success)]" : "text-[var(--admin-on-surface-variant)] opacity-40"}`}
                    aria-hidden="true"
                  />
                  <span className="text-[var(--admin-on-surface)]">
                    {check.label}
                    {"detail" in check ? (
                      <span className="text-[var(--admin-on-surface-variant)]">
                        {" "}
                        ({check.detail})
                      </span>
                    ) : null}
                  </span>
                </div>
              ))}
              {assessment.status === "DRAFT" ? (
                <button
                  type="button"
                  className={`${primaryButtonClassName} w-full`}
                  disabled={publishing || !allChecksPassed}
                  onClick={() => {
                    setConfirmError(null);
                    setPendingConfirm("submit");
                  }}
                >
                  {publishing ? "Submitting..." : "Submit for review"}
                </button>
              ) : (
                <p className="text-xs text-[var(--admin-on-surface-variant)]">
                  Status: {STATUS_LABELS[assessment.status] ?? assessment.status}
                </p>
              )}
            </div>
          </div>
        </aside>
      </div>

      <AdminConfirmDialog
        open={pendingConfirm === "submit"}
        title="Submit for review?"
        description="This moves the assessment out of draft. You can still edit it while it is in review."
        confirmLabel="Submit for review"
        busyLabel="Submitting…"
        icon={Send}
        tone="primary"
        busy={publishing}
        error={confirmError}
        onConfirm={() => {
          void handleSubmitForReview();
        }}
        onCancel={() => {
          if (publishing) return;
          setConfirmError(null);
          setPendingConfirm(null);
        }}
      />

      <AdminConfirmDialog
        open={pendingConfirm === "delete"}
        title="Delete this assessment?"
        description={
          <>
            <span className="font-medium text-[var(--admin-on-surface)]">{title}</span> will be
            permanently removed along with its item assignments.
          </>
        }
        confirmLabel="Delete assessment"
        busyLabel="Deleting…"
        icon={AlertTriangle}
        tone="danger"
        busy={deleting}
        error={confirmError}
        onConfirm={() => {
          void handleDelete();
        }}
        onCancel={() => {
          if (deleting) return;
          setConfirmError(null);
          setPendingConfirm(null);
        }}
      />
    </div>
  );
}
