"use client";

import { useId, useMemo, useState } from "react";
import { ChevronLeft } from "lucide-react";
import type { z } from "zod";
import type { studioCourseDetailSchema } from "@atlas/contracts/courses/course-authoring-schemas";
import { inlineExpandClassName } from "./admin-form-dropdown-shared";
import {
  builderFieldLabelClassName,
  builderHelperClassName,
  fieldClassName,
} from "./course-builder-shared";
import { CourseCurrencyPicker } from "./course-currency-picker";
import { lessonInputClassName } from "../lessons/lesson-editor-shared";
import { CourseEditFreePricingPlanScreen } from "./course-edit-free-pricing-plan-screen";
import { CourseEditOneTimePricingPlanScreen } from "./course-edit-one-time-pricing-plan-screen";
import { CourseEditLimitedTimePricingPlanScreen } from "./course-edit-limited-time-pricing-plan-screen";
import {
  coursePricingPlansFromDetail,
  createPricingPlanDraftFromKind,
  pricingPlanKindLabel,
  type CoursePricingPlanAccessibility,
  type CoursePricingPlanItem,
  type CoursePricingPlanKind,
  type CoursePricingPlanStatus,
  type CoursePricingPlanType,
} from "./course-pricing-plan-settings";
import {
  formatCoursePricingPlanError,
  saveCoursePricingPlans,
} from "./course-pricing-plans-client";
import { createClientUuid } from "../../../lib/client-api";
import {
  inlineLessonGhostButtonClassName,
  inlineLessonPrimaryDarkButtonClassName,
  inlineLessonSecondaryButtonClassName,
} from "./inline-lesson-editor/inline-lesson-editor-shared";
import { LessonSettingsFieldLabel } from "./inline-lesson-editor/inline-lesson-settings-shared";

type CourseDetail = z.infer<typeof studioCourseDetailSchema>;

type CourseEditPricingPlanScreenProps = {
  course: CourseDetail;
  planId: string | null;
  planKind: CoursePricingPlanKind | null;
  disabled: boolean;
  onBack: () => void;
  onSaved: (course: CourseDetail) => void;
};

type PricingPlanDraft = Omit<CoursePricingPlanItem, "id" | "position">;

const STATUS_OPTIONS: CoursePricingPlanStatus[] = [
  "DRAFT",
  "PUBLISHED",
  "UNPUBLISHED",
  "ARCHIVED",
];

const ACCESSIBILITY_OPTIONS: CoursePricingPlanAccessibility[] = ["PUBLIC", "PRIVATE"];

function statusLabel(status: CoursePricingPlanStatus): string {
  if (status === "UNPUBLISHED") return "Unpublished";
  return status.charAt(0) + status.slice(1).toLowerCase();
}

function accessibilityLabel(value: CoursePricingPlanAccessibility): string {
  return value.charAt(0) + value.slice(1).toLowerCase();
}

export function CourseEditPricingPlanScreen({
  course,
  planId,
  planKind,
  disabled,
  onBack,
  onSaved,
}: CourseEditPricingPlanScreenProps) {
  const existingPlans = useMemo(() => coursePricingPlansFromDetail(course), [course]);
  const editingPlan = planId ? existingPlans.find((item) => item.id === planId) : null;
  const selectedKind = editingPlan?.planKind ?? planKind ?? "FREE";

  if (selectedKind === "FREE") {
    return (
      <CourseEditFreePricingPlanScreen
        course={course}
        planId={planId}
        disabled={disabled}
        onBack={onBack}
        onSaved={onSaved}
      />
    );
  }

  if (selectedKind === "ONE_TIME") {
    return (
      <CourseEditOneTimePricingPlanScreen
        course={course}
        planId={planId}
        disabled={disabled}
        onBack={onBack}
        onSaved={onSaved}
      />
    );
  }

  if (selectedKind === "LIMITED_TIME") {
    return (
      <CourseEditLimitedTimePricingPlanScreen
        course={course}
        planId={planId}
        disabled={disabled}
        onBack={onBack}
        onSaved={onSaved}
      />
    );
  }

  return (
    <CourseEditStandardPricingPlanScreen
      course={course}
      planId={planId}
      planKind={selectedKind}
      disabled={disabled}
      onBack={onBack}
      onSaved={onSaved}
      existingPlans={existingPlans}
      editingPlan={editingPlan ?? null}
    />
  );
}

type CourseEditStandardPricingPlanScreenProps = CourseEditPricingPlanScreenProps & {
  existingPlans: CoursePricingPlanItem[];
  editingPlan: CoursePricingPlanItem | null;
};

function CourseEditStandardPricingPlanScreen({
  course,
  planId,
  disabled,
  onBack,
  onSaved,
  existingPlans,
  editingPlan,
  planKind,
}: CourseEditStandardPricingPlanScreenProps) {
  const titleId = useId();
  const isEditing = Boolean(editingPlan);
  const selectedKind = editingPlan?.planKind ?? planKind ?? "ONE_TIME";

  const [draft, setDraft] = useState<PricingPlanDraft>(() =>
    editingPlan
      ? {
          title: editingPlan.title,
          planKind: editingPlan.planKind,
          type: editingPlan.type,
          priceCents: editingPlan.priceCents,
          currency: editingPlan.currency,
          validityDays: editingPlan.validityDays,
          location: editingPlan.location,
          isDefault: editingPlan.isDefault,
          oneToOneTemplate: editingPlan.oneToOneTemplate,
          paymentGateway: editingPlan.paymentGateway,
          checkoutUrl: editingPlan.checkoutUrl,
          accessibility: editingPlan.accessibility,
          status: editingPlan.status,
          shortDescription: editingPlan.shortDescription,
          longDescription: editingPlan.longDescription,
          validityMode: editingPlan.validityMode,
          expiryDate: editingPlan.expiryDate,
          renewalPlanId: editingPlan.renewalPlanId,
          allowReEnroll: editingPlan.allowReEnroll,
          audienceType: editingPlan.audienceType,
          discountPriceCents: editingPlan.discountPriceCents,
          trialDurationDays: editingPlan.trialDurationDays,
          allowCouponCode: editingPlan.allowCouponCode,
          offerLabel: editingPlan.offerLabel,
          coursePriceCents: editingPlan.coursePriceCents,
          offerStartAt: editingPlan.offerStartAt,
          offerEndAt: editingPlan.offerEndAt,
        }
      : createPricingPlanDraftFromKind(course, existingPlans, selectedKind),
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    const title = draft.title.trim();
    if (!title || disabled || saving) return;

    setSaving(true);
    setError(null);

    try {
      const normalized: CoursePricingPlanItem = {
        id: editingPlan?.id ?? createClientUuid(),
        title,
        planKind: draft.planKind,
        type: draft.type,
        priceCents: draft.type === "PAID" ? Math.max(0, draft.priceCents) : 0,
        currency: draft.currency.trim().toUpperCase(),
        validityDays: Math.max(1, draft.validityDays),
        location: draft.location.trim() || "Rest Of The World",
        isDefault: draft.isDefault,
        oneToOneTemplate: draft.oneToOneTemplate?.trim() || null,
        paymentGateway: draft.paymentGateway?.trim() || null,
        checkoutUrl: draft.checkoutUrl?.trim() || null,
        accessibility: draft.accessibility,
        status: draft.status,
        position: editingPlan?.position ?? existingPlans.length,
        shortDescription: draft.shortDescription.trim(),
        longDescription: draft.longDescription.trim(),
        validityMode: draft.validityMode,
        expiryDate: draft.expiryDate,
        renewalPlanId: draft.renewalPlanId,
        allowReEnroll: draft.allowReEnroll,
        audienceType: draft.audienceType,
        discountPriceCents: draft.discountPriceCents,
        trialDurationDays: draft.trialDurationDays,
        allowCouponCode: draft.allowCouponCode,
        offerLabel: draft.offerLabel.trim(),
        coursePriceCents: draft.coursePriceCents,
        offerStartAt: draft.offerStartAt,
        offerEndAt: draft.offerEndAt,
      };

      let nextItems: CoursePricingPlanItem[];

      if (isEditing && editingPlan) {
        nextItems = existingPlans.map((item) =>
          item.id === editingPlan.id ? normalized : draft.isDefault ? { ...item, isDefault: false } : item,
        );
      } else {
        nextItems = [
          ...existingPlans.map((item) =>
            normalized.isDefault ? { ...item, isDefault: false } : item,
          ),
          normalized,
        ];
      }

      const updated = await saveCoursePricingPlans(course, nextItems, {
        successMessage: isEditing
          ? `"${title}" updated successfully`
          : `"${title}" added successfully`,
      });
      onSaved(updated);
    } catch (saveError) {
      setError(formatCoursePricingPlanError(saveError));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={`flex min-h-0 flex-1 flex-col overflow-hidden ${inlineExpandClassName}`}>
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-[var(--admin-surface-low)]">
        <div className="mx-auto w-full max-w-2xl px-4 py-6 md:px-8 md:py-8">
          <button
            type="button"
            className={`${inlineLessonGhostButtonClassName} mb-6 gap-1.5 px-2`}
            disabled={saving}
            onClick={onBack}
          >
            <ChevronLeft className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden="true" />
            Back
          </button>

          <p className="text-sm font-semibold text-[var(--admin-primary-strong)]">
            {isEditing ? "Edit Pricing Plan" : "Add Pricing Plan"}
          </p>
          <header className="mb-6 mt-1">
            <h1 className="text-2xl font-bold text-[var(--admin-on-surface)] md:text-3xl">
              {isEditing ? "Edit Pricing Plan" : "Add Pricing Plan"}
            </h1>
            <p className={`${builderHelperClassName} mt-2`}>
              {isEditing
                ? "Update pricing, validity, and checkout details for this plan."
                : `Configure your ${pricingPlanKindLabel(selectedKind).toLowerCase()}.`}
            </p>
          </header>

          {error ? (
            <p
              role="alert"
              className="mb-6 rounded-lg border border-[var(--admin-danger)]/30 bg-[color-mix(in_srgb,var(--admin-danger)_8%,var(--admin-surface))] px-4 py-3 text-sm text-[var(--admin-danger)]"
            >
              {error}
            </p>
          ) : null}

          <div className="space-y-5 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5">
            <div className="space-y-2">
              <LessonSettingsFieldLabel htmlFor={titleId}>Title</LessonSettingsFieldLabel>
              <input
                id={titleId}
                className={lessonInputClassName}
                value={draft.title}
                disabled={disabled || saving}
                placeholder="Base plan"
                onChange={(event) => {
                  setDraft((current) => ({ ...current, title: event.target.value }));
                }}
              />
            </div>

            <div className="space-y-2">
              <p className={builderFieldLabelClassName}>Type</p>
              <div className="inline-flex w-fit rounded-xl bg-[var(--admin-surface-high)] p-1">
                {(["FREE", "PAID"] as const).map((tier) => (
                  <label
                    key={tier}
                    className={[
                      "cursor-pointer rounded-lg px-5 py-2 text-sm font-semibold transition-all",
                      draft.type === tier
                        ? "bg-[var(--admin-surface)] text-[var(--admin-on-surface)] shadow-sm"
                        : "text-[var(--admin-on-surface-variant)]",
                      disabled || saving || draft.planKind === "FREE" ? "cursor-not-allowed opacity-60" : "",
                    ].join(" ")}
                  >
                    <input
                      type="radio"
                      name="pricing-plan-type"
                      value={tier}
                      checked={draft.type === tier}
                      disabled={disabled || saving || draft.planKind === "FREE"}
                      className="sr-only"
                      onChange={() => {
                        setDraft((current) => ({ ...current, type: tier as CoursePricingPlanType }));
                      }}
                    />
                    {tier === "FREE" ? "Free" : "Paid"}
                  </label>
                ))}
              </div>
              {draft.planKind === "FREE" ? (
                <p className={builderHelperClassName}>Free plans always use a zero price.</p>
              ) : null}
            </div>

            {draft.type === "PAID" ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <LessonSettingsFieldLabel htmlFor="pricing-plan-price">Price</LessonSettingsFieldLabel>
                  <input
                    id="pricing-plan-price"
                    type="number"
                    min={0}
                    step="0.01"
                    className={lessonInputClassName}
                    value={(draft.priceCents / 100).toString()}
                    disabled={disabled || saving}
                    onChange={(event) => {
                      const parsed = Number(event.target.value);
                      setDraft((current) => ({
                        ...current,
                        priceCents: Number.isFinite(parsed) ? Math.max(0, Math.round(parsed * 100)) : 0,
                      }));
                    }}
                  />
                </div>
                <CourseCurrencyPicker
                  value={draft.currency}
                  onChange={(currency) => {
                    setDraft((current) => ({ ...current, currency }));
                  }}
                  disabled={disabled || saving}
                />
              </div>
            ) : null}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <LessonSettingsFieldLabel htmlFor="pricing-plan-validity">
                  Validity (days)
                </LessonSettingsFieldLabel>
                <input
                  id="pricing-plan-validity"
                  type="number"
                  min={1}
                  className={lessonInputClassName}
                  value={draft.validityDays}
                  disabled={disabled || saving}
                  onChange={(event) => {
                    setDraft((current) => ({
                      ...current,
                      validityDays: Math.max(1, Number(event.target.value) || 1),
                    }));
                  }}
                />
              </div>
              <div className="space-y-2">
                <LessonSettingsFieldLabel htmlFor="pricing-plan-location">Location</LessonSettingsFieldLabel>
                <input
                  id="pricing-plan-location"
                  className={lessonInputClassName}
                  value={draft.location}
                  disabled={disabled || saving}
                  onChange={(event) => {
                    setDraft((current) => ({ ...current, location: event.target.value }));
                  }}
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <LessonSettingsFieldLabel htmlFor="pricing-plan-template">
                  1:1 Template
                </LessonSettingsFieldLabel>
                <input
                  id="pricing-plan-template"
                  className={lessonInputClassName}
                  value={draft.oneToOneTemplate ?? ""}
                  disabled={disabled || saving}
                  placeholder="Optional"
                  onChange={(event) => {
                    setDraft((current) => ({
                      ...current,
                      oneToOneTemplate: event.target.value,
                    }));
                  }}
                />
              </div>
              <div className="space-y-2">
                <LessonSettingsFieldLabel htmlFor="pricing-plan-gateway">
                  Payment Gateway
                </LessonSettingsFieldLabel>
                <input
                  id="pricing-plan-gateway"
                  className={lessonInputClassName}
                  value={draft.paymentGateway ?? ""}
                  disabled={disabled || saving}
                  placeholder="Razorpay"
                  onChange={(event) => {
                    setDraft((current) => ({
                      ...current,
                      paymentGateway: event.target.value,
                    }));
                  }}
                />
              </div>
            </div>

            <div className="space-y-2">
              <LessonSettingsFieldLabel htmlFor="pricing-plan-checkout">
                Fast checkout link
              </LessonSettingsFieldLabel>
              <input
                id="pricing-plan-checkout"
                className={lessonInputClassName}
                value={draft.checkoutUrl ?? ""}
                disabled={disabled || saving}
                placeholder="Leave blank to auto-generate"
                onChange={(event) => {
                  setDraft((current) => ({
                    ...current,
                    checkoutUrl: event.target.value,
                  }));
                }}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label htmlFor="pricing-plan-status" className={builderFieldLabelClassName}>
                  Status
                </label>
                <select
                  id="pricing-plan-status"
                  className={fieldClassName}
                  value={draft.status}
                  disabled={disabled || saving}
                  onChange={(event) => {
                    setDraft((current) => ({
                      ...current,
                      status: event.target.value as CoursePricingPlanStatus,
                    }));
                  }}
                >
                  {STATUS_OPTIONS.map((status) => (
                    <option key={status} value={status}>
                      {statusLabel(status)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label htmlFor="pricing-plan-accessibility" className={builderFieldLabelClassName}>
                  Accessibility
                </label>
                <select
                  id="pricing-plan-accessibility"
                  className={fieldClassName}
                  value={draft.accessibility}
                  disabled={disabled || saving}
                  onChange={(event) => {
                    setDraft((current) => ({
                      ...current,
                      accessibility: event.target.value as CoursePricingPlanAccessibility,
                    }));
                  }}
                >
                  {ACCESSIBILITY_OPTIONS.map((value) => (
                    <option key={value} value={value}>
                      {accessibilityLabel(value)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <label className="flex items-center gap-3 text-sm text-[var(--admin-on-surface)]">
              <input
                type="checkbox"
                checked={draft.isDefault}
                disabled={disabled || saving}
                className="h-4 w-4 rounded border-[var(--admin-border)] text-[var(--admin-primary)]"
                onChange={(event) => {
                  setDraft((current) => ({ ...current, isDefault: event.target.checked }));
                }}
              />
              Mark as default plan for this course
            </label>
          </div>

          <div className="mt-6 flex flex-wrap justify-end gap-3">
            <button
              type="button"
              className={inlineLessonSecondaryButtonClassName}
              disabled={saving}
              onClick={onBack}
            >
              Cancel
            </button>
            <button
              type="button"
              className={inlineLessonPrimaryDarkButtonClassName}
              disabled={disabled || saving || draft.title.trim().length === 0}
              onClick={() => {
                void handleSave();
              }}
            >
              {saving ? "Saving…" : isEditing ? "Save plan" : "Add plan"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
