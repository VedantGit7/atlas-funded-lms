/**
 * An app page must not be able to load package files as its own subresources.
 *
 * `<script src="/api/v1/public/scorm/…/evil.js">` from a tenant snippet would
 * otherwise run author-uploaded code with the app origin's authority: the
 * sandbox header only isolates *documents*. Package documents' own requests
 * are cross-site (their origin is opaque), and the player's iframe load is a
 * navigation; an app page's script, style or fetch is a same-origin
 * subresource. Browsers that send no Fetch Metadata are allowed, so this is
 * defence in depth, not the boundary.
 */
export function isSameOriginSubresourceRequest(headers: {
  get(name: string): string | null;
}): boolean {
  const site = headers.get("sec-fetch-site");
  const destination = headers.get("sec-fetch-dest");
  return (
    site === "same-origin" &&
    destination !== null &&
    !["iframe", "frame", "document"].includes(destination)
  );
}
