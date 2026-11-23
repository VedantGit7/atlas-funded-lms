"use client";

import { useState } from "react";
import { Eye, EyeOff, Radio, Send } from "lucide-react";
import type { z } from "zod";
import type { publishStatusStudioSchema } from "@atlas/contracts/courses/course-authoring-schemas";
import { ClientApiError } from "../../../../lib/client-api";
import { toast } from "../../../../lib/feedback/toast";
import {
  canChangeContentVisibility,
  contentVisibilityAction,
  isUnpublishedInLiveCourse,
  updateLessonVisibility,
  visibilityResultMessage,
} from "../content-visibility";
import { inlineLessonSecondaryButtonClassName } from "./inline-lesson-editor-shared";

type PublishStatus = z.infer<typeof publishStatusStudioSchema>;

type LessonStatusInput = {
  status: PublishStatus;
  moduleStatus: PublishStatus;
  courseStatus: PublishStatus;
};

export type LessonEditorStatus = {
  tone: "live" | "draft" | "hidden" | "locked";
  text: string;
  /** Publish, show or hide, when the course allows it. */
  action: { label: string; visible: boolean } | null;
};

/**
 * What the editor says about who sees this lesson and what saving does, so an
 * author editing a live course knows whether learners see their changes (QA
 * S1.6). Nothing is said in a draft course, where everything waits for review.
 */
export function lessonEditorStatus(lesson: LessonStatusInput): LessonEditorStatus | null {
  const { status, moduleStatus, courseStatus } = lesson;
  if (courseStatus === "REVIEW") {
    return {
      tone: "locked",
      text: "This course is in review. You can edit this lesson after the review.",
      action: null,
    };
  }
  if (courseStatus === "ARCHIVED") {
    return { tone: "locked", text: "This course is archived.", action: null };
  }
  if (courseStatus !== "PUBLISHED") {
    return status === "ARCHIVED"
      ? {
          tone: "hidden",
          text: "Hidden. This lesson stays hidden when the course is approved.",
          action: contentVisibilityAction({ kind: "Lesson", status, courseStatus }),
        }
      : null;
  }

  const action = contentVisibilityAction({ kind: "Lesson", status, courseStatus });
  if (status === "ARCHIVED") {
    return { tone: "hidden", text: "Hidden from learners.", action };
  }
  if (isUnpublishedInLiveCourse(status, courseStatus)) {
    return {
      tone: "draft",
      text: "Draft. Learners can't see this lesson until you publish it.",
      action,
    };
  }
  if (moduleStatus !== "PUBLISHED") {
    return {
      tone: "draft",
      text: "Published, but its section isn't. Learners will see it once the section is published or shown.",
      action,
    };
  }
  return {
    tone: "live",
    text: "Live. Learners see this lesson, and your changes reach them when you save.",
    action,
  };
}

const toneClassName: Record<LessonEditorStatus["tone"], string> = {
  live: "border-[color-mix(in_srgb,var(--admin-success)_30%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-success)_8%,var(--admin-surface))] text-[var(--admin-on-surface)]",
  draft:
    "border-[color-mix(in_srgb,var(--admin-warning)_35%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-warning)_9%,var(--admin-surface))] text-[var(--admin-on-surface)]",
  hidden:
    "border-dashed border-[var(--admin-outline)] bg-[var(--admin-surface-low)] text-[var(--admin-on-surface-variant)]",
  locked:
    "border-[var(--admin-border)] bg-[var(--admin-surface-low)] text-[var(--admin-on-surface-variant)]",
};

const toneIconClassName: Record<LessonEditorStatus["tone"], string> = {
  live: "text-[var(--admin-success)]",
  draft: "text-[var(--admin-warning)]",
  hidden: "text-[var(--admin-on-surface-variant)]",
  locked: "text-[var(--admin-on-surface-variant)]",
};

type LessonStatusStripProps = LessonStatusInput & {
  lessonId: string;
  /** Called with the lesson's new status after publishing, showing or hiding it. */
  onChanged: (status: PublishStatus) => void;
};

export function LessonStatusStrip({
  lessonId,
  status,
  moduleStatus,
  courseStatus,
  onChanged,
}: LessonStatusStripProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const summary = lessonEditorStatus({ status, moduleStatus, courseStatus });
  if (!summary) return null;

  const Icon =
    summary.tone === "live"
      ? Radio
      : summary.tone === "hidden"
        ? EyeOff
        : summary.tone === "draft"
          ? Send
          : Eye;
  const action = canChangeContentVisibility(courseStatus) ? summary.action : null;

  async function runAction() {
    if (!action) return;
    setBusy(true);
    setError(null);
    try {
      const result = await updateLessonVisibility({ lessonId, visible: action.visible });
      toast.success(
        result.visible && courseStatus === "PUBLISHED" && moduleStatus !== "PUBLISHED"
          ? "Lesson published. Learners will see it once its section is visible too."
          : visibilityResultMessage({ kind: "Lesson", before: status, result, courseStatus }),
      );
      onChanged(result.status);
    } catch (actionError) {
      setError(
        actionError instanceof ClientApiError
          ? actionError.message
          : "That didn't work. Try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className={`flex flex-wrap items-center gap-x-4 gap-y-2 border-b px-4 py-2.5 text-sm md:px-6 ${toneClassName[summary.tone]}`}
      role="status"
    >
      <p className="flex min-w-0 flex-1 items-center gap-2">
        <Icon
          className={`h-4 w-4 shrink-0 ${toneIconClassName[summary.tone]}`}
          strokeWidth={2}
          aria-hidden="true"
        />
        <span>{summary.text}</span>
      </p>
      {error ? (
        <p role="alert" className="text-sm text-[var(--admin-danger)]">
          {error}
        </p>
      ) : null}
      {action ? (
        <button
          type="button"
          className={inlineLessonSecondaryButtonClassName}
          disabled={busy}
          onClick={() => {
            void runAction();
          }}
        >
          {busy ? "Saving…" : action.label}
        </button>
      ) : null}
    </div>
  );
}
