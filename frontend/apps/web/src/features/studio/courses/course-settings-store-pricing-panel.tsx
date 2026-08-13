"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import type { z } from "zod";
import { ClientApiError, clientApi } from "../../../lib/client-api";
import type { studioCourseDetailSchema } from "@atlas/contracts/courses/course-authoring-schemas";
import { fieldClassName, statusBannerClassName } from "./course-builder-shared";
import {
  courseStorePlatformPricingFromDetail,
  mergeCourseStorePlatformPricingIntoTags,
  storePlatformPricingEqual,
  type CourseStorePlatformPricing,
  type CourseStorePricingPlatform,
} from "./course-store-pricing-settings";
import {
  CourseSettingsCheckboxField,
  CourseSettingsFormFooter,
  CourseSettingsSectionBlock,
  courseSettingsCardClassName,
  courseSettingsFieldStackClassName,
} from "./course-settings-shared";

type CourseDetail = z.infer<typeof studioCourseDetailSchema>;

type CourseSettingsStorePricingPanelProps = {
  course: CourseDetail;
  editable: boolean;
  platform: CourseStorePricingPlatform;
  onSaved: (course: CourseDetail) => void;
};

const PLATFORM_COPY: Record<
  CourseStorePricingPlatform,
  { title: string; productHint: string; enableLabel: string; enableDescription: string }
> = {
  ios: {
    title: "App Store product",
    productHint: "Use the Product ID from App Store Connect (e.g. com.school.course.premium).",
    enableLabel: "Enable iOS in-app purchase",
    enableDescription:
      "When enabled, learners can unlock this course with the configured App Store product.",
  },
  android: {
    title: "Google Play product",
    productHint: "Use the Product ID from Google Play Console (e.g. course_premium).",
    enableLabel: "Enable Android in-app purchase",
    enableDescription:
      "When enabled, learners can unlock this course with the configured Play Store product.",
  },
};

function formatError(error: unknown, platform: CourseStorePricingPlatform): string {
  if (error instanceof ClientApiError) return error.message;
  return `Failed to save ${platform === "ios" ? "iOS" : "Android"} pricing.`;
}

function parseHintCents(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const cents = Number(trimmed);
  if (!Number.isFinite(cents) || cents < 0) return null;
  return Math.round(cents);
}

export function CourseSettingsStorePricingPanel({
  course,
  editable,
  platform,
  onSaved,
}: CourseSettingsStorePricingPanelProps) {
  const copy = PLATFORM_COPY[platform];
  const savedForm = useMemo(
    () => courseStorePlatformPricingFromDetail(course, platform),
    [course, platform],
  );
  const [form, setForm] = useState<CourseStorePlatformPricing>(savedForm);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setForm(courseStorePlatformPricingFromDetail(course, platform));
  }, [course, platform]);

  const saveMutation = useMutation({
    mutationFn: async (nextForm: CourseStorePlatformPricing) => {
      if (nextForm.enabled && !nextForm.productId.trim()) {
        throw new Error("Product ID is required when store pricing is enabled.");
      }

      const response = await clientApi.put<{ data: CourseDetail }>(
        `/api/v1/courses/${course.id}`,
        {
          tags: mergeCourseStorePlatformPricingIntoTags(course.tags, platform, {
            ...nextForm,
            productId: nextForm.productId.trim(),
            displayPriceLabel: nextForm.displayPriceLabel.trim(),
          }),
        },
        `course-${platform}-pricing-update`,
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
      setError(formatError(submitError, platform));
    },
  });

  const disabled = !editable || saveMutation.isPending;
  const isDirty = !storePlatformPricingEqual(form, savedForm);

  function updateForm(patch: Partial<CourseStorePlatformPricing>) {
    setForm((current) => ({ ...current, ...patch }));
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

      <div className="space-y-8">
        <div className={courseSettingsCardClassName}>
          <CourseSettingsCheckboxField
            id={`${platform}-pricing-enabled`}
            label={copy.enableLabel}
            description={copy.enableDescription}
            checked={form.enabled}
            disabled={disabled}
            onChange={(checked) => {
              updateForm({ enabled: checked });
            }}
          />
        </div>

        <CourseSettingsSectionBlock title={copy.title} description={copy.productHint}>
          <div className="space-y-4">
            <div className={courseSettingsFieldStackClassName}>
              <label
                htmlFor={`${platform}-product-id`}
                className="text-sm font-semibold text-[var(--admin-on-surface)]"
              >
                Product ID
              </label>
              <input
                id={`${platform}-product-id`}
                type="text"
                className={fieldClassName}
                value={form.productId}
                disabled={disabled}
                placeholder={platform === "ios" ? "com.school.course.premium" : "course_premium"}
                onChange={(event) => {
                  updateForm({ productId: event.target.value });
                }}
              />
            </div>

            <div className={courseSettingsFieldStackClassName}>
              <label
                htmlFor={`${platform}-display-price`}
                className="text-sm font-semibold text-[var(--admin-on-surface)]"
              >
                Display price label
              </label>
              <input
                id={`${platform}-display-price`}
                type="text"
                className={fieldClassName}
                value={form.displayPriceLabel}
                disabled={disabled}
                placeholder="$9.99"
                onChange={(event) => {
                  updateForm({ displayPriceLabel: event.target.value });
                }}
              />
              <p className="text-sm text-[var(--admin-on-surface-variant)]">
                Shown in the mobile app. StoreKit / Play Billing remain the source of truth for
                checkout.
              </p>
            </div>

            <div className={courseSettingsFieldStackClassName}>
              <label
                htmlFor={`${platform}-price-hint`}
                className="text-sm font-semibold text-[var(--admin-on-surface)]"
              >
                Price tier hint (cents)
              </label>
              <input
                id={`${platform}-price-hint`}
                type="number"
                min={0}
                step={1}
                className={fieldClassName}
                value={form.priceTierHintCents ?? ""}
                disabled={disabled}
                placeholder="999"
                onChange={(event) => {
                  updateForm({ priceTierHintCents: parseHintCents(event.target.value) });
                }}
              />
              <p className="text-sm text-[var(--admin-on-surface-variant)]">
                Optional reference amount for admin reporting. Leave blank if unused.
              </p>
            </div>
          </div>
        </CourseSettingsSectionBlock>
      </div>

      <CourseSettingsFormFooter
        onSave={handleSave}
        onCancel={handleCancel}
        saving={saveMutation.isPending}
        saveDisabled={disabled || !isDirty}
        cancelDisabled={disabled || !isDirty}
      />
    </div>
  );
}
