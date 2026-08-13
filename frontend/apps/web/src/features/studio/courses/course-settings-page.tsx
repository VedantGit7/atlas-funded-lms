"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { z } from "zod";
import type { studioCourseDetailSchema } from "@atlas/contracts/courses/course-authoring-schemas";
import { CourseSettingsComingSoon } from "./course-settings-coming-soon";
import { CourseSettingsDetailShell } from "./course-settings-detail-shell";
import { CourseSettingsForm } from "./course-settings-form";
import { CourseSettingsGeneralPage } from "./course-settings-general-page";
import { CourseSettingsHub } from "./course-settings-hub";
import { CourseSettingsPricingPlansFlow } from "./course-settings-pricing-plans-flow";
import { CourseSettingsPermissionsPanel } from "./course-settings-permissions-panel";
import { CourseSettingsAndroidPricingPanel } from "./course-settings-android-pricing-panel";
import { CourseSettingsIosPricingPanel } from "./course-settings-ios-pricing-panel";
import { CourseSettingsFeaturesPage } from "./course-settings-features-page";
import {
  findCourseSettingsCard,
  isCourseFeaturesSettingsSection,
  isCourseGeneralSettingsSection,
  isCoursePublishDeleteSettingsSection,
} from "./course-settings-metadata";
import { CourseSettingsPublishDeletePage } from "./course-settings-publish-delete-page";

type CourseDetail = z.infer<typeof studioCourseDetailSchema>;

type CourseSettingsPageProps = {
  course: CourseDetail;
};

function CourseSettingsPageFallback() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 md:px-8">
      <div className="h-8 w-48 animate-pulse rounded-lg bg-[var(--admin-surface-high)]" />
      <div className="mt-3 h-4 w-72 animate-pulse rounded bg-[var(--admin-surface-high)]" />
    </div>
  );
}

function CourseSettingsPageInner({ course: initialCourse }: CourseSettingsPageProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const sectionId = searchParams.get("section");
  const [course, setCourse] = useState(initialCourse);
  const editable = course.status === "DRAFT";

  useEffect(() => {
    setCourse(initialCourse);
  }, [initialCourse]);

  if (!sectionId) {
    return <CourseSettingsHub courseId={course.id} />;
  }

  const card = findCourseSettingsCard(sectionId);
  if (!card) {
    router.replace(`/studio/courses/${course.id}/settings`);
    return null;
  }

  if (card.externalHref) {
    router.replace(card.externalHref(course.id));
    return null;
  }

  if (isCourseGeneralSettingsSection(sectionId)) {
    return <CourseSettingsGeneralPage course={course} section={card} onCourseChange={setCourse} />;
  }

  if (isCourseFeaturesSettingsSection(sectionId)) {
    return <CourseSettingsFeaturesPage course={course} section={card} onCourseChange={setCourse} />;
  }

  if (isCoursePublishDeleteSettingsSection(sectionId)) {
    return (
      <CourseSettingsPublishDeletePage course={course} section={card} onCourseChange={setCourse} />
    );
  }

  if (card.id === "pricing-plans") {
    return (
      <CourseSettingsPricingPlansFlow
        course={course}
        editable={editable}
        section={card}
        onCourseChange={setCourse}
      />
    );
  }

  if (card.id === "permissions") {
    return (
      <CourseSettingsDetailShell card={card} courseId={course.id}>
        <CourseSettingsPermissionsPanel course={course} editable={editable} onSaved={setCourse} />
      </CourseSettingsDetailShell>
    );
  }

  if (card.id === "ios-pricing") {
    return (
      <CourseSettingsDetailShell card={card} courseId={course.id}>
        <CourseSettingsIosPricingPanel course={course} editable={editable} onSaved={setCourse} />
      </CourseSettingsDetailShell>
    );
  }

  if (card.id === "android-pricing") {
    return (
      <CourseSettingsDetailShell card={card} courseId={course.id}>
        <CourseSettingsAndroidPricingPanel
          course={course}
          editable={editable}
          onSaved={setCourse}
        />
      </CourseSettingsDetailShell>
    );
  }

  if (!card.available) {
    return (
      <CourseSettingsDetailShell card={card} courseId={course.id}>
        <CourseSettingsComingSoon />
      </CourseSettingsDetailShell>
    );
  }

  if (card.lifecyclePanel) {
    return (
      <CourseSettingsPublishDeletePage course={course} section={card} onCourseChange={setCourse} />
    );
  }

  if (card.formSection) {
    return (
      <CourseSettingsDetailShell card={card} courseId={course.id}>
        <CourseSettingsForm
          course={course}
          editable={editable}
          onSaved={setCourse}
          section={card.formSection}
        />
      </CourseSettingsDetailShell>
    );
  }

  return (
    <CourseSettingsDetailShell card={card} courseId={course.id}>
      <CourseSettingsComingSoon />
    </CourseSettingsDetailShell>
  );
}

export function CourseSettingsPage(props: CourseSettingsPageProps) {
  return (
    <Suspense fallback={<CourseSettingsPageFallback />}>
      <CourseSettingsPageInner {...props} />
    </Suspense>
  );
}
