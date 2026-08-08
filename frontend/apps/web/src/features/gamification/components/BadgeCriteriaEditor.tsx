"use client";

import { Plus, Trash2 } from "lucide-react";
import { BADGE_ICONS, badgeIconByKey } from "../badge-icons";
import { fieldClassName, labelClassName } from "../gamification-admin-shared";
import { GamificationSelectField } from "./GamificationSelectField";

export { BADGE_ICONS, badgeIconByKey };

export type PrimitiveBadgeCriteria =
  | { type: "xp_total"; minXp: number }
  | { type: "streak_current"; streakKey: string; minCount: number }
  | { type: "event_count"; eventType: string; minCount: number };

export type BadgeCriteria =
  | PrimitiveBadgeCriteria
  | { type: "compound"; operator: "all" | "any"; criteria: PrimitiveBadgeCriteria[] };

/** Source events the gamification engine consumes today (keep in sync with
 * GAMIFICATION_CONSUMED_EVENT_TYPES in the backend engine). */
export const GAMIFICATION_EVENT_TYPES = [
  { value: "lesson.completed", label: "Lesson completed" },
  { value: "path.step_completed", label: "Learning path step completed" },
  { value: "assessment.submitted", label: "Assessment submitted" },
  { value: "assessment.graded", label: "Assessment graded" },
  { value: "practice.session_completed", label: "Practice session completed" },
] as const;

/** Streak keys available from engine defaults. */
export const GAMIFICATION_STREAK_KEYS = [
  { value: "daily_learning", label: "Daily learning" },
  { value: "practice_daily", label: "Daily practice" },
] as const;

const CONDITION_TYPE_OPTIONS = [
  { value: "xp_total", label: "Total XP threshold" },
  { value: "streak_current", label: "Streak length" },
  { value: "event_count", label: "Activity count" },
] as const;

function defaultPrimitiveForType(type: PrimitiveBadgeCriteria["type"]): PrimitiveBadgeCriteria {
  switch (type) {
    case "xp_total":
      return { type: "xp_total", minXp: 100 };
    case "streak_current":
      return { type: "streak_current", streakKey: "daily_learning", minCount: 3 };
    case "event_count":
      return { type: "event_count", eventType: "lesson.completed", minCount: 1 };
  }
}

export function defaultCriteriaForType(type: BadgeCriteria["type"]): BadgeCriteria {
  if (type === "compound") {
    return {
      type: "compound",
      operator: "all",
      criteria: [defaultPrimitiveForType("xp_total")],
    };
  }
  return defaultPrimitiveForType(type);
}

function describePrimitive(criteria: PrimitiveBadgeCriteria): string {
  if (criteria.type === "xp_total") {
    return `Reach ${String(criteria.minXp)} XP`;
  }
  if (criteria.type === "streak_current") {
    const streak = GAMIFICATION_STREAK_KEYS.find((entry) => entry.value === criteria.streakKey);
    return `${String(criteria.minCount)}-day ${streak?.label ?? criteria.streakKey} streak`;
  }
  const event = GAMIFICATION_EVENT_TYPES.find((entry) => entry.value === criteria.eventType);
  return `${event?.label ?? criteria.eventType} × ${String(criteria.minCount)}`;
}

export function describeCriteria(criteria: BadgeCriteria): string {
  if (criteria.type === "compound") {
    const joiner = criteria.operator === "all" ? " AND " : " OR ";
    return criteria.criteria.map(describePrimitive).join(joiner);
  }
  return describePrimitive(criteria);
}

function PrimitiveCriteriaFields({
  criteria,
  onChange,
}: {
  criteria: PrimitiveBadgeCriteria;
  onChange: (criteria: PrimitiveBadgeCriteria) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <GamificationSelectField
        label="Condition"
        value={criteria.type}
        onChange={(value) => {
          onChange(defaultPrimitiveForType(value as PrimitiveBadgeCriteria["type"]));
        }}
        options={CONDITION_TYPE_OPTIONS.map((option) => ({
          value: option.value,
          label: option.label,
        }))}
      />

      {criteria.type === "xp_total" ? (
        <label className="block">
          <span className={labelClassName}>Minimum XP</span>
          <input
            type="number"
            min={0}
            className={`${fieldClassName} mt-1.5`}
            value={criteria.minXp}
            onChange={(e) => {
              onChange({ type: "xp_total", minXp: Math.max(0, Number(e.target.value) || 0) });
            }}
          />
        </label>
      ) : null}

      {criteria.type === "streak_current" ? (
        <>
          <GamificationSelectField
            label="Streak"
            value={criteria.streakKey}
            onChange={(streakKey) => {
              onChange({ ...criteria, streakKey });
            }}
            options={GAMIFICATION_STREAK_KEYS.map((entry) => ({
              value: entry.value,
              label: entry.label,
            }))}
          />
          <label className="block">
            <span className={labelClassName}>Days</span>
            <input
              type="number"
              min={1}
              className={`${fieldClassName} mt-1.5`}
              value={criteria.minCount}
              onChange={(e) => {
                onChange({ ...criteria, minCount: Math.max(1, Number(e.target.value) || 1) });
              }}
            />
          </label>
        </>
      ) : null}

      {criteria.type === "event_count" ? (
        <>
          <GamificationSelectField
            label="Activity"
            value={criteria.eventType}
            onChange={(eventType) => {
              onChange({ ...criteria, eventType });
            }}
            options={GAMIFICATION_EVENT_TYPES.map((entry) => ({
              value: entry.value,
              label: entry.label,
            }))}
          />
          <label className="block">
            <span className={labelClassName}>Times</span>
            <input
              type="number"
              min={1}
              className={`${fieldClassName} mt-1.5`}
              value={criteria.minCount}
              onChange={(e) => {
                onChange({ ...criteria, minCount: Math.max(1, Number(e.target.value) || 1) });
              }}
            />
          </label>
        </>
      ) : null}
    </div>
  );
}

type BadgeCriteriaEditorProps = {
  criteria: BadgeCriteria;
  onChange: (criteria: BadgeCriteria) => void;
  iconKey: string | null;
  onIconChange: (iconKey: string | null) => void;
  idPrefix: string;
};

export function BadgeCriteriaEditor({
  criteria,
  onChange,
  iconKey,
  onIconChange,
  idPrefix,
}: BadgeCriteriaEditorProps) {
  return (
    <div className="space-y-4">
      <GamificationSelectField
        label="Earned when"
        value={criteria.type === "compound" ? "compound" : "single"}
        onChange={(value) => {
          if (value === "compound") {
            onChange({
              type: "compound",
              operator: "all",
              criteria: criteria.type === "compound" ? criteria.criteria : [criteria],
            });
          } else {
            onChange(
              criteria.type === "compound"
                ? (criteria.criteria[0] ?? defaultPrimitiveForType("xp_total"))
                : criteria,
            );
          }
        }}
        options={[
          { value: "single", label: "A single condition is met" },
          { value: "compound", label: "Multiple conditions (AND / OR)" },
        ]}
      />

      {criteria.type !== "compound" ? (
        <PrimitiveCriteriaFields criteria={criteria} onChange={onChange} />
      ) : (
        <div className="space-y-3">
          <GamificationSelectField
            className="sm:max-w-xs"
            label="Require"
            value={criteria.operator}
            onChange={(operator) => {
              onChange({ ...criteria, operator: operator as "all" | "any" });
            }}
            options={[
              { value: "all", label: "All conditions (AND)" },
              { value: "any", label: "Any condition (OR)" },
            ]}
          />

          {criteria.criteria.map((child, index) => (
            <div
              key={index}
              className="space-y-3 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-3"
            >
              <div className="flex items-center justify-between">
                <span className={labelClassName}>Condition {index + 1}</span>
                {criteria.criteria.length > 1 ? (
                  <button
                    type="button"
                    title="Remove condition"
                    className="text-[var(--admin-on-surface-variant)] hover:text-[var(--admin-danger)]"
                    onClick={() => {
                      onChange({
                        ...criteria,
                        criteria: criteria.criteria.filter((_, i) => i !== index),
                      });
                    }}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </button>
                ) : null}
              </div>
              <PrimitiveCriteriaFields
                criteria={child}
                onChange={(next) => {
                  onChange({
                    ...criteria,
                    criteria: criteria.criteria.map((entry, i) => (i === index ? next : entry)),
                  });
                }}
              />
            </div>
          ))}

          {criteria.criteria.length < 5 ? (
            <button
              type="button"
              className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--admin-primary)]"
              onClick={() => {
                onChange({
                  ...criteria,
                  criteria: [...criteria.criteria, defaultPrimitiveForType("xp_total")],
                });
              }}
            >
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              Add condition
            </button>
          ) : null}
        </div>
      )}

      <fieldset>
        <legend className={labelClassName}>Icon</legend>
        <div className="mt-1.5 flex flex-wrap gap-2" role="radiogroup" aria-label="Badge icon">
          {BADGE_ICONS.map((entry) => {
            const Icon = entry.icon;
            const selected = iconKey === entry.key;
            return (
              <button
                key={entry.key}
                id={`${idPrefix}-icon-${entry.key}`}
                type="button"
                role="radio"
                aria-checked={selected}
                title={entry.label}
                className={
                  selected
                    ? "rounded-lg border-2 border-[var(--admin-primary)] bg-[color-mix(in_srgb,var(--admin-primary)_10%,var(--admin-surface))] p-2"
                    : "rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-2 hover:border-[var(--admin-primary)]"
                }
                onClick={() => {
                  onIconChange(selected ? null : entry.key);
                }}
              >
                <Icon
                  className={
                    selected
                      ? "h-5 w-5 text-[var(--admin-primary)]"
                      : "h-5 w-5 text-[var(--admin-on-surface-variant)]"
                  }
                  aria-hidden="true"
                />
              </button>
            );
          })}
        </div>
      </fieldset>
    </div>
  );
}
