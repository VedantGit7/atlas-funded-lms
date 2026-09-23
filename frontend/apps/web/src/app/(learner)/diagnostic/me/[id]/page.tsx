import Link from "next/link";
import { PageGate } from "../../../../../components/patterns/PageGate";
import { AuthenticatedDiagnosticRunner } from "../../../../../features/diagnostics/components/AuthenticatedDiagnosticRunner";
import { ServerApiError } from "../../../../../lib/server-api";
import { diagnosticServerApi } from "@/modules/diagnostics/diagnostic.server-api";

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
            title="Diagnostic assessment"
            initialItems={result.data.runner.items}
          />
        </PageGate>
      );
    }

    return (
      <PageGate state="ready" title="Diagnostic">
        <main className="mx-auto w-full max-w-2xl">
          <section className="rounded-2xl border border-border bg-card p-8 text-center">
            <h1 className="text-xl font-semibold text-foreground">
              This session is no longer in progress
            </h1>
            <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
              You&apos;ve already submitted this diagnostic. View your scorecard to see your results
              and recommended next step.
            </p>
            <Link
              href={`/diagnostic/me/${result.data.sessionId}/result`}
              className="mt-6 inline-flex items-center justify-center rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition-[filter] hover:brightness-110"
            >
              View your scorecard
            </Link>
          </section>
        </main>
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
