export type GeneralSettingsNavItem = {
  id: string;
  label: string;
  href: string;
  available: boolean;
};

export const GENERAL_SETTINGS_NAV_ITEMS: readonly GeneralSettingsNavItem[] = [
  {
    id: "time-zones",
    label: "Time Zones",
    href: "/admin/timezones",
    available: true,
  },
  {
    id: "video-quality",
    label: "Video Quality",
    href: "/admin/video-quality",
    available: true,
  },
] as const;

export function resolveGeneralSettingsNavItem(pathname: string): GeneralSettingsNavItem {
  const match = GENERAL_SETTINGS_NAV_ITEMS.find(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
  );
  return match ?? (GENERAL_SETTINGS_NAV_ITEMS[0] as GeneralSettingsNavItem);
}
