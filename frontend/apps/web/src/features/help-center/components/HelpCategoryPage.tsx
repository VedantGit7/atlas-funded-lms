import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { getArticlesByCategory, getHelpCategory } from "../help-center-content";
import { helpListRowClassName } from "../help-center-styles";
import { HelpSearchBar } from "./HelpSearchBar";

type HelpCategoryPageProps = {
  categoryId: string;
  academyName: string;
};

export function HelpCategoryPage({ categoryId, academyName }: HelpCategoryPageProps) {
  const category = getHelpCategory(categoryId);
  const articles = getArticlesByCategory(categoryId);

  if (!category) {
    return null;
  }

  return (
    <div className="mx-auto max-w-4xl space-y-10">
      <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
        <Link href="/help" className="text-primary hover:underline">
          Help Center
        </Link>
        <span className="mx-2 text-muted-foreground">/</span>
        <span className="text-foreground">{category.title}</span>
      </nav>

      <header className="space-y-3">
        <h1 className="text-3xl font-semibold text-primary">{category.title}</h1>
        <p className="max-w-2xl text-muted-foreground">{category.description}</p>
      </header>

      <HelpSearchBar />

      {articles.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No articles are published in this category yet. Browse other topics from the{" "}
          <Link href="/help" className="text-primary hover:underline">
            Help Center home
          </Link>
          .
        </p>
      ) : (
        <ul className="space-y-2">
          {articles.map((article) => (
            <li key={article.slug}>
              <Link href={`/help/${article.slug}`} className={helpListRowClassName}>
                <div>
                  <p className="text-base font-medium text-foreground group-hover:text-primary">
                    {article.title}
                  </p>
                  <p className="mt-0.5 text-sm text-muted-foreground">{article.summary}</p>
                </div>
                <ChevronRight
                  className="h-4 w-4 shrink-0 text-muted-foreground"
                  aria-hidden="true"
                />
              </Link>
            </li>
          ))}
        </ul>
      )}

      <p className="text-xs text-muted-foreground">
        Showing {articles.length} article{articles.length === 1 ? "" : "s"} for {academyName}.
      </p>
    </div>
  );
}
