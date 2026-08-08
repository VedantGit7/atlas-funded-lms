import type { z } from "zod";
import type { studioCourseDetailSchema } from "@atlas/contracts/courses/course-authoring-schemas";
import { ClientApiError, clientApi, type ClientApiMutationOptions } from "../../../lib/client-api";
import {
  buildCourseFaqsUpdatePayload,
  type CourseFaqItem,
} from "./course-faq-settings";

type CourseDetail = z.infer<typeof studioCourseDetailSchema>;

export function formatCourseFaqError(error: unknown): string {
  if (error instanceof ClientApiError) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return "Failed to save FAQs.";
}

export async function saveCourseFaqs(
  course: CourseDetail,
  items: CourseFaqItem[],
  options?: ClientApiMutationOptions,
): Promise<CourseDetail> {
  const response = await clientApi.put<{ data: CourseDetail }>(
    `/api/v1/courses/${course.id}`,
    buildCourseFaqsUpdatePayload(course, items),
    "course-faqs-save",
    options,
  );
  return response.data;
}

export async function deleteCourseFaq(
  course: CourseDetail,
  faqId: string,
  items: CourseFaqItem[],
): Promise<CourseDetail> {
  const target = items.find((item) => item.id === faqId);

  if (!target) {
    throw new Error("This FAQ cannot be deleted.");
  }

  const nextItems = items
    .filter((item) => item.id !== faqId)
    .map((item, index) => ({ ...item, position: index }));

  return saveCourseFaqs(course, nextItems, {
    successMessage: `"${target.question}" deleted successfully`,
  });
}
