import type { TenantTx } from "@atlas/db";
import { createLessonAssetDownload } from "@atlas/storage/lesson-asset.service";
import {
  type ResourceAssetRow,
  type ResourceKind,
  listLearnerResourceFacets,
  listLearnerResources,
} from "./resources.repository";
import type { ResourceItem, ResourceListQuery, ResourceListResponse } from "./schemas";

type ServiceCtx = {
  tenantId: string;
  actorMembershipId: string;
  requestId: string;
};

const KIND_ORDER: ResourceKind[] = ["pdf", "video", "link", "document"];

function decodeOffset(cursor: string | undefined): number {
  if (!cursor) return 0;
  try {
    const decoded = Number.parseInt(Buffer.from(cursor, "base64url").toString("utf8"), 10);
    return Number.isFinite(decoded) && decoded > 0 ? decoded : 0;
  } catch {
    return 0;
  }
}

function encodeOffset(offset: number): string {
  return Buffer.from(String(offset), "utf8").toString("base64url");
}

function splitCsv(value: string | undefined): string[] | null {
  if (!value) return null;
  const parts = value
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
  return parts.length > 0 ? parts : null;
}

/** Removes a single trailing file extension for display (keeps names like "v1.2" intact-ish). */
function stripExtension(name: string): string {
  return name.replace(/\.[a-z0-9]{1,5}$/i, "").trim() || name;
}

async function resolveAction(
  tx: TenantTx,
  ctx: ServiceCtx,
  row: ResourceAssetRow,
): Promise<{ href: string | null; external: boolean }> {
  if (row.provider === "r2") {
    try {
      const signed = await createLessonAssetDownload(
        tx,
        { tenantId: ctx.tenantId },
        { assetReferenceId: row.objectKeyOrUrl },
      );
      return { href: signed.data.url, external: false };
    } catch {
      return { href: null, external: false };
    }
  }

  if (/^https?:\/\//i.test(row.objectKeyOrUrl)) {
    return { href: row.objectKeyOrUrl, external: true };
  }

  return { href: null, external: false };
}

export async function listMyResources(
  tx: TenantTx,
  ctx: ServiceCtx,
  query: ResourceListQuery,
): Promise<ResourceListResponse> {
  const offset = decodeOffset(query.cursor);
  const limit = query.limit;

  const rows = await listLearnerResources({
    tx,
    membershipId: ctx.actorMembershipId,
    limit: limit + 1,
    offset,
    q: query.q ?? null,
    kinds: splitCsv(query.kinds),
    categories: splitCsv(query.categories),
    sort: query.sort,
  });

  const hasNextPage = rows.length > limit;
  const pageRows = hasNextPage ? rows.slice(0, limit) : rows;
  const total = rows[0]?.totalCount ?? 0;

  const items: ResourceItem[] = await Promise.all(
    pageRows.map(async (row) => {
      const action = await resolveAction(tx, ctx, row);
      const displayTitle = stripExtension(row.title);
      const description =
        row.lessonTitle && row.lessonTitle !== displayTitle ? row.lessonTitle : row.courseTitle;

      return {
        id: row.id,
        kind: row.kind,
        title: displayTitle,
        description,
        category: row.category,
        sizeBytes: row.sizeBytes != null ? Number(row.sizeBytes) : null,
        contentType: row.contentType,
        createdAt: row.createdAt.toISOString(),
        courseId: row.courseId,
        courseTitle: row.courseTitle,
        lessonId: row.lessonId,
        lessonTitle: row.lessonTitle,
        href: action.href,
        external: action.external,
      };
    }),
  );

  const facetRows = await listLearnerResourceFacets({ tx, membershipId: ctx.actorMembershipId });
  const categorySet = new Set<string>();
  const kindSet = new Set<ResourceKind>();
  for (const facet of facetRows) {
    if (facet.category && facet.category.trim().length > 0) categorySet.add(facet.category);
    kindSet.add(facet.kind);
  }

  return {
    data: {
      items,
      pageInfo: {
        nextCursor: hasNextPage ? encodeOffset(offset + limit) : null,
        hasNextPage,
      },
      facets: {
        categories: [...categorySet].sort((a, b) => a.localeCompare(b)),
        kinds: KIND_ORDER.filter((kind) => kindSet.has(kind)),
      },
      total,
    },
  };
}
