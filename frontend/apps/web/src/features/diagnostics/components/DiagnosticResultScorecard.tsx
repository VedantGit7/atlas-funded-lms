import type { DiagnosticScorecard } from "@atlas/contracts/diagnostics/diagnostic.types";
import { ReadinessReveal } from "../../readiness/components/ReadinessReveal";
import { ScoreGauge } from "../../readiness/components/ScoreGauge";
import {
  dimensionToneMeta,
  formatBandLabel,
  readinessTone,
  resultHeadline,
} from "../diagnostics-view";
import { DiagnosticNextActionCard } from "./DiagnosticNextActionCard";
import { DiagnosticResultActions } from "./DiagnosticResultActions";

type DiagnosticResultScorecardProps = {
  scorecard: DiagnosticScorecard;
  learnerName?: string | null;
};

export function DiagnosticResultScorecard({
  scorecard,
  learnerName,
}: DiagnosticResultScorecardProps) {
  const overallScore = scorecard.overallScore;
  const tone = readinessTone(overallScore ?? 0);
  const bandLabel = formatBandLabel(scorecard.overallBandLabel);
  const firstName = learnerName?.trim().split(/\s+/)[0] ?? null;
  const headline = `${resultHeadline(tone.tone)}${firstName ? `, ${firstName}` : ""}.`;
  const roundedScore = overallScore != null ? Math.round(overallScore) : null;

  return (
    <section aria-labelledby="diagnostic-scorecard" className="space-y-16">
      <ReadinessReveal className="text-center">
        <h1 id="diagnostic-scorecard" className="sr-only">
          Diagnostic results
        </h1>

        <span
          className={`inline-flex items-center rounded-full px-4 py-1.5 text-xs font-bold uppercase tracking-widest ${tone.chipClassName}`}
        >
          {scorecard.partial ? `Preliminary · ${bandLabel}` : bandLabel}
        </span>

        {overallScore != null ? (
          <div className="mt-6 flex justify-center">
            <ScoreGauge
              score={overallScore}
              color={tone.gaugeColor}
              variant="hero"
              caption="of 100"
              ariaLabel={`Overall diagnostic score ${String(roundedScore ?? 0)} of 100, band ${bandLabel}`}
            />
          </div>
        ) : null}

        <div className="mx-auto mt-6 max-w-2xl">
          <h2 className="text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
            {headline}
          </h2>
          <p className="mt-3 text-base leading-relaxed text-muted-foreground">
            {scorecard.interpretation}
          </p>
        </div>
      </ReadinessReveal>

      <ReadinessReveal delay={0.15} className="space-y-6">
        <h2 className="text-center text-xs font-bold uppercase tracking-widest text-muted-foreground">
          Score breakdown
        </h2>

        {scorecard.dimensions.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card p-8 text-center">
            <p className="text-sm text-muted-foreground">
              Dimension-level detail appears here as more of your competency signals are recorded.
            </p>
          </div>
        ) : (
          <ul className="grid grid-cols-1 gap-5 md:grid-cols-3">
            {scorecard.dimensions.map((dimension) => {
              const dimTone = readinessTone(dimension.score);
              const meta = dimensionToneMeta(dimTone.tone);
              const DimIcon = meta.icon;
              const dimBand = formatBandLabel(dimension.bandLabel ?? dimension.bandKey);
              const rounded = Math.round(dimension.score);

              return (
                <li
                  key={dimension.dimensionId}
                  className="group rounded-2xl border border-border bg-card p-6 transition-colors hover:border-[var(--ring)]"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <h3 className="text-lg font-semibold tracking-tight text-foreground">
                        {dimension.dimensionName}
                      </h3>
                      <span
                        className="mt-1 inline-flex items-center gap-1.5 text-xs font-semibold"
                        style={{ color: dimTone.gaugeColor }}
                      >
                        <DimIcon className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
                        {dimBand}
                      </span>
                    </div>
                    <ScoreGauge
                      score={dimension.score}
                      color={dimTone.gaugeColor}
                      variant="mini"
                      className="shrink-0"
                      ariaLabel={`${dimension.dimensionName} score ${String(rounded)} of 100, band ${dimBand}`}
                    />
                  </div>
                  <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                    {meta.description}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </ReadinessReveal>

      <ReadinessReveal delay={0.3}>
        <DiagnosticNextActionCard nextAction={scorecard.nextAction} />
      </ReadinessReveal>

      <ReadinessReveal delay={0.45}>
        <DiagnosticResultActions />
      </ReadinessReveal>
    </section>
  );
}
