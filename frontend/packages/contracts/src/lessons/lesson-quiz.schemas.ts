import { z } from "zod";
import { PublishStatusSchema, ShowAnswersPolicySchema } from "../assessments/schemas";

/**
 * A course's quiz lesson, edited inside the course (QA review 1 M26, review 2
 * 4.1): its settings and questions in one place, saved in one request. The
 * quiz is named after the lesson and goes live with it; there's no separate
 * quiz to create, submit and approve.
 */

/** The most questions one quiz holds (a random draw picks from these). */
export const LESSON_QUIZ_MAX_QUESTIONS = 500;

export const lessonQuizSettingsSchema = z
  .object({
    attemptsAllowed: z.number().int().min(1).max(100),
    /** Null: no time limit. */
    timeLimitSeconds: z.number().int().min(60).max(86400).nullable(),
    passMarkPercent: z.number().min(0).max(100),
    shuffleItems: z.boolean(),
    shuffleOptions: z.boolean(),
    showAnswersPolicy: ShowAnswersPolicySchema,
    /** Null: every question. Otherwise this many, drawn at random per attempt. */
    questionsPerAttempt: z.number().int().min(1).max(LESSON_QUIZ_MAX_QUESTIONS).nullable(),
    /** Share of a question's marks lost for a wrong answer; 0 is off. */
    negativeMarkPercent: z.number().min(0).max(100),
  })
  .strict();

export const putLessonQuizBodySchema = z
  .object({
    settings: lessonQuizSettingsSchema,
    /** The questions, in the order learners see them. */
    questions: z
      .array(
        z
          .object({
            itemId: z.uuid(),
            points: z.coerce.number().min(0).max(10000),
          })
          .strict(),
      )
      .max(LESSON_QUIZ_MAX_QUESTIONS),
  })
  .strict();

export const lessonQuizQuestionSchema = z.object({
  itemId: z.uuid(),
  position: z.number().int(),
  points: z.number(),
  itemTypeKey: z.string(),
  contentJson: z.record(z.string(), z.unknown()),
  /** The question's status in the question bank (a quiz uses drafts too). */
  itemStatus: PublishStatusSchema,
  /** Learners have answered it in this quiz, so it can't be removed. */
  answered: z.boolean(),
});

export const lessonQuizSchema = z.object({
  lessonId: z.uuid(),
  lessonTitle: z.string(),
  courseId: z.uuid(),
  /** The course can be edited now (it's a draft or live, not in review). */
  editable: z.boolean(),
  /** The lesson, its section and the course are live, so learners see the quiz. */
  lessonLive: z.boolean(),
  /** Null until the first save. */
  quiz: z
    .object({
      id: z.uuid(),
      status: PublishStatusSchema,
      settings: lessonQuizSettingsSchema,
      questions: z.array(lessonQuizQuestionSchema),
      totalMarks: z.number(),
      /** Submitted or in-progress attempts by learners. */
      attemptCount: z.number().int(),
    })
    .nullable(),
});

export const lessonQuizResponseSchema = z.object({ data: lessonQuizSchema });

export type LessonQuizSettings = z.infer<typeof lessonQuizSettingsSchema>;
export type PutLessonQuizBody = z.infer<typeof putLessonQuizBodySchema>;
export type LessonQuizQuestion = z.infer<typeof lessonQuizQuestionSchema>;
export type LessonQuiz = z.infer<typeof lessonQuizSchema>;
export type LessonQuizResponse = z.infer<typeof lessonQuizResponseSchema>;
