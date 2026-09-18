import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { repoRoot, resolveSplitPath, splitPathExists } from "./split-layout-paths";

const searchPaths = [
  "app/(learner)/search/page.tsx",
  "app/(learner)/search/layout.tsx",
  "app/api/v1/search/route.ts",
  "app/api/v1/search/route.metadata.ts",
  "app/api/v1/search/reindex/route.ts",
  "app/api/v1/search/reindex/route.metadata.ts",
  "features/search/components/search-results-page.tsx",
  "features/search/components/search-query-form.tsx",
  "features/search/components/search-result-card.tsx",
  "features/search/components/search-type-filters.tsx",
  "features/search/api.ts",
  "server/search/search-source-adapters.ts",
  "server/search/search-worker-router.ts",
];

describe("search e2e wiring", () => {
  it("includes approved screen, APIs, and search feature files", () => {
    for (const relativePath of searchPaths) {
      expect(splitPathExists(relativePath)).toBe(true);
    }
  });

  it("search page loads results through server API", () => {
    const source = readFileSync(resolveSplitPath("app/(learner)/search/page.tsx"), "utf8");
    expect(source).toContain("serverApi.get");
    expect(source).toContain("SearchResultsPage");
    expect(source).not.toContain("access_json");
  });

  it("result cards navigate through safe internal action paths", () => {
    const source = readFileSync(
      resolveSplitPath("features/search/components/search-result-card.tsx"),
      "utf8",
    );
    expect(source).toContain("result.actionPath");
    expect(source).not.toContain("dangerouslySetInnerHTML");
  });

  it("reindex API emits worker-owned outbox event only", () => {
    const serviceSource = readFileSync(
      resolve(repoRoot, "backend/packages/domain/src/search/search.service.ts"),
      "utf8",
    );
    expect(serviceSource).toContain("SEARCH_REINDEX_REQUESTED_EVENT");
    expect(serviceSource).not.toContain("search_index_entries");
  });

  it("search service does not emit analytics events", () => {
    const serviceSource = readFileSync(
      resolve(repoRoot, "backend/packages/domain/src/search/search.service.ts"),
      "utf8",
    );
    expect(serviceSource).not.toContain("analytics");
    expect(serviceSource).not.toContain("click");
  });

  it("worker router registers search consumers", () => {
    const consumersSource = readFileSync(resolveSplitPath("events/outbox-consumers.ts"), "utf8");
    expect(consumersSource).toContain("createSearchOutboxConsumers");
    expect(consumersSource).toContain("SEARCH_OUTBOX_EVENTS");
  });

  it("learner shell exposes topbar search entry", () => {
    const shellSource = readFileSync(
      resolveSplitPath("components/shells/LearnerShell.tsx"),
      "utf8",
    );
    expect(shellSource).toContain('href="/search"');
  });
});
