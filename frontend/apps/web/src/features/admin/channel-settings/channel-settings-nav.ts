export type ChannelSettingsNavItem = {
  id: string;
  label: string;
  href: string;
};

export const CHANNEL_EMAIL_NAV_ITEMS: readonly ChannelSettingsNavItem[] = [
  {
    id: "transactional-email",
    label: "Transactional Email",
    href: "/admin/channels/transactional-email",
  },
  {
    id: "marketing-email",
    label: "Marketing Email",
    href: "/admin/channels/marketing-email",
  },
  {
    id: "support-email",
    label: "Support Email",
    href: "/admin/channels/support-email",
  },
] as const;
