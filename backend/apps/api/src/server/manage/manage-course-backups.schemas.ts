import { z } from "zod";

export const COURSE_BACKUP_STATUSES = [
  "QUEUED",
  "RUNNING",
  "SUCCEEDED",
  "FAILED",
  "CANCELLED",
] as const;

export const COURSE_BACKUP_DEMO_OTP = "000000";

export const manageCourseBackupJobSchema = z.object({
  id: z.string().uuid(),
  courseId: z.string().uuid(),
  courseTitle: z.string(),
  status: z.enum(COURSE_BACKUP_STATUSES),
  sectionIds: z.array(z.string().uuid()).nullable(),
  downloadUrl: z.string().nullable(),
  errorMessage: z.string().nullable(),
  expiresAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const manageCourseBackupsListResponseSchema = z.object({
  data: z.object({ items: z.array(manageCourseBackupJobSchema) }),
});

export const manageCourseBackupResponseSchema = z.object({
  data: manageCourseBackupJobSchema,
});

export const createManageCourseBackupBodySchema = z
  .object({
    courseId: z.string().uuid(),
    sectionIds: z.array(z.string().uuid()).max(500).optional(),
    otpCode: z.string().trim().min(4).max(12),
  })
  .strict();

export const requestCourseBackupOtpResponseSchema = z.object({
  data: z.object({
    sent: z.literal(true),
    demoHint: z.string().optional(),
  }),
});

export const manageCourseBackupDownloadResponseSchema = z.object({
  data: z.object({
    id: z.string().uuid(),
    courseId: z.string().uuid(),
    courseTitle: z.string(),
    generatedAt: z.string().datetime(),
    expiresAt: z.string().datetime().nullable(),
    scope: z.unknown(),
    snapshot: z.unknown(),
  }),
});
