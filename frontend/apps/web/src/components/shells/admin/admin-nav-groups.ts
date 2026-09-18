import {
  AlignLeft,
  Award,
  BarChart3,
  Bell,
  BookOpen,
  Briefcase,
  CheckSquare,
  ChevronDown,
  ChevronRight,
  Circle,
  ClipboardList,
  Download,
  FileBadge,
  Flag,
  GitBranch,
  Globe,
  GraduationCap,
  KeyRound,
  Languages,
  LayoutDashboard,
  LineChart,
  Megaphone,
  MessagesSquare,
  Palette,
  Puzzle,
  Scale,
  ScrollText,
  Settings,
  ShieldCheck,
  Tag,
  Target,
  Trash2,
  Trophy,
  Users,
  Zap,
  type LucideIcon,
} from "lucide-react";
import type { AdminNavItem } from "../../../features/admin/admin-navigation";
import {
  ADMIN_INSIGHT_SECTIONS,
  ADMIN_INSIGHTS_HREF,
  adminInsightHref,
} from "../../../features/admin/insights/admin-insights-catalog";
import {
  ADMIN_MANAGE_HREF,
  ADMIN_MANAGE_SECTIONS,
  adminManageHref,
} from "../../../features/admin/manage/admin-manage-catalog";
import {
  ADMIN_MARKETING_HREF,
  ADMIN_MARKETING_SECTIONS,
  adminMarketingHref,
  type AdminGrowNavBadge,
} from "../../../features/admin/grow/admin-marketing-catalog";
import {
  ADMIN_SALES_HREF,
  ADMIN_SALES_SECTIONS,
  adminSalesHref,
} from "../../../features/admin/grow/admin-sales-catalog";
import {
  ADMIN_REPORT_SECTIONS,
  ADMIN_REPORTS_HREF,
  adminReportHref,
} from "../../../features/admin/reports/admin-reports-catalog";

type AdminNavGroupId =
  | "overview"
  | "people"
  | "content"
  | "community"
  | "grow"
  | "operate"
  | "analyse"
  | "configuration"
  | "data"
  | "more";

const GROUP_ORDER: ReadonlyArray<{ id: AdminNavGroupId; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "people", label: "People" },
  { id: "content", label: "Content" },
  { id: "community", label: "Community" },
  { id: "grow", label: "Grow" },
  { id: "operate", label: "Operate" },
  { id: "analyse", label: "Analyse" },
  { id: "configuration", label: "Configuration" },
  { id: "data", label: "Data" },
  { id: "more", label: "More" },
];

const NAV_META: Record<string, { group: AdminNavGroupId; icon: LucideIcon; expandable?: boolean }> =
  {
    "/admin": { group: "overview", icon: LayoutDashboard },
    "/admin/members": { group: "people", icon: Users },
    "/admin/roles": { group: "people", icon: ShieldCheck },
    "/studio/courses": { group: "content", icon: GraduationCap },
    "/admin/competency": { group: "content", icon: Target },
    "/admin/certificates/templates": { group: "content", icon: FileBadge },
    "/admin/certificates": { group: "content", icon: Award },
    "/admin/readiness-policy": { group: "content", icon: ClipboardList },
    "/admin/moderation/cases": { group: "community", icon: MessagesSquare },
    "/admin/moderation/appeals": { group: "community", icon: Scale },
    "/admin/review": { group: "community", icon: CheckSquare },
    "/admin/gamification": { group: "community", icon: Trophy },
    "/admin/marketing": { group: "grow", icon: Megaphone, expandable: true },
    "/admin/sales": { group: "grow", icon: Tag, expandable: true },
    [ADMIN_MANAGE_HREF]: { group: "operate", icon: Briefcase, expandable: true },
    "/admin/sub-schools": { group: "operate", icon: BookOpen },
    [ADMIN_REPORTS_HREF]: { group: "analyse", icon: AlignLeft, expandable: true },
    [ADMIN_INSIGHTS_HREF]: { group: "analyse", icon: LineChart, expandable: true },
    "/admin/config": { group: "configuration", icon: Settings },
    "/admin/branding": { group: "configuration", icon: Palette },
    "/admin/domains": { group: "configuration", icon: Globe },
    "/admin/feature-flags": { group: "configuration", icon: Flag },
    "/admin/entitlements": { group: "configuration", icon: KeyRound },
    "/admin/notifications": { group: "configuration", icon: Bell },
    "/admin/notifications/templates": { group: "configuration", icon: Bell },
    "/admin/automation": { group: "configuration", icon: Zap },
    "/admin/workflows": { group: "configuration", icon: GitBranch },
    "/admin/locales": { group: "configuration", icon: Languages },
    "/admin/extensions": { group: "configuration", icon: Puzzle },
    "/admin/analytics": { group: "data", icon: BarChart3 },
    "/admin/audit": { group: "data", icon: ScrollText },
    "/admin/exports": { group: "data", icon: Download },
    "/admin/deletion-requests": { group: "data", icon: Trash2 },
  };

export type AdminNavChildItem = {
  href: string;
  label: string;
  badge?: AdminGrowNavBadge;
};

export type AdminNavGroupedItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  expandable?: boolean;
  children?: AdminNavChildItem[];
};

export type AdminNavGroup = {
  id: AdminNavGroupId;
  label: string;
  items: AdminNavGroupedItem[];
};

const REPORTS_CHILDREN: AdminNavChildItem[] = ADMIN_REPORT_SECTIONS.map((section) => ({
  href: adminReportHref(section.slug),
  label: section.label,
}));

const INSIGHTS_CHILDREN: AdminNavChildItem[] = ADMIN_INSIGHT_SECTIONS.map((section) => ({
  href: adminInsightHref(section.slug),
  label: section.label,
}));

const MANAGE_CHILDREN: AdminNavChildItem[] = ADMIN_MANAGE_SECTIONS.map((section) => ({
  href: adminManageHref(section.slug),
  label: section.label,
}));

const MARKETING_CHILDREN: AdminNavChildItem[] = ADMIN_MARKETING_SECTIONS.map((section) => ({
  href: adminMarketingHref(section.slug),
  label: section.label,
  ...("badge" in section ? { badge: section.badge } : {}),
}));

const SALES_CHILDREN: AdminNavChildItem[] = ADMIN_SALES_SECTIONS.map((section) => ({
  href: adminSalesHref(section.slug),
  label: section.label,
}));

/** Groups the already-entitlement-filtered nav items into ordered sections
 *  with icons, preserving original order within each group. */
export function groupAdminNavigation(items: readonly AdminNavItem[]): AdminNavGroup[] {
  const buckets = new Map<AdminNavGroupId, AdminNavGroupedItem[]>();

  for (const item of items) {
    const meta = NAV_META[item.href] ?? { group: "more" as AdminNavGroupId, icon: Circle };
    const bucket = buckets.get(meta.group) ?? [];
    bucket.push({
      href: item.href,
      label: item.label,
      icon: meta.icon,
      ...(meta.expandable ? { expandable: true } : {}),
      ...(item.href === ADMIN_MANAGE_HREF ? { children: MANAGE_CHILDREN } : {}),
      ...(item.href === ADMIN_MARKETING_HREF ? { children: MARKETING_CHILDREN } : {}),
      ...(item.href === ADMIN_SALES_HREF ? { children: SALES_CHILDREN } : {}),
      ...(item.href === ADMIN_REPORTS_HREF ? { children: REPORTS_CHILDREN } : {}),
      ...(item.href === ADMIN_INSIGHTS_HREF ? { children: INSIGHTS_CHILDREN } : {}),
    });
    buckets.set(meta.group, bucket);
  }

  return GROUP_ORDER.map(({ id, label }) => ({
    id,
    label,
    items: buckets.get(id) ?? [],
  })).filter((group) => group.items.length > 0);
}

export { ChevronDown as AdminNavChevronDownIcon, ChevronRight as AdminNavChevronIcon };
