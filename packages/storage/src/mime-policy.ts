import type { AssetPurpose } from "./schemas/storage-policy";

const BRANDING_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/svg+xml",
  "image/x-icon",
  "image/vnd.microsoft.icon",
]);

const LESSON_ASSET_MIME_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "text/plain",
  "text/csv",
  "application/zip",
]);

export function assertAllowedMimeType(args: { purpose: AssetPurpose; contentType: string }): void {
  const contentType = args.contentType.toLowerCase();

  if (contentType.startsWith("video/")) {
    throw new Error("SELF_HOSTED_VIDEO_FORBIDDEN");
  }

  if (args.purpose === "branding.logo" || args.purpose === "branding.favicon") {
    if (!BRANDING_MIME_TYPES.has(contentType)) {
      throw new Error("UNSUPPORTED_BRANDING_ASSET_TYPE");
    }
    return;
  }

  if (args.purpose === "lesson.asset" || args.purpose === "lesson.attachment") {
    if (!LESSON_ASSET_MIME_TYPES.has(contentType)) {
      throw new Error("UNSUPPORTED_LESSON_ASSET_TYPE");
    }
    return;
  }

  if (args.purpose === "temp.upload") {
    if (contentType.startsWith("video/")) {
      throw new Error("SELF_HOSTED_VIDEO_FORBIDDEN");
    }
    return;
  }

  if (contentType.startsWith("video/")) {
    throw new Error("SELF_HOSTED_VIDEO_FORBIDDEN");
  }
}
