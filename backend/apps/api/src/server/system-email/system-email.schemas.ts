import { z } from "zod";
import { notificationSourceEventKeySchema } from "../notifications/notification.dto";

export const systemEmailDtoSchema = z.object({
  key: notificationSourceEventKeySchema,
  name: z.string(),
  description: z.string(),
  category: z.enum(["certificates", "security"]),
  enabled: z.boolean(),
  isCustomized: z.boolean(),
  subject: z.string(),
  body: z.string(),
  defaultSubject: z.string(),
  defaultBody: z.string(),
  defaultActionPath: z.string(),
  templateId: z.string().uuid().nullable(),
  updatedAt: z.string().datetime().nullable(),
});

export const systemEmailsListResponseSchema = z.object({
  data: z.object({ items: z.array(systemEmailDtoSchema) }),
});

export const systemEmailResponseSchema = z.object({
  data: systemEmailDtoSchema,
});

export const updateSystemEmailBodySchema = z
  .object({
    subject: z.string().trim().min(1).max(200),
    body: z.string().trim().min(1).max(4000),
  })
  .strict();

export const setSystemEmailEnabledBodySchema = z
  .object({
    enabled: z.boolean(),
  })
  .strict();

export const testSystemEmailBodySchema = z
  .object({
    testEmail: z.string().email(),
  })
  .strict();

export const testSystemEmailResponseSchema = z.object({
  data: z.object({
    sent: z.literal(true),
    to: z.string().email(),
  }),
});

export const previewSystemEmailResponseSchema = z.object({
  data: z.object({
    subject: z.string(),
    body: z.string(),
    sampleVariables: z.record(z.string(), z.string()),
    variables: z.array(
      z.object({
        key: z.string(),
        sample: z.string(),
        description: z.string(),
      }),
    ),
    defaultActionPath: z.string(),
  }),
});
