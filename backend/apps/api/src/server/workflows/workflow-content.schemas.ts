import { z } from "zod";

/**
 * What a reviewer is approving (QA review 2 4.1: "the reviewer can't see the
 * questions being approved"): the quizzes in a course, or the quiz itself,
 * with each question, its marks and its correct answer in words.
 */

export const reviewQuestionSchema = z.object({
  position: z.number().int(),
  itemTypeKey: z.string(),
  contentJson: z.record(z.string(), z.unknown()),
  points: z.number(),
  /** Answer choices, for choice questions; empty otherwise. */
  choices: z.array(z.object({ label: z.string(), correct: z.boolean() })),
  /** The correct (or model) answer, one line per part. */
  correctAnswer: z.array(z.string()),
  correctAnswerLabel: z.string(),
  explanation: z.string().nullable(),
});

export const reviewQuizSchema = z.object({
  assessmentId: z.uuid(),
  title: z.string(),
  /** The quiz lesson and its section, for a course's quiz. */
  lessonTitle: z.string().nullable(),
  sectionTitle: z.string().nullable(),
  passMarkPercent: z.number(),
  attemptsAllowed: z.number().int(),
  timeLimitSeconds: z.number().int().nullable(),
  questionsPerAttempt: z.number().int().nullable(),
  negativeMarkPercent: z.number(),
  totalMarks: z.number(),
  questions: z.array(reviewQuestionSchema),
});

export const workflowContentResponseSchema = z.object({
  data: z.object({
    targetType: z.string(),
    targetId: z.uuid(),
    quizzes: z.array(reviewQuizSchema),
  }),
});

export type ReviewQuestion = z.infer<typeof reviewQuestionSchema>;
export type ReviewQuiz = z.infer<typeof reviewQuizSchema>;
export type WorkflowContentResponse = z.infer<typeof workflowContentResponseSchema>;
