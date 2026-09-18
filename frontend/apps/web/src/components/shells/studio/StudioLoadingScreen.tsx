import { PenLine } from "lucide-react";

type StudioLoadingScreenProps = {
  /** Accessible status text, also shown beneath the spinner. */
  label?: string;
};

/**
 * In-shell branded loading screen for studio section switches. Mirrors the
 * admin loading screen but uses the scoped `--admin-*` tokens so studio stays
 * visually aligned with the admin shell in light and dark mode.
 */
export function StudioLoadingScreen({ label = "Loading" }: StudioLoadingScreenProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="admin-theme relative flex min-h-[70vh] w-full flex-col items-center justify-center overflow-hidden px-6 py-16"
      style={{ backgroundColor: "var(--admin-bg)" }}
    >
      <div aria-hidden className="pointer-events-none absolute inset-0 opacity-20">
        <div
          className="absolute -left-[10%] -top-[10%] h-[40%] w-[40%] rounded-full blur-[120px]"
          style={{ backgroundColor: "color-mix(in srgb, var(--admin-primary) 18%, transparent)" }}
        />
        <div
          className="absolute -bottom-[10%] -right-[10%] h-[30%] w-[30%] rounded-full blur-[100px]"
          style={{ backgroundColor: "color-mix(in srgb, var(--admin-primary) 18%, transparent)" }}
        />
      </div>

      <div className="fba-loader-reveal relative z-10 flex flex-col items-center gap-10">
        <div className="relative flex h-[76px] w-[76px] items-center justify-center">
          <span
            aria-hidden
            className="absolute inset-0 rounded-full border-[3px]"
            style={{ borderColor: "var(--admin-border)" }}
          />
          <span
            aria-hidden
            className="fba-loader-spin absolute inset-0 rounded-full border-[3px] border-transparent"
            style={{ borderTopColor: "var(--admin-primary)" }}
          />
          <span
            aria-hidden
            className="flex h-[52px] w-[52px] items-center justify-center rounded-[15px]"
            style={{
              backgroundColor: "var(--admin-primary)",
              boxShadow:
                "0 12px 28px -6px color-mix(in srgb, var(--admin-primary) 30%, transparent)",
            }}
          >
            <PenLine
              className="h-6 w-6 text-[var(--admin-on-primary)]"
              strokeWidth={2.5}
              aria-hidden
            />
          </span>
        </div>

        <div className="flex flex-col items-center gap-6">
          <p className="text-[15px] font-semibold tracking-tight text-[var(--admin-on-surface)]">
            {label}
          </p>
          <div className="flex items-center gap-2" aria-hidden>
            {[0, 1, 2].map((index) => (
              <span
                key={index}
                className="fba-loader-dot h-[6px] w-[6px] rounded-full"
                style={{
                  backgroundColor: "var(--admin-on-surface-variant)",
                  animationDelay: `${(index * 0.2).toString()}s`,
                }}
              />
            ))}
          </div>
        </div>
      </div>

      <span className="sr-only">{label}</span>
    </div>
  );
}
