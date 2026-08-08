import {
  BarChart3,
  BookOpen,
  CheckSquare,
  Circle,
  ClipboardCheck,
  FolderOpen,
  GraduationCap,
  LayoutDashboard,
  Library,
  Route,
  type LucideIcon,
} from "lucide-react";
import type { StudioNavItem } from "../../../features/studio/studio-navigation";

type StudioNavGroupId = "overview" | "authoring" | "assessment" | "operations";

const GROUP_ORDER: ReadonlyArray<{ id: StudioNavGroupId; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "authoring", label: "Authoring" },
  { id: "assessment", label: "Assessment" },
  { id: "operations", label: "Operations" },
];

const NAV_META: Record<string, { group: StudioNavGroupId; icon: LucideIcon }> = {
  "/studio": { group: "overview", icon: LayoutDashboard },
  "/studio/courses": { group: "authoring", icon: GraduationCap },
  "/studio/items": { group: "authoring", icon: Library },
  "/studio/item-collections": { group: "authoring", icon: FolderOpen },
  "/studio/learning-paths": { group: "authoring", icon: Route },
  "/studio/assessments": { group: "assessment", icon: ClipboardCheck },
  "/studio/grading": { group: "assessment", icon: BookOpen },
  "/studio/analytics": { group: "operations", icon: BarChart3 },
  "/studio/review": { group: "operations", icon: CheckSquare },
};

export type StudioNavGroupedItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

export type StudioNavGroup = {
  id: StudioNavGroupId;
  label: string;
  items: StudioNavGroupedItem[];
};

export function groupStudioNavigation(items: readonly StudioNavItem[]): StudioNavGroup[] {
  const buckets = new Map<StudioNavGroupId, StudioNavGroupedItem[]>();

  for (const item of items) {
    const meta = NAV_META[item.href] ?? { group: "operations" as StudioNavGroupId, icon: Circle };
    const bucket = buckets.get(meta.group) ?? [];
    bucket.push({ href: item.href, label: item.label, icon: meta.icon });
    buckets.set(meta.group, bucket);
  }

  return GROUP_ORDER.map(({ id, label }) => ({
    id,
    label,
    items: buckets.get(id) ?? [],
  })).filter((group) => group.items.length > 0);
}
