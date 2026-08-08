"use client";

import type { z } from "zod";
import type { studioCourseDetailSchema } from "@atlas/contracts/courses/course-authoring-schemas";
import { CourseSettingsAssociatedContentsPanel } from "./course-settings-associated-contents-panel";
import { CourseSettingsMoveToTrashPanel } from "./course-settings-move-to-trash-panel";
import { CourseSettingsRemoveLearnersPanel } from "./course-settings-remove-learners-panel";
import type { CourseSettingsCard } from "./course-settings-metadata";
import { CourseSettingsPublishCoursePanel } from "./course-settings-publish-course-panel";
import { CourseSettingsPublishDeleteShell } from "./course-settings-publish-delete-shell";

type CourseDetail = z.infer<typeof studioCourseDetailSchema>;

type CourseSettingsPublishDeletePageProps = {
  course: CourseDetail;
  section: CourseSettingsCard;
  onCourseChange: (course: CourseDetail) => void;
};

export function CourseSettingsPublishDeletePage({
  course,
  section,
  onCourseChange,
}: CourseSettingsPublishDeletePageProps) {
  return (
    <CourseSettingsPublishDeleteShell courseId={course.id} section={section}>
      {section.id === "publish-course" ? (
        <CourseSettingsPublishCoursePanel
          course={course}
          courseId={course.id}
          canPublish
          onCourseChange={onCourseChange}
        />
      ) : section.id === "move-to-trash" ? (
        <CourseSettingsMoveToTrashPanel course={course} />
      ) : section.id === "associated-contents" ? (
        <CourseSettingsAssociatedContentsPanel course={course} />
      ) : section.id === "remove-learners" ? (
        <CourseSettingsRemoveLearnersPanel course={course} />
      ) : null}
    </CourseSettingsPublishDeleteShell>
  );
}
