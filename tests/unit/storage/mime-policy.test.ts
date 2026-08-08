import { describe, expect, it } from "vitest";
import { assertAllowedMimeType } from "@atlas/storage/mime-policy";

describe("assertAllowedMimeType", () => {
  describe("branding assets", () => {
    it.each([
      "image/png",
      "image/jpeg",
      "image/webp",
      "image/svg+xml",
      "image/x-icon",
      "image/vnd.microsoft.icon",
    ])("allows %s", (contentType) => {
      expect(() => assertAllowedMimeType({ purpose: "branding.logo", contentType })).not.toThrow();
    });

    it.each(["application/pdf", "application/zip", "video/mp4"])("rejects %s", (contentType) => {
      expect(() => assertAllowedMimeType({ purpose: "branding.logo", contentType })).toThrow();
    });
  });

  describe("lesson assets", () => {
    it.each([
      "application/pdf",
      "image/png",
      "image/jpeg",
      "image/webp",
      "text/plain",
      "text/csv",
      "application/zip",
      "audio/mpeg",
      "audio/wav",
      "audio/mp4",
      "application/vnd.ms-powerpoint",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ])("allows %s", (contentType) => {
      expect(() => assertAllowedMimeType({ purpose: "lesson.asset", contentType })).not.toThrow();
    });

    it.each(["video/mp4", "video/webm", "video/quicktime"])("rejects %s", (contentType) => {
      expect(() => assertAllowedMimeType({ purpose: "lesson.asset", contentType })).toThrow(
        "SELF_HOSTED_VIDEO_FORBIDDEN",
      );
    });

    it("rejects unsupported lesson asset types", () => {
      expect(() =>
        assertAllowedMimeType({ purpose: "lesson.asset", contentType: "application/octet-stream" }),
      ).toThrow("UNSUPPORTED_LESSON_ASSET_TYPE");
    });
  });

  describe("module scorm packages", () => {
    it.each(["application/zip", "application/x-zip-compressed"])("allows %s", (contentType) => {
      expect(() => assertAllowedMimeType({ purpose: "module.scorm", contentType })).not.toThrow();
    });

    it("rejects application/pdf", () => {
      expect(() =>
        assertAllowedMimeType({ purpose: "module.scorm", contentType: "application/pdf" }),
      ).toThrow("UNSUPPORTED_SCORM_PACKAGE_TYPE");
    });
  });

  describe("video rejection", () => {
    it.each([
      { purpose: "branding.logo" as const, contentType: "video/mp4" },
      { purpose: "lesson.asset" as const, contentType: "video/webm" },
      { purpose: "temp.upload" as const, contentType: "video/quicktime" },
    ])("returns SELF_HOSTED_VIDEO_FORBIDDEN for $contentType", ({ purpose, contentType }) => {
      expect(() => assertAllowedMimeType({ purpose, contentType })).toThrow(
        "SELF_HOSTED_VIDEO_FORBIDDEN",
      );
    });
  });
});
