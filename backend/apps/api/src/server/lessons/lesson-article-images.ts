import type { TenantTx } from "@atlas/db";
import { createLessonAssetDownload } from "@atlas/storage/lesson-asset.service";
import { findStorageReferenceById } from "./lesson-assets.repository";

/**
 * Images in an article (QA review 1 m19).
 *
 * Lesson files are private, and a download link works only for a short time,
 * so an article can't hold one. The Studio toolbar uploads an image to the
 * lesson and writes `![alt](asset:<id>)`; each time the lesson is opened the
 * reference is swapped for a fresh signed link. Only an image uploaded to
 * this same lesson is signed: a reference to any other file (another lesson's,
 * an export, a certificate) stays unresolved and shows as its alt text.
 */
const ASSET_IMAGE =
  /(!\[[^\]\n]*\]\()asset:([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(\))/gi;

/** The image references in an article, at most this many signed per lesson. */
const MAX_IMAGES = 50;

export function articleImageAssetIds(body: string): string[] {
  const ids = new Set<string>();
  for (const match of body.matchAll(ASSET_IMAGE)) {
    const id = match[2]?.toLowerCase();
    if (id) ids.add(id);
    if (ids.size >= MAX_IMAGES) break;
  }
  return [...ids];
}

export function replaceArticleImageAssets(body: string, urls: Map<string, string>): string {
  return body.replace(ASSET_IMAGE, (whole, open: string, id: string, close: string) => {
    const url = urls.get(id.toLowerCase());
    return url ? `${open}${url}${close}` : whole;
  });
}

export async function resolveArticleImages(
  tx: TenantTx,
  ctx: { tenantId: string },
  lessonId: string,
  body: string | null,
): Promise<string | null> {
  if (!body) return body;
  const ids = articleImageAssetIds(body);
  if (ids.length === 0) return body;

  const urls = new Map<string, string>();
  for (const id of ids) {
    try {
      const reference = await findStorageReferenceById({ tx, storageReferenceId: id });
      if (
        !reference ||
        reference.status !== "READY" ||
        reference.resourceId !== lessonId ||
        !reference.contentType.toLowerCase().startsWith("image/")
      ) {
        continue;
      }
      const signed = await createLessonAssetDownload(
        tx,
        { tenantId: ctx.tenantId },
        { assetReferenceId: id },
      );
      urls.set(id, signed.data.url);
    } catch {
      // An image that can't be signed shows as its alt text.
    }
  }
  return replaceArticleImageAssets(body, urls);
}
