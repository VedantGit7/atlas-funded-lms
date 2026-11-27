import { z } from "zod";

/**
 * The learner's own courses with their progress (QA remediation S3.3): what
 * the home page's "Continue learning" and the Progress page show.
 */

export const myCourseStatusSchema = z.enum(["not_started", "in_progress", "completed"]);

export const myCourseLessonSchema = z.object({
  id: z.uuid(),
  status: z.enum(["not_started", "in_progress", "completed"]),
});

export const myCourseSchema = z.object({
  courseId: z.uuid(),
  title: z.string(),
  coverKey: z.string().nullable(),
  category: z.string().nullable(),
  enrolledAt: z.iso.datetime(),
  /** When the last lesson was completed; null until the course is finished. */
  completedAt: z.iso.datetime().nullable(),
  /** The learner's latest lesson activity in this course; null before the first lesson. */
  lastActivityAt: z.iso.datetime().nullable(),
  totalLessons: z.number().int().nonnegative(),
  completedLessons: z.number().int().nonnegative(),
  progressPct: z.number().int().min(0).max(100),
  status: myCourseStatusSchema,
  /** The lesson to start or continue; null once every lesson is done. */
  nextLesson: z.object({ id: z.uuid(), title: z.string() }).nullable(),
  /** The published lessons in course order, for the lesson track. */
  lessons: z.array(myCourseLessonSchema),
});

export const myCoursesResponseSchema = z.object({
  data: z.object({
    /** In progress first (latest activity first), then not started, then finished. */
    items: z.array(myCourseSchema),
    totals: z.object({
      enrolled: z.number().int().nonnegative(),
      inProgress: z.number().int().nonnegative(),
      completed: z.number().int().nonnegative(),
      lessonsCompleted: z.number().int().nonnegative(),
    }),
  }),
});

export type MyCourse = z.infer<typeof myCourseSchema>;
export type MyCoursesResponse = z.infer<typeof myCoursesResponseSchema>;
