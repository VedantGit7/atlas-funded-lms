import { describe, expect, it } from "vitest";
import { createElement } from "../../../frontend/apps/web/node_modules/react";
import { renderToStaticMarkup } from "../../../frontend/apps/web/node_modules/react-dom/server.node.js";
import { SearchResultCard } from "../../../frontend/apps/web/src/features/search/components/search-result-card";

/** A course with no description used to show its title twice (S1.5 browser check). */
describe("search result card", () => {
  const result = { type: "course", title: "Price Action Mastery", actionPath: "/courses/c-1" };

  it("shows the snippet when it adds something", () => {
    const html = renderToStaticMarkup(
      createElement(SearchResultCard, {
        result: { ...result, snippet: "Learn to read candles and structure." },
      }),
    );
    expect(html).toContain("Learn to read candles");
    expect(html).toContain('href="/courses/c-1"');
  });

  it("doesn't repeat the title as the snippet", () => {
    const html = renderToStaticMarkup(
      createElement(SearchResultCard, { result: { ...result, snippet: "price action mastery " } }),
    );
    expect(html.match(/Price Action Mastery/gi)).toHaveLength(1);
  });
});
