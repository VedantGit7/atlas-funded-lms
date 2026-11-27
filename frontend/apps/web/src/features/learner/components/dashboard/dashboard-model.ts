import type { MyCourse } from "@atlas/contracts/enrollments/my-courses.schemas";

/**
 * Pure helpers for the learner home and Progress pages (QA remediation S3.3).
 * Colors here are data-visualization accents (readiness / mastery bands),
 * centralised so the ramp stays consistent, not scattered hex literals.
 */

/** Map an overall readiness/mastery score (0-100) to a band accent color. */
export function scoreColor(score: number): string {
  if (score >= 85) return "#22c55e"; // advanced / mastered
  if (score >= 65) return "#3b82f6"; // proficient
  if (score >= 40) return "#6366f1"; // developing
  return "#f59e0b"; // emerging
}

export function scoreBandLabel(score: number): string {
  if (score >= 85) return "Advanced";
  if (score >= 65) return "Proficient";
  if (score >= 40) return "Developing";
  return "Emerging";
}

/**
 * "Welcome" until the learner has enrolled or started a lesson, then "Welcome
 * back": a first visit is never greeted as a return (QA review 1 m38).
 */
export function homeGreeting(displayName: string | null, courses: MyCourse[] | null): string {
  const returning = (courses ?? []).length > 0;
  const name = displayName?.trim();
  const greeting = returning ? "Welcome back" : "Welcome";
  return name ? `${greeting}, ${name}` : greeting;
}

/** The line under the greeting: what the learner does next, in one sentence. */
export function homeSubtitle(courses: MyCourse[] | null): string {
  const list = courses ?? [];
  if (list.length === 0) return "Choose a course from the catalogue to get started.";
  if (list.every((course) => course.status === "completed")) {
    return "You've finished every course you're enrolled in.";
  }
  if (list.some((course) => course.status === "in_progress")) return "Pick up where you left off.";
  return "Your courses are ready when you are.";
}

/**
 * The course "Continue learning" leads with: the one with the latest lesson
 * activity, else the newest one not started; none once everything is finished.
 * The API already sorts in-progress courses by latest activity.
 */
export function pickContinueCourse(courses: MyCourse[] | null): MyCourse | null {
  const list = courses ?? [];
  return (
    list.find((course) => course.status === "in_progress") ??
    list.find((course) => course.status === "not_started" && course.totalLessons > 0) ??
    null
  );
}

export function courseStatusLabel(status: MyCourse["status"]): string {
  if (status === "completed") return "Finished";
  if (status === "in_progress") return "In progress";
  return "Not started";
}

export function courseActionLabel(course: MyCourse): "Start the course" | "Continue" | "Review" {
  if (course.status === "completed") return "Review";
  return course.status === "in_progress" ? "Continue" : "Start the course";
}

/** The next lesson to open, or the course page once every lesson is done. */
export function courseActionHref(course: MyCourse): string {
  const base = `/courses/${course.courseId}`;
  return course.nextLesson ? `${base}/lessons/${course.nextLesson.id}` : base;
}

/** An announcement leads the home page for this long after it's sent. */
export const HOME_ANNOUNCEMENT_DAYS = 30;

export type HomeAnnouncement = {
  id: string;
  title: string;
  body: string;
  href: string | null;
  at: string;
};

/**
 * The academy's latest announcement while it's recent; never a private notice
 * (the API is asked for announcements only, QA review 1 M35).
 */
export function homeAnnouncement(
  item: { id: string; title: string; body: string; actionPath: string; createdAt: string } | null,
  now: Date = new Date(),
): HomeAnnouncement | null {
  if (!item?.title.trim()) return null;
  const sent = Date.parse(item.createdAt);
  if (Number.isNaN(sent)) return null;
  if (now.getTime() - sent > HOME_ANNOUNCEMENT_DAYS * 24 * 60 * 60 * 1000) return null;
  const path = item.actionPath.trim();
  const href = path.startsWith("/") && !path.startsWith("//") && path !== "/" ? path : null;
  return {
    id: item.id,
    title: item.title.trim(),
    body: item.body.trim(),
    href,
    at: item.createdAt,
  };
}

export type LevelProgress = {
  levelNumber: number;
  xpIntoLevel: number;
  xpForNextLevel: number | null;
  progressPct: number;
};

/**
 * "40 of 100 XP to level 2", or "Top level" once there is no next level. The
 * old home read the level thresholds from a config the API doesn't send, so it
 * showed "Level 1" with "Max level" (QA review 1 m38).
 */
export function levelProgressLabel(level: LevelProgress): string {
  if (level.xpForNextLevel == null) return "Top level";
  return `${String(level.xpIntoLevel)} of ${String(level.xpForNextLevel)} XP to level ${String(level.levelNumber + 1)}`;
}
