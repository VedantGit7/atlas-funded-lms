import Link from "next/link";
import { PageGate, PageHeader } from "../../../components/patterns/PageGate";
import { ReadinessPolicyEditor } from "../../../features/readiness/components/ReadinessPolicyEditor";
import { competencyConfigServerApi } from "../../../modules/competency/competency-config.server-api";
import { readinessServerApi } from "../../../modules/readiness/readiness.server-api";
import { ServerApiError } from "../../../lib/server-api";

export default async function AdminReadinessPolicyPage() {
  try {
    const [policyResponse, profiles] = await Promise.all([
      readinessServerApi.getReadinessPolicy(),
      competencyConfigServerApi.listScoringProfiles(),
    ]);

    return (
      <PageGate state="ready" title="Readiness Policy">
        <main className="space-y-6">
          <header className="flex flex-wrap items-center justify-between gap-3">
            <PageHeader
              title="Readiness Policy"
              description="Configure band-driven CTA prominence, legal copy, and outbound redirect target."
            />
            <Link href="/admin" className="text-sm underline">
              Back to admin
            </Link>
          </header>

          <ReadinessPolicyEditor
            initialPolicy={policyResponse.data}
            scoringProfiles={profiles.data}
            canManage
          />
        </main>
      </PageGate>
    );
  } catch (error) {
    if (error instanceof ServerApiError && (error.status === 401 || error.status === 403)) {
      return (
        <PageGate
          state="denied"
          title="Readiness Policy"
          deniedMessage="You do not have permission to manage readiness policy."
        />
      );
    }

    if (error instanceof ServerApiError) {
      return (
        <PageGate
          state="error"
          title="Readiness Policy"
          errorMessage={`Failed to load readiness policy. Request ID: ${error.requestId}`}
        />
      );
    }

    throw error;
  }
}
