import { PageGate, PageHeader } from "../../../../components/patterns/PageGate";
import { AppealsReviewClient } from "../../../../features/moderation/components/AppealsReviewClient";

export default function ModerationAppealsPage() {
  return (
    <PageGate state="ready" title="Appeals review">
      <main className="space-y-6">
        <PageHeader
          title="Appeals review"
          description="Review pending member appeals against moderation decisions."
        />
        <AppealsReviewClient />
      </main>
    </PageGate>
  );
}
