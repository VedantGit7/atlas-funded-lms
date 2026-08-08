import type { SearchAccessContext, SearchResultDto } from "./search.types";
import { buildSearchSnippet } from "./search.repository";
import { getSearchAdapterForIndexEntry } from "./search-source-registry";

export async function resolveAuthorizedSearchResult(
  args: SearchAccessContext & { q: string },
): Promise<SearchResultDto | null> {
  const adapter = getSearchAdapterForIndexEntry(args.entry);
  if (!adapter) {
    return null;
  }

  const result = await adapter.resolveResultForActor(args);
  if (!result) {
    return null;
  }

  return {
    ...result,
    snippet: buildSearchSnippet(args.entry.title, args.entry.body, args.q),
  };
}

export async function filterAuthorizedSearchResults(
  args: SearchAccessContext & { q: string; entries: SearchAccessContext["entry"][] },
): Promise<SearchResultDto[]> {
  const items: SearchResultDto[] = [];

  for (const entry of args.entries) {
    const resolved = await resolveAuthorizedSearchResult({
      tx: args.tx,
      ctx: args.ctx,
      entry,
      q: args.q,
    });
    if (resolved) {
      items.push(resolved);
    }
  }

  return items;
}
