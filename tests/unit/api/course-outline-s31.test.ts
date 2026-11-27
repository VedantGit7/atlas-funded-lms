import { describe, expect, it } from "vitest";
import { buildLearnerCourseOutline } from "../../../backend/apps/api/src/server/courses/course-outline.service";
import type { LearnerOutlineRow } from "../../../backend/apps/api/src/server/courses/course-outline.repository";
import {
  articleImageAssetIds,
  replaceArticleImageAssets,
} from "../../../backend/apps/api/src/server/lessons/lesson-article-images";

/** QA remediation S3.1: the learner outline (m41, H20) and article images (m19). */

const course = "018f0000-0000-7000-8000-0000000000c0";
const m1 = "018f0000-0000-7000-8000-0000000000d1";
const m2 = "018f0000-0000-7000-8000-0000000000d2";

function row(overrides: Partial<LearnerOutlineRow>): LearnerOutlineRow {
  return {
    module_id: m1,
    module_title: "Basics",
    module_position: 1,
    module_content_kind: "STANDARD",
    lesson_id: null,
    lesson_title: null,
    lesson_position: null,
    duration_seconds: null,
    video_url: null,
    video_provider: null,
    content_meta: {},
    has_body: false,
    in_syllabus: true,
    progress_status: null,
    last_seen_at: null,
    ...overrides,
  };
}

const lesson = (id: string, position: number, extra: Partial<LearnerOutlineRow> = {}) =>
  row({
    lesson_id: `018f0000-0000-7000-8000-00000000000${id}`,
    lesson_title: `Lesson ${id}`,
    lesson_position: position,
    ...extra,
  });

describe("learner course outline", () => {
  it("resumes the lesson last seen in progress, not the first one in progress", () => {
    const outline = buildLearnerCourseOutline(course, [
      lesson("1", 1, { progress_status: "completed" }),
      lesson("2", 2, { progress_status: "in_progress", last_seen_at: new Date("2026-11-01") }),
      lesson("3", 3, { progress_status: "in_progress", last_seen_at: new Date("2026-11-20") }),
    ]);
    expect(outline.resumeLessonId).toBe("018f0000-0000-7000-8000-000000000003");
  });

  it("works out lesson types without the article body", () => {
    const outline = buildLearnerCourseOutline(course, [
      lesson("1", 1, { has_body: true }),
      lesson("2", 2, { video_url: "https://youtu.be/x", video_provider: "youtube" }),
      lesson("3", 3, { content_meta: { type: "live" } }),
      lesson("4", 4),
    ]);
    expect(outline.modules[0]?.lessons.map((l) => l.lessonType)).toEqual([
      "article",
      "video",
      "live",
      null,
    ]);
  });

  it("keeps an interactive (SCORM) chapter and an empty chapter, with no lessons", () => {
    const outline = buildLearnerCourseOutline(course, [
      lesson("1", 1),
      row({
        module_id: m2,
        module_title: "Simulator",
        module_position: 2,
        module_content_kind: "SCORM",
      }),
    ]);
    expect(outline.modules.map((m) => [m.title, m.contentKind, m.lessons.length])).toEqual([
      ["Basics", "standard", 1],
      ["Simulator", "scorm", 0],
    ]);
    expect(outline.totalLessons).toBe(1);
  });

  it("reports 0% for a course with no lessons yet", () => {
    const outline = buildLearnerCourseOutline(course, [row({})]);
    expect(outline).toMatchObject({ totalLessons: 0, progressPct: 0, resumeLessonId: null });
  });
});

describe("article images", () => {
  const a = "018f0000-0000-7000-8000-0000000000a1";
  const b = "018f0000-0000-7000-8000-0000000000b2";

  it("finds image references once each, and ignores links and other schemes", () => {
    const body = `![x](asset:${a}) ![y](asset:${a.toUpperCase()}) [link](asset:${b}) ![z](https://e.x/a.png)`;
    expect(articleImageAssetIds(body)).toEqual([a]);
  });

  it("swaps only the references it has a link for", () => {
    const body = `![x](asset:${a})\n![y](asset:${b})`;
    const out = replaceArticleImageAssets(body, new Map([[a, "https://signed.example/a?sig=1"]]));
    expect(out).toBe(`![x](https://signed.example/a?sig=1)\n![y](asset:${b})`);
  });
});
