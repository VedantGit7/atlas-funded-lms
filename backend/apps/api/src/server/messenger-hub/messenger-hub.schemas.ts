import { z } from "zod";

export const messengerHubChannelKeySchema = z.enum([
  "push",
  "email",
  "system_email",
  "announcements",
  "whatsapp",
]);

export const messengerHubActivityKindSchema = z.enum([
  "sent",
  "scheduled",
  "draft",
  "connected",
]);

export const messengerHubActivityItemSchema = z.object({
  id: z.string(),
  channel: messengerHubChannelKeySchema,
  kind: messengerHubActivityKindSchema,
  title: z.string(),
  detail: z.string(),
  at: z.string().datetime(),
  href: z.string(),
});

export const messengerHubSummaryDtoSchema = z.object({
  email: z.object({
    activeCount: z.number().int().nonnegative(),
    scheduledCount: z.number().int().nonnegative(),
    draftCount: z.number().int().nonnegative(),
    sentCount: z.number().int().nonnegative(),
    totalReach: z.number().int().nonnegative(),
    weeklySent: z.array(z.number().int().nonnegative()).length(7),
    latestTitle: z.string().nullable(),
  }),
  push: z.object({
    activeCount: z.number().int().nonnegative(),
    sentCount: z.number().int().nonnegative(),
    totalReach: z.number().int().nonnegative(),
  }),
  systemEmail: z.object({
    enabledCount: z.number().int().nonnegative(),
    totalCount: z.number().int().nonnegative(),
  }),
  announcements: z.object({
    sentCount: z.number().int().nonnegative(),
    totalReach: z.number().int().nonnegative(),
  }),
  whatsapp: z.object({
    connectionStatus: z.enum(["CONNECTED", "DISCONNECTED"]),
    activeCount: z.number().int().nonnegative(),
    sentCount: z.number().int().nonnegative(),
  }),
  integrations: z.object({
    webhookCount: z.number().int().nonnegative(),
    webhookEnabledCount: z.number().int().nonnegative(),
    lastDeliveryAt: z.string().datetime().nullable(),
    lastDeliveryOk: z.boolean().nullable(),
    apiKeyConfigured: z.boolean(),
  }),
  activity: z.array(messengerHubActivityItemSchema),
});

export const messengerHubSummaryResponseSchema = z.object({
  data: messengerHubSummaryDtoSchema,
});
