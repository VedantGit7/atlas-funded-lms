import { z } from "zod";
import {
  NOTIFICATION_PREFERENCE_CATEGORIES,
  type PartialNotificationChannelPrefs,
} from "./notification-preferences.data";
export * from "./notification-preferences.data";

export const notificationPreferenceCategorySchema = z.enum(NOTIFICATION_PREFERENCE_CATEGORIES);
export function validateNotificationPreferenceInput(
  notifications: Record<string, PartialNotificationChannelPrefs> | undefined,
): Record<string, PartialNotificationChannelPrefs> {
  if (!notifications) {
    return {};
  }

  const validated: Record<string, PartialNotificationChannelPrefs> = {};
  for (const [key, value] of Object.entries(notifications)) {
    const parsed = notificationPreferenceCategorySchema.safeParse(key);
    if (parsed.success) {
      validated[parsed.data] = value;
    }
  }
  return validated;
}
