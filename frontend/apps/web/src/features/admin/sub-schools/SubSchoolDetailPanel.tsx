"use client";

import Link from "next/link";
import { ChevronLeft, ExternalLink } from "lucide-react";
import { generalSettingsBackLinkClassName } from "../general-settings/general-settings-shared";
import type { SubSchoolRow } from "./SubSchoolsListPanel";
import {
  SUB_SCHOOLS_HREF,
  subSchoolCopyProductHref,
  subSchoolPublicUrl,
} from "./sub-schools-shared";

type SubSchoolDetailPanelProps = {
  subSchool: SubSchoolRow;
};

export function SubSchoolDetailPanel({ subSchool }: SubSchoolDetailPanelProps) {
  const publicUrl = subSchoolPublicUrl(subSchool.key);

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-16">
      <Link href={SUB_SCHOOLS_HREF} prefetch={false} className={generalSettingsBackLinkClassName}>
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        Sub-Schools
      </Link>

      <nav
        aria-label="Breadcrumb"
        className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em]"
      >
        <Link
          href={SUB_SCHOOLS_HREF}
          prefetch={false}
          className="text-[var(--admin-primary)] underline underline-offset-4 transition-colors hover:opacity-80"
        >
          Sub-School
        </Link>
        <span className="text-[var(--admin-on-surface-variant)]" aria-hidden="true">
          /
        </span>
        <span className="text-[var(--admin-on-surface)]">{subSchool.name}</span>
      </nav>

      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1.5">
          <h1 className="truncate text-2xl font-bold tracking-tight text-[var(--admin-on-surface)] sm:text-3xl">
            {subSchool.name}
          </h1>
          {subSchool.email ? (
            <p className="truncate text-sm text-[var(--admin-on-surface-variant)]">
              {subSchool.email}
            </p>
          ) : null}
        </div>
        <a
          href={publicUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex shrink-0 items-center gap-2 text-sm font-bold uppercase tracking-wide text-[var(--admin-primary)] transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--admin-bg)]"
        >
          Open URL
          <ExternalLink className="h-4 w-4" aria-hidden="true" />
        </a>
      </header>

      <div className="space-y-5">
        <p className="max-w-xl text-sm leading-relaxed text-[var(--admin-on-surface-variant)]">
          Copy products to your Institute easily from different Institutes and sync your courses,
          mock-tests or test series with ease.
        </p>
        <Link
          href={subSchoolCopyProductHref(subSchool.id)}
          prefetch={false}
          className="inline-flex items-center justify-center rounded-lg bg-[var(--admin-on-surface)] px-5 py-2.5 text-sm font-bold text-[var(--admin-surface)] shadow-sm transition-all hover:opacity-90 motion-safe:active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--admin-bg)]"
        >
          Copy product
        </Link>
      </div>
    </div>
  );
}
