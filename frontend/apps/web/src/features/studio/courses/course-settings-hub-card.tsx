"use client";

import Link from "next/link";
import type { CourseSettingsCard } from "./course-settings-metadata";

type CourseSettingsHubCardProps = {
  card: CourseSettingsCard;
  courseId: string;
  href: string;
};

export function CourseSettingsHubCard({ card, href }: CourseSettingsHubCardProps) {
  const Icon = card.icon;
  const destructive = card.destructive === true;

  return (
    <Link
      href={href}
      prefetch={false}
      className={[
        "group flex items-start gap-4 rounded-xl border bg-[var(--admin-surface)] p-5 transition-all motion-safe:hover:-translate-y-0.5",
        destructive
          ? "border-[color-mix(in_srgb,var(--admin-danger)_20%,var(--admin-border))] hover:border-[var(--admin-danger)] hover:bg-[color-mix(in_srgb,var(--admin-danger)_6%,var(--admin-surface))]"
          : "border-[var(--admin-border)] hover:border-[var(--admin-primary)] hover:bg-[var(--admin-surface-high)]",
      ].join(" ")}
    >
      <span
        className={[
          "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-colors",
          destructive
            ? "bg-[color-mix(in_srgb,var(--admin-danger)_12%,var(--admin-surface))] text-[var(--admin-danger)] group-hover:bg-[color-mix(in_srgb,var(--admin-danger)_18%,var(--admin-surface))]"
            : "bg-[var(--admin-primary)]/10 text-[var(--admin-primary)] group-hover:bg-[var(--admin-primary)]/15",
        ].join(" ")}
      >
        <Icon className="h-5 w-5" strokeWidth={1.75} aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-bold text-[var(--admin-on-surface)]">{card.title}</span>
          {!card.available && !card.externalHref ? (
            <span className="rounded-md bg-[var(--admin-surface-high)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[var(--admin-on-surface-variant)]">
              Coming soon
            </span>
          ) : null}
        </span>
        <span className="mt-1 block text-sm leading-relaxed text-[var(--admin-on-surface-variant)]">
          {card.description}
        </span>
      </span>
    </Link>
  );
}
