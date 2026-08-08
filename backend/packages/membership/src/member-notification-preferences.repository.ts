import { createUuidV7 } from "@atlas/core/id/uuid-v7";
import type {
  NotificationPreferenceCategory,
  PartialNotificationChannelPrefs,
} from "./notification-preferences.catalog";

type Tx = {
  $queryRaw<T = unknown>(query: TemplateStringsArray, ...values: unknown[]): Promise<T>;
  $executeRaw(query: TemplateStringsArray, ...values: unknown[]): Promise<unknown>;
};

export async function listMemberNotificationPreferenceOverrides(args: {
  tx: Tx;
  tenantId: string;
  membershipId: string;
}): Promise<Array<{ category_key: string; email_enabled: boolean; in_app_enabled: boolean }>> {
  return args.tx.$queryRaw<
    Array<{ category_key: string; email_enabled: boolean; in_app_enabled: boolean }>
  >`
    select category_key, email_enabled, in_app_enabled
    from member_notification_preferences
    where tenant_id = ${args.tenantId}::uuid
      and membership_id = ${args.membershipId}::uuid
  `;
}

/** Category-level opt-out: true only when BOTH channels are off (fully opted out). */
export async function isMemberOptedOutOfCategory(args: {
  tx: Tx;
  tenantId: string;
  membershipId: string;
  category: NotificationPreferenceCategory;
}): Promise<boolean> {
  const rows = await args.tx.$queryRaw<Array<{ enabled: boolean }>>`
    select enabled
    from member_notification_preferences
    where tenant_id = ${args.tenantId}::uuid
      and membership_id = ${args.membershipId}::uuid
      and category_key = ${args.category}
    limit 1
  `;

  const row = rows[0];
  if (!row) {
    return false;
  }

  return !row.enabled;
}

/** Channel-level opt-out: true when this specific channel is off for the category. */
export async function isMemberOptedOutOfChannel(args: {
  tx: Tx;
  tenantId: string;
  membershipId: string;
  category: NotificationPreferenceCategory;
  channel: "email" | "in_app";
}): Promise<boolean> {
  const rows = await args.tx.$queryRaw<Array<{ email_enabled: boolean; in_app_enabled: boolean }>>`
    select email_enabled, in_app_enabled
    from member_notification_preferences
    where tenant_id = ${args.tenantId}::uuid
      and membership_id = ${args.membershipId}::uuid
      and category_key = ${args.category}
    limit 1
  `;

  const row = rows[0];
  if (!row) {
    return false;
  }

  return args.channel === "email" ? !row.email_enabled : !row.in_app_enabled;
}

export async function upsertMemberNotificationPreferences(args: {
  tx: Tx;
  tenantId: string;
  membershipId: string;
  preferences: Record<string, PartialNotificationChannelPrefs>;
}): Promise<void> {
  for (const [categoryKey, channels] of Object.entries(args.preferences)) {
    const id = createUuidV7();
    const emailEnabled = channels.email ?? true;
    const inAppEnabled = channels.inApp ?? true;
    const enabled = emailEnabled || inAppEnabled;

    await args.tx.$executeRaw`
      insert into member_notification_preferences (
        id,
        tenant_id,
        membership_id,
        category_key,
        enabled,
        email_enabled,
        in_app_enabled,
        created_at,
        updated_at
      )
      values (
        ${id}::uuid,
        ${args.tenantId}::uuid,
        ${args.membershipId}::uuid,
        ${categoryKey},
        ${enabled},
        ${emailEnabled},
        ${inAppEnabled},
        now(),
        now()
      )
      on conflict (tenant_id, membership_id, category_key)
      do update set
        enabled = excluded.enabled,
        email_enabled = excluded.email_enabled,
        in_app_enabled = excluded.in_app_enabled,
        updated_at = now()
    `;
  }
}
