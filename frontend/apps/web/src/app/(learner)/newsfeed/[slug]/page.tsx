import { PageGate } from "../../../components/patterns/PageGate";
import { LearnerNewsfeedArticle } from "../../../features/learner/components/newsfeed/LearnerNewsfeedArticle";

type PageProps = { params: Promise<{ slug: string }> };

export default async function NewsfeedArticlePage({ params }: PageProps) {
  const { slug } = await params;
  return (
    <PageGate state="ready" title="Newsfeed article">
      <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6">
        <LearnerNewsfeedArticle slug={slug} />
      </main>
    </PageGate>
  );
}
