"use client";

import { useState } from "react";
import type { CourseSettingsCard } from "./course-settings-metadata";
import { CourseSettingsGeneralShell } from "./course-settings-general-shell";
import { StudioAttachTagScreen } from "./inline-lesson-editor/inline-lesson-attach-tag-screen";
import { StudioCreateTagScreen } from "./inline-lesson-editor/inline-lesson-create-tag-screen";
import { StudioTagListSection } from "./inline-lesson-editor/inline-lesson-settings-lesson-tag";

type CourseTagView = "list" | "create" | "attach";

type CourseSettingsTagsFlowProps = {
  courseId: string;
  editable: boolean;
  section: CourseSettingsCard;
};

export function CourseSettingsTagsFlow({
  courseId,
  editable,
  section,
}: CourseSettingsTagsFlowProps) {
  const [tagView, setTagView] = useState<CourseTagView>("list");
  const [refreshToken, setRefreshToken] = useState(0);
  const disabled = !editable;

  if (tagView === "create") {
    return (
      <StudioCreateTagScreen
        tagScope="course"
        entityId={courseId}
        disabled={disabled}
        onBack={() => {
          setTagView("list");
        }}
        onCreated={() => {
          setRefreshToken((value) => value + 1);
          setTagView("list");
        }}
      />
    );
  }

  if (tagView === "attach") {
    return (
      <StudioAttachTagScreen
        tagScope="course"
        entityId={courseId}
        disabled={disabled}
        onBack={() => {
          setTagView("list");
        }}
        onCreateTag={() => {
          setTagView("create");
        }}
        onAttached={() => {
          setRefreshToken((value) => value + 1);
        }}
      />
    );
  }

  return (
    <CourseSettingsGeneralShell courseId={courseId} section={section}>
      <StudioTagListSection
        tagScope="course"
        entityId={courseId}
        layout="course-settings"
        disabled={disabled}
        refreshToken={refreshToken}
        onCreateTag={() => {
          setTagView("create");
        }}
        onAttachTag={() => {
          setTagView("attach");
        }}
      />
    </CourseSettingsGeneralShell>
  );
}
