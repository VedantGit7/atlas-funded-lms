export type ShellNavItem = {
  href: string;
  label: string;
  mobilePrimary?: boolean;
};

export function themeColor(tokens: unknown, key: string, fallback: string): string {
  if (tokens && typeof tokens === "object" && key in tokens) {
    const value = (tokens as Record<string, unknown>)[key];
    if (typeof value === "string") {
      return value;
    }
  }
  return fallback;
}

/** Match active route; `rootHref` uses exact match only (e.g. `/`, `/studio`). */
export function createNavIsActive(rootHref: string) {
  return (pathname: string, href: string): boolean => {
    if (href === rootHref) {
      return pathname === rootHref;
    }
    return pathname === href || pathname.startsWith(`${href}/`);
  };
}

/** Learner home route must not match every path via prefix. */
export function isLearnerNavActive(pathname: string, href: string): boolean {
  return pathname === href || (href !== "/" && pathname.startsWith(href));
}

export function mobilePrimaryItems<T extends ShellNavItem>(items: readonly T[], limit = 4): T[] {
  const primary = items.filter((item) => item.mobilePrimary);
  return primary.length > 0 ? primary : items.slice(0, limit);
}

export function bottomNavGridClass(count: number): string {
  if (count <= 3) return "grid-cols-3";
  if (count === 5) return "grid-cols-5";
  return "grid-cols-4";
}
