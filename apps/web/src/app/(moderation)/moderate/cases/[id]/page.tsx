import Link from "next/link";
import { PageGate, PageHeader } from "../../../../../components/patterns/PageGate";
import { ModerationCaseDetailClient } from "../../../../../features/moderation/components/ModerationCaseDetailClient";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function ModerationCaseDetailPage({ params }: PageProps) {
  const { id } = await params;

  return (
    <PageGate state="ready" title="Moderation case">
      <main className="space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <PageHeader
            title="Moderation case"
            description="Review evidence and record a decision."
          />
          <Link href="/moderate/cases" className="text-sm underline">
            Back to queue
          </Link>
        </header>
        <ModerationCaseDetailClient caseId={id} />
      </main>
    </PageGate>
  );
}
