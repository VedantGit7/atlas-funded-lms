import type { z } from "zod";
import type { studioCourseDetailSchema } from "@atlas/contracts/courses/course-authoring-schemas";
import { ClientApiError, clientApi, type ClientApiMutationOptions } from "../../../lib/client-api";
import {
  buildCoursePricingPlansUpdatePayload,
  storedCoursePricingPlansFromDetail,
  type CoursePricingPlanItem,
} from "./course-pricing-plan-settings";

type CourseDetail = z.infer<typeof studioCourseDetailSchema>;

export function formatCoursePricingPlanError(error: unknown): string {
  if (error instanceof ClientApiError) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return "Failed to save pricing plans.";
}

export async function saveCoursePricingPlans(
  course: CourseDetail,
  items: CoursePricingPlanItem[],
  options?: ClientApiMutationOptions,
): Promise<CourseDetail> {
  const response = await clientApi.put<{ data: CourseDetail }>(
    `/api/v1/courses/${course.id}`,
    buildCoursePricingPlansUpdatePayload(course, items),
    "course-pricing-plans-save",
    options,
  );
  return response.data;
}

export async function deleteCoursePricingPlan(
  course: CourseDetail,
  planId: string,
): Promise<CourseDetail> {
  const items = storedCoursePricingPlansFromDetail(course);
  const target = items.find((item) => item.id === planId);

  if (!target) {
    throw new Error("This pricing plan cannot be deleted.");
  }

  let nextItems = items.filter((item) => item.id !== planId);

  if (target.isDefault && nextItems.length > 0) {
    nextItems = nextItems.map((item, index) => ({
      ...item,
      position: index,
      isDefault: index === 0,
    }));
  } else {
    nextItems = nextItems.map((item, index) => ({ ...item, position: index }));
  }

  return saveCoursePricingPlans(course, nextItems, {
    successMessage: `"${target.title}" deleted successfully`,
  });
}
