"use client";

import Link from "next/link";
import type { SearchResultItem } from "@atlas/domain/search/search.contract";

type SearchResultCardProps = {
  result: SearchResultItem;
};

export function SearchResultCard({ result }: SearchResultCardProps) {
  // A course with no description gets its title as the snippet; don't repeat it.
  const snippet =
    result.snippet && result.snippet.trim().toLowerCase() !== result.title.trim().toLowerCase()
      ? result.snippet
      : null;
  return (
    <article className="rounded-lg border p-4">
      <div className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">
        {result.type}
      </div>
      <h2 className="text-lg font-semibold">
        <Link href={result.actionPath} className="underline-offset-2 hover:underline">
          {result.title}
        </Link>
      </h2>
      {snippet ? <p className="mt-2 text-sm text-foreground">{snippet}</p> : null}
    </article>
  );
}
