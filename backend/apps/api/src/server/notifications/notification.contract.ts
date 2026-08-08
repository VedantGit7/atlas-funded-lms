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
