export const generalSettingsBackLinkClassName =
  "inline-flex items-center gap-1 text-sm font-semibold text-[var(--admin-on-surface-variant)] transition-colors hover:text-[var(--admin-on-surface)]";

export const generalSettingsLayoutClassName =
  "flex min-h-[calc(100vh-11rem)] flex-col overflow-hidden rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-sm lg:flex-row";

export const generalSettingsSidebarClassName =
  "w-full shrink-0 border-b border-[var(--admin-border)] bg-[var(--admin-surface)] lg:w-56 lg:border-b-0 lg:border-r";

export const generalSettingsSidebarHeaderClassName =
  "border-b border-[var(--admin-border)] px-5 py-4";

export const generalSettingsSidebarTitleClassName =
  "text-sm font-bold text-[var(--admin-on-surface)]";

export const generalSettingsNavClassName = "flex flex-col gap-0.5 p-3";

export function generalSettingsNavItemClassName(active: boolean): string {
  return [
    "relative rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
    active
      ? "bg-[var(--admin-primary-container)] text-[var(--admin-on-primary-container)]"
      : "text-[var(--admin-on-surface-variant)] hover:bg-[var(--admin-surface-high)] hover:text-[var(--admin-on-surface)]",
  ].join(" ");
}

export const generalSettingsMainClassName =
  "flex min-h-0 min-w-0 flex-1 flex-col bg-[var(--admin-surface-low)]";

export const generalSettingsContentClassName =
  "mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-6 md:px-8 md:py-8";

export const generalSettingsPageTitleClassName =
  "text-2xl font-bold tracking-tight text-[var(--admin-on-surface)] md:text-[1.75rem]";

export const generalSettingsPageDescClassName =
  "mt-2 max-w-2xl text-sm leading-relaxed text-[var(--admin-on-surface-variant)]";

export const generalSettingsFormCardClassName =
  "mt-8 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-6 shadow-sm";

export const generalSettingsFooterClassName =
  "mt-8 flex flex-wrap items-center gap-3 border-t border-[var(--admin-border)] pt-6";
