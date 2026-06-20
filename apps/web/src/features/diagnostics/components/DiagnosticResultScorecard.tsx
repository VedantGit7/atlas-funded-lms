import type { DiagnosticScorecard } from "../../../modules/diagnostics/diagnostic.types";
import { DiagnosticNextActionCard } from "./DiagnosticNextActionCard";

type DiagnosticResultScorecardProps = {
  scorecard: DiagnosticScorecard;
};

export function DiagnosticResultScorecard({ scorecard }: DiagnosticResultScorecardProps) {
  const dimensionSummary = scorecard.dimensions
    .map(
      (dimension) =>
        `${dimension.dimensionName}: ${dimension.score.toFixed(1)} (${dimension.bandLabel ?? "Unassigned"})`,
    )
    .join("; ");

  return (
    <section aria-labelledby="diagnostic-scorecard" className="space-y-4">
      <div className="rounded border p-4">
        <h2 id="diagnostic-scorecard" className="text-lg font-semibold">
          {scorecard.partial ? "Preliminary diagnostic snapshot" : "Diagnostic scorecard"}
        </h2>
        <p className="mt-2 text-sm opacity-80">{scorecard.interpretation}</p>
        <p className="mt-4 text-2xl font-semibold">
          Overall band: {scorecard.overallBandLabel ?? "Pending"}
        </p>
        {scorecard.overallScore != null ? (
          <p className="text-sm opacity-80">Overall score: {scorecard.overallScore.toFixed(1)}</p>
        ) : null}
      </div>

      <div className="rounded border p-4">
        <h3 className="font-semibold">Dimension overview</h3>
        <p className="sr-only">{dimensionSummary}</p>
        <ul className="mt-3 grid gap-3 md:grid-cols-2" aria-hidden="false">
          {scorecard.dimensions.map((dimension) => (
            <li key={dimension.dimensionId} className="rounded border p-3">
              <p className="font-medium">{dimension.dimensionName}</p>
              <p className="text-xl font-semibold">{dimension.score.toFixed(1)}</p>
              <p className="text-sm opacity-80">
                Band: {dimension.bandLabel ?? dimension.bandKey ?? "Unassigned"}
              </p>
            </li>
          ))}
        </ul>
      </div>

      <DiagnosticNextActionCard nextAction={scorecard.nextAction} />
    </section>
  );
}
