import { PageGate, PageHeader } from "../../../components/patterns/PageGate";
import { LearnerNewsfeedFeed } from "../../../features/learner/components/newsfeed/LearnerNewsfeedFeed";

export default function NewsfeedPage() {
  return (
    <PageGate state="ready" title="Newsfeed">
      <main className="mx-auto w-full max-w-6xl space-y-6">
        <PageHeader
          title="Newsfeed"
          description="School updates, announcements, and product launches from your academy."
        />
        <LearnerNewsfeedFeed />
      </main>
    </PageGate>
  );
}
