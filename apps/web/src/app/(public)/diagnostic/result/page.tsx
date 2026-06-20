import { AnonymousDiagnosticResultView } from "../../../../features/diagnostics/components/AnonymousDiagnosticResultView";

type DiagnosticResultPageProps = {
  searchParams: Promise<{ anonId?: string }>;
};

export default async function DiagnosticResultPage({ searchParams }: DiagnosticResultPageProps) {
  const params = await searchParams;
  const anonymousId = params.anonId;

  if (!anonymousId) {
    return (
      <section className="rounded border p-4">
        <h1 className="text-xl font-semibold">Diagnostic result unavailable</h1>
        <p className="mt-2 text-sm opacity-80">
          Start a diagnostic to view your preliminary scorecard.
        </p>
      </section>
    );
  }

  return <AnonymousDiagnosticResultView anonymousId={anonymousId} />;
}
