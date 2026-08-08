/** Product / learning notifications (tenant-scoped, per membership). */
export const PRODUCT_NOTIFICATION_CATEGORIES = [
  "certificate.issued",
  "certificate.revoked",
] as const;

/** Security alert emails (opt-out, default on). */
export const SECURITY_NOTIFICATION_CATEGORIES = [
  "security.password_changed",
  "security.email_changed",
  "security.phone_changed",
  "security.signin_method_linked",
  "security.signin_method_removed",
  "security.mfa_enabled",
  "security.mfa_disabled",
] as const;

export const NOTIFICATION_PREFERENCE_CATEGORIES = [
  ...PRODUCT_NOTIFICATION_CATEGORIES,
  ...SECURITY_NOTIFICATION_CATEGORIES,
] as const;

export type NotificationPreferenceCategory =
  (typeof NOTIFICATION_PREFERENCE_CATEGORIES)[number];

export const NOTIFICATION_CATEGORY_LABELS: Record<NotificationPreferenceCategory, string> = {
  "certificate.issued": "A certificate is issued to me",
  "certificate.revoked": "A certificate of mine is revoked",
  "security.password_changed": "My password was changed",
  "security.email_changed": "My email address was changed",
  "security.phone_changed": "My phone number was changed",
  "security.signin_method_linked": "A new sign-in method was linked",
  "security.signin_method_removed": "A sign-in method was removed",
  "security.mfa_enabled": "Two-factor authentication was added",
  "security.mfa_disabled": "Two-factor authentication was removed",
};

export const NOTIFICATION_CATEGORY_GROUPS = {
  product: {
    title: "Product notifications",
    description: "Course and certificate activity in this academy.",
    categories: PRODUCT_NOTIFICATION_CATEGORIES,
  },
  security: {
    title: "Security alerts & notifications",
    description:
      "Get notified when important changes are made to your account. We recommend keeping these on.",
    categories: SECURITY_NOTIFICATION_CATEGORIES,
  },
} as const;

export type NotificationChannelPrefs = { email: boolean; inApp: boolean };
