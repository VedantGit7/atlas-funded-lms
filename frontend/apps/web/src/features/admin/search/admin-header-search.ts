/**
 * The admin header search (QA review 2 H13: the box did nothing). It finds
 * admin pages and settings by name, and members and courses through the API.
 */

export type AdminSearchPage = {
  href: string;
  title: string;
  description?: string;
  keywords?: readonly string[];
};

export type AdminSearchResult = {
  id: string;
  group: "Pages" | "Members" | "Courses";
  title: string;
  detail?: string;
  href: string;
};

export const ADMIN_SEARCH_MIN_LENGTH = 2;
const PAGE_LIMIT = 6;

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

/**
 * Pages whose name, description or keywords contain every word of the query,
 * best first: a name that starts with the query, then one containing it, then
 * the rest. The same address is listed once.
 */
export function matchAdminPages(
  query: string,
  pages: readonly AdminSearchPage[],
  limit = PAGE_LIMIT,
): AdminSearchResult[] {
  const q = normalize(query);
  if (q.length < ADMIN_SEARCH_MIN_LENGTH) return [];
  const words = q.split(/\s+/).filter(Boolean);

  const scored: Array<{ page: AdminSearchPage; score: number }> = [];
  const seen = new Set<string>();
  for (const page of pages) {
    if (seen.has(page.href)) continue;
    const title = normalize(page.title);
    const haystack = [title, page.description ?? "", ...(page.keywords ?? [])]
      .map(normalize)
      .join(" ");
    if (!words.every((word) => haystack.includes(word))) continue;
    seen.add(page.href);
    const score = title.startsWith(q) ? 0 : title.includes(q) ? 1 : 2;
    scored.push({ page, score });
  }

  return scored
    .sort((a, b) => a.score - b.score || a.page.title.localeCompare(b.page.title))
    .slice(0, limit)
    .map(({ page }) => ({
      id: `page:${page.href}`,
      group: "Pages" as const,
      title: page.title,
      ...(page.description ? { detail: page.description } : {}),
      href: page.href,
    }));
}

export function memberResult(member: {
  id: string;
  accountEmail?: string | null;
  invitedEmail?: string | null;
  profile?: { displayName?: string | null } | null;
}): AdminSearchResult {
  const email = member.accountEmail ?? member.invitedEmail ?? null;
  const name = member.profile?.displayName?.trim() || email || "Member";
  return {
    id: `member:${member.id}`,
    group: "Members",
    title: name,
    ...(email && email !== name ? { detail: email } : {}),
    href: `/admin/members/${member.id}`,
  };
}

export function courseResult(course: {
  id: string;
  title: string;
  status?: string;
}): AdminSearchResult {
  const status =
    course.status === "PUBLISHED"
      ? "Live"
      : course.status === "REVIEW"
        ? "In review"
        : course.status === "ARCHIVED"
          ? "Archived"
          : "Draft";
  return {
    id: `course:${course.id}`,
    group: "Courses",
    title: course.title,
    detail: status,
    href: `/studio/courses/${course.id}`,
  };
}
