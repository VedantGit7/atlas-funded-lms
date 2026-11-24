import { ADMIN_PRIMARY_NAV } from "../../features/admin/admin-navigation";
import {
  ADMIN_SETTINGS_SECTIONS,
  flattenAdminSettingsItems,
} from "../../features/admin/settings/admin-settings-catalog";
import { LEARNER_PRIMARY_NAV } from "../../features/learner/learner-navigation";
import { STUDIO_PRIMARY_NAV } from "../../features/studio/studio-navigation";

/**
 * Browser tab titles name the page: "Members · FundedBeyond LMS" rather than
 * "FundedBeyond LMS · FundedBeyond LMS" on every page (QA review 1 m1). The
 * page is named after the menu entry or setting its address falls under.
 */
const PAGE_LABELS: ReadonlyArray<{ href: string; label: string }> = [
  ...LEARNER_PRIMARY_NAV.map((item) => ({ href: item.href, label: item.label })),
  ...STUDIO_PRIMARY_NAV.map((item) => ({
    href: item.href,
    label: item.href === "/studio" ? "Studio" : item.label,
  })),
  ...ADMIN_PRIMARY_NAV.map((item) => ({
    href: item.href,
    label: item.href === "/admin" ? "Admin" : item.label,
  })),
  ...flattenAdminSettingsItems(ADMIN_SETTINGS_SECTIONS).map((item) => ({
    href: item.href,
    label: item.title,
  })),
  { href: "/admin/settings", label: "Settings" },
];

/** The label of the menu entry whose address is the longest prefix of `pathname`. */
export function pageLabelForPath(pathname: string): string | null {
  const path = pathname.split("?")[0]?.replace(/\/+$/, "") || "/";
  let best: { href: string; label: string } | null = null;
  for (const entry of PAGE_LABELS) {
    const href = entry.href.split("?")[0] ?? entry.href;
    const matches = href === "/" ? path === "/" : path === href || path.startsWith(`${href}/`);
    if (matches && (!best || href.length > best.href.length)) best = { href, label: entry.label };
  }
  return best?.label ?? null;
}

/** "Members · FundedBeyond LMS", or the academy title alone when the page has no menu entry. */
export function pageDocumentTitle(pathname: string, academyTitle: string): string {
  const label = pageLabelForPath(pathname);
  return label ? `${label} · ${academyTitle}` : academyTitle;
}
