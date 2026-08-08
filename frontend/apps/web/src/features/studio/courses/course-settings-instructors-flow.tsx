"use client";

import { useState } from "react";
import type { z } from "zod";
import type { studioCourseDetailSchema } from "@atlas/contracts/courses/course-authoring-schemas";
import type { CourseSettingsCard } from "./course-settings-metadata";
import { CourseAttachInstructorScreen } from "./course-attach-instructor-screen";
import { CourseSettingsGeneralShell } from "./course-settings-general-shell";
import { CourseSettingsInstructorsPanel } from "./course-settings-instructors-panel";

type CourseDetail = z.infer<typeof studioCourseDetailSchema>;

type InstructorView = "list" | "attach";

type CourseSettingsInstructorsFlowProps = {
  course: CourseDetail;
  editable: boolean;
  section: CourseSettingsCard;
  onCourseChange: (course: CourseDetail) => void;
};

export function CourseSettingsInstructorsFlow({
  course,
  editable,
  section,
  onCourseChange,
}: CourseSettingsInstructorsFlowProps) {
  const [instructorView, setInstructorView] = useState<InstructorView>("list");
  const [refreshToken, setRefreshToken] = useState(0);
  const disabled = !editable;

  if (instructorView === "attach") {
    return (
      <CourseAttachInstructorScreen
        course={course}
        disabled={disabled}
        onBack={() => {
          setInstructorView("list");
        }}
        onAttached={(updated) => {
          onCourseChange(updated);
          setRefreshToken((value) => value + 1);
        }}
      />
    );
  }

  return (
    <CourseSettingsGeneralShell courseId={course.id} section={section}>
      <CourseSettingsInstructorsPanel
        course={course}
        disabled={disabled}
        refreshToken={refreshToken}
        onAddInstructors={() => {
          setInstructorView("attach");
        }}
        onCourseChange={(updated) => {
          onCourseChange(updated);
          setRefreshToken((value) => value + 1);
        }}
      />
    </CourseSettingsGeneralShell>
  );
}
