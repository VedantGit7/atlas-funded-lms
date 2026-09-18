"use client";

import { useId, useMemo, useState } from "react";
import { CircleHelp } from "lucide-react";
import type { z } from "zod";
import type { studioCourseDetailSchema } from "@atlas/contracts/courses/course-authoring-schemas";
import {
  coursePricingPlansFromDetail,
  createPricingPlanDraftFromKind,
  PRICING_PLAN_DEFAULT_LOCATION,
  resolvePricingPlanExpiryDate,
  toPricingPlanIsoDate,
  validityDaysUntilPricingPlanExpiry,
  PRICING_PLAN_SHORT_DESCRIPTION_MAX_LENGTH,
  PRICING_PLAN_TITLE_MAX_LENGTH,
  type CoursePricingPlanItem,
} from "./course-pricing-plan-settings";
import {
  formatCoursePricingPlanError,
  saveCoursePricingPlans,
} from "./course-pricing-plans-client";
import {
  PricingPlanFieldLabel,
  PricingPlanFormShell,
  PricingPlanRadioCardGroup,
  PricingPlanSectionTitle,
  PricingPlanTextarea,
  PricingPlanTextInput,
  PricingPlanValidityModeField,
} from "./course-pricing-plan-form-shared";
import { PricingPlanLocationPicker } from "./pricing-plan-location-picker";
import { PricingPlanRenewalPlanPicker } from "./pricing-plan-renewal-plan-picker";
import { createClientUuid } from "../../../lib/client-api";

type CourseDetail = z.infer<typeof studioCourseDetailSchema>;

type CourseEditFreePricingPlanScreenProps = {
  course: CourseDetail;
  planId: string | null;
  disabled: boolean;
  onBack: () => void;
  onSaved: (course: CourseDetail) => void;
};

type FreePlanDraft = Omit<CoursePricingPlanItem, "id" | "position">;

const VISIBILITY_OPTIONS = [
  {
    value: "PUBLIC" as const,
    title: "Public",
    description:
      "Make it a public type to allow easy access to all the learners without any restriction.",
  },
  {
    value: "PRIVATE" as const,
    title: "Private",
    description:
      "Make it a private type to allow access to only the invited students with whom you share.",
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

export function CourseEditFreePricingPlanScreen({
  course,
  planId,
  disabled,
  onBack,
  onSaved,
}: CourseEditFreePricingPlanScreenProps) {
  const titleId = useId();
  const shortDescriptionId = useId();
  const longDescriptionId = useId();
  const validityId = useId();
  const expiryId = useId();
  const locationId = useId();
  const renewalPlanId = useId();

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

  const [draft, setDraft] = useState<FreePlanDraft>(() =>
    editingPlan
      ? {
          title: editingPlan.title,
          planKind: editingPlan.planKind,
          type: editingPlan.type,
          priceCents: 0,
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
      : createPricingPlanDraftFromKind(course, existingPlans, "FREE"),
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    const title = draft.title.trim();
    if (!title || disabled || saving) return;

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
        planKind: "FREE",
        type: "FREE",
        priceCents: 0,
        currency: draft.currency.trim().toUpperCase(),
        validityDays:
          draft.validityMode === "EXPIRY" && resolvedExpiryDate
            ? validityDaysUntilPricingPlanExpiry(resolvedExpiryDate)
            : Math.max(1, draft.validityDays),
        location: draft.location.trim() || PRICING_PLAN_DEFAULT_LOCATION,
        isDefault: draft.isDefault,
        oneToOneTemplate: null,
        paymentGateway: null,
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
        discountPriceCents: null,
        trialDurationDays: 0,
        allowCouponCode: false,
        offerLabel: "",
        coursePriceCents: null,
        offerStartAt: null,
        offerEndAt: null,
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
      breadcrumbCurrentLabel="Free Plan"
      title="Free Plan"
      subtitle="Add a free plan for your course"
      error={error}
      saving={saving}
      disabled={disabled}
      saveDisabled={draft.title.trim().length === 0}
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
            placeholder="Free Plan"
            onChange={(value) => {
              setDraft((current) => ({ ...current, title: value }));
            }}
          />
        </section>

        <section className="space-y-2">
          <PricingPlanFieldLabel
            htmlFor={shortDescriptionId}
            tooltip="A short summary shown in plan listings and checkout previews."
            counter={{
              current: draft.shortDescription.length,
              max: PRICING_PLAN_SHORT_DESCRIPTION_MAX_LENGTH,
            }}
          >
            Short Description
          </PricingPlanFieldLabel>
          <PricingPlanTextInput
            id={shortDescriptionId}
            value={draft.shortDescription}
            maxLength={PRICING_PLAN_SHORT_DESCRIPTION_MAX_LENGTH}
            disabled={disabled || saving}
            placeholder="Enter short description"
            onChange={(value) => {
              setDraft((current) => ({ ...current, shortDescription: value }));
            }}
          />
        </section>

        <section className="space-y-2">
          <PricingPlanFieldLabel
            htmlFor={longDescriptionId}
            tooltip="Optional extended description for learners reviewing this plan."
          >
            Long Description
          </PricingPlanFieldLabel>
          <PricingPlanTextarea
            id={longDescriptionId}
            value={draft.longDescription}
            disabled={disabled || saving}
            placeholder="Enter long description"
            onChange={(value) => {
              setDraft((current) => ({ ...current, longDescription: value }));
            }}
          />
        </section>

        <section>
          <PricingPlanSectionTitle title="Visibility" />
          <PricingPlanRadioCardGroup
            name="free-plan-visibility"
            value={draft.accessibility}
            disabled={disabled || saving}
            options={VISIBILITY_OPTIONS}
            onChange={(value) => {
              setDraft((current) => ({ ...current, accessibility: value }));
            }}
          />
        </section>

        <PricingPlanValidityModeField
          mode={draft.validityMode}
          validityId={validityId}
          expiryId={expiryId}
          validityDays={draft.validityDays}
          expiryDate={resolvePricingPlanExpiryDate(draft.expiryDate, draft.validityDays)}
          disabled={disabled || saving}
          radioName="free-plan-validity-mode"
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
          <label className="flex items-start gap-3 text-sm text-[var(--admin-on-surface)]">
            <input
              type="checkbox"
              checked={draft.allowReEnroll}
              disabled={disabled || saving}
              className="mt-0.5 h-4 w-4 rounded border-[var(--admin-border)] text-[var(--admin-primary)]"
              onChange={(event) => {
                setDraft((current) => ({ ...current, allowReEnroll: event.target.checked }));
              }}
            />
            <span>
              <span className="inline-flex items-center gap-1.5 font-semibold">
                Allow Re-Enroll
                <span
                  title="Enable this option to permit learners to re-enroll in this plan."
                  className="text-[var(--admin-on-surface-variant)]"
                  aria-label="Enable this option to permit learners to re-enroll in this plan."
                >
                  <CircleHelp className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
                </span>
              </span>
              <span className="mt-1 block text-[var(--admin-on-surface-variant)]">
                Enable this option to permit learners to re-enroll in this plan
              </span>
            </span>
          </label>
        </section>

        <section>
          <PricingPlanSectionTitle title="Plan Type" />
          <PricingPlanRadioCardGroup
            name="free-plan-audience"
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
