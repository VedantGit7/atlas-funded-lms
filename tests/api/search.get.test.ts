import { describe, expect, it } from "vitest";
import {
  getRegisteredSearchSourceAdapters,
  getSearchSourceAdapter,
} from "@atlas/domain/search/search-source-registry";

/**
 * QA review 1 C9, review 2 C4: learner search returned nothing for published
 * courses. The worker indexed them, but the search sources (which decide what
 * each result is and who may see it) were loaded only in the worker; the API
 * process serving GET /api/v1/search had none and dropped every result.
 *
 * This file must not import search-source-adapters itself: loading the route
 * has to be enough.
 */
describe("GET /api/v1/search loads its search sources", () => {
  it("registers the course, post and certificate sources with the route", async () => {
    expect(getRegisteredSearchSourceAdapters()).toHaveLength(0);

    await import("../../backend/apps/api/src/app/api/v1/search/route");

    expect(getSearchSourceAdapter("learning", "course")).toBeDefined();
    expect(
      getRegisteredSearchSourceAdapters()
        .map((adapter) => adapter.sourceType)
        .sort(),
    ).toEqual(["certificate", "course", "post"]);
  });
});
