import { PageGate } from "../../../../components/patterns/PageGate";
import { LearnerDiagnosticStartButton } from "../../../../features/diagnostics/components/LearnerDiagnosticStartButton";

export default function LearnerDiagnosticPage() {
  return (
    <PageGate state="ready" title="Diagnostic">
      <LearnerDiagnosticStartButton />
    </PageGate>
  );
}
