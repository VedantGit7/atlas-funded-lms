import { PageGate } from "../../../../../../components/patterns/PageGate";
import { DiagnosticResultScorecard } from "../../../../../../features/diagnostics/components/DiagnosticResultScorecard";
import { ServerApiError } from "../../../../../../lib/server-api";
import { diagnosticServerApi } from "../../../../../../modules/diagnostics/diagnostic.server-api";

type LearnerDiagnosticResultPageProps = {
  params: Promise<{ id: string }>;
};

export default async function LearnerDiagnosticResultPage({
  params,
}: LearnerDiagnosticResultPageProps) {
  const { id } = await params;

  try {
    const result = await diagnosticServerApi.getAuthenticatedDiagnosticResult(id);

    if (!result.data.scorecard) {
      return (
        <PageGate state="ready" title="Diagnostic result">
          <p className="rounded border p-4 text-sm opacity-80">
            Your scorecard is still being prepared. Complete and submit the diagnostic first.
          </p>
        </PageGate>
      );
    }

    return (
      <PageGate state="ready" title="Diagnostic result">
        <DiagnosticResultScorecard scorecard={result.data.scorecard} />
      </PageGate>
    );
  } catch (error) {
    if (error instanceof ServerApiError && (error.status === 401 || error.status === 403)) {
      return (
        <PageGate
          state="denied"
          title="Diagnostic result"
          deniedMessage="You do not have permission to view this diagnostic result."
        />
      );
    }

    throw error;
  }
}
