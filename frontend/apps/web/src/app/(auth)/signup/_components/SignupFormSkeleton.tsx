// Loading placeholder for the sign-up form, shown as the Suspense fallback while
// SignupForm hydrates. The structure mirrors the real form (header, four fields,
// primary action, divider, two social buttons, terms footer) so the layout does
// not shift when the form takes over. Rendered inside AuthShell, which already
// provides the brand panel, theme toggle and Request ID footer. All colours come
// from the `--fba-*` tokens, so it adapts to light/dark automatically; the
// shimmer + pulse are neutralised under reduced-motion (see globals.css).

const FIELDS = [
  { key: "name", labelWidth: "w-20" },
  { key: "email", labelWidth: "w-14" },
  { key: "password", labelWidth: "w-24" },
  { key: "confirm", labelWidth: "w-28" },
] as const;

export function SignupFormSkeleton() {
  return (
    <div role="status" aria-live="polite" className="fba-loader-reveal flex w-full flex-col">
      <span className="sr-only">Loading the sign-up form…</span>

      {/* Activity signal */}
      <div aria-hidden className="mb-6 flex items-center gap-2">
        <span className="fba-pulse-soft h-2 w-2 rounded-full bg-[var(--fba-ind)]" />
        <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--fba-tx3)]">
          Syncing secure environment
        </span>
      </div>

      {/* Header */}
      <div aria-hidden className="mb-8 space-y-3">
        <div className="fba-skeleton h-9 w-56 rounded-[8px]" />
        <div className="fba-skeleton h-4 w-44 rounded-[6px] opacity-70" />
      </div>

      {/* Fields + primary action */}
      <div aria-hidden className="space-y-4">
        {FIELDS.map((field) => (
          <div key={field.key} className="space-y-2">
            <div className={`fba-skeleton h-3 ${field.labelWidth} rounded-[4px]`} />
            <div className="fba-skeleton h-12 w-full rounded-[10px]" />
          </div>
        ))}

        <div
          className="fba-skeleton h-[52px] w-full rounded-[10px]"
          style={{ backgroundColor: "color-mix(in srgb, var(--fba-ind) 14%, var(--fba-bg2))" }}
        />
      </div>

      {/* Divider */}
      <div aria-hidden className="my-6 flex items-center gap-3">
        <span className="h-px flex-1 bg-[var(--fba-bdr)]" />
        <div className="fba-skeleton h-3 w-24 rounded-full opacity-60" />
        <span className="h-px flex-1 bg-[var(--fba-bdr)]" />
      </div>

      {/* Social providers */}
      <div aria-hidden className="grid grid-cols-2 gap-3">
        <div className="fba-skeleton h-12 w-full rounded-[10px]" />
        <div className="fba-skeleton h-12 w-full rounded-[10px]" />
      </div>

      {/* Terms footer */}
      <div aria-hidden className="mt-6 flex flex-col items-center gap-2">
        <div className="fba-skeleton h-3 w-3/4 rounded-[4px] opacity-50" />
        <div className="fba-skeleton h-3 w-1/2 rounded-[4px] opacity-50" />
      </div>
    </div>
  );
}
