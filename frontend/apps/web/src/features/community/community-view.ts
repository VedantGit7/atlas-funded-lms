import {
  Compass,
  Hash,
  Landmark,
  LineChart,
  ShieldCheck,
  Target,
  TrendingUp,
  Users,
  Globe,
  Lock,
  Building2,
  EyeOff,
  type LucideIcon,
} from "lucide-react";

export type CommunityAuthor = {
  membershipId: string;
  displayName: string | null;
  roleKey: string | null;
};

/**
 * Stable, non-negative hash for deterministic visual assignment (avatar tint,
 * space glyph). Small and dependency-free; collisions are cosmetically fine.
 */
function hashString(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash);
}

export function authorDisplayName(
  author: CommunityAuthor | undefined,
  fallbackMembershipId: string,
): string {
  const name = author?.displayName?.trim();
  if (name) return name;
  // No profile yet: a short, stable label beats leaking a raw UUID.
  return `Member ${fallbackMembershipId.slice(0, 4)}`;
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean).slice(0, 2);
  if (parts.length === 0) return "?";
  return parts.map((part) => part.charAt(0).toUpperCase()).join("");
}

/**
 * Deterministic, token-based avatar tint so members keep a consistent colour
 * without hardcoding hex values. Every option adapts to light/dark via tokens.
 */
const AVATAR_TINTS = [
  "bg-[color-mix(in_srgb,var(--primary)_16%,var(--card))] text-[color-mix(in_srgb,var(--primary)_78%,var(--foreground))]",
  "bg-[color-mix(in_srgb,var(--success)_16%,var(--card))] text-[color-mix(in_srgb,var(--success)_74%,var(--foreground))]",
  "bg-[color-mix(in_srgb,var(--warning)_18%,var(--card))] text-[color-mix(in_srgb,var(--warning)_72%,var(--foreground))]",
  "bg-[color-mix(in_srgb,var(--accent)_22%,var(--card))] text-[color-mix(in_srgb,var(--accent)_70%,var(--foreground))]",
  "bg-[color-mix(in_srgb,var(--ring)_20%,var(--card))] text-[color-mix(in_srgb,var(--ring)_72%,var(--foreground))]",
] as const;

export function avatarTint(seed: string): string {
  return AVATAR_TINTS[hashString(seed) % AVATAR_TINTS.length] ?? AVATAR_TINTS[0];
}

const SPACE_GLYPHS: LucideIcon[] = [
  Hash,
  TrendingUp,
  ShieldCheck,
  Target,
  LineChart,
  Compass,
  Landmark,
  Users,
];

export function spaceGlyph(seed: string): LucideIcon {
  return SPACE_GLYPHS[hashString(seed) % SPACE_GLYPHS.length] ?? Hash;
}

export type RoleBadge = { label: string };

export function roleBadge(roleKey: string | null | undefined): RoleBadge | null {
  if (roleKey === "admin") return { label: "Admin" };
  if (roleKey === "moderator") return { label: "Moderator" };
  return null;
}

export type VisibilityMeta = { label: string; icon: LucideIcon };

export function visibilityMeta(visibility: string): VisibilityMeta {
  switch (visibility) {
    case "PUBLIC":
      return { label: "Public", icon: Globe };
    case "PRIVATE":
      return { label: "Private", icon: Lock };
    case "UNLISTED":
      return { label: "Unlisted", icon: EyeOff };
    case "TENANT":
    default:
      return { label: "Organization", icon: Building2 };
  }
}

/** Compact count (1240 -> "1.2k") for member/post pills. */
export function formatCount(value: number): string {
  if (value < 1000) return String(value);
  const thousands = value / 1000;
  return `${thousands.toFixed(thousands >= 10 ? 0 : 1).replace(/\.0$/, "")}k`;
}

/** Short relative time ("just now", "4h ago", "3d ago"), date beyond a week. */
export function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const diffSeconds = Math.round((Date.now() - then) / 1000);

  if (diffSeconds < 45) return "just now";
  const diffMinutes = Math.round(diffSeconds / 60);
  if (diffMinutes < 60) return `${String(diffMinutes)}m ago`;
  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `${String(diffHours)}h ago`;
  const diffDays = Math.round(diffHours / 24);
  if (diffDays < 7) return `${String(diffDays)}d ago`;

  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export type ThreadNode<T extends { id: string; parentCommentId?: string | null }> = T & {
  replies: Array<ThreadNode<T>>;
};

/**
 * Builds a nested reply tree from a flat, chronologically ordered comment list.
 * Orphaned replies (missing/unknown parent) surface at the top level so nothing
 * is silently dropped. Sibling order preserves the input order (created_at asc).
 */
export function buildCommentTree<T extends { id: string; parentCommentId?: string | null }>(
  comments: T[],
): Array<ThreadNode<T>> {
  const byId = new Map<string, ThreadNode<T>>();
  for (const comment of comments) {
    byId.set(comment.id, { ...comment, replies: [] });
  }

  const roots: Array<ThreadNode<T>> = [];
  for (const comment of comments) {
    const node = byId.get(comment.id);
    if (!node) continue;
    const parentId = comment.parentCommentId ?? null;
    const parent = parentId ? byId.get(parentId) : null;
    if (parent && parent.id !== node.id) {
      parent.replies.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}
