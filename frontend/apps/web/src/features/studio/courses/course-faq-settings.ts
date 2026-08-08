import type { z } from "zod";
import type { studioCourseDetailSchema } from "@atlas/contracts/courses/course-authoring-schemas";
import { mergeCourseAccessIntoTags, parseCourseAccessFromTags } from "./course-access-settings";

type CourseDetail = z.infer<typeof studioCourseDetailSchema>;

export const COURSE_FAQ_QUESTION_MAX_LENGTH = 255;
export const COURSE_FAQ_ANSWER_MAX_LENGTH = 5000;

const FAQ_TAG_KEY = "studioFaqs";

export type CourseFaqItem = {
  id: string;
  question: string;
  answer: string;
  position: number;
};

function parseFaqItems(raw: unknown): CourseFaqItem[] {
  if (!Array.isArray(raw)) return [];

  const items: CourseFaqItem[] = [];

  for (const entry of raw) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
    const record = entry as Record<string, unknown>;
    const id = typeof record["id"] === "string" ? record["id"] : "";
    const question = typeof record["question"] === "string" ? record["question"].trim() : "";
    const answer = typeof record["answer"] === "string" ? record["answer"].trim() : "";
    const position =
      typeof record["position"] === "number" && Number.isFinite(record["position"])
        ? record["position"]
        : items.length;

    if (!id || !question) continue;

    items.push({ id, question, answer, position });
  }

  return items.sort((a, b) => a.position - b.position);
}

export function courseFaqsFromDetail(course: CourseDetail): CourseFaqItem[] {
  const raw = course.tags?.[FAQ_TAG_KEY];
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return [];
  }

  const record = raw as Record<string, unknown>;
  return parseFaqItems(record["items"]);
}

export function mergeCourseFaqsIntoTags(
  tags: Record<string, unknown> | undefined,
  items: CourseFaqItem[],
): Record<string, unknown> {
  const access = parseCourseAccessFromTags(tags);

  return mergeCourseAccessIntoTags(
    {
      ...(tags ?? {}),
      [FAQ_TAG_KEY]: {
        items: items.map((item, index) => ({
          id: item.id,
          question: item.question.trim(),
          answer: item.answer.trim(),
          position: index,
        })),
      },
    },
    access,
  );
}

export function buildCourseFaqsUpdatePayload(course: CourseDetail, items: CourseFaqItem[]) {
  return {
    tags: mergeCourseFaqsIntoTags(course.tags, items),
  };
}

export function createEmptyCourseFaqDraft(): { question: string; answer: string } {
  return { question: "", answer: "" };
}
