"use client";

import { useState } from "react";
import type { SearchResultItem } from "@atlas/domain/search/search.contract";
import { fetchSearchResults } from "../api";
import { SearchQueryForm } from "./search-query-form";
import { SearchResultCard } from "./search-result-card";
import { SearchTypeFilters } from "./search-type-filters";

type SearchResultsPageProps = {
  initialQuery: string;
  initialType?: string;
  initialResults: SearchResultItem[];
  initialNextCursor: string | null;
  initialHasNextPage: boolean;
  errorMessage?: string;
};

export function SearchResultsPage({
  initialQuery,
  initialType,
  initialResults,
  initialNextCursor,
  initialHasNextPage,
  errorMessage,
}: SearchResultsPageProps) {
  const [results, setResults] = useState(initialResults);
  const [nextCursor, setNextCursor] = useState(initialNextCursor);
  const [hasNextPage, setHasNextPage] = useState(initialHasNextPage);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  async function handleLoadMore() {
    if (!nextCursor || loadingMore) {
      return;
    }

    setLoadingMore(true);
    setLoadError(null);

    try {
      const response = await fetchSearchResults({
        q: initialQuery,
        ...(initialType ? { type: initialType } : {}),
        cursor: nextCursor,
      });

      setResults((current) => [...current, ...response.data.items]);
      setNextCursor(response.data.pageInfo.nextCursor);
      setHasNextPage(response.data.pageInfo.hasNextPage);
    } catch {
      setLoadError("Failed to load more results.");
    } finally {
      setLoadingMore(false);
    }
  }

  const showEmpty = initialQuery.length >= 2 && results.length === 0 && !errorMessage;

  return (
    <div className="space-y-6">
      <SearchQueryForm initialQuery={initialQuery} {...(initialType ? { initialType } : {})} />
      <SearchTypeFilters
        query={initialQuery}
        {...(initialType ? { activeType: initialType } : {})}
      />

      {errorMessage ? (
        <p role="alert" className="rounded border border-red-300 bg-red-50 p-4 text-sm">
          {errorMessage}
        </p>
      ) : null}

      {initialQuery.length < 2 ? (
        <p className="text-sm text-neutral-600">Enter at least 2 characters to search.</p>
      ) : null}

      {showEmpty ? (
        <p className="rounded border border-dashed p-6 text-sm text-neutral-600">
          No results matched your search.
        </p>
      ) : null}

      <div className="space-y-3">
        {results.map((result) => (
          <SearchResultCard
            key={`${result.type}-${result.title}-${result.actionPath}`}
            result={result}
          />
        ))}
      </div>

      {loadError ? (
        <p role="alert" className="text-sm text-red-700">
          {loadError}
        </p>
      ) : null}

      {hasNextPage ? (
        <button
          type="button"
          className="rounded border px-4 py-2 text-sm"
          onClick={() => void handleLoadMore()}
          disabled={loadingMore}
        >
          {loadingMore ? "Loading…" : "Load more"}
        </button>
      ) : null}
    </div>
  );
}
