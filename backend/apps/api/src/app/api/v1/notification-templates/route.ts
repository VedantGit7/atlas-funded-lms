import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  createNotificationTemplateBodySchema,
  deleteNotificationTemplateBodySchema,
  deleteNotificationTemplateResponseSchema,
  notificationTemplateDetailResponseSchema,
  notificationTemplateListResponseSchema,
  updateNotificationTemplateBodySchema,
} from "../../../../server/notifications/notification.dto";
import {
  createNotificationTemplate,
  deleteNotificationTemplate,
  listNotificationTemplates,
  updateNotificationTemplate,
} from "../../../../server/notifications/notification.service";
import {
  deleteNotificationTemplateMetadata,
  listNotificationTemplatesMetadata,
  mutateNotificationTemplatesMetadata,
  updateNotificationTemplateMetadata,
} from "../../../../server/notifications/notification.route-metadata";

export const GET = createTenantRoute<
  Record<string, never>,
  z.output<typeof notificationTemplateListResponseSchema>
>({
  metadata: listNotificationTemplatesMetadata,
  output: notificationTemplateListResponseSchema,
  handler: async ({ tx, ctx }) => listNotificationTemplates(tx, ctx),
});

export const POST = createTenantRoute<
  z.output<typeof createNotificationTemplateBodySchema>,
  z.output<typeof notificationTemplateDetailResponseSchema>
>({
  metadata: mutateNotificationTemplatesMetadata,
  body: createNotificationTemplateBodySchema,
  output: notificationTemplateDetailResponseSchema,
  handler: async ({ tx, ctx, input }) => createNotificationTemplate(tx, ctx, input),
});

export const PUT = createTenantRoute<
  z.output<typeof updateNotificationTemplateBodySchema>,
  z.output<typeof notificationTemplateDetailResponseSchema>
>({
  metadata: updateNotificationTemplateMetadata,
  body: updateNotificationTemplateBodySchema,
  output: notificationTemplateDetailResponseSchema,
  handler: async ({ tx, ctx, input }) => updateNotificationTemplate(tx, ctx, input),
});

export const DELETE = createTenantRoute<
  z.output<typeof deleteNotificationTemplateBodySchema>,
  z.output<typeof deleteNotificationTemplateResponseSchema>
>({
  metadata: deleteNotificationTemplateMetadata,
  body: deleteNotificationTemplateBodySchema,
  output: deleteNotificationTemplateResponseSchema,
  handler: async ({ tx, ctx, input }) => deleteNotificationTemplate(tx, ctx, input),
});
