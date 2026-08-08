export const tableHeaderClassName =
  "text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--admin-on-surface-variant)]";

export const codeEditorShellClassName =
  "overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-low)] motion-safe:transition-[border-color,box-shadow] motion-safe:duration-200";

export const codeEditorGutterClassName =
  "select-none border-r border-[var(--admin-border)] bg-[var(--admin-surface-high)]/60 py-4 text-right font-mono text-[11px] leading-relaxed text-[var(--admin-on-surface-variant)]";

export const codeEditorTextareaClassName =
  "min-h-[320px] w-full resize-none border-0 bg-transparent p-4 font-mono text-[13px] leading-relaxed text-[var(--admin-on-surface)] outline-none focus:ring-0";

export const advancedEditorShellClassName =
  "overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-low)]";

export const tabButtonClassName = (active: boolean) =>
  [
    "relative shrink-0 border-b-2 px-3 py-3 text-[13px] font-semibold motion-safe:transition-colors motion-safe:duration-200",
    active
      ? "border-[var(--admin-primary)] text-[var(--admin-primary)] bg-[var(--admin-primary-container)]/10"
      : "border-transparent text-[var(--admin-on-surface-variant)] hover:text-[var(--admin-on-surface)]",
  ].join(" ");
