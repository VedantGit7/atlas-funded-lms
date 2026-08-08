"use client";

import { useState } from "react";
import type { z } from "zod";
import type { studioCourseDetailSchema } from "@atlas/contracts/courses/course-authoring-schemas";
import type { CourseSettingsCard } from "./course-settings-metadata";
import { CourseEditFaqScreen } from "./course-edit-faq-screen";
import { CourseSettingsFaqsPanel } from "./course-settings-faqs-panel";
import { CourseSettingsGeneralShell } from "./course-settings-general-shell";

type CourseDetail = z.infer<typeof studioCourseDetailSchema>;

type FaqView = "list" | "form";

type CourseSettingsFaqsFlowProps = {
  course: CourseDetail;
  editable: boolean;
  section: CourseSettingsCard;
  onCourseChange: (course: CourseDetail) => void;
};

export function CourseSettingsFaqsFlow({
  course,
  editable,
  section,
  onCourseChange,
}: CourseSettingsFaqsFlowProps) {
  const [faqView, setFaqView] = useState<FaqView>("list");
  const [editingFaqId, setEditingFaqId] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);
  const disabled = !editable;

  if (faqView === "form") {
    return (
      <CourseEditFaqScreen
        key={editingFaqId ?? "new"}
        course={course}
        faqId={editingFaqId}
        disabled={disabled}
        onBack={() => {
          setFaqView("list");
          setEditingFaqId(null);
        }}
        onSaved={(updated) => {
          onCourseChange(updated);
          setRefreshToken((value) => value + 1);
          setFaqView("list");
          setEditingFaqId(null);
        }}
      />
    );
  }

  return (
    <CourseSettingsGeneralShell courseId={course.id} section={section}>
      <CourseSettingsFaqsPanel
        course={course}
        disabled={disabled}
        refreshToken={refreshToken}
        onAddFaq={() => {
          setEditingFaqId(null);
          setFaqView("form");
        }}
        onEditFaq={(faqId) => {
          setEditingFaqId(faqId);
          setFaqView("form");
        }}
        onCourseChange={onCourseChange}
      />
    </CourseSettingsGeneralShell>
  );
}
