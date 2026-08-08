"use client";

import Link from "next/link";
import type { SearchResultItem } from "@atlas/domain/search/search.contract";

type SearchResultCardProps = {
  result: SearchResultItem;
};

export function SearchResultCard({ result }: SearchResultCardProps) {
  return (
    <article className="rounded-lg border p-4">
      <div className="mb-1 text-xs uppercase tracking-wide text-neutral-500">{result.type}</div>
      <h2 className="text-lg font-semibold">
        <Link href={result.actionPath} className="underline-offset-2 hover:underline">
          {result.title}
        </Link>
      </h2>
      {result.snippet ? <p className="mt-2 text-sm text-neutral-700">{result.snippet}</p> : null}
    </article>
  );
}
