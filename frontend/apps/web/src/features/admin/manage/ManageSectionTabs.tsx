"use client";

import Link from "next/link";
import {
  ADMIN_MANAGE_SECTIONS,
  adminManageHref,
  type AdminManageSlug,
} from "./admin-manage-catalog";

/**
 * Navigation between Manage sections.
 *
 * There was none. `/admin/manage` redirects to `course-encryption` and the
 * section page rendered only its own body, so the other sections existed as
 * routes that nothing linked to — reachable only by typing the URL. Adding a
 * section here (Tags and Learner Products were the two that exposed this) would
 * otherwise produce a screen that works perfectly and no user can find.
 *
 * Driven off ADMIN_MANAGE_SECTIONS so the nav cannot drift from the catalogue:
 * a section added there appears here without a second edit, which is the only
 * way this stays true.
 */
export function ManageSectionTabs({ active }: { active: AdminManageSlug }) {
  return (
    <nav
      aria-label="Manage sections"
      className="flex gap-6 overflow-x-auto border-b border-[var(--admin-border)]"
    >
      {ADMIN_MANAGE_SECTIONS.map((section) => {
        const isActive = section.slug === active;
        return (
          <Link
            key={section.slug}
            href={adminManageHref(section.slug)}
            aria-current={isActive ? "page" : undefined}
            className={[
              "whitespace-nowrap border-b-2 py-2 text-sm transition-colors",
              isActive
                ? "border-[var(--admin-primary)] font-semibold text-[var(--admin-primary)]"
                : "border-transparent text-[var(--admin-on-surface-variant)] hover:text-[var(--admin-on-surface)]",
            ].join(" ")}
          >
            {section.label}
          </Link>
        );
      })}
    </nav>
  );
}
