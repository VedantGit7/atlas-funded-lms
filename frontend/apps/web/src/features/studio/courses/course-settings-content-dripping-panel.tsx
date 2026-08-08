"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import type { z } from "zod";
import { ClientApiError, clientApi } from "../../../lib/client-api";
import type { studioCourseDetailSchema } from "@atlas/contracts/courses/course-authoring-schemas";
import { inlineExpandClassName } from "./admin-form-dropdown-shared";
import type { CourseDripSettings, DripReleaseMode } from "./course-access-settings";
import {
  courseDripSettingsEqual,
  mergeCourseDripSettingsIntoTags,
  parseCourseDripSettingsFromTags,
} from "./course-access-settings";
import { ContentDrippingDateTimeInput } from "./content-dripping-datetime-input";
import { builderFieldLabelClassName, statusBannerClassName } from "./course-builder-shared";
import { CourseSettingsContentDrippingConfigurePanel } from "./course-settings-content-dripping-configure-panel";
import { PricingPlanRadioCardGroup } from "./course-pricing-plan-form-shared";
import {
  CourseSettingsFormFooter,
  CourseSettingsNavigationRow,
  CourseSettingsSectionBlock,
  CourseSettingsToggleCard,
} from "./course-settings-shared";
import { defaultPricingPlanOfferStartAt } from "./pricing-plan-datetime-utils";

type CourseDetail = z.infer<typeof studioCourseDetailSchema>;
type ContentDrippingView = "main" | "configure";

type CourseSettingsContentDrippingPanelProps = {
  course: CourseDetail;
  editable: boolean;
  onSaved: (course: CourseDetail) => void;
};

const RELEASE_MODE_OPTIONS: Array<{
  value: DripReleaseMode;
  title: string;
  description: string;
}> = [
  {
    value: "enrollment_date",
    title: "Learner Enrollment Date",
    description:
      "Lessons will be released based on enrollment date. Each learner will have different lesson access dates.",
  },
  {
    value: "fixed_start_date",
    title: "Fixed Start Date",
    description:
      "Lessons will be released based on fixed dates. All the learners will have same lesson access dates.",
  },
];

function formatError(error: unknown): string {
  if (error instanceof ClientApiError) return error.message;
  return "Failed to save content dripping settings.";
}

function dripFromCourse(course: CourseDetail): CourseDripSettings {
  return parseCourseDripSettingsFromTags(course.tags);
}

export function CourseSettingsContentDrippingPanel({
  course,
  editable,
  onSaved,
}: CourseSettingsContentDrippingPanelProps) {
  const savedForm = useMemo(() => dripFromCourse(course), [course]);
  const [form, setForm] = useState<CourseDripSettings>(savedForm);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<ContentDrippingView>("main");

  useEffect(() => {
    setForm(dripFromCourse(course));
  }, [course]);

  const saveMutation = useMutation({
    mutationFn: async (nextForm: CourseDripSettings) => {
      const response = await clientApi.put<{ data: CourseDetail }>(
        `/api/v1/courses/${course.id}`,
        {
          tags: mergeCourseDripSettingsIntoTags(course.tags, nextForm),
        },
        "course-content-dripping-update",
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
  const isDirty = !courseDripSettingsEqual(form, savedForm);

  function updateForm(patch: Partial<CourseDripSettings>) {
    setForm((current) => {
      const next = { ...current, ...patch };
      if (patch.dripEnabled === false) {
        setView("main");
      }
      if (patch.dripReleaseMode === "fixed_start_date" && !next.dripReleaseAt) {
        next.dripReleaseAt = defaultPricingPlanOfferStartAt();
      }
      return next;
    });
  }

  function handleCancel() {
    setForm(savedForm);
    setError(null);
    setView("main");
  }

  function handleSave() {
    if (disabled || !isDirty) return;
    saveMutation.mutate(form);
  }

  if (view === "configure") {
    return (
      <CourseSettingsContentDrippingConfigurePanel
        courseId={course.id}
        form={form}
        savedForm={savedForm}
        disabled={disabled}
        saving={saveMutation.isPending}
        error={error}
        onBack={() => {
          setView("main");
        }}
        onChange={updateForm}
        onSave={handleSave}
        onCancel={handleCancel}
      />
    );
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

      <div className="space-y-8">
        <CourseSettingsToggleCard
          id="content-dripping-enabled"
          title="Content Dripping"
          description="Enable to pre-schedule release of lessons one by one, and effectively deliver your course contents"
          checked={form.dripEnabled}
          disabled={disabled}
          onChange={(checked) => {
            updateForm({ dripEnabled: checked });
          }}
        />

        <CourseSettingsSectionBlock
          title="Lesson Release Date"
          description="Select based on which date the lessons should be released to the learners"
        >
          <PricingPlanRadioCardGroup
            name="content-drip-release-mode"
            value={form.dripReleaseMode}
            options={RELEASE_MODE_OPTIONS}
            disabled={disabled}
            onChange={(value) => {
              updateForm({ dripReleaseMode: value });
            }}
          />
        </CourseSettingsSectionBlock>

        <div className={`space-y-2 ${inlineExpandClassName}`}>
          <label htmlFor="content-drip-release-date" className={builderFieldLabelClassName}>
            Release Date
          </label>
          <ContentDrippingDateTimeInput
            id="content-drip-release-date"
            value={form.dripReleaseAt ?? defaultPricingPlanOfferStartAt()}
            disabled={disabled}
            onChange={(value) => {
              updateForm({ dripReleaseAt: value });
            }}
          />
        </div>

        <CourseSettingsNavigationRow
          title="Configure content-dripping"
          description="Configure lessons for content dripping"
          disabled={disabled || !form.dripEnabled}
          onClick={() => {
            setView("configure");
          }}
        />
      </div>

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
