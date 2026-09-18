"use client";

import { Check } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import type { z } from "zod";
import { ClientApiError, clientApi } from "../../../lib/client-api";
import type { studioCourseDetailSchema } from "@atlas/contracts/courses/course-authoring-schemas";
import { inlineExpandClassName } from "./admin-form-dropdown-shared";
import { CourseAccessModePicker } from "./course-access-mode-picker";
import { builderHelperClassName, statusBannerClassName } from "./course-builder-shared";
import {
  coursePermissionsFromDetail,
  mergeCoursePermissionsIntoTags,
  permissionsSettingsEqual,
  type CourseCatalogVisibility,
  type CoursePermissionsSettings,
} from "./course-permissions-settings";
import { PricingPlanRadioCardGroup } from "./course-pricing-plan-form-shared";
import {
  CourseSettingsFormFooter,
  CourseSettingsSectionBlock,
  courseSettingsSectionStackClassName,
} from "./course-settings-shared";

type CourseDetail = z.infer<typeof studioCourseDetailSchema>;

type CourseSettingsPermissionsPanelProps = {
  course: CourseDetail;
  editable: boolean;
  onSaved: (course: CourseDetail) => void;
};

const CATALOG_VISIBILITY_OPTIONS: Array<{
  value: CourseCatalogVisibility;
  title: string;
  description: string;
}> = [
  {
    value: "PUBLIC",
    title: "Public Course",
    description:
      "Make it a public course to allow easy access to all the learners without any restriction.",
  },
  {
    value: "PRIVATE",
    title: "Private Course",
    description:
      "Make it a private course to allow access to only the invited students with whom you share the course.",
  },
  {
    value: "UNLISTED",
    title: "Unlisted Course",
    description:
      "Make it unlisted course if you want to remove this course from the list of all products.",
  },
];

function formatError(error: unknown): string {
  if (error instanceof ClientApiError) return error.message;
  return "Failed to save permissions.";
}

type PermissionsCheckboxProps = {
  id: string;
  label: string;
  description?: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
};

function PermissionsCheckbox({
  id,
  label,
  description,
  checked,
  disabled = false,
  onChange,
}: PermissionsCheckboxProps) {
  return (
    <label
      htmlFor={id}
      className={[
        "flex cursor-pointer items-start gap-3 rounded-xl transition-opacity",
        disabled ? "cursor-not-allowed opacity-60" : "",
      ].join(" ")}
    >
      <span
        className={[
          "mt-0.5 inline-flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[4px] border-2 transition-[border-color,background-color] duration-200",
          checked
            ? "border-[var(--admin-primary)] bg-[var(--admin-primary)] text-[var(--admin-on-primary)]"
            : "border-[var(--admin-outline)] bg-[var(--admin-surface)]",
        ].join(" ")}
        aria-hidden="true"
      >
        {checked ? <Check className="h-3 w-3" strokeWidth={3} /> : null}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-[var(--admin-on-surface)]">{label}</span>
        {description ? (
          <span className={`${builderHelperClassName} mt-1 block leading-relaxed`}>
            {description}
          </span>
        ) : null}
      </span>
      <input
        id={id}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        className="sr-only"
        onChange={(event) => {
          onChange(event.target.checked);
        }}
      />
    </label>
  );
}

export function CourseSettingsPermissionsPanel({
  course,
  editable,
  onSaved,
}: CourseSettingsPermissionsPanelProps) {
  const savedForm = useMemo(() => coursePermissionsFromDetail(course), [course]);
  const [form, setForm] = useState<CoursePermissionsSettings>(savedForm);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setForm(coursePermissionsFromDetail(course));
  }, [course]);

  const saveMutation = useMutation({
    mutationFn: async (nextForm: CoursePermissionsSettings) => {
      const response = await clientApi.put<{ data: CourseDetail }>(
        `/api/v1/courses/${course.id}`,
        {
          tags: mergeCoursePermissionsIntoTags(course.tags, nextForm),
        },
        "course-permissions-update",
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
  const isPaid = course.accessTier === "PAID";
  const isDirty = !permissionsSettingsEqual(form, savedForm);
  const mobilePlatformsDisabled = disabled || form.allPlatforms;
  const inAppSyncDisabled = disabled || !isPaid;

  function updateForm(patch: Partial<CoursePermissionsSettings>) {
    setForm((current) => ({ ...current, ...patch }));
  }

  function handleAllPlatformsChange(checked: boolean) {
    if (checked) {
      updateForm({ allPlatforms: true, androidApp: false, iosApp: false });
      return;
    }
    updateForm({ allPlatforms: false });
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

      <div className={courseSettingsSectionStackClassName}>
        <CourseSettingsSectionBlock
          title="Sell Independently"
          description="Enable to sell your course independently outside a bundle."
        >
          <PermissionsCheckbox
            id="sell-independently"
            label="Sell Independently"
            checked={form.sellIndependently}
            disabled={disabled}
            onChange={(checked) => {
              updateForm({ sellIndependently: checked });
            }}
          />
        </CourseSettingsSectionBlock>

        <CourseSettingsSectionBlock
          title="Default Course Enrollment"
          description="Auto enroll learners to the course when they signup. Applicable only on public courses."
        >
          <div className="rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] px-4 py-4 shadow-sm">
            <PermissionsCheckbox
              id="enroll-on-signup"
              label="Enroll On Signup"
              description="Enroll your learners to the course once they signup."
              checked={form.enrollOnSignup}
              disabled={disabled || form.catalogVisibility !== "PUBLIC"}
              onChange={(checked) => {
                updateForm({ enrollOnSignup: checked });
              }}
            />
          </div>
        </CourseSettingsSectionBlock>

        <CourseSettingsSectionBlock
          title="Course Access Type"
          description="Select course access type to make a course public/private/unlisted."
        >
          <PricingPlanRadioCardGroup
            name="course-catalog-visibility"
            value={form.catalogVisibility}
            disabled={disabled}
            options={CATALOG_VISIBILITY_OPTIONS}
            onChange={(value) => {
              updateForm({
                catalogVisibility: value,
                ...(value !== "PUBLIC" ? { enrollOnSignup: false } : {}),
              });
            }}
          />
        </CourseSettingsSectionBlock>

        <CourseSettingsSectionBlock
          title="Content Access Mode"
          description="Control how learners unlock course content after enrollment."
        >
          <div className={`max-w-md ${inlineExpandClassName}`}>
            <CourseAccessModePicker
              value={form.accessMode}
              disabled={disabled}
              onChange={(value) => {
                updateForm({ accessMode: value });
              }}
            />
          </div>
        </CourseSettingsSectionBlock>

        <CourseSettingsSectionBlock
          title="Course Selling Platform"
          description="Select platform to sell your course. You can select apps only if all platforms is not selected."
        >
          <div className="space-y-5">
            <PermissionsCheckbox
              id="all-platforms"
              label="All Platforms (Web, Android, iOS)"
              description="Sell your course on all the platforms."
              checked={form.allPlatforms}
              disabled={disabled}
              onChange={handleAllPlatformsChange}
            />

            <div className="space-y-4 border-t border-[var(--admin-border)] pt-5">
              <p className="text-sm font-semibold text-[var(--admin-on-surface)]">
                Or Sell Course Only Through Mobile Apps
              </p>

              <PermissionsCheckbox
                id="android-app"
                label="Android App"
                description="Applicable only if you have subscribed to Android app add-on."
                checked={form.androidApp}
                disabled={mobilePlatformsDisabled}
                onChange={(checked) => {
                  updateForm({ androidApp: checked });
                }}
              />

              <PermissionsCheckbox
                id="ios-app"
                label="iOS App"
                description="Applicable only if you have subscribed to iOS app add-on."
                checked={form.iosApp}
                disabled={mobilePlatformsDisabled}
                onChange={(checked) => {
                  updateForm({ iosApp: checked });
                }}
              />
            </div>
          </div>
        </CourseSettingsSectionBlock>

        <CourseSettingsSectionBlock
          title="Offline Access"
          description="For offline access your school should have Android app subscription, encrypted courses & product selling type should be paid."
        >
          <PermissionsCheckbox
            id="in-app-sync"
            label="In App Sync"
            description="Enable to In App Sync access to allow offline access within the App."
            checked={form.inAppSync}
            disabled={inAppSyncDisabled}
            onChange={(checked) => {
              updateForm({ inAppSync: checked });
            }}
          />
        </CourseSettingsSectionBlock>
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
