import { z } from "zod";

/**
 * A learner's own view of a course they are enrolled in: its published chapters
 * and lessons in order, with where they are in each lesson, for the lesson
 * player's outline and the course page's progress (QA review 1 m41, review 2 H20).
 */
export const learnerOutlineLessonStatusSchema = z.enum(["not_started", "in_progress", "completed"]);

export const learnerOutlineLessonSchema = z.object({
  id: z.uuid(),
  title: z.string(),
  position: z.number().int(),
  durationSeconds: z.number().int().nullable(),
  /** article, video, audio, pdf, slides, live, section_quiz, assignment…; null when unknown. */
  lessonType: z.string().nullable(),
  status: learnerOutlineLessonStatusSchema,
});

export const learnerOutlineModuleSchema = z.object({
  id: z.uuid(),
  title: z.string(),
  position: z.number().int(),
  contentKind: z.enum(["standard", "scorm"]),
  lessons: z.array(learnerOutlineLessonSchema),
});

export const learnerCourseOutlineSchema = z.object({
  courseId: z.uuid(),
  /**
   * False before the learner enrols: the outline is a preview of what the
   * course covers, every lesson "not started" (QA review 1 M38).
   */
  enrolled: z.boolean(),
  modules: z.array(learnerOutlineModuleSchema),
  /** Counted the way course completion counts them: every published lesson. */
  completedLessons: z.number().int().nonnegative(),
  totalLessons: z.number().int().nonnegative(),
  progressPct: z.number().int().min(0).max(100),
  /** The lesson "Continue" opens: the last one in progress, else the first not done. */
  resumeLessonId: z.uuid().nullable(),
});

export const learnerCourseOutlineResponseSchema = z.object({
  data: learnerCourseOutlineSchema,
});

export type LearnerCourseOutline = z.infer<typeof learnerCourseOutlineSchema>;
export type LearnerOutlineLessonStatus = z.infer<typeof learnerOutlineLessonStatusSchema>;
