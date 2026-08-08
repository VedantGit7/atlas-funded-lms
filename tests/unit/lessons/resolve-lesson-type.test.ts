import { describe, expect, it } from "vitest";
import { resolveLessonType } from "../../../backend/apps/api/src/server/lessons/lessons.repository";

describe("resolveLessonType", () => {
  it("reads stored type from content_json object", () => {
    expect(
      resolveLessonType({
        contentJson: { type: "pdf" },
      }),
    ).toBe("pdf");
  });

  it("parses stringified content_json", () => {
    expect(
      resolveLessonType({
        contentJson: JSON.stringify({ type: "video" }),
      }),
    ).toBe("video");
  });

  it("infers video from video_url", () => {
    expect(
      resolveLessonType({
        contentJson: null,
        videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      }),
    ).toBe("video");
  });

  it("infers pdf from uploaded asset filename", () => {
    expect(
      resolveLessonType({
        contentJson: { primaryAssetReferenceId: "asset-1" },
        assetFileHint: "chapter-1.pdf",
      }),
    ).toBe("pdf");
  });

  it("infers audio from asset filename when type is missing", () => {
    expect(
      resolveLessonType({
        contentJson: null,
        assetFileHint: "intro-track.mp3",
      }),
    ).toBe("audio");
  });
});
