import { PageGate } from "../../../../../components/patterns/PageGate";
import { AuthenticatedDiagnosticRunner } from "../../../../../features/diagnostics/components/AuthenticatedDiagnosticRunner";
import { ServerApiError } from "../../../../../lib/server-api";
import { diagnosticServerApi } from "../../../../../modules/diagnostics/diagnostic.server-api";

type LearnerDiagnosticSessionPageProps = {
  params: Promise<{ id: string }>;
};

export default async function LearnerDiagnosticSessionPage({
  params,
}: LearnerDiagnosticSessionPageProps) {
  const { id } = await params;

  try {
    const result = await diagnosticServerApi.getAuthenticatedDiagnosticResult(id);

    if (result.data.runner) {
      return (
        <PageGate state="ready" title="Diagnostic">
          <AuthenticatedDiagnosticRunner
            sessionId={result.data.sessionId}
            attemptId={result.data.runner.attemptId}
            title="Diagnostic"
            initialItems={result.data.runner.items}
          />
        </PageGate>
      );
    }

    return (
      <PageGate state="ready" title="Diagnostic">
        <p className="rounded border p-4 text-sm opacity-80">
          This diagnostic session is no longer in progress. View your scorecard instead.
        </p>
      </PageGate>
    );
  } catch (error) {
    if (error instanceof ServerApiError && (error.status === 401 || error.status === 403)) {
      return (
        <PageGate
          state="denied"
          title="Diagnostic"
          deniedMessage="You do not have permission to access this diagnostic."
        />
      );
    }

    throw error;
  }
}
