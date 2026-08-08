import {
  deleteNotificationTemplateMetadata,
  listNotificationTemplatesMetadata,
  mutateNotificationTemplatesMetadata,
  updateNotificationTemplateMetadata,
} from "../../../../server/notifications/notification.route-metadata";

export const routeMetadata = {
  GET: listNotificationTemplatesMetadata,
  POST: mutateNotificationTemplatesMetadata,
  PUT: updateNotificationTemplateMetadata,
  DELETE: deleteNotificationTemplateMetadata,
};
