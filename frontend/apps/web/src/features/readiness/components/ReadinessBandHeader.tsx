import { Gauge } from "lucide-react";
import type {
  CompositeReadinessProjection,
  LegalCopyConfig,
} from "@atlas/contracts/readiness/readiness.types";
import { ScoreGauge } from "./ScoreGauge";
import { formatBandLabel, formatUpdatedAt, readinessTone } from "../readiness-view";

type ReadinessBandHeaderProps = {
  composite: CompositeReadinessProjection | null;
  legalCopy: LegalCopyConfig | null;
};

export function ReadinessBandHeader({ composite, legalCopy }: ReadinessBandHeaderProps) {
  if (!composite) {
    return (
      <section
        aria-label="Readiness band"
        className="rounded-2xl border border-border bg-card p-8 text-center md:p-12"
      >
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <Gauge className="h-7 w-7" strokeWidth={1.75} aria-hidden="true" />
        </span>
        <h2 className="mt-5 text-xl font-semibold text-foreground">Your readiness band is on the way</h2>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
          Complete lessons, practice, and assessments to generate a composite readiness score. Your
          band updates automatically as new signals arrive.
        </p>
      </section>
    );
  }

  const tone = readinessTone(composite.score);
  const bandLabel = formatBandLabel(composite.bandKey);
  const roundedScore = Math.round(composite.score);
  const bandNote = legalCopy?.bandNotes[composite.bandKey];

  return (
    <section
      aria-label="Readiness band"
      className="overflow-hidden rounded-2xl border border-border bg-card"
    >
      <div className="grid items-center gap-8 p-6 md:grid-cols-[auto_1fr] md:gap-12 md:p-10">
        <div className="mx-auto md:mx-0">
          <ScoreGauge
            score={composite.score}
            color={tone.gaugeColor}
            variant="hero"
            caption="of 100"
            ariaLabel={`Composite readiness score ${String(roundedScore)} of 100, band ${bandLabel}`}
          />
        </div>

        <div className="text-center md:text-left">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">
            Composite readiness
          </p>

          <div className="mt-3 flex flex-wrap items-center justify-center gap-3 md:justify-start">
            <h2 className="text-3xl font-semibold tracking-tight text-foreground">{bandLabel}</h2>
            <span
              className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider ${tone.chipClassName}`}
            >
              Band
            </span>
          </div>

          <p className="mt-4 max-w-xl text-sm leading-relaxed text-muted-foreground">
            Your composite blends every tracked competency dimension into one readiness signal.
            Education stays available at every band, so keep building on your strengths.
          </p>

          {bandNote ? (
            <p className="mt-4 rounded-xl border border-border bg-muted/60 p-4 text-sm leading-relaxed text-foreground">
              {bandNote}
            </p>
          ) : null}

          <p className="mt-4 text-xs text-muted-foreground">
            Last updated {formatUpdatedAt(composite.calculatedAt)}
          </p>
        </div>
      </div>
    </section>
  );
}
