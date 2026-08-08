import type { AssetPurpose } from "./schemas/storage-policy";
import type { StorageEnv } from "./schemas/storage-env";

export function assertAllowedSize(args: {
  purpose: AssetPurpose;
  sizeBytes: number;
  env: Pick<StorageEnv, "STORAGE_MAX_BRANDING_ASSET_BYTES" | "STORAGE_MAX_LESSON_ASSET_BYTES">;
}): void {
  const max =
    args.purpose === "branding.logo" ||
    args.purpose === "branding.favicon" ||
    args.purpose === "branding.og-image" ||
    args.purpose === "lesson.thumbnail" ||
    args.purpose === "member.avatar"
      ? args.env.STORAGE_MAX_BRANDING_ASSET_BYTES
      : args.purpose === "lesson.asset" || args.purpose === "lesson.attachment"
        ? args.env.STORAGE_MAX_LESSON_ASSET_BYTES
        : args.purpose === "module.scorm"
          ? args.env.STORAGE_MAX_LESSON_ASSET_BYTES
          : args.env.STORAGE_MAX_LESSON_ASSET_BYTES;

  if (args.sizeBytes > max) {
    throw new Error("ASSET_SIZE_LIMIT_EXCEEDED");
  }
}
