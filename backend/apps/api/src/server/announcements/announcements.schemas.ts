import { z } from "zod";

export const ANNOUNCEMENT_TYPES = ["GENERAL", "BATCH"] as const;
export const ANNOUNCEMENT_STATUSES = ["SENT"] as const;

export const ANNOUNCEMENT_TITLE_MAX = 60;
export const ANNOUNCEMENT_MESSAGE_MAX = 255;
export const ANNOUNCEMENT_IMAGE_MAX_BYTES = 40 * 1024;

export const announcementDtoSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  message: z.string(),
  type: z.enum(ANNOUNCEMENT_TYPES),
  audienceBatchId: z.string().uuid().nullable(),
  audienceLabel: z.string(),
  deepLink: z.string().nullable(),
  imageUrl: z.string().nullable(),
  status: z.enum(ANNOUNCEMENT_STATUSES),
  recipientCount: z.number().int().nonnegative(),
  sentAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const announcementsListQuerySchema = z
  .object({
    type: z.enum(["ALL", ...ANNOUNCEMENT_TYPES]).optional().default("ALL"),
    q: z.string().trim().max(200).optional(),
    createdOn: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
    /** Calendar month filter as YYYY-MM (UTC date bounds on created_at). */
    createdMonth: z
      .string()
      .regex(/^\d{4}-\d{2}$/)
      .optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.createdOn && value.createdMonth) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Use createdOn or createdMonth, not both.",
        path: ["createdMonth"],
      });
    }
  });

export const announcementsListResponseSchema = z.object({
  data: z.object({ items: z.array(announcementDtoSchema) }),
});

export const announcementResponseSchema = z.object({ data: announcementDtoSchema });

const optionalDeepLinkSchema = z
  .string()
  .trim()
  .max(1000)
  .optional()
  .nullable()
  .transform((value) => {
    if (value == null) return null;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  })
  .superRefine((value, ctx) => {
    if (!value) return;
    try {
      const url = new URL(value);
      if (url.protocol !== "http:" && url.protocol !== "https:") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Deeplink must start with http:// or https://.",
        });
      }
    } catch {
      if (!value.startsWith("/")) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Enter a URL with http:// or https://, or an internal path starting with /.",
        });
      }
    }
  });

const optionalImageUrlSchema = z
  .string()
  .trim()
  .max(80_000)
  .optional()
  .nullable()
  .transform((value) => {
    if (value == null) return null;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  })
  .superRefine((value, ctx) => {
    if (!value) return;
    if (value.startsWith("data:image/jpeg") || value.startsWith("data:image/jpg")) {
      const comma = value.indexOf(",");
      if (comma < 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Invalid image data.",
        });
        return;
      }
      const base64 = value.slice(comma + 1);
      const byteLength = Buffer.from(base64, "base64").byteLength;
      if (byteLength > ANNOUNCEMENT_IMAGE_MAX_BYTES) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Image must be 40kb or smaller.",
        });
      }
      return;
    }
    try {
      const url = new URL(value);
      if (url.protocol !== "http:" && url.protocol !== "https:") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Image URL must use http:// or https://.",
        });
      }
    } catch {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Image must be a JPEG data URL or http(s) URL.",
      });
    }
  });

export const createAnnouncementBodySchema = z
  .object({
    title: z.string().trim().min(1).max(ANNOUNCEMENT_TITLE_MAX),
    message: z.string().trim().min(1).max(ANNOUNCEMENT_MESSAGE_MAX),
    deepLink: optionalDeepLinkSchema,
    imageUrl: optionalImageUrlSchema,
    batchId: z.string().uuid().optional().nullable(),
  })
  .strict();

export const deleteAnnouncementBodySchema = z
  .object({
    titleConfirmation: z.string().trim().min(1).max(ANNOUNCEMENT_TITLE_MAX),
  })
  .strict();

export const deleteAnnouncementResponseSchema = z.object({
  data: z.object({ id: z.string().uuid(), deleted: z.literal(true) }),
});

export const testAnnouncementResponseSchema = z.object({
  data: z.object({
    sent: z.literal(true),
  }),
});
