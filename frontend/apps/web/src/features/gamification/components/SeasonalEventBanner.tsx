import Link from "next/link";
import { ArrowRight, Sparkles, TrendingUp } from "lucide-react";
import { formatDeadline } from "../gamification-view";

type SeasonalEventBannerProps = {
  event: {
    name: string;
    endsAt: string;
    xpMultiplier: number;
  } | null;
};

const dotPattern: React.CSSProperties = {
  backgroundImage: "radial-gradient(currentColor 1px, transparent 1px)",
  backgroundSize: "18px 18px",
};

export function SeasonalEventBanner({ event }: SeasonalEventBannerProps) {
  if (!event) {
    return null;
  }

  const multiplierLabel = `×${String(event.xpMultiplier)} XP`;

  return (
    <section
      className="relative isolate overflow-hidden rounded-2xl border border-primary bg-primary p-6 text-primary-foreground md:p-10"
      aria-label={`Active event: ${event.name}`}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 opacity-[0.12]"
        style={dotPattern}
      />

      <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <div className="max-w-xl">
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[color-mix(in_srgb,var(--primary-foreground)_18%,transparent)] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.12em]">
              <Sparkles className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden="true" />
              Active event
            </span>
            <span className="text-xs font-medium text-[color-mix(in_srgb,var(--primary-foreground)_78%,transparent)]">
              {formatDeadline(event.endsAt)}
            </span>
          </div>
          <h2 className="mt-3 text-3xl font-bold leading-tight tracking-tight md:text-4xl">
            {event.name}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-[color-mix(in_srgb,var(--primary-foreground)_78%,transparent)]">
            Every lesson, assessment, and practice session you complete earns {multiplierLabel}{" "}
            while this event runs. Keep your streak alive to make the most of it.
          </p>
        </div>

        <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
          <div className="rounded-xl border border-[color-mix(in_srgb,var(--primary-foreground)_26%,transparent)] bg-[color-mix(in_srgb,var(--primary-foreground)_12%,transparent)] p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[color-mix(in_srgb,var(--primary-foreground)_70%,transparent)]">
              XP multiplier
            </p>
            <div className="mt-1 flex items-center gap-1.5">
              <TrendingUp className="h-5 w-5" strokeWidth={2.5} aria-hidden="true" />
              <span className="text-xl font-bold tabular-nums">{multiplierLabel}</span>
            </div>
          </div>
          <Link
            href="/roadmap"
            className="inline-flex items-center gap-2 rounded-xl bg-primary-foreground px-6 py-3 text-sm font-semibold text-primary transition-[filter] hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-foreground focus-visible:ring-offset-2 focus-visible:ring-offset-primary"
          >
            Keep learning
            <ArrowRight className="h-4 w-4" strokeWidth={2.5} aria-hidden="true" />
          </Link>
        </div>
      </div>
    </section>
  );
}
