import Link from "next/link";
import { Calendar, Clock, Headphones } from "lucide-react";
import { getHelpCategory, getRelatedArticles } from "../help-center-content";
import { formatReadTime } from "../help-center-view";
import type { HelpArticle } from "../help-center-types";
import { HelpArticleContent, HelpBreadcrumbs } from "./HelpArticleContent";
import { HelpArticleFeedback } from "./HelpArticleFeedback";
import { HelpArticleToc } from "./HelpArticleToc";
import { HelpArticleTocMobile } from "./HelpArticleTocMobile";
import { helpOutlineButtonClassName } from "../help-center-styles";

type HelpArticlePageProps = {
  article: HelpArticle;
};

export function HelpArticlePage({ article }: HelpArticlePageProps) {
  const category = getHelpCategory(article.categoryId);
  const related = getRelatedArticles(article, 3);

  return (
    <div className="mx-auto max-w-6xl">
      <div className="grid grid-cols-1 gap-10 md:grid-cols-12">
        <aside className="hidden md:col-span-3 md:block">
          <div className="sticky top-24">
            <HelpArticleToc sections={article.sections} />
          </div>
        </aside>

        <article className="md:col-span-9 lg:col-span-7">
          {category ? (
            <HelpBreadcrumbs
              categoryTitle={category.title}
              categoryId={category.id}
              articleTitle={article.title}
            />
          ) : null}

          <HelpArticleTocMobile sections={article.sections} />

          <header className="mb-10">
            <h1 className="text-3xl font-semibold tracking-tight text-primary sm:text-4xl">
              {article.title}
            </h1>
            <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <Calendar className="h-4 w-4" aria-hidden="true" />
                Last updated: {article.lastUpdated}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Clock className="h-4 w-4" aria-hidden="true" />
                {formatReadTime(article.readMinutes)}
              </span>
            </div>
          </header>

          <HelpArticleContent sections={article.sections} />

          <hr className="my-12 border-border" />

          <HelpArticleFeedback articleSlug={article.slug} />
        </article>
      </div>

      {related.length > 0 ? (
        <footer className="mt-16 border-t border-border pt-10">
          <h2 className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            Related articles
          </h2>
          <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-3">
            {related.map((entry) => (
              <Link key={entry.slug} href={`/help/${entry.slug}`} className="group">
                <p className="text-lg font-semibold text-primary group-hover:underline">
                  {entry.title}
                </p>
                <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{entry.summary}</p>
              </Link>
            ))}
          </div>
        </footer>
      ) : null}

      <section className="mt-12 rounded-xl border border-border bg-muted p-6 sm:flex sm:items-center sm:justify-between sm:gap-6">
        <div>
          <p className="text-lg font-semibold text-foreground">Still need help?</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Check security settings or troubleshooting articles for persistent errors.
          </p>
        </div>
        <div className="mt-4 flex flex-wrap gap-3 sm:mt-0">
          <Link href="/settings" className={helpOutlineButtonClassName}>
            <Headphones className="h-4 w-4" aria-hidden="true" />
            Settings
          </Link>
          <Link href="/help" className="text-sm font-medium text-primary hover:underline">
            Back to Help Center
          </Link>
        </div>
      </section>
    </div>
  );
}
