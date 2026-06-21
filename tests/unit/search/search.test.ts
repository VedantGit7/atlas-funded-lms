import { describe, expect, it } from "vitest";
import {
  SEARCH_SOURCE_TYPES,
  searchQuerySchema,
  searchResultItemSchema,
} from "@atlas/domain/search/search.dto";
import {
  searchReindexMetadata,
  searchQueryMetadata,
} from "@atlas/domain/search/search.route-metadata";

describe("search query validation", () => {
  it("accepts optional q on initial page render", () => {
    const parsed = searchQuerySchema.parse({});
    expect(parsed.q).toBeUndefined();
    expect(parsed.limit).toBe(20);
  });

  it("requires q to be at least 2 characters when provided", () => {
    expect(() => searchQuerySchema.parse({ q: "a" })).toThrow();
    expect(searchQuerySchema.parse({ q: "ab" }).q).toBe("ab");
  });

  it("rejects unknown source type", () => {
    expect(() => searchQuerySchema.parse({ q: "alpha", type: "lesson" })).toThrow();
  });

  it("rejects tenant_id injection", () => {
    expect(() =>
      searchQuerySchema.parse({ q: "alpha", tenant_id: "018f0000-0000-7000-8000-000000000001" }),
    ).toThrow();
  });

  it("rejects offset pagination", () => {
    expect(() => searchQuerySchema.parse({ q: "alpha", offset: "10" })).toThrow();
  });

  it("validates cursor as uuid", () => {
    expect(() => searchQuerySchema.parse({ q: "alpha", cursor: "not-a-uuid" })).toThrow();
  });

  it("registers only approved source types", () => {
    expect(SEARCH_SOURCE_TYPES).toEqual(["course", "post", "certificate"]);
  });
});

describe("search action path safety", () => {
  it("accepts internal relative action paths", () => {
    expect(
      searchResultItemSchema.parse({
        type: "course",
        title: "Course",
        snippet: "Course body",
        actionPath: "/courses/018f0000-0000-7000-8000-000000000001",
      }).actionPath,
    ).toBe("/courses/018f0000-0000-7000-8000-000000000001");
  });

  it("rejects external action paths", () => {
    expect(() =>
      searchResultItemSchema.parse({
        type: "course",
        title: "Course",
        snippet: "Course body",
        actionPath: "https://example.test/courses/1",
      }),
    ).toThrow();
  });
});

describe("search vector behavior", () => {
  it("does not expose vector_ref in result schema", () => {
    expect(
      searchResultItemSchema.safeParse({
        type: "course",
        title: "Course",
        snippet: "Course body",
        actionPath: "/courses/1",
        vector_ref: "embedding-1",
      }).success,
    ).toBe(false);
  });
});

describe("search reindex metadata", () => {
  it("requires idempotency for reindex", () => {
    expect(searchReindexMetadata.idempotency).toBe("required");
  });

  it("does not require idempotency for query", () => {
    expect(searchQueryMetadata.idempotency).toBe("none");
  });
});
