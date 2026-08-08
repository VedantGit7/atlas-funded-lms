import { describe, expect, it } from "vitest";
import {
  HELP_ARTICLES,
  HELP_CATEGORIES,
  getHelpArticle,
  getRelatedArticles,
  getTipOfWeek,
} from "../help-center-content";
import { searchHelpArticles } from "../help-center-view";

describe("help-center-content", () => {
  it("has unique article slugs", () => {
    const slugs = HELP_ARTICLES.map((article) => article.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("maps every article to a known category", () => {
    const categoryIds = new Set(HELP_CATEGORIES.map((category) => category.id));
    for (const article of HELP_ARTICLES) {
      expect(categoryIds.has(article.categoryId)).toBe(true);
    }
  });

  it("resolves related articles without unknown slugs", () => {
    for (const article of HELP_ARTICLES) {
      const related = getRelatedArticles(article, 3);
      for (const entry of related) {
        expect(getHelpArticle(entry.slug)).toBeTruthy();
      }
    }
  });

  it("returns a rotating tip of the week", () => {
    const tip = getTipOfWeek(new Date("2026-07-16T12:00:00Z"));
    expect(tip.label.length).toBeGreaterThan(0);
    expect(tip.body.length).toBeGreaterThan(0);
  });
});

describe("searchHelpArticles", () => {
  it("finds diagnostic articles by keyword", () => {
    const results = searchHelpArticles("diagnostic");
    expect(results.some((result) => result.slug.includes("diagnostic"))).toBe(true);
  });

  it("returns empty for blank query", () => {
    expect(searchHelpArticles("   ")).toEqual([]);
  });
});
