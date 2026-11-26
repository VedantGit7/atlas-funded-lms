/**
 * The name shown for a lesson attachment (QA review 1 m30: link attachments
 * were labelled just "link"). A file shows its file name; a link shows the
 * title it was given, else its address without the "https://www." prefix.
 */
export function lessonAssetLabel(asset: {
  assetType: string;
  fileName?: string | null;
  externalUrl?: string | null;
}): string {
  const name = asset.fileName?.trim();
  if (name) return name;
  if (asset.externalUrl) {
    try {
      const url = new URL(asset.externalUrl);
      const path = url.pathname === "/" ? "" : url.pathname.replace(/\/$/, "");
      const label = `${url.hostname.replace(/^www\./, "")}${path}`;
      return label.length > 60 ? `${label.slice(0, 57)}…` : label;
    } catch {
      return asset.externalUrl;
    }
  }
  return asset.assetType === "link" ? "Link" : "Attachment";
}
