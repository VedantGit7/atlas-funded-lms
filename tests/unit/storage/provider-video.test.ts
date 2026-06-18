import { describe, expect, it } from "vitest";
import { validateProviderVideoRef } from "@atlas/storage/provider-video.service";

describe("validateProviderVideoRef", () => {
  it("accepts YouTube URL for youtube provider", () => {
    expect(
      validateProviderVideoRef({
        provider: "youtube",
        url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      }),
    ).toEqual({
      provider: "youtube",
      url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    });
  });

  it("accepts Vimeo URL for vimeo provider", () => {
    expect(
      validateProviderVideoRef({
        provider: "vimeo",
        url: "https://vimeo.com/123456789",
      }),
    ).toEqual({
      provider: "vimeo",
      url: "https://vimeo.com/123456789",
    });
  });

  it("accepts Bunny URL for bunny provider", () => {
    expect(
      validateProviderVideoRef({
        provider: "bunny",
        url: "https://vz-abc123.b-cdn.net/playlist.m3u8",
      }),
    ).toEqual({
      provider: "bunny",
      url: "https://vz-abc123.b-cdn.net/playlist.m3u8",
    });
  });

  it("rejects mismatched host", () => {
    expect(() =>
      validateProviderVideoRef({
        provider: "youtube",
        url: "https://vimeo.com/123456789",
      }),
    ).toThrow("VIDEO_PROVIDER_HOST_MISMATCH");
  });

  it.each([
    "https://cdn.example.com/lesson.mp4",
    "https://cdn.example.com/lesson.mov",
    "https://cdn.example.com/lesson.webm",
  ])("rejects direct video file URL %s", (url) => {
    expect(() =>
      validateProviderVideoRef({
        provider: "youtube",
        url,
      }),
    ).toThrow("SELF_HOSTED_VIDEO_FORBIDDEN");
  });
});
