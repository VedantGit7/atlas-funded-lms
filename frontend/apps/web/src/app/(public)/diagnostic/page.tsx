import Link from "next/link";
import { PublicDiagnosticRunner } from "../../../features/diagnostics/components/PublicDiagnosticRunner";
import { publicLandingServerApi } from "../../../modules/public/public-landing.server-api";

/**
 * The runner starts a session as soon as it mounts, which fails with a 503 when
 * the academy has not published a diagnostic assessment. Ask first, and show a
 * plain notice instead of starting a session that cannot succeed. If the check
 * itself fails, fall back to the runner, which reports its own errors.
 */
async function isDiagnosticPublished(): Promise<boolean> {
  try {
    const landing = await publicLandingServerApi.getLanding("home");
    return landing.data.diagnosticAvailable !== false;
  } catch {
    return true;
  }
}

export default async function PublicDiagnosticPage() {
  if (!(await isDiagnosticPublished())) {
    return (
      <section className="rounded border p-4">
        <h1 className="text-xl font-semibold">The diagnostic is not available yet</h1>
        <p className="mt-2 text-sm opacity-80">
          This academy has not published its readiness diagnostic. You can still create a free
          account and start learning.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link href="/signup" className="rounded border px-4 py-2">
            Create a free account
          </Link>
          <Link href="/" className="rounded border px-4 py-2">
            Back to home
          </Link>
        </div>
      </section>
    );
  }

  return (
    <div className="space-y-4">
      <PublicDiagnosticRunner />
    </div>
  );
}
