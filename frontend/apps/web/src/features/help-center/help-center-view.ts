import type { getHelpArticle } from "./help-center-content";
import { HELP_ARTICLES, HELP_CATEGORIES } from "./help-center-content";
import type { HelpSearchResult } from "./help-center-types";

function normalizeQuery(query: string): string {
  return query.trim().toLowerCase();
}

export function searchHelpArticles(query: string, limit = 12): HelpSearchResult[] {
  const normalized = normalizeQuery(query);
  if (!normalized) {
    return [];
  }

  const categoryTitleById = new Map(
    HELP_CATEGORIES.map((category) => [category.id, category.title]),
  );

  const tokens = normalized.split(/\s+/).filter(Boolean);

  const scored = HELP_ARTICLES.map((article) => {
    const haystack = `${article.title} ${article.summary} ${article.sections
      .map(
        (section) =>
          `${section.title} ${section.blocks.map((block) => ("text" in block ? block.text : "")).join(" ")}`,
      )
      .join(" ")}`.toLowerCase();

    let score = 0;
    for (const token of tokens) {
      if (article.title.toLowerCase().includes(token)) score += 4;
      if (article.summary.toLowerCase().includes(token)) score += 2;
      if (haystack.includes(token)) score += 1;
    }

    return { article, score };
  })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return scored.map(({ article }) => ({
    slug: article.slug,
    title: article.title,
    summary: article.summary,
    categoryId: article.categoryId,
    categoryTitle: categoryTitleById.get(article.categoryId) ?? article.categoryId,
  }));
}

export function flattenArticleToc(article: NonNullable<ReturnType<typeof getHelpArticle>>) {
  return article.sections.map((section) => ({
    id: section.id,
    title: section.title,
  }));
}

export function formatReadTime(minutes: number): string {
  return `${String(minutes)} min read`;
}
