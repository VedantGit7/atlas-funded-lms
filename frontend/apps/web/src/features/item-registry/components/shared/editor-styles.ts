export const editorInputClassName =
  "w-full rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-3 py-2 text-sm text-[var(--admin-on-surface)] placeholder:text-[var(--admin-on-surface-variant)] transition-[border-color,box-shadow,background-color] duration-200 focus:border-[var(--admin-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--admin-primary)]/30 disabled:cursor-not-allowed disabled:bg-[var(--admin-surface-high)] disabled:opacity-60";

export const editorLabelClassName = "mb-1 block text-sm font-medium text-[var(--admin-on-surface)]";

export const editorHintClassName = "mb-1.5 text-xs text-[var(--admin-on-surface-variant)]";

export const editorPanelClassName =
  "rounded-xl border border-[var(--admin-border)] bg-[color-mix(in_srgb,var(--admin-surface-high)_22%,var(--admin-surface))] p-4 motion-safe:animate-[admin-dropdown-in_0.18s_cubic-bezier(0.16,1,0.3,1)]";

export const choiceClassName =
  "flex w-full cursor-pointer items-start gap-3 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-4 py-3 text-left text-sm transition-[border-color,background-color,transform] duration-200 hover:border-[color-mix(in_srgb,var(--admin-primary)_35%,var(--admin-border))] hover:bg-[var(--admin-surface)] has-[:checked]:border-[var(--admin-primary)] has-[:checked]:bg-[color-mix(in_srgb,var(--admin-primary-container)_35%,var(--admin-surface))] motion-safe:active:scale-[0.995]";

export const learnerChoiceClassName =
  "flex w-full cursor-pointer items-start gap-3 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] px-4 py-3 text-left text-sm shadow-sm transition-[border-color,background-color,transform,box-shadow] duration-200 hover:border-[color-mix(in_srgb,var(--admin-primary)_35%,var(--admin-border))] hover:shadow-md has-[:checked]:border-[var(--admin-primary)] has-[:checked]:bg-[color-mix(in_srgb,var(--admin-primary-container)_28%,var(--admin-surface))] motion-safe:active:scale-[0.995]";

export const chipButtonClassName =
  "rounded-xl border px-4 py-3 text-sm font-semibold transition-[border-color,background-color,transform,box-shadow] duration-200 motion-safe:active:scale-[0.98]";

export const codeEditorClassName =
  "w-full rounded-lg border border-[var(--admin-border)] bg-[color-mix(in_srgb,var(--admin-on-surface)_92%,var(--admin-bg))] px-3 py-3 font-mono text-sm leading-relaxed text-[var(--admin-success)] focus:border-[var(--admin-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--admin-primary)]/30";
