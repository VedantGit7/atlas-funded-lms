"use client";

import type { z } from "zod";
import type { studioCourseDetailSchema } from "@atlas/contracts/courses/course-authoring-schemas";
import { CourseSettingsBrandingPanel } from "./course-settings-branding-panel";
import { CourseSettingsComingSoon } from "./course-settings-coming-soon";
import { CourseSettingsGeneralShell } from "./course-settings-general-shell";
import { CourseSettingsSeoPanel } from "./course-settings-seo-panel";
import { CourseSettingsFaqsFlow } from "./course-settings-faqs-flow";
import { CourseSettingsInstructorsFlow } from "./course-settings-instructors-flow";
import { CourseSettingsTagsFlow } from "./course-settings-tags-flow";
import type { CourseSettingsCard } from "./course-settings-metadata";

type CourseDetail = z.infer<typeof studioCourseDetailSchema>;

type CourseSettingsGeneralPageProps = {
  course: CourseDetail;
  section: CourseSettingsCard;
  onCourseChange: (course: CourseDetail) => void;
};

export function CourseSettingsGeneralPage({
  course,
  section,
  onCourseChange,
}: CourseSettingsGeneralPageProps) {
  const editable = course.status === "DRAFT";

  if (section.id === "tags") {
    return (
      <div className="px-4 py-6 md:px-8 md:py-8">
        <CourseSettingsTagsFlow courseId={course.id} editable={editable} section={section} />
      </div>
    );
  }

  if (section.id === "faqs") {
    return (
      <div className="px-4 py-6 md:px-8 md:py-8">
        <CourseSettingsFaqsFlow
          course={course}
          editable={editable}
          section={section}
          onCourseChange={onCourseChange}
        />
      </div>
    );
  }

  if (section.id === "instructors") {
    return (
      <div className="px-4 py-6 md:px-8 md:py-8">
        <CourseSettingsInstructorsFlow
          course={course}
          editable={editable}
          section={section}
          onCourseChange={onCourseChange}
        />
      </div>
    );
  }

  return (
    <div className="px-4 py-6 md:px-8 md:py-8">
      <CourseSettingsGeneralShell courseId={course.id} section={section}>
        {section.id === "branding" ? (
          <CourseSettingsBrandingPanel
            course={course}
            editable={editable}
            onSaved={onCourseChange}
          />
        ) : section.id === "seo" ? (
          <CourseSettingsSeoPanel course={course} editable={editable} onSaved={onCourseChange} />
        ) : (
          <CourseSettingsComingSoon />
        )}
      </CourseSettingsGeneralShell>
    </div>
  );
}
