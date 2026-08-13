import { z } from "zod";

export const proctoringEventTypeSchema = z.enum([
  "tab_hidden",
  "window_blur",
  "fullscreen_exit",
  "copy",
  "paste",
  "cut",
  "context_menu",
  "devtools_heuristic",
  "face_present",
  "face_absent",
  "multiple_faces",
  "microphone_activity",
  "media_permission_denied",
  "media_unavailable",
  "identity_verification_passed",
  "identity_verification_failed",
  "identity_verification_degraded",
]);

export const proctoringConsentLevelSchema = z.union([z.literal(1), z.literal(2), z.literal(3)]);

export const ingestProctoringEventsBodySchema = z
  .object({
    events: z
      .array(
        z.object({
          eventType: proctoringEventTypeSchema,
          occurredAt: z.iso.datetime(),
          clientEventId: z.string().min(1).max(128),
          metadata: z.record(z.string(), z.unknown()).optional(),
        }),
      )
      .min(1)
      .max(50),
    consent: z
      .object({
        consentedAt: z.iso.datetime(),
        level: proctoringConsentLevelSchema,
      })
      .optional(),
  })
  .strict();

export const ingestProctoringEventsResponseSchema = z.object({
  data: z.object({
    accepted: z.number().int(),
    duplicates: z.number().int(),
  }),
});

export const identityVerificationStatusSchema = z.enum(["passed", "failed", "degraded"]);

export const identityVerificationMethodSchema = z.enum(["id_face_match", "fixture"]);

export const identityVerificationBodySchema = z
  .object({
    status: identityVerificationStatusSchema,
    method: identityVerificationMethodSchema,
    score: z.number().min(0).max(1).optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();

export const identityVerificationResponseSchema = z.object({
  data: z.object({
    id: z.uuid(),
    status: identityVerificationStatusSchema,
    method: identityVerificationMethodSchema,
    score: z.number().nullable(),
    verifiedAt: z.string().nullable(),
  }),
});

export type IngestProctoringEventsBody = z.infer<typeof ingestProctoringEventsBodySchema>;
export type ProctoringEventType = z.infer<typeof proctoringEventTypeSchema>;
export type IdentityVerificationBody = z.infer<typeof identityVerificationBodySchema>;
