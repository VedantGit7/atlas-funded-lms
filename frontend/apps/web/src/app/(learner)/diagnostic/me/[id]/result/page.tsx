import { PageGate } from "../../../../../../components/patterns/PageGate";
import { DiagnosticResultScorecard } from "../../../../../../features/diagnostics/components/DiagnosticResultScorecard";
import { ServerApiError, serverApi } from "../../../../../../lib/server-api";
import { diagnosticServerApi } from "@/modules/diagnostics/diagnostic.server-api";

type LearnerDiagnosticResultPageProps = {
  params: Promise<{ id: string }>;
};

type MeResponse = {
  data: { profile: { displayName: string | null } | null };
};

async function loadLearnerName(): Promise<string | null> {
  try {
    const me = await serverApi.get<MeResponse>("/api/v1/me");
    return me.data.profile?.displayName ?? null;
  } catch {
    return null;
  }
}

export default async function LearnerDiagnosticResultPage({
  params,
}: LearnerDiagnosticResultPageProps) {
  const { id } = await params;

  try {
    const result = await diagnosticServerApi.getAuthenticatedDiagnosticResult(id);

    if (!result.data.scorecard) {
      return (
        <PageGate state="ready" title="Diagnostic result">
          <main className="mx-auto w-full max-w-2xl">
            <section className="rounded-2xl border border-border bg-card p-8 text-center">
              <h1 className="text-xl font-semibold text-foreground">
                Your scorecard is being prepared
              </h1>
              <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
                Complete and submit the diagnostic first, and your results will appear here.
              </p>
            </section>
          </main>
        </PageGate>
      );
    }

    const learnerName = await loadLearnerName();

    return (
      <PageGate state="ready" title="Diagnostic result">
        <main className="mx-auto w-full max-w-5xl">
          <DiagnosticResultScorecard scorecard={result.data.scorecard} learnerName={learnerName} />
        </main>
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
