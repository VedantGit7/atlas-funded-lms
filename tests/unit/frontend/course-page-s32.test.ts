import { describe, expect, it } from "vitest";
import type { LearnerCourseOutline } from "../../../frontend/apps/web/src/features/lessons/course-outline-model";
import {
  courseNextStep,
  courseSizeLabel,
  instructorsLabel,
  learnerCountLabel,
  outlineTotalSeconds,
  outlineUpNextLessonId,
  promoVideoEmbedUrl,
} from "../../../frontend/apps/web/src/features/courses/course-page-model";
import {
  buildCourseBrandingUpdatePayload,
  courseBrandingFromDetail,
  courseBrandingProblem,
  parseCourseOutcomes,
} from "../../../frontend/apps/web/src/features/studio/courses/course-branding-settings";
import { mergeCourseSeoIntoTags } from "../../../frontend/apps/web/src/features/studio/courses/course-seo-settings";
import { courseCoverFileProblem } from "../../../frontend/apps/web/src/features/studio/courses/upload-course-cover";

/** QA remediation S3.2: course page (review 1 M38, M50, m40) and course images (M21, M49). */

const lessonA = "018f0000-0000-7000-8000-0000000000a1";
const lessonB = "018f0000-0000-7000-8000-0000000000b2";
const lessonC = "018f0000-0000-7000-8000-0000000000c3";

function outline(overrides: Partial<LearnerCourseOutline> = {}): LearnerCourseOutline {
  return {
    courseId: "018f0000-0000-7000-8000-0000000000c0",
    enrolled: true,
    modules: [
      {
        id: "018f0000-0000-7000-8000-0000000000d0",
        title: "Basics",
        position: 1,
        contentKind: "standard",
        lessons: [
          {
            id: lessonA,
            title: "Candles",
            position: 1,
            durationSeconds: 600,
            lessonType: "video",
            status: "not_started",
          },
          {
            id: lessonB,
            title: "Trends",
            position: 2,
            durationSeconds: 1800,
            lessonType: "article",
            status: "not_started",
          },
        ],
      },
      {
        id: "018f0000-0000-7000-8000-0000000000d1",
        title: "Risk",
        position: 2,
        contentKind: "standard",
        lessons: [
          {
            id: lessonC,
            title: "Stops",
            position: 1,
            durationSeconds: 3600,
            lessonType: "quiz",
            status: "not_started",
          },
        ],
      },
    ],
    completedLessons: 0,
    totalLessons: 3,
    progressPct: 0,
    resumeLessonId: lessonA,
    ...overrides,
  };
}

function withStatuses(
  value: LearnerCourseOutline,
  statuses: Record<string, "not_started" | "in_progress" | "completed">,
): LearnerCourseOutline {
  return {
    ...value,
    modules: value.modules.map((module) => ({
      ...module,
      lessons: module.lessons.map((lesson) => ({
        ...lesson,
        status: statuses[lesson.id] ?? lesson.status,
      })),
    })),
  };
}

describe("course page facts", () => {
  it("adds up the course's size and length", () => {
    expect(outlineTotalSeconds(outline())).toBe(6000);
    expect(courseSizeLabel(outline())).toBe("2 chapters · 3 lessons · 1 h 40 min");
    expect(courseSizeLabel(null)).toBeNull();
    expect(learnerCountLabel(0)).toBeNull();
    expect(learnerCountLabel(1)).toBe("1 learner");
    expect(learnerCountLabel(25)).toBe("25 learners");
  });

  it("names the instructors in a sentence", () => {
    expect(instructorsLabel([])).toBeNull();
    expect(instructorsLabel(["Asha"])).toBe("Taught by Asha");
    expect(instructorsLabel(["Asha", "Ravi"])).toBe("Taught by Asha and Ravi");
    expect(instructorsLabel(["Asha", "Ravi", "Meera"])).toBe("Taught by Asha, Ravi and Meera");
  });
});

describe("the course page's one action (m40)", () => {
  it("offers nothing before enrolling", () => {
    expect(courseNextStep(outline({ enrolled: false }))).toBeNull();
    expect(courseNextStep(null)).toBeNull();
  });

  it("starts at the first lesson", () => {
    expect(courseNextStep(outline())).toMatchObject({
      label: "Start the course",
      lessonId: lessonA,
      started: false,
    });
  });

  it("continues where the learner left off", () => {
    const value = withStatuses(outline({ resumeLessonId: lessonB, completedLessons: 1 }), {
      [lessonA]: "completed",
      [lessonB]: "in_progress",
    });
    expect(courseNextStep(value)).toMatchObject({
      label: "Continue",
      lessonId: lessonB,
      lessonTitle: "Trends",
    });
  });

  it("reviews from the start once every lesson is done", () => {
    const value = withStatuses(
      outline({ completedLessons: 3, progressPct: 100, resumeLessonId: lessonC }),
      { [lessonA]: "completed", [lessonB]: "completed", [lessonC]: "completed" },
    );
    expect(courseNextStep(value)).toMatchObject({
      label: "Review the course",
      lessonId: lessonA,
      complete: true,
    });
  });

  it("badges the resume lesson 'Up next' until the course is finished", () => {
    expect(outlineUpNextLessonId(outline({ enrolled: false }))).toBeNull();
    expect(outlineUpNextLessonId(outline())).toBe(lessonA);
    const started = withStatuses(outline({ resumeLessonId: lessonB, completedLessons: 1 }), {
      [lessonA]: "completed",
      [lessonB]: "in_progress",
    });
    expect(outlineUpNextLessonId(started)).toBe(lessonB);
    const finished = withStatuses(
      outline({ completedLessons: 3, progressPct: 100, resumeLessonId: lessonA }),
      { [lessonA]: "completed", [lessonB]: "completed", [lessonC]: "completed" },
    );
    expect(outlineUpNextLessonId(finished)).toBeNull();
  });
});

describe("course video links", () => {
  it("plays YouTube and Vimeo links from hosts the site allows", () => {
    expect(promoVideoEmbedUrl("https://www.youtube.com/watch?v=abc123def45")).toBe(
      "https://www.youtube.com/embed/abc123def45",
    );
    expect(promoVideoEmbedUrl("https://youtu.be/abc123def45?t=10")).toBe(
      "https://www.youtube.com/embed/abc123def45",
    );
    expect(promoVideoEmbedUrl("https://youtube.com/shorts/abc123def45")).toBe(
      "https://www.youtube.com/embed/abc123def45",
    );
    expect(promoVideoEmbedUrl("https://vimeo.com/76979871")).toBe(
      "https://player.vimeo.com/video/76979871",
    );
  });

  it("ignores anything else", () => {
    expect(promoVideoEmbedUrl(null)).toBeNull();
    expect(promoVideoEmbedUrl("not a link")).toBeNull();
    expect(promoVideoEmbedUrl("javascript:alert(1)")).toBeNull();
    expect(promoVideoEmbedUrl("https://evil.example/watch?v=abc123def45")).toBeNull();
    expect(promoVideoEmbedUrl("https://www.youtube.com/watch?v=<script>")).toBeNull();
  });
});

describe("Studio branding: what you'll learn, video and image", () => {
  const course = {
    id: "018f0000-0000-7000-8000-0000000000c0",
    title: "Price action",
    shortDescription: "",
    description: "",
    coverKey: "/api/v1/public/course-covers/018f0000-0000-7000-8000-0000000000e0",
    tags: {
      instructorMembershipIds: ["m1"],
      studioBranding: { promoVideoUrl: "", outcomes: ["Read a chart"], future: "kept" },
      studioSeo: { pageTitle: "Old", seoDescription: "" },
    },
  } as unknown as Parameters<typeof courseBrandingFromDetail>[0];

  it("reads one point per line, without bullets or blank lines, up to 12", () => {
    expect(parseCourseOutcomes("- Read a chart\n\n2. Place a stop\r\n  • Size a trade  ")).toEqual([
      "Read a chart",
      "Place a stop",
      "Size a trade",
    ]);
    const many = Array.from({ length: 14 }, (_, i) => `Point ${String(i + 1)}`).join("\n");
    expect(parseCourseOutcomes(many)).toHaveLength(12);
  });

  it("says what stops a save", () => {
    const form = courseBrandingFromDetail(course);
    expect(form.outcomesText).toBe("Read a chart");
    expect(courseBrandingProblem(form)).toBeNull();
    expect(courseBrandingProblem({ ...form, title: " " })).toBe("Course name is required.");
    expect(
      courseBrandingProblem({
        ...form,
        outcomesText: Array.from({ length: 13 }, (_, i) => `P${String(i)}`).join("\n"),
      }),
    ).toBe(`"What you'll learn" holds up to 12 points. Remove 1.`);
    expect(courseBrandingProblem({ ...form, promoVideoUrl: "https://example.com/video" })).toBe(
      "Use a YouTube or Vimeo link for the course video.",
    );
  });

  it("saves the points and keeps the course's other settings", () => {
    const form = { ...courseBrandingFromDetail(course), outcomesText: "One\nTwo" };
    const payload = buildCourseBrandingUpdatePayload(course, form);
    expect(payload).not.toHaveProperty("coverKey");
    expect(payload.tags).toMatchObject({
      instructorMembershipIds: ["m1"],
      studioBranding: { outcomes: ["One", "Two"], future: "kept" },
      studioSeo: { pageTitle: "Old" },
    });
  });

  it("sends a removed image as null so the course loses it", () => {
    const form = { ...courseBrandingFromDetail(course), coverKey: "" };
    expect(buildCourseBrandingUpdatePayload(course, form)).toMatchObject({ coverKey: null });
  });

  it("keeps what you'll learn when SEO is saved", () => {
    const tags = mergeCourseSeoIntoTags(course.tags, { pageTitle: "New", seoDescription: "" });
    expect(tags["studioBranding"]).toMatchObject({ outcomes: ["Read a chart"], future: "kept" });
  });

  it("accepts PNG, JPEG and WebP images only", () => {
    const file = (type: string, size = 10) => new File([new Uint8Array(size)], "a", { type });
    expect(courseCoverFileProblem(file("image/png"))).toBeNull();
    expect(courseCoverFileProblem(file("image/jpeg"))).toBeNull();
    expect(courseCoverFileProblem(file("image/webp"))).toBeNull();
    expect(courseCoverFileProblem(file("image/svg+xml"))).toBe("Use a PNG, JPEG or WebP image.");
    expect(courseCoverFileProblem(file("image/png", 0))).toBe(
      "This file is empty. Choose another image.",
    );
  });
});
