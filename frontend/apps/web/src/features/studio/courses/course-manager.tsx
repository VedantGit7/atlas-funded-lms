"use client";

import type { z } from "zod";
import type { studioCourseListItemSchema } from "@atlas/contracts/courses/course-authoring-schemas";
import { CourseManagerView } from "./course-manager-view";

type CourseRow = z.infer<typeof studioCourseListItemSchema>;

type CourseManagerProps = {
  courses: CourseRow[];
  canCreate: boolean;
};

export function CourseManager({ courses, canCreate }: CourseManagerProps) {
  return <CourseManagerView courses={courses} canCreate={canCreate} />;
}
