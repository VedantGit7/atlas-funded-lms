// Poisons this module for any client bundle. Audit finding M9: nothing at the
// language level stopped a server module being pulled into a client component,
// so a leak of service code -- and whatever secrets or privileged queries it
// closes over -- would only have shown up as a runtime surprise.
import "server-only";

import type { z } from "zod";
import type {
  createNotificationTemplateBodySchema,
  deleteNotificationTemplateBodySchema,
  notificationInboxListQuerySchema,
  updateNotificationTemplateBodySchema,
} from "./notification.dto";

export type CreateNotificationTemplateBody = z.infer<typeof createNotificationTemplateBodySchema>;
export type UpdateNotificationTemplateBody = z.infer<typeof updateNotificationTemplateBodySchema>;
export type DeleteNotificationTemplateBody = z.infer<typeof deleteNotificationTemplateBodySchema>;
export type NotificationInboxListQuery = z.infer<typeof notificationInboxListQuerySchema>;
