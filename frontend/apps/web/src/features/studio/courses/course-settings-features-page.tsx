"use client";

import type { z } from "zod";
import type { studioCourseDetailSchema } from "@atlas/contracts/courses/course-authoring-schemas";
import { CourseSettingsCertificatesPanel } from "./course-settings-certificates-panel";
import { CourseSettingsContentDrippingPanel } from "./course-settings-content-dripping-panel";
import { CourseSettingsComingSoon } from "./course-settings-coming-soon";
import { CourseSettingsDiscussionsBookmarksPanel } from "./course-settings-discussions-bookmarks-panel";
import { CourseSettingsFeaturesShell } from "./course-settings-features-shell";
import { CourseSettingsLeaderboardPanel } from "./course-settings-leaderboard-panel";
import { CourseSettingsGamificationPanel } from "./course-settings-gamification-panel";
import { CourseSettingsLearnerConfigurationsPanel } from "./course-settings-learner-configurations-panel";
import { CourseSettingsLearningPathPanel } from "./course-settings-learning-path-panel";
import { CourseSettingsRatingsReviewsPanel } from "./course-settings-ratings-reviews-panel";
import type { CourseSettingsCard } from "./course-settings-metadata";

type CourseDetail = z.infer<typeof studioCourseDetailSchema>;

type CourseSettingsFeaturesPageProps = {
  course: CourseDetail;
  section: CourseSettingsCard;
  onCourseChange: (course: CourseDetail) => void;
};

export function CourseSettingsFeaturesPage({
  course,
  section,
  onCourseChange,
}: CourseSettingsFeaturesPageProps) {
  const editable = course.status === "DRAFT";

  return (
    <CourseSettingsFeaturesShell courseId={course.id} section={section}>
      {section.id === "ratings-reviews" ? (
        <CourseSettingsRatingsReviewsPanel
          course={course}
          editable={editable}
          onSaved={onCourseChange}
        />
      ) : section.id === "discussions-bookmarks" ? (
        <CourseSettingsDiscussionsBookmarksPanel
          course={course}
          editable={editable}
          onSaved={onCourseChange}
        />
      ) : section.id === "leaderboard" ? (
        <CourseSettingsLeaderboardPanel
          course={course}
          editable={editable}
          onSaved={onCourseChange}
        />
      ) : section.id === "gamification" ? (
        <CourseSettingsGamificationPanel
          course={course}
          editable={editable}
          onSaved={onCourseChange}
        />
      ) : section.id === "certificates" ? (
        <CourseSettingsCertificatesPanel
          course={course}
          editable={editable}
          onSaved={onCourseChange}
        />
      ) : section.id === "content-dripping" ? (
        <CourseSettingsContentDrippingPanel
          course={course}
          editable={editable}
          onSaved={onCourseChange}
        />
      ) : section.id === "learner-configurations" ? (
        <CourseSettingsLearnerConfigurationsPanel
          course={course}
          editable={editable}
          onSaved={onCourseChange}
        />
      ) : section.id === "learning-path" ? (
        <CourseSettingsLearningPathPanel
          course={course}
          editable={editable}
          onSaved={onCourseChange}
        />
      ) : (
        <CourseSettingsComingSoon />
      )}
    </CourseSettingsFeaturesShell>
  );
}
