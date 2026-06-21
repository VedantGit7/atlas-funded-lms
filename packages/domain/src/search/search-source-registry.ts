import type {
  SearchAccessContext,
  SearchIndexProjection,
  SearchIndexRow,
  SearchReindexCursor,
  SearchResultDto,
  SearchSourceType,
  ServiceCtx,
  Tx,
} from "./search.types";

export type SearchSourceAdapter = {
  sourceContext: string;
  sourceType: SearchSourceType;
  supportedEvents: readonly string[];
  resolveSourceIdFromEvent(eventType: string, payload: unknown): string | null;
  buildIndexProjection(
    tx: Tx,
    ctx: ServiceCtx,
    sourceId: string,
  ): Promise<SearchIndexProjection | null>;
  resolveResultForActor(args: SearchAccessContext): Promise<SearchResultDto | null>;
  iterateReindexBatch(
    tx: Tx,
    ctx: ServiceCtx,
    cursor: SearchReindexCursor | null,
    batchSize: number,
  ): Promise<{ projections: SearchIndexProjection[]; nextCursor: SearchReindexCursor | null }>;
};

const adapters: SearchSourceAdapter[] = [];

export function registerSearchSourceAdapter(adapter: SearchSourceAdapter): void {
  const duplicate = adapters.find(
    (existing) =>
      existing.sourceContext === adapter.sourceContext &&
      existing.sourceType === adapter.sourceType,
  );
  if (duplicate) {
    throw new Error(
      `Duplicate search source adapter: ${adapter.sourceContext}/${adapter.sourceType}`,
    );
  }
  adapters.push(adapter);
}

export function getRegisteredSearchSourceAdapters(): readonly SearchSourceAdapter[] {
  return adapters;
}

export function getSearchSourceAdapter(
  sourceContext: string,
  sourceType: SearchSourceType,
): SearchSourceAdapter | undefined {
  return adapters.find(
    (adapter) => adapter.sourceContext === sourceContext && adapter.sourceType === sourceType,
  );
}

export function getSearchAdaptersForEvent(eventType: string): SearchSourceAdapter[] {
  return adapters.filter((adapter) => adapter.supportedEvents.includes(eventType));
}

export function getSearchAdapterForIndexEntry(
  entry: SearchIndexRow,
): SearchSourceAdapter | undefined {
  return getSearchSourceAdapter(entry.source_context, entry.source_type);
}

export function clearSearchSourceAdaptersForTests(): void {
  adapters.length = 0;
}

export const REGISTERED_SEARCH_SOURCE_TYPES = ["course", "post", "certificate"] as const;

export const SEARCH_SOURCE_EVENT_BINDINGS = {
  course: ["course.published"] as const,
  post: ["community.post.created"] as const,
  certificate: ["certificate.issued", "certificate.revoked"] as const,
  moderation: ["moderation.decided"] as const,
} as const;
