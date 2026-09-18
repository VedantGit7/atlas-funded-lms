"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import type { z } from "zod";
import { ClientApiError, clientApi } from "../../../lib/client-api";
import type { studioCourseDetailSchema } from "@atlas/contracts/courses/course-authoring-schemas";
import { GAMIFICATION_EVENT_TYPES } from "../../gamification/components/BadgeCriteriaEditor";
import { statusBannerClassName } from "./course-builder-shared";
import {
  courseGamificationFromDetail,
  gamificationSettingsEqual,
  mergeCourseGamificationIntoTags,
  type CourseGamificationSettings,
  type CourseXpRuleOverride,
} from "./course-gamification-settings";
import {
  CourseSettingsCheckboxField,
  CourseSettingsFormFooter,
  CourseSettingsSectionBlock,
} from "./course-settings-shared";
import {
  fieldClassName,
  labelClassName,
  outlineButtonClassName,
  selectClassName,
} from "../../../app/admin/branding/_components/branding-admin-shared";

type CourseDetail = z.infer<typeof studioCourseDetailSchema>;

type CourseSettingsGamificationPanelProps = {
  course: CourseDetail;
  editable: boolean;
  onSaved: (course: CourseDetail) => void;
};

const SETTINGS_CARD_CLASSNAME =
  "rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] px-4 py-4 shadow-sm md:px-5 md:py-5";

function formatError(error: unknown): string {
  if (error instanceof ClientApiError) return error.message;
  return "Failed to save gamification settings.";
}

function defaultOverride(): CourseXpRuleOverride {
  return {
    eventType: GAMIFICATION_EVENT_TYPES[0].value,
    points: 10,
  };
}

export function CourseSettingsGamificationPanel({
  course,
  editable,
  onSaved,
}: CourseSettingsGamificationPanelProps) {
  const savedForm = useMemo(() => courseGamificationFromDetail(course), [course]);
  const [form, setForm] = useState<CourseGamificationSettings>(savedForm);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setForm(courseGamificationFromDetail(course));
  }, [course]);

  const saveMutation = useMutation({
    mutationFn: async (nextForm: CourseGamificationSettings) => {
      const response = await clientApi.put<{ data: CourseDetail }>(
        `/api/v1/courses/${course.id}`,
        {
          tags: mergeCourseGamificationIntoTags(course.tags, nextForm),
        },
        "course-gamification-update",
      );
      return response.data;
    },
    onMutate: () => {
      setError(null);
    },
    onSuccess: (saved) => {
      onSaved(saved);
    },
    onError: (submitError) => {
      setError(formatError(submitError));
    },
  });

  const disabled = !editable || saveMutation.isPending;
  const isDirty = !gamificationSettingsEqual(form, savedForm);

  function updateForm(patch: Partial<CourseGamificationSettings>) {
    setForm((current) => ({ ...current, ...patch }));
  }

  function updateOverride(index: number, patch: Partial<CourseXpRuleOverride>) {
    setForm((current) => ({
      ...current,
      xpRuleOverrides: current.xpRuleOverrides.map((rule, i) =>
        i === index ? { ...rule, ...patch } : rule,
      ),
    }));
  }

  function handleCancel() {
    setForm(savedForm);
    setError(null);
  }

  function handleSave() {
    if (disabled || !isDirty) return;
    saveMutation.mutate(form);
  }

  return (
    <div className="min-w-0 w-full">
      {!editable ? (
        <p
          className={`${statusBannerClassName} mb-6 border-[var(--admin-warning)]/30 bg-[var(--admin-warning)]/10 text-[var(--admin-warning)]`}
        >
          This course is locked while in review or published.
        </p>
      ) : null}

      {error ? (
        <p
          role="alert"
          className={`${statusBannerClassName} mb-6 border-[var(--admin-danger)]/30 bg-[var(--admin-danger)]/10 text-[var(--admin-danger)]`}
        >
          {error}
        </p>
      ) : null}

      <CourseSettingsSectionBlock
        title="Course gamification"
        description="Override tenant XP rules for learning events that happen inside this course"
      >
        <div className="space-y-4">
          <div className={SETTINGS_CARD_CLASSNAME}>
            <CourseSettingsCheckboxField
              id="course-gamification-enabled"
              label="Enable course XP overrides"
              description="When enabled, matching events in this course use the overrides below instead of tenant defaults"
              checked={form.enabled}
              disabled={disabled}
              onChange={(checked) => {
                updateForm({ enabled: checked });
              }}
            />
          </div>

          {form.enabled ? (
            <div className={SETTINGS_CARD_CLASSNAME}>
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-[var(--admin-on-surface)]">
                    XP overrides
                  </p>
                  <p className="mt-1 text-xs text-[var(--admin-on-surface-variant)]">
                    One override per event type. Assessment graded supports an optional pass
                    condition.
                  </p>
                </div>
                <button
                  type="button"
                  className={outlineButtonClassName}
                  disabled={disabled}
                  onClick={() => {
                    updateForm({
                      xpRuleOverrides: [...form.xpRuleOverrides, defaultOverride()],
                    });
                  }}
                >
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  Add override
                </button>
              </div>

              {form.xpRuleOverrides.length === 0 ? (
                <p className="text-sm text-[var(--admin-on-surface-variant)]">
                  No overrides configured. Tenant defaults apply.
                </p>
              ) : (
                <div className="space-y-3">
                  {form.xpRuleOverrides.map((rule, index) => (
                    <div
                      key={index}
                      className="grid grid-cols-1 gap-3 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-3 sm:grid-cols-[1fr_120px_140px_auto]"
                    >
                      <label className="block">
                        <span className={labelClassName}>Event</span>
                        <select
                          className={`${selectClassName} mt-1.5`}
                          value={rule.eventType}
                          disabled={disabled}
                          onChange={(e) => {
                            updateOverride(index, { eventType: e.target.value });
                          }}
                        >
                          {GAMIFICATION_EVENT_TYPES.map((entry) => (
                            <option key={entry.value} value={entry.value}>
                              {entry.label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="block">
                        <span className={labelClassName}>XP</span>
                        <input
                          type="number"
                          min={0}
                          max={10000}
                          className={`${fieldClassName} mt-1.5`}
                          value={rule.points}
                          disabled={disabled}
                          onChange={(e) => {
                            updateOverride(index, {
                              points: Math.min(10000, Math.max(0, Number(e.target.value) || 0)),
                            });
                          }}
                        />
                      </label>
                      {rule.eventType === "assessment.graded" ? (
                        <label className="block">
                          <span className={labelClassName}>Condition</span>
                          <select
                            className={`${selectClassName} mt-1.5`}
                            value={rule.condition ?? ""}
                            disabled={disabled}
                            onChange={(e) => {
                              updateOverride(index, {
                                condition: e.target.value === "pass" ? "pass" : undefined,
                              });
                            }}
                          >
                            <option value="">Any grade</option>
                            <option value="pass">Pass only</option>
                          </select>
                        </label>
                      ) : (
                        <div />
                      )}
                      <button
                        type="button"
                        title="Remove override"
                        className="self-end pb-2 text-[var(--admin-on-surface-variant)] hover:text-[var(--admin-danger)]"
                        disabled={disabled}
                        onClick={() => {
                          updateForm({
                            xpRuleOverrides: form.xpRuleOverrides.filter((_, i) => i !== index),
                          });
                        }}
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : null}
        </div>
      </CourseSettingsSectionBlock>

      {editable ? (
        <CourseSettingsFormFooter
          onSave={handleSave}
          onCancel={handleCancel}
          saving={saveMutation.isPending}
          saveDisabled={disabled || !isDirty}
          cancelDisabled={disabled || !isDirty}
        />
      ) : null}
    </div>
  );
}
