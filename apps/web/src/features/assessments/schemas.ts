import { z } from "zod";

export const IdSchema = z.string().uuid();

export const PublishStatusSchema = z.enum(["DRAFT", "REVIEW", "PUBLISHED", "ARCHIVED"]);

export const AssessmentTypeSchema = z.enum([
  "quiz",
  "exam",
  "diagnostic",
  "readiness_review",
  "assignment",
]);

export const ShowAnswersPolicySchema = z.enum([
  "never",
  "after_submit",
  "after_pass",
  "after_graded",
]);

export const AssessmentConfigSchema = z
  .object({
    attemptsAllowed: z.number().int().min(1).max(100).default(1),
    timeLimitSeconds: z.number().int().min(60).max(86400).optional(),
    passMarkPercent: z.number().min(0).max(100).default(70),
    shuffleItems: z.boolean().default(false),
    shuffleOptions: z.boolean().default(false),
    secureMode: z.boolean().default(false),
    l1ProctoringEnabled: z.boolean().default(false),
    showAnswersPolicy: ShowAnswersPolicySchema.default("after_submit"),
  })
  .strict();

export const AssessmentItemInputSchema = z.object({
  itemId: IdSchema,
  position: z.number().int().min(1).max(1000),
  points: z.coerce.number().min(0).max(10000),
  required: z.boolean().default(true),
});

export const CreateAssessmentBodySchema = z.object({
  title: z.string().trim().min(2).max(180),
  description: z.string().trim().max(2000).optional(),
  assessmentType: AssessmentTypeSchema.default("quiz"),
  config: AssessmentConfigSchema.default({}),
});

export const UpdateAssessmentBodySchema = z.object({
  title: z.string().trim().min(2).max(180).optional(),
  description: z.string().trim().max(2000).nullable().optional(),
  assessmentType: AssessmentTypeSchema.optional(),
  config: AssessmentConfigSchema.partial().optional(),
  items: z.array(AssessmentItemInputSchema).max(500).optional(),
});

export const ListAssessmentsQuerySchema = z.object({
  type: AssessmentTypeSchema.optional(),
  status: PublishStatusSchema.optional(),
  q: z.string().trim().max(120).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  cursor: z.string().optional(),
});

export const GetAssessmentQuerySchema = z.object({
  view: z.enum(["learner"]).optional(),
});

export const AssessmentParamsSchema = z.object({
  id: IdSchema,
});

export const PublishAssessmentBodySchema = z.object({
  reason: z.string().trim().max(500).optional(),
});

export const StartAttemptBodySchema = z.object({}).strict();

export const SaveAnswerBodySchema = z.object({
  itemId: IdSchema,
  answerJson: z.record(z.string(), z.unknown()),
});

export const SubmitAttemptBodySchema = z.object({}).strict();

export const AttemptParamsSchema = z.object({
  id: IdSchema,
});

export type AssessmentConfig = z.infer<typeof AssessmentConfigSchema>;
export type CreateAssessmentInput = z.infer<typeof CreateAssessmentBodySchema>;
export type UpdateAssessmentInput = z.infer<typeof UpdateAssessmentBodySchema>;
export type ListAssessmentsQuery = z.infer<typeof ListAssessmentsQuerySchema>;
export type AssessmentItemInput = z.infer<typeof AssessmentItemInputSchema>;
export type SaveAnswerInput = z.infer<typeof SaveAnswerBodySchema>;
