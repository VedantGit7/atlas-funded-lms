"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { ClientApiError, clientApi } from "../../../lib/client-api";
import {
  alertErrorClassName,
  alertInfoClassName,
  fieldClassName,
  gamificationStatusBadgeClassName,
  labelClassName,
  outlineButtonClassName,
  panelBodyClassName,
  panelClassName,
  panelEyebrowClassName,
  panelHeaderClassName,
  primaryButtonClassName,
  type GamificationEventOption,
} from "../gamification-admin-shared";
import { GamificationAnimatedCollapsible } from "./GamificationAnimatedCollapsible";
import { GamificationSelectField } from "./GamificationSelectField";
import {
  describeQuestRewards,
  describeQuestStep,
  QUEST_STEP_TYPE_LABELS,
  type QuestDto,
  type QuestStep,
} from "../quest-shared";

export type AdminQuest = QuestDto & {
  startedCount: number;
  completedCount: number;
};

type BadgeOption = { key: string; name: string };
type CourseOption = { id: string; title: string };

type QuestsAdminPanelProps = {
  initialQuests: AdminQuest[];
  badges: BadgeOption[];
  courses: CourseOption[];
  events: GamificationEventOption[];
};

type QuestFormState = {
  key: string;
  name: string;
  description: string;
  questType: "single_step" | "chain" | "time_bound";
  steps: QuestStep[];
  rewardXp: number;
  rewardBadgeKey: string;
  startsAt: string;
  endsAt: string;
  status: "ACTIVE" | "INACTIVE" | "ARCHIVED";
};

const EMPTY_FORM: QuestFormState = {
  key: "",
  name: "",
  description: "",
  questType: "single_step",
  steps: [{ type: "complete_lessons", count: 1 }],
  rewardXp: 0,
  rewardBadgeKey: "",
  startsAt: "",
  endsAt: "",
  status: "ACTIVE",
};

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function defaultStepForType(type: QuestStep["type"], events: GamificationEventOption[]): QuestStep {
  switch (type) {
    case "complete_lessons":
      return { type, count: 1 };
    case "earn_xp":
      return { type, amount: 100 };
    case "maintain_streak":
      return { type, streakKey: "daily_learning", days: 3 };
    case "earn_badge":
      return { type, badgeKey: "" };
    case "complete_assessment":
      return { type, minScorePercent: 70 };
    case "event_count":
      return {
        type,
        eventType: events[0]?.eventType ?? "lesson.completed",
        count: 1,
      };
  }
}

function formFromQuest(quest: QuestDto): QuestFormState {
  return {
    key: quest.key,
    name: quest.name,
    description: quest.description ?? "",
    questType: quest.questType as QuestFormState["questType"],
    steps: quest.criteria.steps,
    rewardXp: quest.rewards.xp ?? 0,
    rewardBadgeKey: quest.rewards.badgeKey ?? "",
    startsAt: quest.startsAt ? quest.startsAt.slice(0, 16) : "",
    endsAt: quest.endsAt ? quest.endsAt.slice(0, 16) : "",
    status: quest.status,
  };
}

function toLocalIsoOrNull(value: string): string | null {
  if (!value.trim()) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function StepEditor({
  step,
  onChange,
  onRemove,
  badges,
  courses,
  events,
}: {
  step: QuestStep;
  onChange: (step: QuestStep) => void;
  onRemove: () => void;
  badges: BadgeOption[];
  courses: CourseOption[];
  events: GamificationEventOption[];
}) {
  const activeEvents = events.filter((event) => event.status === "active");

  return (
    <div className="space-y-3 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-3">
      <div className="flex items-end gap-3">
        <div className="min-w-0 flex-1">
          <GamificationSelectField
            label="Step type"
            value={step.type}
            onChange={(value) => {
              onChange(defaultStepForType(value as QuestStep["type"], events));
            }}
            options={Object.entries(QUEST_STEP_TYPE_LABELS).map(([value, stepLabel]) => ({
              value,
              label: stepLabel,
            }))}
          />
        </div>
        <button
          type="button"
          title="Remove step"
          className="pb-2 text-[var(--admin-on-surface-variant)] hover:text-[var(--admin-danger)]"
          onClick={onRemove}
        >
          <Trash2 className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {step.type === "complete_lessons" ? (
          <>
            <label className="block">
              <span className={labelClassName}>Lessons</span>
              <input
                type="number"
                min={1}
                className={`${fieldClassName} mt-1.5`}
                value={step.count}
                onChange={(e) => {
                  onChange({ ...step, count: Math.max(1, Number(e.target.value) || 1) });
                }}
              />
            </label>
            <GamificationSelectField
              label="Course (optional)"
              value={step.courseId ?? ""}
              onChange={(courseId) => {
                onChange(
                  courseId
                    ? { ...step, courseId }
                    : { type: "complete_lessons", count: step.count },
                );
              }}
              options={[
                { value: "", label: "Any course" },
                ...courses.map((course) => ({
                  value: course.id,
                  label: course.title,
                })),
              ]}
            />
          </>
        ) : null}

        {step.type === "earn_xp" ? (
          <label className="block">
            <span className={labelClassName}>XP to earn</span>
            <input
              type="number"
              min={1}
              className={`${fieldClassName} mt-1.5`}
              value={step.amount}
              onChange={(e) => {
                onChange({ ...step, amount: Math.max(1, Number(e.target.value) || 1) });
              }}
            />
          </label>
        ) : null}

        {step.type === "maintain_streak" ? (
          <>
            <label className="block">
              <span className={labelClassName}>Streak key</span>
              <input
                className={`${fieldClassName} mt-1.5`}
                value={step.streakKey}
                onChange={(e) => {
                  onChange({ ...step, streakKey: slugify(e.target.value) });
                }}
              />
            </label>
            <label className="block">
              <span className={labelClassName}>Days</span>
              <input
                type="number"
                min={1}
                max={365}
                className={`${fieldClassName} mt-1.5`}
                value={step.days}
                onChange={(e) => {
                  onChange({
                    ...step,
                    days: Math.min(365, Math.max(1, Number(e.target.value) || 1)),
                  });
                }}
              />
            </label>
          </>
        ) : null}

        {step.type === "earn_badge" ? (
          <GamificationSelectField
            label="Badge"
            value={step.badgeKey}
            onChange={(badgeKey) => {
              onChange({ ...step, badgeKey });
            }}
            placeholder="Select a badge…"
            options={[
              { value: "", label: "Select a badge…" },
              ...badges.map((badge) => ({
                value: badge.key,
                label: badge.name,
              })),
            ]}
          />
        ) : null}

        {step.type === "complete_assessment" ? (
          <label className="block">
            <span className={labelClassName}>Minimum score %</span>
            <input
              type="number"
              min={0}
              max={100}
              className={`${fieldClassName} mt-1.5`}
              value={step.minScorePercent}
              onChange={(e) => {
                onChange({
                  ...step,
                  minScorePercent: Math.min(100, Math.max(0, Number(e.target.value) || 0)),
                });
              }}
            />
          </label>
        ) : null}

        {step.type === "event_count" ? (
          <>
            <GamificationSelectField
              label="Activity"
              value={step.eventType}
              onChange={(eventType) => {
                onChange({ ...step, eventType });
              }}
              options={activeEvents.map((event) => ({
                value: event.eventType,
                label: event.label,
              }))}
            />
            <label className="block">
              <span className={labelClassName}>Times</span>
              <input
                type="number"
                min={1}
                className={`${fieldClassName} mt-1.5`}
                value={step.count}
                onChange={(e) => {
                  onChange({ ...step, count: Math.max(1, Number(e.target.value) || 1) });
                }}
              />
            </label>
          </>
        ) : null}
      </div>
    </div>
  );
}

function QuestForm({
  mode,
  form,
  setForm,
  badges,
  courses,
  events,
  busy,
  onSubmit,
}: {
  mode: "create" | "edit";
  form: QuestFormState;
  setForm: (updater: (current: QuestFormState) => QuestFormState) => void;
  badges: BadgeOption[];
  courses: CourseOption[];
  events: GamificationEventOption[];
  busy: boolean;
  onSubmit: () => void;
}) {
  const stepsInvalid =
    form.steps.length === 0 ||
    form.steps.some((step) => step.type === "earn_badge" && !step.badgeKey);
  const invalid = busy || !form.key.trim() || !form.name.trim() || stepsInvalid;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="block">
          <span className={labelClassName}>Key</span>
          <input
            className={`${fieldClassName} mt-1.5`}
            value={form.key}
            disabled={mode === "edit"}
            placeholder="first-week-mission"
            onChange={(e) => {
              const key = slugify(e.target.value);
              setForm((current) => ({ ...current, key }));
            }}
          />
        </label>
        <label className="block">
          <span className={labelClassName}>Name</span>
          <input
            className={`${fieldClassName} mt-1.5`}
            value={form.name}
            placeholder="First Week Mission"
            onChange={(e) => {
              setForm((current) => ({ ...current, name: e.target.value }));
            }}
          />
        </label>
        <label className="block sm:col-span-2">
          <span className={labelClassName}>Description</span>
          <input
            className={`${fieldClassName} mt-1.5`}
            value={form.description}
            placeholder="Shown to learners on their quest list"
            onChange={(e) => {
              setForm((current) => ({ ...current, description: e.target.value }));
            }}
          />
        </label>
        <GamificationSelectField
          label="Quest type"
          value={form.questType}
          onChange={(value) => {
            setForm((current) => ({
              ...current,
              questType: value as QuestFormState["questType"],
            }));
          }}
          options={[
            { value: "single_step", label: "Standard (steps in any order)" },
            { value: "chain", label: "Chain (steps in order)" },
            { value: "time_bound", label: "Time-bound" },
          ]}
        />
        <GamificationSelectField
          label="Status"
          value={form.status}
          onChange={(value) => {
            setForm((current) => ({
              ...current,
              status: value as QuestFormState["status"],
            }));
          }}
          options={[
            { value: "ACTIVE", label: "ACTIVE" },
            { value: "INACTIVE", label: "INACTIVE" },
            { value: "ARCHIVED", label: "ARCHIVED" },
          ]}
        />
        {form.questType === "time_bound" ? (
          <>
            <label className="block">
              <span className={labelClassName}>Starts</span>
              <input
                type="datetime-local"
                className={`${fieldClassName} mt-1.5`}
                value={form.startsAt}
                onChange={(e) => {
                  setForm((current) => ({ ...current, startsAt: e.target.value }));
                }}
              />
            </label>
            <label className="block">
              <span className={labelClassName}>Ends</span>
              <input
                type="datetime-local"
                className={`${fieldClassName} mt-1.5`}
                value={form.endsAt}
                onChange={(e) => {
                  setForm((current) => ({ ...current, endsAt: e.target.value }));
                }}
              />
            </label>
          </>
        ) : null}
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <span className={labelClassName}>Steps</span>
          <button
            type="button"
            className={outlineButtonClassName}
            onClick={() => {
              setForm((current) => ({
                ...current,
                steps: [...current.steps, defaultStepForType("complete_lessons", events)],
              }));
            }}
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Add step
          </button>
        </div>
        <div className="space-y-3">
          {form.steps.map((step, index) => (
            <StepEditor
              key={index}
              step={step}
              badges={badges}
              courses={courses}
              events={events}
              onChange={(next) => {
                setForm((current) => ({
                  ...current,
                  steps: current.steps.map((entry, i) => (i === index ? next : entry)),
                }));
              }}
              onRemove={() => {
                setForm((current) => ({
                  ...current,
                  steps: current.steps.filter((_, i) => i !== index),
                }));
              }}
            />
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="block">
          <span className={labelClassName}>Reward XP</span>
          <input
            type="number"
            min={0}
            className={`${fieldClassName} mt-1.5`}
            value={form.rewardXp}
            onChange={(e) => {
              setForm((current) => ({
                ...current,
                rewardXp: Math.max(0, Number(e.target.value) || 0),
              }));
            }}
          />
        </label>
        <GamificationSelectField
          label="Reward badge (optional)"
          value={form.rewardBadgeKey}
          onChange={(rewardBadgeKey) => {
            setForm((current) => ({ ...current, rewardBadgeKey }));
          }}
          options={[
            { value: "", label: "No badge" },
            ...badges.map((badge) => ({
              value: badge.key,
              label: badge.name,
            })),
          ]}
        />
      </div>

      <button
        type="button"
        className={primaryButtonClassName}
        disabled={invalid}
        onClick={onSubmit}
      >
        {mode === "create" ? (
          <>
            <Plus className="h-4 w-4" aria-hidden="true" />
            Create quest
          </>
        ) : (
          "Save quest"
        )}
      </button>
    </div>
  );
}

export function QuestsAdminPanel({
  initialQuests,
  badges,
  courses,
  events,
}: QuestsAdminPanelProps) {
  const [quests, setQuests] = useState(initialQuests);
  const [createForm, setCreateForm] = useState<QuestFormState>(EMPTY_FORM);
  const [selectedQuestId, setSelectedQuestId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<QuestFormState | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function buildPayload(form: QuestFormState) {
    return {
      name: form.name.trim(),
      description: form.description.trim() || null,
      questType: form.questType,
      criteria: { steps: form.steps },
      rewards: {
        ...(form.rewardXp > 0 ? { xp: form.rewardXp } : {}),
        ...(form.rewardBadgeKey ? { badgeKey: form.rewardBadgeKey } : {}),
      },
      startsAt: toLocalIsoOrNull(form.startsAt),
      endsAt: toLocalIsoOrNull(form.endsAt),
      status: form.status,
    };
  }

  function reportError(caught: unknown, fallback: string) {
    if (caught instanceof ClientApiError) {
      setError(caught.message);
      setRequestId(caught.requestId);
    } else {
      setError(fallback);
    }
  }

  async function createQuest() {
    setMessage(null);
    setError(null);
    setBusy(true);
    try {
      const response = await clientApi.post<{ data: QuestDto }>(
        "/api/v1/quests",
        {
          operation: "create",
          quest: { key: createForm.key.trim(), ...buildPayload(createForm) },
        },
        `quest-create-${createForm.key.trim()}`,
      );
      setQuests((current) => [
        ...current,
        { ...response.data, startedCount: 0, completedCount: 0 },
      ]);
      setCreateForm(EMPTY_FORM);
      setMessage("Quest created.");
    } catch (caught) {
      reportError(caught, "Failed to create quest.");
    } finally {
      setBusy(false);
    }
  }

  async function saveQuest() {
    if (!selectedQuestId || !editForm) return;
    setMessage(null);
    setError(null);
    setBusy(true);
    try {
      const response = await clientApi.put<{ data: QuestDto }>(
        "/api/v1/quests",
        { id: selectedQuestId, ...buildPayload(editForm) },
        `quest-update-${selectedQuestId}-${Date.now().toString()}`,
      );
      setQuests((current) =>
        current.map((quest) =>
          quest.id === selectedQuestId ? { ...quest, ...response.data } : quest,
        ),
      );
      setMessage("Quest saved.");
    } catch (caught) {
      reportError(caught, "Failed to save quest.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      {message ? (
        <p className={alertInfoClassName} role="status">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className={alertErrorClassName} role="alert">
          {error}
          {requestId ? ` (Request ID: ${requestId})` : null}
        </p>
      ) : null}

      <section className={panelClassName}>
        <div className={panelHeaderClassName}>
          <div>
            <p className={panelEyebrowClassName}>Catalogue</p>
            <h2 className="font-semibold text-[var(--admin-on-surface)]">Quests</h2>
          </div>
        </div>
        <div className={panelBodyClassName}>
          {quests.length === 0 ? (
            <p className="text-sm text-[var(--admin-on-surface-variant)]">
              No quests yet — create the first mission below.
            </p>
          ) : (
            <ul className="divide-y divide-[var(--admin-border)]">
              {quests.map((quest) => (
                <li key={quest.id} className="flex items-center gap-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-[var(--admin-on-surface)]">
                      {quest.name}
                      <span className="ml-2 text-xs font-normal text-[var(--admin-on-surface-variant)]">
                        {quest.key}
                      </span>
                    </p>
                    <p className="text-xs text-[var(--admin-on-surface-variant)]">
                      {quest.criteria.steps.map((step) => describeQuestStep(step)).join(" · ")} →{" "}
                      {describeQuestRewards(quest.rewards)}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs text-[var(--admin-on-surface-variant)]">
                    {quest.startedCount} started · {quest.completedCount} completed
                  </span>
                  <span className={gamificationStatusBadgeClassName(quest.status)}>
                    {quest.status}
                  </span>
                  <button
                    type="button"
                    className="text-xs font-semibold text-[var(--admin-primary)]"
                    onClick={() => {
                      setSelectedQuestId(quest.id);
                      setEditForm(formFromQuest(quest));
                    }}
                  >
                    Edit
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <GamificationAnimatedCollapsible
        open={Boolean(selectedQuestId && editForm)}
        id="quest-edit-panel"
      >
        {selectedQuestId && editForm ? (
          <section className={panelClassName}>
            <div className={panelHeaderClassName}>
              <div>
                <p className={panelEyebrowClassName}>Edit</p>
                <h2 className="font-semibold text-[var(--admin-on-surface)]">{editForm.name}</h2>
              </div>
            </div>
            <div className={panelBodyClassName}>
              <QuestForm
                mode="edit"
                form={editForm}
                setForm={(updater) => {
                  setEditForm((current) => (current ? updater(current) : current));
                }}
                badges={badges}
                courses={courses}
                events={events}
                busy={busy}
                onSubmit={() => {
                  void saveQuest();
                }}
              />
            </div>
          </section>
        ) : null}
      </GamificationAnimatedCollapsible>

      <section className={panelClassName}>
        <div className={panelHeaderClassName}>
          <div>
            <p className={panelEyebrowClassName}>Create</p>
            <h2 className="font-semibold text-[var(--admin-on-surface)]">New quest</h2>
          </div>
        </div>
        <div className={panelBodyClassName}>
          <QuestForm
            mode="create"
            form={createForm}
            setForm={(updater) => {
              setCreateForm(updater);
            }}
            badges={badges}
            courses={courses}
            events={events}
            busy={busy}
            onSubmit={() => {
              void createQuest();
            }}
          />
        </div>
      </section>
    </div>
  );
}
