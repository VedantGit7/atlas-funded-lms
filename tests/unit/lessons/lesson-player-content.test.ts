import { describe, expect, it } from "vitest";
import {
  buildPlayerContent,
  unwrapArticleBody,
  unwrapBodyText,
} from "../../../backend/apps/api/src/server/lessons/lesson-player-content";
import { lessonPlayerContentSchema } from "../../../backend/apps/api/src/server/lessons/lesson-schemas";

/**
 * QA review 1 C5/C23/C24, review 2 C1/C5/C7: learners saw lessons as code.
 * The player now gets a small typed object per lesson type, and article text
 * wrapped in {"body": …} by the old editors is unwrapped.
 */

const wrap = (text: string) => JSON.stringify({ body: text }, null, 2);

describe("unwrapBodyText", () => {
  it("keeps plain text as it is", () => {
    expect(unwrapBodyText("Hello **world**")).toBe("Hello **world**");
    expect(unwrapBodyText("")).toBe("");
  });

  it("peels one layer of the old editor's wrapping", () => {
    expect(unwrapBodyText(wrap("Risk management basics"))).toBe("Risk management basics");
  });

  it("peels many layers, one per old save", () => {
    let value = "Position sizing\n\n- one\n- two";
    for (let index = 0; index < 6; index += 1) value = wrap(value);
    expect(unwrapBodyText(value)).toBe("Position sizing\n\n- one\n- two");
  });

  it("peels leaked lesson content that carried a body", () => {
    expect(
      unwrapBodyText(JSON.stringify({ type: "text", body: "Real text", isPreview: false })),
    ).toBe("Real text");
  });

  it("returns null for leaked lesson content with no text inside", () => {
    expect(unwrapBodyText(JSON.stringify({ assessmentId: "abc" }))).toBeNull();
    expect(
      unwrapBodyText(wrap(JSON.stringify({ primaryAssetReferenceId: "x", discussionPostId: "y" }))),
    ).toBeNull();
  });

  it("keeps an article whose text really is a JSON sample", () => {
    const sample = '{"symbol": "EURUSD", "lots": 0.5}';
    expect(unwrapBodyText(sample)).toBe(sample);
    expect(unwrapBodyText(wrap(sample))).toBe(sample);
  });

  it("keeps text that only looks like JSON", () => {
    expect(unwrapBodyText("{not json}")).toBe("{not json}");
    expect(unwrapBodyText("[1, 2]")).toBe("[1, 2]");
    expect(unwrapBodyText("{}")).toBe("{}");
  });
});

describe("unwrapArticleBody", () => {
  it("returns null for empty or missing text", () => {
    expect(unwrapArticleBody(undefined)).toBeNull();
    expect(unwrapArticleBody(42)).toBeNull();
    expect(unwrapArticleBody("   ")).toBeNull();
    expect(unwrapArticleBody(wrap(""))).toBeNull();
  });

  it("returns the unwrapped text", () => {
    expect(unwrapArticleBody(wrap(wrap("Text")))).toBe("Text");
  });
});

describe("buildPlayerContent", () => {
  const internal = {
    discussionPostId: "11111111-1111-4111-8111-111111111111",
    primaryAssetReferenceId: "22222222-2222-4222-8222-222222222222",
    primaryAssetFileName: "deck.pdf",
    thumbnailAssetReferenceId: "33333333-3333-4333-8333-333333333333",
    features: { allowComments: true },
  };
  const build = (lessonType: string | null, contentJson: unknown, primaryFile = null) => {
    const content = buildPlayerContent({ lessonType, contentJson, primaryFile });
    expect(lessonPlayerContentSchema.parse(content)).toEqual(content);
    const json = JSON.stringify(content);
    for (const key of Object.keys(internal)) expect(json).not.toContain(key);
    return content;
  };

  it("builds an article with unwrapped text", () => {
    expect(build("article", { ...internal, body: wrap("Hello") })).toEqual({
      kind: "article",
      body: "Hello",
    });
  });

  it("treats text, mixed and unknown types as articles", () => {
    for (const type of ["text", "mixed", null, "something-else"]) {
      expect(build(type, { body: "x" }).kind).toBe("article");
    }
  });

  it("builds a quiz with its assessment id", () => {
    expect(build("section_quiz", { ...internal, assessmentId: " q-1 " })).toEqual({
      kind: "quiz",
      assessmentId: "q-1",
      body: null,
    });
    expect(build("quiz", {})).toEqual({ kind: "quiz", assessmentId: null, body: null });
  });

  it("builds a live class and drops unsafe join links", () => {
    expect(
      build("live", {
        live: {
          provider: "zoom",
          meetingUrl: "https://zoom.us/j/123",
          scheduledAt: "2026-12-30T18:00",
          instructions: "Bring a chart",
        },
      }),
    ).toEqual({
      kind: "live",
      live: {
        provider: "zoom",
        meetingUrl: "https://zoom.us/j/123",
        scheduledAt: "2026-12-30T18:00",
        instructions: "Bring a chart",
      },
      body: null,
    });

    const unsafe = build("live", {
      live: { provider: "skype", meetingUrl: "javascript:alert(1)" },
    });
    expect(unsafe).toEqual({
      kind: "live",
      live: { provider: null, meetingUrl: null, scheduledAt: null, instructions: null },
      body: null,
    });
    expect(build("live", {})).toEqual({ kind: "live", live: null, body: null });
  });

  it("builds file lessons with the signed file only", () => {
    const file = {
      name: "deck.pdf",
      url: "https://storage.example.com/signed",
      contentType: "application/pdf",
      expiresAt: "2026-11-21T12:00:00.000Z",
    };
    for (const type of ["pdf", "audio", "slides", "scorm"] as const) {
      const content = buildPlayerContent({
        lessonType: type,
        contentJson: internal,
        primaryFile: file,
      });
      expect(content).toEqual({ kind: "file", fileType: type, file, body: null });
    }
    expect(build("pdf", internal)).toEqual({
      kind: "file",
      fileType: "pdf",
      file: null,
      body: null,
    });
  });

  it("builds video and assignment lessons", () => {
    expect(build("video", { body: "Notes" })).toEqual({ kind: "video", body: "Notes" });
    expect(build("assignment", { body: wrap("Do it") })).toEqual({
      kind: "assignment",
      body: "Do it",
    });
  });

  it("copes with content that is not an object", () => {
    expect(build("article", null)).toEqual({ kind: "article", body: null });
    expect(build("article", ["x"])).toEqual({ kind: "article", body: null });
    expect(build("article", "text")).toEqual({ kind: "article", body: null });
  });
});
