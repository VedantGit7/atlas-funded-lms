import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageGate } from "../../../../components/patterns/PageGate";
import { HelpArticlePage } from "../../../../features/help-center/components/HelpArticlePage";
import { HELP_ARTICLES, getHelpArticle } from "../../../../features/help-center/help-center-content";

type HelpArticleRouteProps = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return HELP_ARTICLES.map((article) => ({ slug: article.slug }));
}

export async function generateMetadata({ params }: HelpArticleRouteProps): Promise<Metadata> {
  const { slug } = await params;
  const article = getHelpArticle(slug);

  if (!article) {
    return { title: "Article not found" };
  }

  return {
    title: `${article.title} | Help Center`,
    description: article.summary,
  };
}

export default async function HelpArticleRoute({ params }: HelpArticleRouteProps) {
  const { slug } = await params;
  const article = getHelpArticle(slug);

  if (!article) {
    notFound();
  }

  return (
    <PageGate state="ready" title={article.title}>
      <main className="px-1 py-2 sm:py-4">
        <HelpArticlePage article={article} />
      </main>
    </PageGate>
  );
}
