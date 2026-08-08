/** Shared surface classes for the help center — token-only, light/dark safe. */

export const helpCardClassName =
  "rounded-xl border border-border bg-card p-6 motion-safe:transition-[box-shadow,transform] motion-safe:duration-200 motion-safe:ease-out hover:shadow-md motion-safe:hover:-translate-y-0.5";

export const helpCategoryIconClassName =
  "flex h-12 w-12 items-center justify-center rounded-lg bg-[color-mix(in_srgb,var(--primary)_12%,transparent)] text-primary";

export const helpListRowClassName =
  "group flex items-center justify-between rounded-lg bg-muted p-4 motion-safe:transition-colors hover:bg-[color-mix(in_srgb,var(--muted-foreground)_8%,var(--muted))]";

export const helpSearchShellClassName =
  "rounded-xl border border-border bg-card motion-safe:transition-[box-shadow,border-color] motion-safe:duration-300 focus-within:border-primary focus-within:shadow-[0_0_0_4px_color-mix(in_srgb,var(--primary)_10%,transparent)]";

export const helpChipClassName =
  "rounded-full px-2 py-1 text-xs font-medium text-primary motion-safe:transition-colors hover:bg-[color-mix(in_srgb,var(--primary)_12%,transparent)]";

export const helpPrimaryButtonClassName =
  "inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-8 py-3 text-sm font-semibold text-primary-foreground motion-safe:transition-transform motion-safe:hover:scale-[1.02] motion-safe:active:scale-[0.98]";

export const helpOutlineButtonClassName =
  "inline-flex items-center justify-center gap-2 rounded-lg border border-primary px-8 py-3 text-sm font-semibold text-primary motion-safe:transition-colors hover:bg-[color-mix(in_srgb,var(--primary)_6%,transparent)]";
