"use client";

import { useState } from "react";
import { CalendarClock, Copy, Plus } from "lucide-react";
import { ClientApiError, clientApi } from "../../../lib/client-api";
import {
  alertErrorClassName,
  alertInfoClassName,
  fieldClassName,
  gamificationStatusBadgeClassName,
  labelClassName,
  panelBodyClassName,
  panelClassName,
  panelEyebrowClassName,
  panelHeaderClassName,
  primaryButtonClassName,
} from "../gamification-admin-shared";
import { GamificationAnimatedCollapsible } from "./GamificationAnimatedCollapsible";
import { GamificationSelectField } from "./GamificationSelectField";

export type SeasonalEventDto = {
  id: string;
  key: string;
  name: string;
  status: "draft" | "scheduled" | "active" | "ended";
  startsAt: string;
  endsAt: string;
  multiplier: { xpMultiplier: number; applyToStreakBonuses: boolean };
  linkedQuestIds: string[];
  linkedLeaderboardKey: string | null;
};

type QuestOption = { id: string; name: string };
type LeaderboardOption = { key: string; name: string };

type SeasonalEventsPanelProps = {
  initialEvents: SeasonalEventDto[];
  quests: QuestOption[];
  leaderboards: LeaderboardOption[];
};

type SeasonalFormState = {
  key: string;
  name: string;
  startsAt: string;
  endsAt: string;
  xpMultiplier: number;
  applyToStreakBonuses: boolean;
  linkedQuestIds: string[];
  linkedLeaderboardKey: string;
};

const EMPTY_FORM: SeasonalFormState = {
  key: "",
  name: "",
  startsAt: "",
  endsAt: "",
  xpMultiplier: 2,
  applyToStreakBonuses: true,
  linkedQuestIds: [],
  linkedLeaderboardKey: "",
};

const STATUS_BADGE: Record<SeasonalEventDto["status"], string> = {
  draft: "INACTIVE",
  scheduled: "DRAFT",
  active: "ACTIVE",
  ended: "ARCHIVED",
};

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function toLocalInput(iso: string): string {
  return iso.slice(0, 16);
}

function toIsoOrNull(value: string): string | null {
  if (!value.trim()) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function formFromEvent(event: SeasonalEventDto): SeasonalFormState {
  return {
    key: event.key,
    name: event.name,
    startsAt: toLocalInput(event.startsAt),
    endsAt: toLocalInput(event.endsAt),
    xpMultiplier: event.multiplier.xpMultiplier,
    applyToStreakBonuses: event.multiplier.applyToStreakBonuses,
    linkedQuestIds: event.linkedQuestIds,
    linkedLeaderboardKey: event.linkedLeaderboardKey ?? "",
  };
}

function SeasonalForm({
  mode,
  form,
  setForm,
  quests,
  leaderboards,
  busy,
  onSubmit,
}: {
  mode: "create" | "edit";
  form: SeasonalFormState;
  setForm: (updater: (current: SeasonalFormState) => SeasonalFormState) => void;
  quests: QuestOption[];
  leaderboards: LeaderboardOption[];
  busy: boolean;
  onSubmit: () => void;
}) {
  const invalid =
    busy ||
    !form.key.trim() ||
    !form.name.trim() ||
    !toIsoOrNull(form.startsAt) ||
    !toIsoOrNull(form.endsAt) ||
    new Date(form.endsAt) <= new Date(form.startsAt);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="block">
          <span className={labelClassName}>Key</span>
          <input
            className={`${fieldClassName} mt-1.5`}
            value={form.key}
            disabled={mode === "edit"}
            placeholder="double-xp-weekend"
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
            placeholder="Double XP Weekend"
            onChange={(e) => {
              setForm((current) => ({ ...current, name: e.target.value }));
            }}
          />
        </label>
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
        <label className="block">
          <span className={labelClassName}>XP multiplier</span>
          <input
            type="number"
            min={1}
            max={10}
            step={0.5}
            className={`${fieldClassName} mt-1.5`}
            value={form.xpMultiplier}
            onChange={(e) => {
              const xpMultiplier = Math.min(10, Math.max(1, Number(e.target.value) || 1));
              setForm((current) => ({ ...current, xpMultiplier }));
            }}
          />
        </label>
        <label className="mt-6 flex items-center gap-2 text-sm text-[var(--admin-on-surface)]">
          <input
            type="checkbox"
            checked={form.applyToStreakBonuses}
            onChange={(e) => {
              setForm((current) => ({ ...current, applyToStreakBonuses: e.target.checked }));
            }}
          />
          Also boost streak milestone bonuses
        </label>
        <GamificationSelectField
          label="Dedicated leaderboard (optional)"
          value={form.linkedLeaderboardKey}
          onChange={(linkedLeaderboardKey) => {
            setForm((current) => ({ ...current, linkedLeaderboardKey }));
          }}
          options={[
            { value: "", label: "None" },
            ...leaderboards.map((board) => ({
              value: board.key,
              label: board.name,
            })),
          ]}
        />
      </div>

      {quests.length > 0 ? (
        <fieldset>
          <legend className={labelClassName}>Linked quests</legend>
          <div className="mt-1.5 flex flex-wrap gap-3">
            {quests.map((quest) => (
              <label
                key={quest.id}
                className="flex items-center gap-2 text-sm text-[var(--admin-on-surface)]"
              >
                <input
                  type="checkbox"
                  checked={form.linkedQuestIds.includes(quest.id)}
                  onChange={(e) => {
                    setForm((current) => ({
                      ...current,
                      linkedQuestIds: e.target.checked
                        ? [...current.linkedQuestIds, quest.id]
                        : current.linkedQuestIds.filter((id) => id !== quest.id),
                    }));
                  }}
                />
                {quest.name}
              </label>
            ))}
          </div>
        </fieldset>
      ) : null}

      <button
        type="button"
        className={primaryButtonClassName}
        disabled={invalid}
        onClick={onSubmit}
      >
        {mode === "create" ? (
          <>
            <Plus className="h-4 w-4" aria-hidden="true" />
            Schedule event
          </>
        ) : (
          "Save event"
        )}
      </button>
    </div>
  );
}

export function SeasonalEventsPanel({
  initialEvents,
  quests,
  leaderboards,
}: SeasonalEventsPanelProps) {
  const [events, setEvents] = useState(initialEvents);
  const [createForm, setCreateForm] = useState<SeasonalFormState>(EMPTY_FORM);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<SeasonalFormState | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function reportError(caught: unknown, fallback: string) {
    if (caught instanceof ClientApiError) {
      setError(caught.message);
      setRequestId(caught.requestId);
    } else {
      setError(fallback);
    }
  }

  function upsert(event: SeasonalEventDto) {
    setEvents((current) => {
      const exists = current.some((entry) => entry.id === event.id);
      return exists
        ? current.map((entry) => (entry.id === event.id ? event : entry))
        : [event, ...current];
    });
  }

  async function createEvent() {
    setMessage(null);
    setError(null);
    setBusy(true);
    try {
      const response = await clientApi.post<{ data: SeasonalEventDto }>(
        "/api/v1/seasonal-events",
        {
          operation: "create",
          event: {
            key: createForm.key.trim(),
            name: createForm.name.trim(),
            status: "scheduled",
            startsAt: toIsoOrNull(createForm.startsAt),
            endsAt: toIsoOrNull(createForm.endsAt),
            multiplier: {
              xpMultiplier: createForm.xpMultiplier,
              applyToStreakBonuses: createForm.applyToStreakBonuses,
            },
            linkedQuestIds: createForm.linkedQuestIds,
            linkedLeaderboardKey: createForm.linkedLeaderboardKey || null,
          },
        },
        `seasonal-create-${createForm.key.trim()}`,
      );
      upsert(response.data);
      setCreateForm(EMPTY_FORM);
      setMessage("Seasonal event scheduled.");
    } catch (caught) {
      reportError(caught, "Failed to create seasonal event.");
    } finally {
      setBusy(false);
    }
  }

  async function saveEvent() {
    if (!selectedId || !editForm) return;
    setMessage(null);
    setError(null);
    setBusy(true);
    try {
      const response = await clientApi.put<{ data: SeasonalEventDto }>(
        "/api/v1/seasonal-events",
        {
          id: selectedId,
          name: editForm.name.trim(),
          startsAt: toIsoOrNull(editForm.startsAt),
          endsAt: toIsoOrNull(editForm.endsAt),
          multiplier: {
            xpMultiplier: editForm.xpMultiplier,
            applyToStreakBonuses: editForm.applyToStreakBonuses,
          },
          linkedQuestIds: editForm.linkedQuestIds,
          linkedLeaderboardKey: editForm.linkedLeaderboardKey || null,
        },
        `seasonal-update-${selectedId}-${Date.now().toString()}`,
      );
      upsert(response.data);
      setMessage("Seasonal event saved.");
    } catch (caught) {
      reportError(caught, "Failed to save seasonal event.");
    } finally {
      setBusy(false);
    }
  }

  async function endEvent(event: SeasonalEventDto) {
    setMessage(null);
    setError(null);
    setBusy(true);
    try {
      const response = await clientApi.put<{ data: SeasonalEventDto }>(
        "/api/v1/seasonal-events",
        { id: event.id, status: "ended" },
        `seasonal-end-${event.id}`,
      );
      upsert(response.data);
      setMessage("Seasonal event ended.");
    } catch (caught) {
      reportError(caught, "Failed to end seasonal event.");
    } finally {
      setBusy(false);
    }
  }

  function cloneEvent(event: SeasonalEventDto) {
    setCreateForm({
      ...formFromEvent(event),
      key: `${event.key}-next`,
      name: `${event.name} (next)`,
      startsAt: "",
      endsAt: "",
    });
    setMessage("Clone prepared below — pick the new dates and schedule.");
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
            <p className={panelEyebrowClassName}>Calendar</p>
            <h2 className="font-semibold text-[var(--admin-on-surface)]">Seasonal events</h2>
          </div>
        </div>
        <div className={panelBodyClassName}>
          {events.length === 0 ? (
            <p className="text-sm text-[var(--admin-on-surface-variant)]">
              No seasonal events yet — schedule the first one below.
            </p>
          ) : (
            <ul className="divide-y divide-[var(--admin-border)]">
              {events.map((event) => (
                <li key={event.id} className="flex items-center gap-3 py-2.5">
                  <CalendarClock
                    className="h-5 w-5 shrink-0 text-[var(--admin-primary)]"
                    aria-hidden="true"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-[var(--admin-on-surface)]">
                      {event.name}
                      <span className="ml-2 text-xs font-normal text-[var(--admin-outline)]">
                        {event.key}
                      </span>
                    </p>
                    <p className="text-xs text-[var(--admin-on-surface-variant)]">
                      {new Date(event.startsAt).toLocaleString()} →{" "}
                      {new Date(event.endsAt).toLocaleString()} · ×{event.multiplier.xpMultiplier}{" "}
                      XP
                      {event.linkedLeaderboardKey ? ` · board ${event.linkedLeaderboardKey}` : ""}
                      {event.linkedQuestIds.length > 0
                        ? ` · ${String(event.linkedQuestIds.length)} quest(s)`
                        : ""}
                    </p>
                  </div>
                  <span className={gamificationStatusBadgeClassName(STATUS_BADGE[event.status])}>
                    {event.status.toUpperCase()}
                  </span>
                  <button
                    type="button"
                    className="text-xs font-semibold text-[var(--admin-primary)]"
                    onClick={() => {
                      setSelectedId(event.id);
                      setEditForm(formFromEvent(event));
                    }}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    title="Clone for next season"
                    className="text-[var(--admin-on-surface-variant)] hover:text-[var(--admin-primary)]"
                    onClick={() => {
                      cloneEvent(event);
                    }}
                  >
                    <Copy className="h-4 w-4" aria-hidden="true" />
                  </button>
                  {event.status === "active" || event.status === "scheduled" ? (
                    <button
                      type="button"
                      className="text-xs font-semibold text-[var(--admin-danger)]"
                      disabled={busy}
                      onClick={() => {
                        void endEvent(event);
                      }}
                    >
                      End
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <GamificationAnimatedCollapsible open={Boolean(selectedId && editForm)} id="seasonal-edit-panel">
        {selectedId && editForm ? (
        <section className={panelClassName}>
          <div className={panelHeaderClassName}>
            <div>
              <p className={panelEyebrowClassName}>Edit</p>
              <h2 className="font-semibold text-[var(--admin-on-surface)]">{editForm.name}</h2>
            </div>
          </div>
          <div className={panelBodyClassName}>
            <SeasonalForm
              mode="edit"
              form={editForm}
              setForm={(updater) => {
                setEditForm((current) => (current ? updater(current) : current));
              }}
              quests={quests}
              leaderboards={leaderboards}
              busy={busy}
              onSubmit={() => {
                void saveEvent();
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
            <h2 className="font-semibold text-[var(--admin-on-surface)]">New seasonal event</h2>
          </div>
        </div>
        <div className={panelBodyClassName}>
          <SeasonalForm
            mode="create"
            form={createForm}
            setForm={(updater) => {
              setCreateForm(updater);
            }}
            quests={quests}
            leaderboards={leaderboards}
            busy={busy}
            onSubmit={() => {
              void createEvent();
            }}
          />
        </div>
      </section>
    </div>
  );
}
