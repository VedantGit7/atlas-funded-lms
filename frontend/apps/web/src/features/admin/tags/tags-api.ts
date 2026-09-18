import type { TagVisibility } from "@atlas/contracts/tags/tag-schemas";
import { clientApi } from "../../../lib/client-api";

/**
 * Client for the tenant tag vocabulary.
 *
 * Every path is written as a literal here rather than assembled from a table,
 * so `check-frontend-api-closure --strict` can match each backend route to a
 * caller instead of seeing an uninformative `*` pattern.
 */

export type { TagVisibility };

/** The three stored values, in the order the segmented controls render them. */
export const TAG_VISIBILITIES: readonly TagVisibility[] = ["public", "private", "classification"];

export const TAG_TITLE_MAX = 60;
export const TAG_DESCRIPTION_MAX = 255;

/** The most tags one bulk command may carry; mirrors `TAG_BULK_LIMIT`. */
export const TAG_BULK_LIMIT = 100;

export type TagUsage = {
  courses: number;
  lessons: number;
};

export type Tag = {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  visibility: TagVisibility;
  /** Absent unless the list was fetched with usage. */
  usage?: TagUsage;
};

export type TagDetail = Tag & {
  createdAt: string;
  updatedAt: string;
};

export type TagUsageDetail = {
  tagId: string;
  counts: TagUsage;
  courses: Array<{ id: string; title: string; status: string }>;
  lessons: Array<{ id: string; title: string; courseId: string; courseTitle: string }>;
  truncated: boolean;
};

type ListResponse = { data: { items: Tag[] } };

/**
 * The whole vocabulary in one call.
 *
 * `withUsage` is opt-in on the server, and this screen is the only caller that
 * asks for it — the lesson and course tag pickers read the same endpoint on
 * every keystroke and would pay for two aggregates they never render.
 */
export async function fetchTags(): Promise<Tag[]> {
  const response = await clientApi.get<ListResponse>("/api/v1/tags?withUsage=true");
  return response.data.items;
}

/** Re-reads one tag so an edit starts from current values, not a stale row. */
export async function fetchTag(tagId: string): Promise<TagDetail> {
  const response = await clientApi.get<{ data: TagDetail }>(
    `/api/v1/tags/${encodeURIComponent(tagId)}`,
  );
  return response.data;
}

/** Where this tag is attached: exact counts, sampled lists. */
export async function fetchTagUsage(tagId: string): Promise<TagUsageDetail> {
  const response = await clientApi.get<{ data: TagUsageDetail }>(
    `/api/v1/tags/${encodeURIComponent(tagId)}/usage`,
  );
  return response.data;
}

export async function createTag(input: {
  title: string;
  description?: string;
  visibility: TagVisibility;
}): Promise<TagDetail> {
  const response = await clientApi.post<{ data: TagDetail }>("/api/v1/tags", input, "tag-create", {
    successMessage: "Tag created.",
  });
  return response.data;
}

export async function updateTag(
  tagId: string,
  input: { title: string; description: string; visibility: TagVisibility },
): Promise<TagDetail> {
  const response = await clientApi.put<{ data: TagDetail }>(
    `/api/v1/tags/${encodeURIComponent(tagId)}`,
    input,
    `tag-update-${tagId}`,
    { successMessage: "Tag updated." },
  );
  return response.data;
}

export async function deleteTag(tagId: string): Promise<void> {
  await clientApi.delete<{ data: { id: string; deleted: true } }>(
    `/api/v1/tags/${encodeURIComponent(tagId)}`,
    `tag-delete-${tagId}`,
    undefined,
    { successMessage: "Tag deleted." },
  );
}

export type BulkTagResult = { updatedIds: string[]; missingIds: string[] };

/** Re-scope or delete a selection in one transaction. */
export async function bulkTagAction(
  input:
    | { action: "set_visibility"; tagIds: string[]; visibility: TagVisibility }
    | { action: "delete"; tagIds: string[] },
): Promise<BulkTagResult> {
  const response = await clientApi.post<{ data: BulkTagResult }>(
    "/api/v1/tags/bulk",
    input,
    "tag-bulk",
  );
  return response.data;
}

/** The most tags one merge may fold away; mirrors `TAG_MERGE_SOURCE_LIMIT`. */
export const TAG_MERGE_SOURCE_LIMIT = 25;

export type MergeTagsResult = {
  sourceTagIds: string[];
  targetTagId: string;
  movedCourses: number;
  movedLessons: number;
  alreadyTagged: number;
};

/**
 * Fold every `sourceTagIds` entry into `targetTagId`, keeping all attachments.
 *
 * Plural in one call rather than a loop of pairwise calls: a duplicate cluster
 * is rarely a pair, and folding them one request at a time would leave a
 * half-merged vocabulary behind the first failure.
 */
export async function mergeTags(input: {
  sourceTagIds: string[];
  targetTagId: string;
}): Promise<MergeTagsResult> {
  const response = await clientApi.post<{ data: MergeTagsResult }>(
    "/api/v1/tags/merge",
    input,
    "tag-merge",
  );
  return response.data;
}

/**
 * The slug the server will derive from a title.
 *
 * Mirrors `slugifyTagTitle` so the edit panel can show what a rename will do to
 * the slug before it happens. The server remains the authority; this is a
 * preview, and it is labelled as one.
 */
export function slugifyTagTitle(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

export type TagAuditEntry = {
  id: string;
  occurredAt: string;
  action: string;
  actorMembershipId: string | null;
  metadata: Record<string, unknown> | null;
};

/**
 * What has happened to this one tag.
 *
 * The audit endpoint could already filter by target *type* — "what happened to
 * tags" — which is not the question a detail screen asks; the `targetId` filter
 * was added for this. It needs `audit.read`, which a tag editor may not hold,
 * so the caller treats a 403 as "no history panel" rather than an error.
 */
export async function fetchTagAudit(tagId: string, limit = 8): Promise<TagAuditEntry[]> {
  const params = new URLSearchParams({
    limit: String(limit),
    targetType: "tag",
    targetId: tagId,
  });
  const response = await clientApi.get<{ data: TagAuditEntry[] }>(
    `/api/v1/audit?${params.toString()}`,
  );
  return response.data;
}
