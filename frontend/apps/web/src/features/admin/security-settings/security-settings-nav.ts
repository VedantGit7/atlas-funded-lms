export type SecuritySettingsNavItem = {
  id: string;
  label: string;
  href: string;
};

export const SECURITY_SETTINGS_NAV_ITEMS: readonly SecuritySettingsNavItem[] = [
  {
    id: "learner-email-verification",
    label: "Learner Email Verification",
    href: "/admin/security/learner-email-verification",
  },
  {
    id: "admin-otp",
    label: "Admin OTP",
    href: "/admin/security/admin-otp",
  },
  {
    id: "device-monitor",
    label: "Device Monitor",
    href: "/admin/security/device-monitor",
  },
] as const;
