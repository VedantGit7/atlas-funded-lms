"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import type { z } from "zod";
import { ClientApiError, clientApi } from "../../../lib/client-api";
import type { studioCourseDetailSchema } from "@atlas/contracts/courses/course-authoring-schemas";
import { inlineExpandClassName } from "./admin-form-dropdown-shared";
import { statusBannerClassName } from "./course-builder-shared";
import {
  certificatesSettingsEqual,
  courseCertificatesFromDetail,
  isCertificateConfigurationComplete,
  mergeCourseCertificatesIntoTags,
  type CourseCertificatesSettings,
} from "./course-certificates-settings";
import { CourseSettingsCertificatesConfigurePanel } from "./course-settings-certificates-configure-panel";
import {
  CourseSettingsFormFooter,
  CourseSettingsNavigationRow,
  CourseSettingsToggleCard,
} from "./course-settings-shared";

type CourseDetail = z.infer<typeof studioCourseDetailSchema>;
type CertificatesView = "main" | "configure";

type CourseSettingsCertificatesPanelProps = {
  course: CourseDetail;
  editable: boolean;
  onSaved: (course: CourseDetail) => void;
};

function formatError(error: unknown): string {
  if (error instanceof ClientApiError) return error.message;
  return "Failed to save certificate settings.";
}

export function CourseSettingsCertificatesPanel({
  course,
  editable,
  onSaved,
}: CourseSettingsCertificatesPanelProps) {
  const savedForm = useMemo(() => courseCertificatesFromDetail(course), [course]);
  const [form, setForm] = useState<CourseCertificatesSettings>(savedForm);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<CertificatesView>("main");

  useEffect(() => {
    setForm(courseCertificatesFromDetail(course));
  }, [course]);

  const saveMutation = useMutation({
    mutationFn: async (nextForm: CourseCertificatesSettings) => {
      const response = await clientApi.put<{ data: CourseDetail }>(
        `/api/v1/courses/${course.id}`,
        {
          tags: mergeCourseCertificatesIntoTags(course.tags, nextForm),
        },
        "course-certificates-update",
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
  const isDirty = !certificatesSettingsEqual(form, savedForm);
  const showConfigurationWarning =
    form.enabled && (!form.templateId || !isCertificateConfigurationComplete(form));

  function updateForm(patch: Partial<CourseCertificatesSettings>) {
    setForm((current) => {
      const next = { ...current, ...patch };
      if (patch.enabled === false) {
        next.templateId = null;
        next.certificateTests = [];
        next.completionCriteriaPercent = null;
        next.attemptMode = null;
        setView("main");
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
      <CourseSettingsCertificatesConfigurePanel
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

      <div className="space-y-4">
        <CourseSettingsToggleCard
          id="certificates-enabled"
          title="Certificates"
          description="Enable course certification for your learners to issue certificates based on determined criteria"
          checked={form.enabled}
          disabled={disabled}
          onChange={(checked) => {
            updateForm({ enabled: checked });
          }}
        />

        {form.enabled ? (
          <div className={`space-y-4 ${inlineExpandClassName}`}>
            <CourseSettingsNavigationRow
              title="Configure certificates"
              description="Configure certificate settings and add tests to issue certificates"
              disabled={false}
              onClick={() => {
                setView("configure");
              }}
            />

            {showConfigurationWarning ? (
              <p className="text-sm leading-relaxed text-[var(--admin-danger)]">
                Note: Please configure the certificate for learners to download on their interface.
              </p>
            ) : null}

            <CourseSettingsNavigationRow
              title="Design Certificates"
              description="Design customised certificates in minutes with easy to use certificate templates"
              href="/admin/certificate-builder/home"
              openInNewTab
            />
          </div>
        ) : null}
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
