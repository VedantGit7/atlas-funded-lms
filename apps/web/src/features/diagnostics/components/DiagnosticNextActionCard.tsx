import type { DiagnosticNextAction } from "../../../modules/diagnostics/diagnostic.types";

type DiagnosticNextActionCardProps = {
  nextAction: DiagnosticNextAction;
};

export function DiagnosticNextActionCard({ nextAction }: DiagnosticNextActionCardProps) {
  return (
    <section aria-labelledby="diagnostic-next-action" className="rounded border p-4">
      <h2 id="diagnostic-next-action" className="text-lg font-semibold">
        Recommended next step
      </h2>
      <p className="mt-2 font-medium">{nextAction.title}</p>
      <p className="mt-2 text-sm opacity-80">{nextAction.description}</p>
    </section>
  );
}
