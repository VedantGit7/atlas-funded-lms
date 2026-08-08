"use client";

import { useEffect, useId, useMemo, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { HELP_SEARCH_SUGGESTIONS } from "../help-center-content";
import { searchHelpArticles } from "../help-center-view";
import { helpChipClassName, helpSearchShellClassName } from "../help-center-styles";
import type { HelpSearchResult } from "../help-center-types";

type HelpSearchBarProps = {
  autoFocus?: boolean;
};

export function HelpSearchBar({ autoFocus = false }: HelpSearchBarProps) {
  const listId = useId();
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query), 200);
    return () => window.clearTimeout(timer);
  }, [query]);

  const results = useMemo(
    () => searchHelpArticles(debouncedQuery, 8),
    [debouncedQuery],
  );

  const showResults = debouncedQuery.trim().length > 0;

  function applySuggestion(label: string) {
    setQuery(label);
    setDebouncedQuery(label);
  }

  return (
    <div className="w-full">
      <div className={helpSearchShellClassName}>
        <div className="flex items-center px-4 py-4">
          <Search className="mr-2 h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            autoFocus={autoFocus}
            placeholder="Search articles, diagnostics, billing, and more…"
            aria-controls={showResults ? listId : undefined}
            aria-expanded={showResults}
            className="w-full border-none bg-transparent text-lg text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-0"
          />
        </div>

        <div className="flex items-center gap-4 overflow-x-auto px-4 pb-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <span className="whitespace-nowrap text-xs font-medium text-muted-foreground">
            Suggested:
          </span>
          {HELP_SEARCH_SUGGESTIONS.map((label) => (
            <button
              key={label}
              type="button"
              onClick={() => applySuggestion(label)}
              className={`${helpChipClassName} whitespace-nowrap`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {showResults ? (
        <ul
          id={listId}
          role="listbox"
          className="mt-3 overflow-hidden rounded-xl border border-border bg-card shadow-sm"
        >
          {results.length === 0 ? (
            <li className="px-4 py-3 text-sm text-muted-foreground" role="option">
              No articles match your search. Try different keywords or browse categories below.
            </li>
          ) : (
            results.map((result) => (
              <HelpSearchResultRow key={result.slug} result={result} />
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
}

function HelpSearchResultRow({ result }: { result: HelpSearchResult }) {
  return (
    <li role="option">
      <Link
        href={`/help/${result.slug}`}
        className="block border-b border-border px-4 py-3 last:border-b-0 motion-safe:transition-colors hover:bg-muted"
      >
        <p className="text-sm font-medium text-foreground">{result.title}</p>
        <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{result.summary}</p>
        <p className="mt-1 text-[11px] font-medium uppercase tracking-wide text-primary">
          {result.categoryTitle}
        </p>
      </Link>
    </li>
  );
}
