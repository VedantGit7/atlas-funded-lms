"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import type { z } from "zod";
import { ClientApiError, clientApi } from "../../../lib/client-api";
import type { studioCourseDetailSchema } from "@atlas/contracts/courses/course-authoring-schemas";
import { inlineExpandClassName } from "./admin-form-dropdown-shared";
import { statusBannerClassName } from "./course-builder-shared";
import {
  courseLearnerConfigurationsFromDetail,
  learnerConfigurationsSettingsEqual,
  mergeCourseLearnerConfigurationsIntoTags,
  type CourseLearnerConfigurationsSettings,
} from "./course-learner-configurations-settings";
import {
  CourseSettingsCheckboxField,
  CourseSettingsFormFooter,
  CourseSettingsSectionBlock,
  courseSettingsCardClassName,
} from "./course-settings-shared";

type CourseDetail = z.infer<typeof studioCourseDetailSchema>;

type CourseSettingsLearnerConfigurationsPanelProps = {
  course: CourseDetail;
  editable: boolean;
  onSaved: (course: CourseDetail) => void;
};

const CHECKOUT_FIELD_OPTIONS: Array<{
  id: string;
  key: keyof Pick<
    CourseLearnerConfigurationsSettings,
    "requestCompleteGstinAddress" | "requestDateOfBirth" | "requestPan"
  >;
  label: string;
  description: string;
}> = [
  {
    id: "learner-request-gstin",
    key: "requestCompleteGstinAddress",
    label: "Request complete GSTIN address",
    description:
      "If this option is enabled, Learners will be allowed to provide their GSTIN details during payment checkout",
  },
  {
    id: "learner-request-dob",
    key: "requestDateOfBirth",
    label: "Request Date of Birth",
    description:
      "If this option is enabled, Learners will be requested to provide their date of birth during payment checkout",
  },
  {
    id: "learner-request-pan",
    key: "requestPan",
    label: "Request PAN",
    description:
      "If this option is enabled, Learners will be requested to provide their PAN during payment checkout",
  },
];

function formatError(error: unknown): string {
  if (error instanceof ClientApiError) return error.message;
  return "Failed to save learner configuration settings.";
}

export function CourseSettingsLearnerConfigurationsPanel({
  course,
  editable,
  onSaved,
}: CourseSettingsLearnerConfigurationsPanelProps) {
  const savedForm = useMemo(() => courseLearnerConfigurationsFromDetail(course), [course]);
  const [form, setForm] = useState<CourseLearnerConfigurationsSettings>(savedForm);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setForm(courseLearnerConfigurationsFromDetail(course));
  }, [course]);

  const saveMutation = useMutation({
    mutationFn: async (nextForm: CourseLearnerConfigurationsSettings) => {
      const response = await clientApi.put<{ data: CourseDetail }>(
        `/api/v1/courses/${course.id}`,
        {
          tags: mergeCourseLearnerConfigurationsIntoTags(course.tags, nextForm),
        },
        "course-learner-configurations-update",
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
  const isDirty = !learnerConfigurationsSettingsEqual(form, savedForm);

  function updateForm(patch: Partial<CourseLearnerConfigurationsSettings>) {
    setForm((current) => {
      const next = { ...current, ...patch };

      if (patch.enableInvoices === false) {
        next.showBillingDetails = false;
        next.allowInvoiceDownload = false;
      }

      return next;
    });
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
        <div className={`space-y-4 ${inlineExpandClassName}`}>
          {CHECKOUT_FIELD_OPTIONS.map((option) => (
            <div key={option.id} className={courseSettingsCardClassName}>
              <CourseSettingsCheckboxField
                id={option.id}
                label={option.label}
                description={option.description}
                checked={form[option.key]}
                disabled={disabled}
                onChange={(checked) => {
                  updateForm({ [option.key]: checked });
                }}
              />
            </div>
          ))}
        </div>

        <CourseSettingsSectionBlock
          title="Invoice settings"
          description="Configure billing records and invoice access for learners enrolled in this course"
        >
          <div className="space-y-4">
            <div className={courseSettingsCardClassName}>
              <CourseSettingsCheckboxField
                id="learner-invoices-enabled"
                label="Invoices"
                description="Enable invoices to generate billing records for learners enrolled in this course."
                checked={form.enableInvoices}
                disabled={disabled}
                onChange={(checked) => {
                  updateForm({ enableInvoices: checked });
                }}
              />
            </div>

            {form.enableInvoices ? (
              <div className={`space-y-4 ${inlineExpandClassName}`}>
                <div className={courseSettingsCardClassName}>
                  <CourseSettingsCheckboxField
                    id="learner-billing-details"
                    label="Billing Details"
                    description="Show billing details to learners during checkout and inside their account settings."
                    checked={form.showBillingDetails}
                    disabled={disabled}
                    onChange={(checked) => {
                      updateForm({ showBillingDetails: checked });
                    }}
                  />
                </div>

                <div className={courseSettingsCardClassName}>
                  <CourseSettingsCheckboxField
                    id="learner-invoice-download"
                    label="Invoice Download"
                    description="Allow learners to download invoices for purchases related to this course."
                    checked={form.allowInvoiceDownload}
                    disabled={disabled}
                    onChange={(checked) => {
                      updateForm({ allowInvoiceDownload: checked });
                    }}
                  />
                </div>
              </div>
            ) : null}
          </div>
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
