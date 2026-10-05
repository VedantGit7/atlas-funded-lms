/**
 * How an uploaded object may be presented by a browser (audit M8).
 *
 * Raster images, audio and PDF are safe to show inline. Anything else an author
 * or member uploads (SVG, text, CSV, archives, slides) is served as a download,
 * so a browser never renders it as a document in the origin that serves it.
 * `<img>`, `<link rel="icon">` and CSS ignore Content-Disposition, so an SVG
 * logo still displays everywhere it is used as an image.
 *
 * The disposition is signed into the upload URL (the stored object carries it
 * from the moment it is written, before any confirm step), set again when the
 * server rewrites an object, and requested as a response override on signed
 * downloads so objects stored before this change are covered too.
 */

const INLINE_SAFE_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/x-icon",
  "image/vnd.microsoft.icon",
  "application/pdf",
]);

export function isInlineSafeContentType(contentType: string): boolean {
  const type = contentType.toLowerCase().split(";")[0]?.trim() ?? "";
  return INLINE_SAFE_TYPES.has(type) || type.startsWith("audio/");
}

/** A filename that cannot break out of the header value. */
function headerSafeFileName(fileName: string): string {
  const base = fileName.split(/[\\/]/).pop() ?? "download";
  const ascii = base
    .replace(/[^\x20-\x7e]/g, "_")
    .replace(/["\\]/g, "_")
    .trim();
  return ascii.length > 0 ? ascii.slice(0, 200) : "download";
}

/** `attachment; filename=…` for types that must not render inline; null for inline-safe ones. */
export function contentDispositionFor(contentType: string, fileName: string): string | null {
  if (isInlineSafeContentType(contentType)) return null;
  const safe = headerSafeFileName(fileName);
  return `attachment; filename="${safe}"; filename*=UTF-8''${encodeURIComponent(
    fileName.split(/[\\/]/).pop() ?? safe,
  )}`;
}
