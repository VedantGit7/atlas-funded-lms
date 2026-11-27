import {
  findOutlineLesson,
  formatLessonDuration,
  outlineLessons,
  type LearnerCourseOutline,
} from "../lessons/course-outline-model";

/**
 * What the course page says about a course (QA review 1 M38, m40): its size,
 * its length, and the one thing an enrolled learner does next.
 */

/** The listed lessons' lengths added up; null when no lesson has a length. */
export function outlineTotalSeconds(outline: LearnerCourseOutline | null): number | null {
  if (!outline) return null;
  let total = 0;
  for (const lesson of outlineLessons(outline)) total += lesson.durationSeconds ?? 0;
  return total > 0 ? total : null;
}

function plural(count: number, one: string, many: string): string {
  return `${String(count)} ${count === 1 ? one : many}`;
}

/** "3 chapters · 12 lessons · 1 h 40 min": only the parts the course has. */
export function courseSizeLabel(outline: LearnerCourseOutline | null): string | null {
  if (!outline) return null;
  const parts: string[] = [];
  if (outline.modules.length > 0) parts.push(plural(outline.modules.length, "chapter", "chapters"));
  if (outline.totalLessons > 0) parts.push(plural(outline.totalLessons, "lesson", "lessons"));
  const length = formatLessonDuration(outlineTotalSeconds(outline));
  if (length) parts.push(length);
  return parts.length > 0 ? parts.join(" · ") : null;
}

export function learnerCountLabel(count: number): string | null {
  return count > 0 ? plural(count, "learner", "learners") : null;
}

/** "Taught by Asha", "Taught by Asha and Ravi", "Taught by Asha, Ravi and Meera". */
export function instructorsLabel(names: string[]): string | null {
  if (names.length === 0) return null;
  if (names.length === 1) return `Taught by ${names[0] ?? ""}`;
  return `Taught by ${names.slice(0, -1).join(", ")} and ${names.at(-1) ?? ""}`;
}

export type CourseNextStep = {
  label: "Start the course" | "Continue" | "Review the course";
  lessonId: string;
  lessonTitle: string;
  started: boolean;
  complete: boolean;
};

/**
 * An enrolled learner's one action: start at the first lesson, continue where
 * they left off, or review once every lesson is done. Null before enrolling or
 * when the course has no lessons yet.
 */
export function courseNextStep(outline: LearnerCourseOutline | null): CourseNextStep | null {
  if (!outline?.enrolled) return null;
  const lessons = outlineLessons(outline);
  const first = lessons[0];
  if (!first) return null;

  const complete = outline.totalLessons > 0 && outline.completedLessons >= outline.totalLessons;
  const started = lessons.some((lesson) => lesson.status !== "not_started");
  const target = complete ? first : (findOutlineLesson(outline, outline.resumeLessonId) ?? first);
  return {
    label: complete ? "Review the course" : started ? "Continue" : "Start the course",
    lessonId: target.id,
    lessonTitle: target.title,
    started,
    complete,
  };
}

/** Only YouTube and Vimeo links play on the course page. */
export function promoVideoEmbedUrl(url: string | null): string | null {
  if (!url) return null;
  let parsed: URL;
  try {
    parsed = new URL(url.trim());
  } catch {
    return null;
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
  const host = parsed.hostname.toLowerCase().replace(/^www\.|^m\./, "");

  let youtubeId: string | null = null;
  if (host === "youtu.be") youtubeId = parsed.pathname.slice(1).split("/")[0] ?? null;
  else if (host === "youtube.com" || host === "youtube-nocookie.com") {
    youtubeId =
      parsed.searchParams.get("v") ??
      /^\/(?:embed|shorts|live)\/([\w-]+)/.exec(parsed.pathname)?.[1] ??
      null;
  }
  if (youtubeId && /^[\w-]{6,20}$/.test(youtubeId)) {
    // The site's security policy frames www.youtube.com and player.vimeo.com only.
    return `https://www.youtube.com/embed/${youtubeId}`;
  }

  if (host === "vimeo.com" || host === "player.vimeo.com") {
    const vimeoId = /\/(?:video\/)?(\d{5,12})(?:$|\/)/.exec(parsed.pathname)?.[1];
    if (vimeoId) return `https://player.vimeo.com/video/${vimeoId}`;
  }
  return null;
}
