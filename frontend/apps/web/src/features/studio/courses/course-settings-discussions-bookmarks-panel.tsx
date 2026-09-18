"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import type { z } from "zod";
import { ClientApiError, clientApi } from "../../../lib/client-api";
import type { studioCourseDetailSchema } from "@atlas/contracts/courses/course-authoring-schemas";
import { statusBannerClassName } from "./course-builder-shared";
import {
  courseDiscussionsBookmarksFromDetail,
  discussionsBookmarksSettingsEqual,
  mergeCourseDiscussionsBookmarksIntoTags,
  type CourseDiscussionsBookmarksSettings,
} from "./course-discussions-bookmarks-settings";
import { CourseSettingsCheckboxField, CourseSettingsFormFooter } from "./course-settings-shared";

type CourseDetail = z.infer<typeof studioCourseDetailSchema>;

type CourseSettingsDiscussionsBookmarksPanelProps = {
  course: CourseDetail;
  editable: boolean;
  onSaved: (course: CourseDetail) => void;
};

const SETTINGS_CARD_CLASSNAME =
  "rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] px-4 py-4 shadow-sm md:px-5 md:py-5";

function formatError(error: unknown): string {
  if (error instanceof ClientApiError) return error.message;
  return "Failed to save discussions and bookmarks settings.";
}

export function CourseSettingsDiscussionsBookmarksPanel({
  course,
  editable,
  onSaved,
}: CourseSettingsDiscussionsBookmarksPanelProps) {
  const savedForm = useMemo(() => courseDiscussionsBookmarksFromDetail(course), [course]);
  const [form, setForm] = useState<CourseDiscussionsBookmarksSettings>(savedForm);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setForm(courseDiscussionsBookmarksFromDetail(course));
  }, [course]);

  const saveMutation = useMutation({
    mutationFn: async (nextForm: CourseDiscussionsBookmarksSettings) => {
      const response = await clientApi.put<{ data: CourseDetail }>(
        `/api/v1/courses/${course.id}`,
        {
          tags: mergeCourseDiscussionsBookmarksIntoTags(course.tags, nextForm),
        },
        "course-discussions-bookmarks-update",
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
  const isDirty = !discussionsBookmarksSettingsEqual(form, savedForm);

  function updateForm(patch: Partial<CourseDiscussionsBookmarksSettings>) {
    setForm((current) => {
      const next = { ...current, ...patch };

      if (!next.discussions) {
        next.privateDiscussions = false;
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

      <div className="space-y-4">
        <div className={SETTINGS_CARD_CLASSNAME}>
          <CourseSettingsCheckboxField
            id="discussions-enabled"
            label="Discussions"
            description="Enable discussions to allow to create discussion forums to ask questions, and clear doubts"
            checked={form.discussions}
            disabled={disabled}
            onChange={(checked) => {
              updateForm({ discussions: checked });
            }}
          />
        </div>

        <div className={SETTINGS_CARD_CLASSNAME}>
          <CourseSettingsCheckboxField
            id="private-discussions-enabled"
            label="Private Discussions"
            description="Enable private discussions to allow students to ask questions and clear doubts privately. These discussions will be visible to teachers only."
            checked={form.privateDiscussions}
            disabled={disabled || !form.discussions}
            onChange={(checked) => {
              updateForm({ privateDiscussions: checked });
            }}
          />
        </div>

        <div className={SETTINGS_CARD_CLASSNAME}>
          <CourseSettingsCheckboxField
            id="bookmarks-enabled"
            label="Bookmarks"
            description="Enable bookmarks to allow learners bookmark a course content and also add new notes if required while learning"
            checked={form.bookmarks}
            disabled={disabled}
            onChange={(checked) => {
              updateForm({ bookmarks: checked });
            }}
          />
        </div>
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
