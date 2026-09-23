import { PageGate, PageHeader } from "../../../../components/patterns/PageGate";
import { DiagnosticCatalog } from "../../../../features/diagnostics/components/DiagnosticCatalog";
import { ServerApiError } from "../../../../lib/server-api";
import { diagnosticServerApi } from "@/modules/diagnostics/diagnostic.server-api";

export default async function LearnerDiagnosticPage() {
  try {
    const catalog = await diagnosticServerApi.getDiagnosticCatalog();

    return (
      <PageGate state="ready" title="Diagnostic assessments">
        <main className="mx-auto w-full max-w-6xl space-y-10">
          <PageHeader
            title="Diagnostic assessments"
            description="Adaptive benchmarks that map your current skill level and point you to the next step. Answer honestly — these adapt to find your level, not to trick you."
          />
          <DiagnosticCatalog items={catalog.data.items} />
        </main>
      </PageGate>
    );
  } catch (error) {
    if (error instanceof ServerApiError && (error.status === 401 || error.status === 403)) {
      return (
        <PageGate
          state="denied"
          title="Diagnostic assessments"
          deniedMessage="You do not have permission to view diagnostic assessments."
        />
      );
    }

    return <PageGate state="error" title="Diagnostic assessments" />;
  }
}
