"use client";

import type { z } from "zod";
import type { studioCourseDetailSchema } from "@atlas/contracts/courses/course-authoring-schemas";
import { CourseSettingsStorePricingPanel } from "./course-settings-store-pricing-panel";

type CourseDetail = z.infer<typeof studioCourseDetailSchema>;

type CourseSettingsIosPricingPanelProps = {
  course: CourseDetail;
  editable: boolean;
  onSaved: (course: CourseDetail) => void;
};

export function CourseSettingsIosPricingPanel(props: CourseSettingsIosPricingPanelProps) {
  return <CourseSettingsStorePricingPanel {...props} platform="ios" />;
}
