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
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
]);

function isAllowedLessonAssetMimeType(contentType: string): boolean {
  if (contentType.startsWith("audio/")) {
    return true;
  }

  return LESSON_ASSET_MIME_TYPES.has(contentType);
}

export function assertAllowedMimeType(args: { purpose: AssetPurpose; contentType: string }): void {
  const contentType = args.contentType.toLowerCase();

  if (contentType.startsWith("video/")) {
    throw new Error("SELF_HOSTED_VIDEO_FORBIDDEN");
  }

  if (
    args.purpose === "branding.logo" ||
    args.purpose === "branding.favicon" ||
    args.purpose === "branding.og-image"
  ) {
    if (!BRANDING_MIME_TYPES.has(contentType)) {
      throw new Error("UNSUPPORTED_BRANDING_ASSET_TYPE");
    }
    return;
  }

  if (args.purpose === "lesson.asset" || args.purpose === "lesson.attachment") {
    if (!isAllowedLessonAssetMimeType(contentType)) {
      throw new Error("UNSUPPORTED_LESSON_ASSET_TYPE");
    }
    return;
  }

  if (args.purpose === "lesson.thumbnail") {
    if (!BRANDING_MIME_TYPES.has(contentType)) {
      throw new Error("UNSUPPORTED_LESSON_THUMBNAIL_TYPE");
    }
    return;
  }

  if (args.purpose === "member.avatar") {
    if (contentType === "image/svg+xml" || !BRANDING_MIME_TYPES.has(contentType)) {
      throw new Error("UNSUPPORTED_AVATAR_TYPE");
    }
    return;
  }

  if (args.purpose === "module.scorm") {
    if (contentType !== "application/zip" && contentType !== "application/x-zip-compressed") {
      throw new Error("UNSUPPORTED_SCORM_PACKAGE_TYPE");
    }
    return;
  }

  if (args.purpose === "certificate.render") {
    if (contentType !== "application/pdf") {
      throw new Error("UNSUPPORTED_CERTIFICATE_RENDER_TYPE");
    }
    return;
  }

  if (args.purpose === "certificate.wallet") {
    if (contentType !== "application/vnd.apple.pkpass" && contentType !== "application/zip") {
      throw new Error("UNSUPPORTED_CERTIFICATE_WALLET_TYPE");
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
