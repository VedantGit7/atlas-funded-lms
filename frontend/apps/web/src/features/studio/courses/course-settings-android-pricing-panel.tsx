"use client";

import type { z } from "zod";
import type { studioCourseDetailSchema } from "@atlas/contracts/courses/course-authoring-schemas";
import { CourseSettingsStorePricingPanel } from "./course-settings-store-pricing-panel";

type CourseDetail = z.infer<typeof studioCourseDetailSchema>;

type CourseSettingsAndroidPricingPanelProps = {
  course: CourseDetail;
  editable: boolean;
  onSaved: (course: CourseDetail) => void;
};

export function CourseSettingsAndroidPricingPanel(props: CourseSettingsAndroidPricingPanelProps) {
  return <CourseSettingsStorePricingPanel {...props} platform="android" />;
}
