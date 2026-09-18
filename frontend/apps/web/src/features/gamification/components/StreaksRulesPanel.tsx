"use client";

import { useState } from "react";
import { Flame, Plus, Trash2 } from "lucide-react";
import { ClientApiError, clientApi } from "../../../lib/client-api";
import {
  alertErrorClassName,
  alertInfoClassName,
  fieldClassName,
  labelClassName,
  outlineButtonClassName,
  panelBodyClassName,
  panelClassName,
  panelEyebrowClassName,
  panelHeaderClassName,
  primaryButtonClassName,
  type GamificationEventOption,
  type GamificationRules,
} from "../gamification-admin-shared";
import { GamificationSelectField } from "./GamificationSelectField";

type StreaksRulesPanelProps = {
  rules: GamificationRules;
  events: GamificationEventOption[];
  onSaved: (rules: GamificationRules) => void;
};

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function StreaksRulesPanel({ rules, events, onSaved }: StreaksRulesPanelProps) {
  const [streaks, setStreaks] = useState(rules.streaks);
  const [freezeInventory, setFreezeInventory] = useState(rules.defaultFreezeInventory);
  const [bonuses, setBonuses] = useState(rules.streakBonuses);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const activeEvents = events.filter((event) => event.status === "active");

  const hasDuplicateStreakKeys =
    new Set(streaks.map((streak) => streak.streakKey)).size !== streaks.length;
  const hasEmptyStreaks = streaks.some(
    (streak) => !streak.streakKey.trim() || streak.eventTypes.length === 0,
  );
  const hasDuplicateBonusDays = new Set(bonuses.map((bonus) => bonus.days)).size !== bonuses.length;
  const invalid = hasDuplicateStreakKeys || hasEmptyStreaks || hasDuplicateBonusDays;

  async function save() {
    setMessage(null);
    setError(null);
    setRequestId(null);
    setBusy(true);
    try {
      const response = await clientApi.put<{ data: GamificationRules }>(
        "/api/v1/gamification/rules",
        {
          streaks: streaks.map((streak) => ({
            streakKey: streak.streakKey.trim(),
            eventTypes: streak.eventTypes,
            cadence: streak.cadence ?? "daily",
          })),
          defaultFreezeInventory: freezeInventory,
          streakBonuses: bonuses,
        },
        `gamification-rules-streaks-${Date.now().toString()}`,
      );
      onSaved(response.data);
      setStreaks(
        response.data.streaks.map((streak) => ({
          ...streak,
          cadence: streak.cadence ?? "daily",
        })),
      );
      setFreezeInventory(response.data.defaultFreezeInventory);
      setBonuses(response.data.streakBonuses);
      setMessage("Streak rules saved.");
    } catch (caught) {
      if (caught instanceof ClientApiError) {
        setError(caught.message);
        setRequestId(caught.requestId);
      } else {
        setError("Failed to save streak rules.");
      }
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
            <p className={panelEyebrowClassName}>Definitions</p>
            <h2 className="font-semibold text-[var(--admin-on-surface)]">Streaks</h2>
          </div>
          <button
            type="button"
            className={outlineButtonClassName}
            onClick={() => {
              setStreaks((current) => [
                ...current,
                {
                  streakKey: `streak-${String(current.length + 1)}`,
                  eventTypes: activeEvents[0]?.eventType ? [activeEvents[0].eventType] : [],
                  cadence: "daily" as const,
                },
              ]);
            }}
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Add streak
          </button>
        </div>
        <div className={`${panelBodyClassName} space-y-3`}>
          <p className="text-xs text-[var(--admin-on-surface-variant)]">
            Streaks count consecutive tenant-local days or weeks with at least one qualifying
            activity, depending on cadence.
          </p>
          {streaks.map((streak, index) => (
            <div
              key={index}
              className="space-y-3 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-3"
            >
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_160px_auto] sm:items-end">
                <label className="block">
                  <span className={labelClassName}>Streak key</span>
                  <input
                    className={`${fieldClassName} mt-1.5`}
                    value={streak.streakKey}
                    onChange={(e) => {
                      const streakKey = slugify(e.target.value);
                      setStreaks((current) =>
                        current.map((entry, i) => (i === index ? { ...entry, streakKey } : entry)),
                      );
                    }}
                  />
                </label>
                <GamificationSelectField
                  label="Cadence"
                  value={streak.cadence ?? "daily"}
                  onChange={(cadence) => {
                    setStreaks((current) =>
                      current.map((entry, i) =>
                        i === index ? { ...entry, cadence: cadence as "daily" | "weekly" } : entry,
                      ),
                    );
                  }}
                  options={[
                    { value: "daily", label: "Daily" },
                    { value: "weekly", label: "Weekly" },
                  ]}
                />
                <button
                  type="button"
                  title="Remove streak"
                  className="pb-2 text-[var(--admin-on-surface-variant)] hover:text-[var(--admin-danger)]"
                  onClick={() => {
                    setStreaks((current) => current.filter((_, i) => i !== index));
                  }}
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
              <fieldset>
                <legend className={labelClassName}>Qualifying activities</legend>
                <div className="mt-1.5 flex flex-wrap gap-3">
                  {activeEvents.map((event) => (
                    <label
                      key={event.eventType}
                      className="flex items-center gap-2 text-sm text-[var(--admin-on-surface)]"
                    >
                      <input
                        type="checkbox"
                        checked={streak.eventTypes.includes(event.eventType)}
                        onChange={(e) => {
                          setStreaks((current) =>
                            current.map((entry, i) => {
                              if (i !== index) return entry;
                              const eventTypes = e.target.checked
                                ? [...entry.eventTypes, event.eventType]
                                : entry.eventTypes.filter((type) => type !== event.eventType);
                              return { ...entry, eventTypes };
                            }),
                          );
                        }}
                      />
                      {event.label}
                    </label>
                  ))}
                </div>
              </fieldset>
            </div>
          ))}
          {hasDuplicateStreakKeys ? (
            <p className="text-sm text-[var(--admin-danger)]">Streak keys must be unique.</p>
          ) : null}
          {hasEmptyStreaks ? (
            <p className="text-sm text-[var(--admin-danger)]">
              Every streak needs a key and at least one qualifying activity.
            </p>
          ) : null}
        </div>
      </section>

      <section className={panelClassName}>
        <div className={panelHeaderClassName}>
          <div>
            <p className={panelEyebrowClassName}>Recovery</p>
            <h2 className="font-semibold text-[var(--admin-on-surface)]">Streak freezes</h2>
          </div>
        </div>
        <div className={panelBodyClassName}>
          <label className="block sm:max-w-xs">
            <span className={labelClassName}>Default freeze inventory per streak</span>
            <input
              type="number"
              min={0}
              max={10}
              className={`${fieldClassName} mt-1.5`}
              value={freezeInventory}
              onChange={(e) => {
                setFreezeInventory(Math.min(10, Math.max(0, Number(e.target.value) || 0)));
              }}
            />
          </label>
          <p className="mt-2 text-xs text-[var(--admin-on-surface-variant)]">
            Freezes let learners repair a single missed day. Granted when their profile is created.
          </p>
        </div>
      </section>

      <section className={panelClassName}>
        <div className={panelHeaderClassName}>
          <div>
            <p className={panelEyebrowClassName}>Rewards</p>
            <h2 className="font-semibold text-[var(--admin-on-surface)]">Milestone bonuses</h2>
          </div>
          <button
            type="button"
            className={outlineButtonClassName}
            onClick={() => {
              const lastDays = bonuses[bonuses.length - 1]?.days ?? 0;
              setBonuses((current) => [
                ...current,
                { days: Math.min(365, lastDays + 7 || 7), bonusXp: 100 },
              ]);
            }}
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Add bonus
          </button>
        </div>
        <div className={`${panelBodyClassName} space-y-3`}>
          <p className="text-xs text-[var(--admin-on-surface-variant)]">
            Bonus XP is granted the day any streak reaches the milestone length.
          </p>
          {bonuses.length === 0 ? (
            <p className="text-sm text-[var(--admin-on-surface-variant)]">
              No milestone bonuses configured.
            </p>
          ) : (
            bonuses.map((bonus, index) => (
              <div
                key={index}
                className="grid grid-cols-[auto_140px_140px_auto] items-end gap-3 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-3"
              >
                <Flame className="mb-2.5 h-5 w-5 text-[var(--admin-warning)]" aria-hidden="true" />
                <label className="block">
                  <span className={labelClassName}>Streak days</span>
                  <input
                    type="number"
                    min={2}
                    max={365}
                    className={`${fieldClassName} mt-1.5`}
                    value={bonus.days}
                    onChange={(e) => {
                      const days = Math.min(365, Math.max(2, Number(e.target.value) || 2));
                      setBonuses((current) =>
                        current.map((entry, i) => (i === index ? { ...entry, days } : entry)),
                      );
                    }}
                  />
                </label>
                <label className="block">
                  <span className={labelClassName}>Bonus XP</span>
                  <input
                    type="number"
                    min={1}
                    max={10000}
                    className={`${fieldClassName} mt-1.5`}
                    value={bonus.bonusXp}
                    onChange={(e) => {
                      const bonusXp = Math.min(10000, Math.max(1, Number(e.target.value) || 1));
                      setBonuses((current) =>
                        current.map((entry, i) => (i === index ? { ...entry, bonusXp } : entry)),
                      );
                    }}
                  />
                </label>
                <button
                  type="button"
                  title="Remove bonus"
                  className="pb-2 text-[var(--admin-on-surface-variant)] hover:text-[var(--admin-danger)]"
                  onClick={() => {
                    setBonuses((current) => current.filter((_, i) => i !== index));
                  }}
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            ))
          )}
          {hasDuplicateBonusDays ? (
            <p className="text-sm text-[var(--admin-danger)]">
              Bonus milestones must have unique day counts.
            </p>
          ) : null}
        </div>
      </section>

      <button
        type="button"
        className={primaryButtonClassName}
        disabled={busy || invalid}
        onClick={() => {
          void save();
        }}
      >
        {busy ? "Saving…" : "Save streak rules"}
      </button>
    </div>
  );
}
