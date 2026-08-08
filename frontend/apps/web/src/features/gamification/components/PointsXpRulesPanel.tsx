"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { ClientApiError, clientApi } from "../../../lib/client-api";
import {
  alertErrorClassName,
  alertInfoClassName,
  fieldClassName,
  labelClassName,
  monoClassName,
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

type PointsXpRulesPanelProps = {
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

export function PointsXpRulesPanel({ rules, events, onSaved }: PointsXpRulesPanelProps) {
  const [xpRules, setXpRules] = useState(rules.xpRules);
  const [thresholds, setThresholds] = useState(rules.levelThresholds);
  const [leaderboardsPublic, setLeaderboardsPublic] = useState(rules.leaderboardsPublic);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const activeEvents = events.filter((event) => event.status === "active");
  const sortedThresholds = [...thresholds].sort((a, b) => a.minXp - b.minXp);
  const maxXp = Math.max(...sortedThresholds.map((entry) => entry.minXp), 1);

  const hasDuplicateRuleKeys = new Set(xpRules.map((rule) => rule.key)).size !== xpRules.length;
  const hasEmptyRuleKeys = xpRules.some((rule) => !rule.key.trim());
  const hasDuplicateLevels =
    new Set(thresholds.map((entry) => entry.levelKey)).size !== thresholds.length ||
    new Set(thresholds.map((entry) => entry.minXp)).size !== thresholds.length;
  const hasZeroThreshold = thresholds.some((entry) => entry.minXp === 0);
  const invalid =
    hasDuplicateRuleKeys ||
    hasEmptyRuleKeys ||
    hasDuplicateLevels ||
    !hasZeroThreshold ||
    thresholds.length === 0 ||
    thresholds.some((entry) => !entry.levelKey.trim());

  async function save() {
    setMessage(null);
    setError(null);
    setRequestId(null);
    setBusy(true);
    try {
      const response = await clientApi.put<{ data: GamificationRules }>(
        "/api/v1/gamification/rules",
        {
          xpRules: xpRules.map((rule) => ({
            key: rule.key.trim(),
            eventType: rule.eventType,
            points: rule.points,
            ...(rule.condition ? { condition: rule.condition } : {}),
          })),
          levelThresholds: sortedThresholds.map((entry) => ({
            levelKey: entry.levelKey.trim(),
            minXp: entry.minXp,
          })),
          leaderboardsPublic,
        },
        `gamification-rules-points-${Date.now().toString()}`,
      );
      onSaved(response.data);
      setXpRules(response.data.xpRules);
      setThresholds(response.data.levelThresholds);
      setLeaderboardsPublic(response.data.leaderboardsPublic);
      setMessage("Points & XP rules saved.");
    } catch (caught) {
      if (caught instanceof ClientApiError) {
        setError(caught.message);
        setRequestId(caught.requestId);
      } else {
        setError("Failed to save rules.");
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
            <p className={panelEyebrowClassName}>Accrual</p>
            <h2 className="font-semibold text-[var(--admin-on-surface)]">XP rules</h2>
          </div>
          <button
            type="button"
            className={outlineButtonClassName}
            onClick={() => {
              setXpRules((current) => [
                ...current,
                {
                  key: `rule-${String(current.length + 1)}`,
                  eventType: activeEvents[0]?.eventType ?? "lesson.completed",
                  points: 10,
                },
              ]);
            }}
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Add rule
          </button>
        </div>
        <div className={`${panelBodyClassName} space-y-3`}>
          {xpRules.length === 0 ? (
            <p className="text-sm text-[var(--admin-on-surface-variant)]">
              No XP rules — learners will not earn XP.
            </p>
          ) : (
            xpRules.map((rule, index) => (
              <div
                key={index}
                className="grid grid-cols-1 items-end gap-3 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-3 sm:grid-cols-[1fr_1fr_120px_auto_auto]"
              >
                <label className="block">
                  <span className={labelClassName}>Rule key</span>
                  <input
                    className={`${fieldClassName} mt-1.5`}
                    value={rule.key}
                    onChange={(e) => {
                      const key = slugify(e.target.value);
                      setXpRules((current) =>
                        current.map((entry, i) => (i === index ? { ...entry, key } : entry)),
                      );
                    }}
                  />
                </label>
                <GamificationSelectField
                  label="Event"
                  value={rule.eventType}
                  onChange={(eventType) => {
                    setXpRules((current) =>
                      current.map((entry, i) =>
                        i === index
                          ? {
                              ...entry,
                              eventType,
                              ...(eventType !== "assessment.graded"
                                ? { condition: undefined }
                                : {}),
                            }
                          : entry,
                      ),
                    );
                  }}
                  options={activeEvents.map((event) => ({
                    value: event.eventType,
                    label: event.label,
                  }))}
                />
                <label className="block">
                  <span className={labelClassName}>Points</span>
                  <input
                    type="number"
                    min={0}
                    max={10000}
                    className={`${fieldClassName} mt-1.5`}
                    value={rule.points}
                    onChange={(e) => {
                      const points = Math.min(10000, Math.max(0, Number(e.target.value) || 0));
                      setXpRules((current) =>
                        current.map((entry, i) => (i === index ? { ...entry, points } : entry)),
                      );
                    }}
                  />
                </label>
                {rule.eventType === "assessment.graded" ? (
                  <label className="flex items-center gap-2 pb-2 text-sm text-[var(--admin-on-surface)]">
                    <input
                      type="checkbox"
                      checked={rule.condition === "pass"}
                      onChange={(e) => {
                        setXpRules((current) =>
                          current.map((entry, i) =>
                            i === index
                              ? { ...entry, condition: e.target.checked ? "pass" : undefined }
                              : entry,
                          ),
                        );
                      }}
                    />
                    Pass only
                  </label>
                ) : (
                  <span />
                )}
                <button
                  type="button"
                  title="Remove rule"
                  className="pb-2 text-[var(--admin-on-surface-variant)] hover:text-[var(--admin-danger)]"
                  onClick={() => {
                    setXpRules((current) => current.filter((_, i) => i !== index));
                  }}
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            ))
          )}
          {hasDuplicateRuleKeys ? (
            <p className="text-sm text-[var(--admin-danger)]">Rule keys must be unique.</p>
          ) : null}
        </div>
      </section>

      <section className={panelClassName}>
        <div className={panelHeaderClassName}>
          <div>
            <p className={panelEyebrowClassName}>Progression</p>
            <h2 className="font-semibold text-[var(--admin-on-surface)]">Level thresholds</h2>
          </div>
          <button
            type="button"
            className={outlineButtonClassName}
            onClick={() => {
              setThresholds((current) => [
                ...current,
                {
                  levelKey: `level_${String(current.length + 1)}`,
                  minXp: (current[current.length - 1]?.minXp ?? 0) + 500,
                },
              ]);
            }}
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Add level
          </button>
        </div>
        <div className={`${panelBodyClassName} space-y-4`}>
          <div className="space-y-3">
            {thresholds.map((entry, index) => (
              <div
                key={index}
                className="grid grid-cols-[1fr_140px_auto] items-end gap-3 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-3"
              >
                <label className="block">
                  <span className={labelClassName}>Level key</span>
                  <input
                    className={`${fieldClassName} mt-1.5`}
                    value={entry.levelKey}
                    onChange={(e) => {
                      const levelKey = slugify(e.target.value);
                      setThresholds((current) =>
                        current.map((item, i) => (i === index ? { ...item, levelKey } : item)),
                      );
                    }}
                  />
                </label>
                <label className="block">
                  <span className={labelClassName}>Min XP</span>
                  <input
                    type="number"
                    min={0}
                    className={`${fieldClassName} mt-1.5`}
                    value={entry.minXp}
                    onChange={(e) => {
                      const minXp = Math.max(0, Number(e.target.value) || 0);
                      setThresholds((current) =>
                        current.map((item, i) => (i === index ? { ...item, minXp } : item)),
                      );
                    }}
                  />
                </label>
                <button
                  type="button"
                  title="Remove level"
                  className="pb-2 text-[var(--admin-on-surface-variant)] hover:text-[var(--admin-danger)]"
                  onClick={() => {
                    setThresholds((current) => current.filter((_, i) => i !== index));
                  }}
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            ))}
          </div>

          {!hasZeroThreshold ? (
            <p className="text-sm text-[var(--admin-danger)]">
              One level must start at 0 XP so every learner has a level.
            </p>
          ) : null}
          {hasDuplicateLevels ? (
            <p className="text-sm text-[var(--admin-danger)]">
              Level keys and minimum XP values must be unique.
            </p>
          ) : null}

          <div>
            <p className={labelClassName}>Level curve preview</p>
            <div className="mt-2 space-y-1.5">
              {sortedThresholds.map((entry) => (
                <div key={entry.levelKey} className="flex items-center gap-3">
                  <span className={`${monoClassName} w-24 shrink-0 text-xs`}>{entry.levelKey}</span>
                  <div className="h-3 flex-1 rounded-full bg-[var(--admin-surface-high)]">
                    <div
                      className="h-3 rounded-full bg-[var(--admin-primary)]"
                      style={{ width: `${String(Math.max(2, (entry.minXp / maxXp) * 100))}%` }}
                    />
                  </div>
                  <span className="w-20 shrink-0 text-right text-xs text-[var(--admin-on-surface-variant)]">
                    {entry.minXp} XP
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className={panelClassName}>
        <div className={panelHeaderClassName}>
          <div>
            <p className={panelEyebrowClassName}>Visibility</p>
            <h2 className="font-semibold text-[var(--admin-on-surface)]">Leaderboards</h2>
          </div>
        </div>
        <div className={panelBodyClassName}>
          <label className="flex items-center gap-3 text-sm text-[var(--admin-on-surface)]">
            <input
              type="checkbox"
              checked={leaderboardsPublic}
              onChange={(e) => {
                setLeaderboardsPublic(e.target.checked);
              }}
            />
            Show leaderboards to learners
          </label>
          <p className="mt-2 text-xs text-[var(--admin-on-surface-variant)]">
            When off, the Leaderboards page and navigation entry are hidden from learners. Admin
            previews keep working.
          </p>
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
        {busy ? "Saving…" : "Save Points & XP rules"}
      </button>
    </div>
  );
}
