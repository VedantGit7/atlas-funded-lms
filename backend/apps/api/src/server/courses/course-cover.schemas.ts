import { z } from "zod";
import { mutationBodySchema } from "@atlas/membership/schemas/shared";

/**
 * Uploading a course's image (QA review 1 M21, M49): ask for an upload, send
 * the file, then confirm, which checks the bytes and sets the course's image.
 */
const forbiddenIdentityFields = {
  userId: z.never().optional(),
  memberId: z.never().optional(),
  membershipId: z.never().optional(),
  courseId: z.never().optional(),
  status: z.never().optional(),
};

export const courseCoverUploadBodySchema = mutationBodySchema({
  fileName: z.string().min(1).max(240),
  contentType: z.string().min(1).max(180),
  sizeBytes: z.number().int().min(1),
  checksumSha256: z
    .string()
    .regex(/^[a-f0-9]{64}$/)
    .nullable()
    .optional(),
  ...forbiddenIdentityFields,
}).strict();

export type CourseCoverUploadBody = z.output<typeof courseCoverUploadBodySchema>;

export const courseCoverConfirmBodySchema = mutationBodySchema({
  assetReferenceId: z.uuid(),
  ...forbiddenIdentityFields,
}).strict();

export type CourseCoverConfirmBody = z.output<typeof courseCoverConfirmBodySchema>;

export const courseCoverConfirmResponseSchema = z.object({
  data: z.object({
    assetReferenceId: z.uuid(),
    /** The image's lasting address, now the course's image. */
    coverKey: z.string(),
  }),
});

export const courseCoverBlobResponseSchema = z.object({
  data: z.object({
    assetReferenceId: z.uuid(),
    stored: z.literal(true),
  }),
});
