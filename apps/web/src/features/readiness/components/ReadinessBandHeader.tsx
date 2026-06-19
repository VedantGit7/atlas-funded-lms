import type {
  CompositeReadinessProjection,
  LegalCopyConfig,
} from "../../../server/readiness/readiness.types";

type ReadinessBandHeaderProps = {
  composite: CompositeReadinessProjection | null;
  legalCopy: LegalCopyConfig | null;
};

export function ReadinessBandHeader({ composite, legalCopy }: ReadinessBandHeaderProps) {
  if (!composite) {
    return (
      <section className="rounded border p-4" aria-label="Readiness band">
        <h2 className="text-lg font-semibold">Readiness band</h2>
        <p className="text-sm opacity-80">
          Complete learning activities to generate your readiness band.
        </p>
      </section>
    );
  }

  const bandNote = legalCopy?.bandNotes[composite.bandKey];

  return (
    <section className="rounded border p-4" aria-label="Readiness band">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm uppercase tracking-wide opacity-70">Current band</p>
          <h2 className="text-2xl font-semibold">{composite.bandKey}</h2>
        </div>
        <div className="text-right text-sm opacity-80">
          <p>Score: {composite.score.toFixed(1)}</p>
          <p>Updated: {new Date(composite.calculatedAt).toLocaleString()}</p>
        </div>
      </div>
      {legalCopy?.disclaimer ? (
        <p className="mt-3 text-sm opacity-80">{legalCopy.disclaimer}</p>
      ) : null}
      {bandNote ? <p className="mt-2 text-sm">{bandNote}</p> : null}
    </section>
  );
}
