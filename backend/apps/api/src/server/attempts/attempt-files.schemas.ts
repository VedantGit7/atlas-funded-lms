import { z } from "zod";
import { mutationBodySchema } from "@atlas/membership/schemas/shared";

/**
 * A learner's file for an upload question (QA review 1 m26; S3.4c): ask for
 * an upload, send the file to storage, confirm (the bytes are checked), then
 * save it as the answer like any other.
 */

export const attemptFileUploadBodySchema = mutationBodySchema({
  /** The upload question the file answers. */
  itemId: z.uuid(),
  fileName: z.string().trim().min(1).max(240),
  sizeBytes: z.number().int().min(1),
  /**
   * What the browser says the file is. Not used: the type comes from the
   * extension (answer-rules.contract.ts), and the bytes are checked against it.
   */
  contentType: z.string().max(180).optional(),
}).strict();

export type AttemptFileUploadBody = z.output<typeof attemptFileUploadBodySchema>;

export const attemptFileConfirmBodySchema = mutationBodySchema({
  assetReferenceId: z.uuid(),
}).strict();

export type AttemptFileConfirmBody = z.output<typeof attemptFileConfirmBodySchema>;

/** A confirmed file, as an upload answer stores it. */
export const attemptFileSchema = z.object({
  assetReferenceId: z.uuid(),
  fileName: z.string(),
  sizeBytes: z.number().int(),
  contentType: z.string(),
});

export const attemptFileResponseSchema = z.object({ data: attemptFileSchema });

export const attemptFileBlobResponseSchema = z.object({
  data: z.object({ assetReferenceId: z.uuid(), stored: z.literal(true) }),
});

/** A short-lived link to the file. */
export const attemptFileDownloadResponseSchema = z.object({
  data: z.object({ url: z.string(), expiresAt: z.string(), fileName: z.string() }),
});

export const attemptFileParamsSchema = z.object({
  id: z.uuid(),
  assetId: z.uuid(),
});

export type AttemptFile = z.infer<typeof attemptFileSchema>;
