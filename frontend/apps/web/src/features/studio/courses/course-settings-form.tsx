"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import type { z } from "zod";
import { ClientApiError, clientApi } from "../../../lib/client-api";
import type { studioCourseDetailSchema } from "@atlas/contracts/courses/course-authoring-schemas";
import { RoleToggle } from "./admin-form-dropdown-shared";
import { CourseCurrencyPicker } from "./course-currency-picker";
import {
  builderFieldLabelClassName,
  builderHelperClassName,
  builderSectionBodyClassName,
  builderSectionClassName,
  builderSectionHeaderClassName,
  builderSectionTitleClassName,
  fieldClassName,
  primaryButtonClassName,
  statusBannerClassName,
} from "./course-builder-shared";
import {
  mergeCourseAccessIntoTags,
  parseCourseAccessFromTags,
  type CourseAccessMode,
  type CourseAccessSettings,
} from "./course-access-settings";
import type { CourseSettingsFormSection } from "./course-settings-metadata";

type CourseDetail = z.infer<typeof studioCourseDetailSchema>;

type CourseSettingsFormProps = {
  course: CourseDetail;
  editable: boolean;
  onSaved: (course: CourseDetail) => void;
  section?: CourseSettingsFormSection;
};

function formatError(error: unknown): string {
  if (error instanceof ClientApiError) return error.message;
  return "Failed to save course.";
}

export function CourseSettingsForm({
  course,
  editable,
  onSaved,
  section,
}: CourseSettingsFormProps) {
  const initialAccess = parseCourseAccessFromTags(course.tags);
  const [title, setTitle] = useState(course.title);
  const [description, setDescription] = useState(course.description ?? "");
  const [accessTier, setAccessTier] = useState<"FREE" | "PAID">(course.accessTier);
  const [priceAmount, setPriceAmount] = useState(
    course.priceCents != null ? (course.priceCents / 100).toString() : "",
  );
  const [currency, setCurrency] = useState(course.currency ?? "USD");
  const [accessMode, setAccessMode] = useState<CourseAccessMode>(initialAccess.accessMode);
  const [dripEnabled, setDripEnabled] = useState(initialAccess.dripEnabled);
  const [dripIntervalDays, setDripIntervalDays] = useState(initialAccess.dripIntervalDays);
  const [sequentialLearning, setSequentialLearning] = useState(initialAccess.sequentialLearning);
  const [prerequisiteCourseIds, setPrerequisiteCourseIds] = useState(
    initialAccess.prerequisiteCourseIds.join(", "),
  );
  const [error, setError] = useState<string | null>(null);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const existingAccess = parseCourseAccessFromTags(course.tags);
      const accessSettings: CourseAccessSettings = {
        ...existingAccess,
        accessMode,
        dripEnabled,
        dripIntervalDays,
        sequentialLearning,
        prerequisiteCourseIds: prerequisiteCourseIds
          .split(",")
          .map((value) => value.trim())
          .filter((value) => value.length > 0),
      };

      const parsedPrice = Number(priceAmount);
      const priceCents =
        accessTier === "PAID" && priceAmount.trim().length > 0 && Number.isFinite(parsedPrice)
          ? Math.max(0, Math.round(parsedPrice * 100))
          : null;

      const response = await clientApi.put<{ data: CourseDetail }>(
        `/api/v1/courses/${course.id}`,
        {
          title,
          description: description || null,
          tags: mergeCourseAccessIntoTags(course.tags, accessSettings),
          accessTier,
          priceCents,
          ...(accessTier === "PAID" ? { currency: currency.trim().toUpperCase() } : {}),
        },
        "course-update",
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

  function handleSubmit() {
    if (!editable || saveMutation.isPending) return;
    saveMutation.mutate();
  }

  const disabled = !editable || saveMutation.isPending;
  const showPricing = !section || section === "pricing-plans";
  const showDripping = !section || section === "content-dripping";
  const showLearningPath = !section || section === "learning-path";

  return (
    <form
      className="flex flex-col gap-6"
      onSubmit={(event) => {
        event.preventDefault();
        void handleSubmit();
      }}
    >
      {!editable ? (
        <p className={`${statusBannerClassName} border-[var(--admin-warning)]/30 bg-[var(--admin-warning)]/10 text-[var(--admin-warning)]`}>
          This course is locked while in review or published.
        </p>
      ) : null}

      {error ? (
        <p
          role="alert"
          className={`${statusBannerClassName} border-[var(--admin-danger)]/30 bg-[var(--admin-danger)]/10 text-[var(--admin-danger)]`}
        >
          {error}
        </p>
      ) : null}

      {showPricing ? (
        <section className={builderSectionClassName}>
          <div className={builderSectionHeaderClassName}>
            <h2 className={builderSectionTitleClassName}>Pricing</h2>
          </div>
          <div className={builderSectionBodyClassName}>
            <div className="inline-flex w-fit rounded-xl bg-[var(--admin-surface-high)] p-1">
              {(["FREE", "PAID"] as const).map((tier) => (
                <label
                  key={tier}
                  className={[
                    "cursor-pointer rounded-lg px-6 py-2 text-sm font-semibold transition-all",
                    accessTier === tier
                      ? "bg-[var(--admin-surface)] text-[var(--admin-on-surface)] shadow-sm"
                      : "text-[var(--admin-on-surface-variant)]",
                    disabled ? "cursor-not-allowed opacity-60" : "",
                  ].join(" ")}
                >
                  <input
                    type="radio"
                    name="pricing-tier"
                    value={tier}
                    checked={accessTier === tier}
                    disabled={disabled}
                    className="sr-only"
                    onChange={() => {
                      setAccessTier(tier);
                    }}
                  />
                  {tier === "FREE" ? "Free" : "Paid"}
                </label>
              ))}
            </div>
            <p className={`${builderHelperClassName} mt-3`}>
              Select Free to make this course accessible to all academy members.
            </p>

            {accessTier === "PAID" ? (
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label htmlFor="course-price" className={builderFieldLabelClassName}>
                    Price
                  </label>
                  <input
                    id="course-price"
                    type="number"
                    min={0}
                    step="0.01"
                    className={fieldClassName}
                    value={priceAmount}
                    onChange={(event) => {
                      setPriceAmount(event.target.value);
                    }}
                    disabled={disabled}
                    placeholder="49.00"
                  />
                </div>
                <div className="space-y-2">
                  <CourseCurrencyPicker
                    value={currency}
                    onChange={setCurrency}
                    disabled={disabled}
                  />
                </div>
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      {showDripping ? (
        <section className={builderSectionClassName}>
          <div className={builderSectionHeaderClassName}>
            <h2 className={builderSectionTitleClassName}>Drip Schedule</h2>
          </div>
          <div className={`${builderSectionBodyClassName} space-y-5`}>
            <RoleToggle
              label="Enable drip content"
              checked={dripEnabled}
              disabled={disabled}
              onChange={setDripEnabled}
            />
            {dripEnabled ? (
              <div className="space-y-2">
                <label htmlFor="drip-interval" className={builderFieldLabelClassName}>
                  Drip interval (days)
                </label>
                <input
                  id="drip-interval"
                  type="number"
                  min={0}
                  className={fieldClassName}
                  value={dripIntervalDays}
                  onChange={(event) => {
                    setDripIntervalDays(Number(event.target.value));
                  }}
                  disabled={disabled}
                />
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      {showLearningPath ? (
        <section className={builderSectionClassName}>
          <div className={builderSectionHeaderClassName}>
            <h2 className={builderSectionTitleClassName}>Prerequisites</h2>
          </div>
          <div className={`${builderSectionBodyClassName} space-y-3`}>
            <div className="space-y-2">
              <label htmlFor="prerequisite-ids" className={builderFieldLabelClassName}>
                Prerequisite Course IDs
              </label>
              <input
                id="prerequisite-ids"
                className={`${fieldClassName} font-mono text-sm`}
                value={prerequisiteCourseIds}
                onChange={(event) => {
                  setPrerequisiteCourseIds(event.target.value);
                }}
                disabled={disabled}
                placeholder="e.g. uuid-1, uuid-2"
              />
              <p className={builderHelperClassName}>Separate multiple IDs with commas.</p>
            </div>
          </div>
        </section>
      ) : null}

      {editable ? (
        <div className="flex justify-end">
          <button type="submit" disabled={saveMutation.isPending} className={primaryButtonClassName}>
            {saveMutation.isPending ? "Saving…" : "Save settings"}
          </button>
        </div>
      ) : null}
    </form>
  );
}
