import { z } from "zod";
import { NOTIFICATION_SOURCE_EVENT_KEYS } from "./notification.events";

const rejectClientTenantFields = z
  .object({
    tenant_id: z.never().optional(),
    tenantId: z.never().optional(),
  })
  .loose();

const htmlTagPattern = /<[^>]*>/g;
const scriptPattern = /javascript:/i;
const unsafeUrlPattern = /^\s*(javascript:|data:|vbscript:)/i;

export const NOTIFICATION_CHANNELS = ["in_app", "email"] as const;

export const notificationChannelSchema = z.enum(NOTIFICATION_CHANNELS);

export const notificationSourceEventKeySchema = z.enum(NOTIFICATION_SOURCE_EVENT_KEYS);

export function sanitizePlainText(value: string): string {
  return value.replace(htmlTagPattern, "").replace(scriptPattern, "").trim();
}

export const internalActionPathSchema = z
  .string()
  .min(1)
  .max(512)
  .regex(/^\/[a-zA-Z0-9/_?=&.-]*$/)
  .refine((value) => !unsafeUrlPattern.test(value), "actionPath must be an internal relative path");

export const notificationVariableDeclarationSchema = z
  .object({
    name: z
      .string()
      .min(1)
      .max(64)
      .regex(/^[a-zA-Z][a-zA-Z0-9_]*$/),
    description: z.string().max(200).optional(),
  })
  .strict();

export const notificationVariablesJsonSchema = z
  .object({
    variables: z.array(notificationVariableDeclarationSchema).max(20).default([]),
    defaultActionPath: internalActionPathSchema.optional(),
  })
  .strict();

export const plainTextBodySchema = z
  .string()
  .min(1)
  .max(4000)
  .refine((value) => !htmlTagPattern.test(value), "Body must be plain text")
  .refine((value) => !scriptPattern.test(value), "Body must be plain text")
  .transform(sanitizePlainText)
  .refine((value) => value.length > 0, "Body is required");

export const plainTextSubjectSchema = z
  .string()
  .min(1)
  .max(200)
  .transform(sanitizePlainText)
  .refine((value) => value.length > 0, "Subject is required");

const templateBaseSchema = z
  .object({
    key: notificationSourceEventKeySchema,
    channel: notificationChannelSchema,
    locale: z.string().min(2).max(16).default("en"),
    body: plainTextBodySchema,
    variablesJson: notificationVariablesJsonSchema.default({ variables: [] }),
    status: z.enum(["ACTIVE", "INACTIVE", "ARCHIVED"]).optional(),
  })
  .strict();

export const createNotificationTemplateBodySchema = templateBaseSchema
  .extend({
    subject: plainTextSubjectSchema.optional(),
  })
  .superRefine((value, ctx) => {
    if (value.channel === "email" && !value.subject) {
      ctx.addIssue({
        code: "custom",
        message: "Email templates require a subject.",
        path: ["subject"],
      });
    }
    validateDeclaredVariables(value.body, value.variablesJson.variables, ctx);
  })
  .and(rejectClientTenantFields);

export const updateNotificationTemplateBodySchema = z
  .object({
    id: z.uuid(),
    key: notificationSourceEventKeySchema.optional(),
    channel: notificationChannelSchema.optional(),
    locale: z.string().min(2).max(16).optional(),
    subject: plainTextSubjectSchema.optional().nullable(),
    body: plainTextBodySchema.optional(),
    variablesJson: notificationVariablesJsonSchema.optional(),
    status: z.enum(["ACTIVE", "INACTIVE", "ARCHIVED"]).optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.body && value.variablesJson) {
      validateDeclaredVariables(value.body, value.variablesJson.variables, ctx);
    }
  })
  .and(rejectClientTenantFields);

export const deleteNotificationTemplateBodySchema = z
  .object({
    id: z.uuid(),
  })
  .strict()
  .and(rejectClientTenantFields);

export const notificationTemplateDtoSchema = z.object({
  id: z.uuid(),
  key: notificationSourceEventKeySchema,
  channel: notificationChannelSchema,
  locale: z.string(),
  subject: z.string().nullable(),
  body: z.string(),
  variablesJson: notificationVariablesJsonSchema,
  status: z.enum(["ACTIVE", "INACTIVE", "ARCHIVED"]),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export const notificationTemplateListResponseSchema = z.object({
  data: z.array(notificationTemplateDtoSchema),
});

export const notificationTemplateDetailResponseSchema = z.object({
  data: notificationTemplateDtoSchema,
});

export const deleteNotificationTemplateResponseSchema = z.object({
  data: z.object({
    id: z.uuid(),
    deleted: z.literal(true),
  }),
});

export const notificationInboxItemSchema = z.object({
  id: z.uuid(),
  title: z.string(),
  body: z.string(),
  actionPath: z.string(),
  read: z.boolean(),
  readAt: z.iso.datetime().nullable(),
  archived: z.boolean(),
  archivedAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
});

export const notificationInboxListQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(50).default(25),
    cursor: z.uuid().optional(),
    /** When true, return archived items only; default list excludes archived. */
    includeArchived: z
      .union([z.boolean(), z.enum(["true", "false", "1", "0"])])
      .optional()
      .transform((value) => {
        if (value === undefined) return false;
        if (typeof value === "boolean") return value;
        return value === "true" || value === "1";
      }),
    tenant_id: z.never().optional(),
    tenantId: z.never().optional(),
  })
  .strict();

export const notificationInboxListResponseSchema = z.object({
  data: z.array(notificationInboxItemSchema),
  page: z.object({
    nextCursor: z.uuid().nullable(),
    hasMore: z.boolean(),
  }),
});

export const markNotificationReadResponseSchema = z.object({
  data: z.object({
    id: z.uuid(),
    read: z.literal(true),
    readAt: z.iso.datetime(),
  }),
});

export const markNotificationArchivedResponseSchema = z.object({
  data: z.object({
    id: z.uuid(),
    archived: z.literal(true),
    archivedAt: z.iso.datetime(),
  }),
});

export const notificationQueuedOutboxPayloadSchema = z.object({
  dispatchId: z.uuid().optional(),
  channel: notificationChannelSchema,
  templateId: z.uuid(),
  templateKey: notificationSourceEventKeySchema,
  membershipId: z.uuid(),
  sourceEventId: z.uuid(),
  renderedPayload: z
    .object({
      title: z.string(),
      body: z.string(),
      actionPath: z.string(),
      emailSubject: z.string().nullable(),
    })
    .optional(),
});

export const notificationParamsSchema = z
  .object({
    id: z.uuid(),
  })
  .strict();

function validateDeclaredVariables(
  body: string,
  declarations: Array<{ name: string }>,
  ctx: z.RefinementCtx,
): void {
  const declared = new Set(declarations.map((item) => item.name));
  const matches = body.match(/\{\{(\w+)\}\}/g) ?? [];

  for (const match of matches) {
    const name = match.slice(2, -2);
    if (!declared.has(name)) {
      ctx.addIssue({
        code: "custom",
        message: `Undeclared template variable: ${name}`,
        path: ["body"],
      });
    }
  }
}

export const NOTIFICATION_READ_RECEIPT_TEMPLATE_KEY = "__inbox_read__" as const;
export const NOTIFICATION_ARCHIVE_TEMPLATE_KEY = "__inbox_archive__" as const;

export function isInboxSentinelTemplateKey(templateKey: string | null | undefined): boolean {
  return (
    templateKey === NOTIFICATION_READ_RECEIPT_TEMPLATE_KEY ||
    templateKey === NOTIFICATION_ARCHIVE_TEMPLATE_KEY
  );
}

export function renderNotificationPlainText(
  template: string,
  variables: Record<string, string>,
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_match, name: string) => variables[name] ?? "");
}

export function extractReadReceiptAt(payloadJson: unknown): string | null {
  if (!payloadJson || typeof payloadJson !== "object") return null;
  const inbox = (payloadJson as { inbox?: { readAt?: unknown } }).inbox;
  return typeof inbox?.readAt === "string" ? inbox.readAt : null;
}

export function extractArchiveReceiptAt(payloadJson: unknown): string | null {
  if (!payloadJson || typeof payloadJson !== "object") return null;
  const inbox = (payloadJson as { inbox?: { archivedAt?: unknown } }).inbox;
  return typeof inbox?.archivedAt === "string" ? inbox.archivedAt : null;
}

export function extractInboxPayload(payloadJson: unknown): {
  title: string;
  body: string;
  actionPath: string;
  readAt: string | null;
} | null {
  if (!payloadJson || typeof payloadJson !== "object") return null;
  const inbox = (payloadJson as { inbox?: unknown }).inbox;
  if (!inbox || typeof inbox !== "object") return null;
  const record = inbox as Record<string, unknown>;
  if (
    typeof record["title"] !== "string" ||
    typeof record["body"] !== "string" ||
    typeof record["actionPath"] !== "string"
  ) {
    return null;
  }
  const readAt = record["readAt"];
  return {
    title: record["title"],
    body: record["body"],
    actionPath: record["actionPath"],
    readAt: typeof readAt === "string" ? readAt : null,
  };
}
