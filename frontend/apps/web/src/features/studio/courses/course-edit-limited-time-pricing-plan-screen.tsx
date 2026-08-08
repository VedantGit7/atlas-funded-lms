"use client";

import { useId, useMemo, useState } from "react";
import type { z } from "zod";
import type { studioCourseDetailSchema } from "@atlas/contracts/courses/course-authoring-schemas";
import {
  coursePricingPlansFromDetail,
  createPricingPlanDraftFromKind,
  PRICING_PLAN_DEFAULT_LOCATION,
  PRICING_PLAN_OFFER_LABEL_MAX_LENGTH,
  PRICING_PLAN_TITLE_MAX_LENGTH,
  resolvePricingPlanExpiryDate,
  toPricingPlanIsoDate,
  validityDaysUntilPricingPlanExpiry,
  type CoursePricingPlanItem,
} from "./course-pricing-plan-settings";
import {
  formatCoursePricingPlanError,
  saveCoursePricingPlans,
} from "./course-pricing-plans-client";
import {
  PricingPlanDaysInput,
  PricingPlanFieldLabel,
  PricingPlanFormShell,
  PricingPlanMoneyInput,
  PricingPlanRadioCardGroup,
  PricingPlanSectionTitle,
  PricingPlanTextarea,
  PricingPlanTextInput,
  PricingPlanValidityModeField,
} from "./course-pricing-plan-form-shared";
import {
  combinePricingPlanDateTime,
  isPricingPlanDateTimeLocal,
  splitPricingPlanDateTime,
} from "./pricing-plan-datetime-utils";
import { PricingPlanLocationPicker } from "./pricing-plan-location-picker";
import { PricingPlanDateTimeRow } from "./pricing-plan-offer-datetime-fields";
import { PricingPlanPaymentGatewayPicker } from "./pricing-plan-payment-gateway-picker";
import { PricingPlanRenewalPlanPicker } from "./pricing-plan-renewal-plan-picker";
import { createClientUuid } from "../../../lib/client-api";

type CourseDetail = z.infer<typeof studioCourseDetailSchema>;

type CourseEditLimitedTimePricingPlanScreenProps = {
  course: CourseDetail;
  planId: string | null;
  disabled: boolean;
  onBack: () => void;
  onSaved: (course: CourseDetail) => void;
};

type LimitedTimePlanDraft = Omit<CoursePricingPlanItem, "id" | "position">;

const ACCESS_TYPE_OPTIONS = [
  {
    value: "PUBLIC" as const,
    title: "Public",
    description:
      "Make it a public type to allow easy access to all the learners without any restriction.",
  },
  {
    value: "PRIVATE" as const,
    title: "Private",
    description: "Make it a private type to allow access to only the invited students with whom you share.",
  },
];

const AUDIENCE_OPTIONS = [
  {
    value: "NORMAL" as const,
    title: "Normal",
    description: "This plan will be visible exclusively to new learners.",
  },
  {
    value: "RENEWAL" as const,
    title: "Renewal",
    description: "This plan will be visible exclusively to renewal learners.",
  },
];

function planDraftFromItem(plan: CoursePricingPlanItem): LimitedTimePlanDraft {
  return {
    title: plan.title,
    planKind: plan.planKind,
    type: plan.type,
    priceCents: plan.priceCents,
    currency: plan.currency,
    validityDays: plan.validityDays,
    location: plan.location,
    isDefault: plan.isDefault,
    oneToOneTemplate: plan.oneToOneTemplate,
    paymentGateway: plan.paymentGateway,
    checkoutUrl: plan.checkoutUrl,
    accessibility: plan.accessibility,
    status: plan.status,
    shortDescription: plan.shortDescription,
    longDescription: plan.longDescription,
    validityMode: plan.validityMode,
    expiryDate: plan.expiryDate,
    renewalPlanId: plan.renewalPlanId,
    allowReEnroll: plan.allowReEnroll,
    audienceType: plan.audienceType,
    discountPriceCents: plan.discountPriceCents,
    trialDurationDays: plan.trialDurationDays,
    allowCouponCode: plan.allowCouponCode,
    offerLabel: plan.offerLabel,
    coursePriceCents: plan.coursePriceCents,
    offerStartAt: plan.offerStartAt,
    offerEndAt: plan.offerEndAt,
  };
}

function patchDateTime(
  current: string | null,
  patch: { date?: string; time?: string },
): string | null {
  const { date, time } = splitPricingPlanDateTime(current);
  const nextDate = patch.date ?? date;
  if (!nextDate) return null;
  return combinePricingPlanDateTime(nextDate, patch.time ?? time ?? "00:00");
}

export function CourseEditLimitedTimePricingPlanScreen({
  course,
  planId,
  disabled,
  onBack,
  onSaved,
}: CourseEditLimitedTimePricingPlanScreenProps) {
  const titleId = useId();
  const offerLabelId = useId();
  const descriptionId = useId();
  const coursePriceId = useId();
  const offerPriceId = useId();
  const offerStartDateId = useId();
  const offerStartTimeId = useId();
  const offerEndDateId = useId();
  const offerEndTimeId = useId();
  const validityId = useId();
  const expiryId = useId();
  const trialDurationId = useId();
  const locationId = useId();
  const renewalPlanId = useId();
  const paymentGatewayId = useId();

  const existingPlans = useMemo(() => coursePricingPlansFromDetail(course), [course]);
  const editingPlan = planId ? existingPlans.find((item) => item.id === planId) : null;
  const isEditing = Boolean(editingPlan);

  const renewalOptions = useMemo(
    () =>
      existingPlans
        .filter((plan) => plan.id !== planId)
        .map((plan) => ({ value: plan.id, label: plan.title })),
    [existingPlans, planId],
  );

  const [draft, setDraft] = useState<LimitedTimePlanDraft>(() =>
    editingPlan
      ? planDraftFromItem(editingPlan)
      : createPricingPlanDraftFromKind(course, existingPlans, "LIMITED_TIME"),
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const offerStartParts = splitPricingPlanDateTime(draft.offerStartAt);
  const offerEndParts = splitPricingPlanDateTime(draft.offerEndAt);

  const canSave =
    draft.title.trim().length > 0 &&
    (draft.coursePriceCents ?? 0) > 0 &&
    draft.priceCents > 0 &&
    draft.offerStartAt != null &&
    isPricingPlanDateTimeLocal(draft.offerStartAt) &&
    draft.offerEndAt != null &&
    isPricingPlanDateTimeLocal(draft.offerEndAt) &&
    Boolean(draft.paymentGateway?.trim());

  async function handleSave() {
    const title = draft.title.trim();
    if (!canSave || disabled || saving) return;

    setSaving(true);
    setError(null);

    try {
      const resolvedExpiryDate =
        draft.validityMode === "EXPIRY"
          ? resolvePricingPlanExpiryDate(draft.expiryDate, draft.validityDays)
          : null;

      const normalized: CoursePricingPlanItem = {
        id: editingPlan?.id ?? createClientUuid(),
        title,
        planKind: "LIMITED_TIME",
        type: "PAID",
        priceCents: Math.max(0, draft.priceCents),
        currency: draft.currency.trim().toUpperCase(),
        validityDays:
          draft.validityMode === "EXPIRY" && resolvedExpiryDate
            ? validityDaysUntilPricingPlanExpiry(resolvedExpiryDate)
            : Math.max(1, draft.validityDays),
        location: draft.location.trim() || PRICING_PLAN_DEFAULT_LOCATION,
        isDefault: draft.isDefault,
        oneToOneTemplate: draft.oneToOneTemplate,
        paymentGateway: draft.paymentGateway?.trim() || null,
        checkoutUrl: draft.checkoutUrl?.trim() || null,
        accessibility: draft.accessibility,
        status: draft.status,
        position: editingPlan?.position ?? existingPlans.length,
        shortDescription: draft.shortDescription.trim(),
        longDescription: draft.longDescription.trim(),
        validityMode: draft.validityMode,
        expiryDate: resolvedExpiryDate,
        renewalPlanId: draft.renewalPlanId,
        allowReEnroll: draft.allowReEnroll,
        audienceType: draft.audienceType,
        discountPriceCents: draft.discountPriceCents,
        trialDurationDays: Math.max(0, draft.trialDurationDays),
        allowCouponCode: draft.allowCouponCode,
        offerLabel: draft.offerLabel.trim(),
        coursePriceCents: draft.coursePriceCents,
        offerStartAt: draft.offerStartAt,
        offerEndAt: draft.offerEndAt,
      };

      let nextItems: CoursePricingPlanItem[];

      if (isEditing && editingPlan) {
        nextItems = existingPlans.map((item) =>
          item.id === editingPlan.id
            ? normalized
            : normalized.isDefault
              ? { ...item, isDefault: false }
              : item,
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
    <PricingPlanFormShell
      breadcrumbParentLabel="Pricing Plans"
      breadcrumbCurrentLabel="Limited Time Offer Plan"
      title="Limited Time Offer Plan"
      subtitle="Add limited time offers for your product"
      error={error}
      saving={saving}
      disabled={disabled}
      saveDisabled={!canSave}
      saveLabel={isEditing ? "Save pricing plan" : "Add pricing plan"}
      onBack={onBack}
      onCancel={onBack}
      onSave={() => {
        void handleSave();
      }}
    >
      <div className="space-y-8">
        <section className="space-y-2">
          <PricingPlanFieldLabel
            htmlFor={titleId}
            required
            counter={{ current: draft.title.length, max: PRICING_PLAN_TITLE_MAX_LENGTH }}
          >
            Plan Title
          </PricingPlanFieldLabel>
          <PricingPlanTextInput
            id={titleId}
            value={draft.title}
            maxLength={PRICING_PLAN_TITLE_MAX_LENGTH}
            disabled={disabled || saving}
            placeholder="Limited time offer plan"
            onChange={(value) => {
              setDraft((current) => ({ ...current, title: value }));
            }}
          />
        </section>

        <section className="space-y-2">
          <PricingPlanFieldLabel
            htmlFor={offerLabelId}
            counter={{ current: draft.offerLabel.length, max: PRICING_PLAN_OFFER_LABEL_MAX_LENGTH }}
          >
            Offer Label
          </PricingPlanFieldLabel>
          <PricingPlanTextInput
            id={offerLabelId}
            value={draft.offerLabel}
            maxLength={PRICING_PLAN_OFFER_LABEL_MAX_LENGTH}
            disabled={disabled || saving}
            placeholder="Enter offer label"
            onChange={(value) => {
              setDraft((current) => ({ ...current, offerLabel: value }));
            }}
          />
        </section>

        <section className="space-y-2">
          <PricingPlanFieldLabel
            htmlFor={descriptionId}
            tooltip="Describe the limited-time offer shown to learners."
          >
            Description
          </PricingPlanFieldLabel>
          <PricingPlanTextarea
            id={descriptionId}
            value={draft.longDescription}
            disabled={disabled || saving}
            placeholder="Enter description"
            onChange={(value) => {
              setDraft((current) => ({ ...current, longDescription: value }));
            }}
          />
        </section>

        <section>
          <PricingPlanSectionTitle title="Access Type" required />
          <PricingPlanRadioCardGroup
            name="limited-time-plan-access"
            value={draft.accessibility}
            disabled={disabled || saving}
            options={ACCESS_TYPE_OPTIONS}
            onChange={(value) => {
              setDraft((current) => ({ ...current, accessibility: value }));
            }}
          />
        </section>

        <section className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <PricingPlanFieldLabel
              htmlFor={coursePriceId}
              required
              tooltip="The standard course price before the limited-time discount."
            >
              Course Price
            </PricingPlanFieldLabel>
            <PricingPlanMoneyInput
              id={coursePriceId}
              valueCents={draft.coursePriceCents}
              disabled={disabled || saving}
              placeholder="Enter course price"
              onChange={(valueCents) => {
                setDraft((current) => ({ ...current, coursePriceCents: valueCents }));
              }}
            />
          </div>
          <div className="space-y-2">
            <PricingPlanFieldLabel
              htmlFor={offerPriceId}
              required
              tooltip="The discounted price learners pay during this offer window."
            >
              Offer Price
            </PricingPlanFieldLabel>
            <PricingPlanMoneyInput
              id={offerPriceId}
              valueCents={draft.priceCents > 0 ? draft.priceCents : null}
              disabled={disabled || saving}
              placeholder="Enter offer price here"
              onChange={(valueCents) => {
                setDraft((current) => ({
                  ...current,
                  priceCents: valueCents ?? 0,
                }));
              }}
            />
          </div>
        </section>

        <section>
          <PricingPlanSectionTitle title="Offer Duration" />
          <div className="space-y-5">
            <div className="space-y-2">
              <PricingPlanFieldLabel required>Start Date &amp; Time</PricingPlanFieldLabel>
              <PricingPlanDateTimeRow
                dateId={offerStartDateId}
                timeId={offerStartTimeId}
                dateValue={offerStartParts.date}
                timeValue={offerStartParts.time}
                disabled={disabled || saving}
                onDateChange={(date) => {
                  setDraft((current) => ({
                    ...current,
                    offerStartAt: patchDateTime(current.offerStartAt, { date }),
                  }));
                }}
                onTimeChange={(time) => {
                  setDraft((current) => ({
                    ...current,
                    offerStartAt: patchDateTime(current.offerStartAt, { time }),
                  }));
                }}
              />
            </div>
            <div className="space-y-2">
              <PricingPlanFieldLabel required>End Date &amp; Time</PricingPlanFieldLabel>
              <PricingPlanDateTimeRow
                dateId={offerEndDateId}
                timeId={offerEndTimeId}
                dateValue={offerEndParts.date}
                timeValue={offerEndParts.time}
                disabled={disabled || saving}
                datePlaceholder="Select date"
                onDateChange={(date) => {
                  setDraft((current) => ({
                    ...current,
                    offerEndAt: patchDateTime(current.offerEndAt, { date }),
                  }));
                }}
                onTimeChange={(time) => {
                  setDraft((current) => ({
                    ...current,
                    offerEndAt: patchDateTime(current.offerEndAt, { time }),
                  }));
                }}
              />
            </div>
          </div>
        </section>

        <PricingPlanValidityModeField
          mode={draft.validityMode}
          validityId={validityId}
          expiryId={expiryId}
          validityDays={draft.validityDays}
          expiryDate={resolvePricingPlanExpiryDate(draft.expiryDate, draft.validityDays)}
          disabled={disabled || saving}
          required
          radioName="limited-time-plan-validity-mode"
          onModeChange={(value) => {
            setDraft((current) => ({
              ...current,
              validityMode: value,
              ...(value === "EXPIRY" && !current.expiryDate
                ? { expiryDate: toPricingPlanIsoDate(new Date()) }
                : {}),
            }));
          }}
          onValidityDaysChange={(value) => {
            setDraft((current) => ({ ...current, validityDays: value }));
          }}
          onExpiryDateChange={(value) => {
            setDraft((current) => ({ ...current, expiryDate: value }));
          }}
        />

        <section className="space-y-2">
          <PricingPlanFieldLabel
            htmlFor={trialDurationId}
            tooltip="Number of trial days offered before billing begins."
          >
            Trial Duration
          </PricingPlanFieldLabel>
          <PricingPlanDaysInput
            id={trialDurationId}
            value={draft.trialDurationDays}
            disabled={disabled || saving}
            onChange={(value) => {
              setDraft((current) => ({ ...current, trialDurationDays: value }));
            }}
          />
        </section>

        <section>
          <PricingPlanLocationPicker
            id={locationId}
            value={draft.location}
            disabled={disabled || saving}
            onChange={(value) => {
              setDraft((current) => ({ ...current, location: value }));
            }}
          />
        </section>

        <section>
          <PricingPlanRenewalPlanPicker
            id={renewalPlanId}
            value={draft.renewalPlanId}
            disabled={disabled || saving}
            options={renewalOptions}
            onChange={(value) => {
              setDraft((current) => ({ ...current, renewalPlanId: value }));
            }}
          />
        </section>

        <section>
          <PricingPlanPaymentGatewayPicker
            id={paymentGatewayId}
            value={draft.paymentGateway}
            disabled={disabled || saving}
            onChange={(value) => {
              setDraft((current) => ({ ...current, paymentGateway: value }));
            }}
          />
        </section>

        <section>
          <label className="flex items-start gap-3 text-sm text-[var(--admin-on-surface)]">
            <input
              type="checkbox"
              checked={draft.allowCouponCode}
              disabled={disabled || saving}
              className="mt-0.5 h-4 w-4 rounded border-[var(--admin-border)] text-[var(--admin-primary)]"
              onChange={(event) => {
                setDraft((current) => ({ ...current, allowCouponCode: event.target.checked }));
              }}
            />
            <span>
              <span className="block font-semibold">Coupon Code</span>
              <span className="mt-1 block text-[var(--admin-on-surface-variant)]">
                Enable to allow learners to apply coupon code while making the purchase
              </span>
            </span>
          </label>
        </section>

        <section>
          <PricingPlanSectionTitle title="Plan Type" />
          <PricingPlanRadioCardGroup
            name="limited-time-plan-audience"
            value={draft.audienceType}
            disabled={disabled || saving}
            options={AUDIENCE_OPTIONS}
            onChange={(value) => {
              setDraft((current) => ({ ...current, audienceType: value }));
            }}
          />
        </section>
      </div>
    </PricingPlanFormShell>
  );
}
