import { describe, expect, it } from "vitest";
import { createElement } from "../../../frontend/apps/web/node_modules/react";
import { renderToStaticMarkup } from "../../../frontend/apps/web/node_modules/react-dom/server.node.js";
import {
  ArticleMarkdown,
  parseArticleBlocks,
  safeHref,
} from "../../../frontend/apps/web/src/features/lessons/article-markdown";
import {
  LessonBody,
  LiveSessionCard,
} from "../../../frontend/apps/web/src/features/lessons/lesson-body";
import { articleTextOf } from "../../../frontend/apps/web/src/features/studio/courses/inline-lesson-editor/lesson-article-workspace";

/**
 * The lesson body learners and the Studio preview see (QA review 1 C5, C23,
 * C24; review 2 C1, C5, C7): each lesson type has its own view, articles are
 * formatted, and no raw data or author HTML is ever shown.
 */

const markdown = (text: string) => renderToStaticMarkup(createElement(ArticleMarkdown, { text }));
const body = (content: Parameters<typeof LessonBody>[0]["content"], extra = {}) =>
  renderToStaticMarkup(createElement(LessonBody, { title: "Lesson", content, ...extra }));

describe("article markdown", () => {
  it("formats headings, lists, emphasis, code and links", () => {
    const html = markdown(
      [
        "# Risk",
        "Use **stops** and *patience*, see `ATR`.",
        "",
        "- one",
        "- two",
        "",
        "1. first",
        "2. second",
        "",
        "```",
        "let x = 1;",
        "```",
        "[Docs](https://example.com/docs)",
      ].join("\n"),
    );
    expect(html).toContain("<h2");
    expect(html).toContain("<strong");
    expect(html).toContain("<em>patience</em>");
    expect(html).toContain("<code");
    expect(html).toContain("<ul");
    expect(html).toContain("<ol");
    expect(html).toContain("<pre");
    expect(html).toContain('href="https://example.com/docs"');
    expect(html).toContain('rel="noopener noreferrer"');
  });

  it("never renders author HTML", () => {
    const html = markdown('<script>alert(1)</script><img src=x onerror="alert(2)">');
    expect(html).not.toContain("<script");
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;script&gt;");
  });

  it.each(["javascript:alert(1)", "data:text/html,x", "vbscript:x", "/relative"])(
    "shows %s links as plain text",
    (url) => {
      expect(safeHref(url)).toBeNull();
      const html = markdown(`[click](${url})`);
      expect(html).not.toContain("<a");
      expect(html).toContain("click");
    },
  );

  it("keeps brackets inside a link's address", () => {
    const html = markdown("See [Wiki](https://en.wikipedia.org/wiki/Risk_(finance)) now.");
    expect(html).toContain('href="https://en.wikipedia.org/wiki/Risk_(finance)"');
    expect(html).toContain("</a> now.");
    const unsafe = markdown("Unsafe [link](javascript:alert(1)) stays text.");
    expect(unsafe).not.toContain("<a");
    expect(unsafe).toContain("Unsafe link stays text.");
  });

  it("keeps line breaks inside a paragraph", () => {
    expect(parseArticleBlocks("a\nb\n\nc")).toEqual([
      { kind: "paragraph", lines: ["a", "b"] },
      { kind: "paragraph", lines: ["c"] },
    ]);
  });
});

describe("lesson body by type", () => {
  it("shows an article as text, not JSON", () => {
    const html = body({ kind: "article", body: "Hello **there**" });
    expect(html).toContain("<strong");
    expect(html).not.toContain("{");
  });

  it("says so when a lesson has no content", () => {
    expect(body(null)).toContain("This lesson has no content yet.");
    expect(body({ kind: "article", body: null })).toContain("This lesson has no content yet.");
  });

  it("shows the video without the empty-content message", () => {
    const html = body(
      { kind: "article", body: null },
      { videoProvider: "youtube", videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" },
    );
    expect(html).toContain("youtube");
    expect(html).not.toContain("no content");
  });

  it("offers a quiz start button", () => {
    const html = body({ kind: "quiz", assessmentId: "a-1", body: null });
    expect(html).toContain("Start quiz");
    expect(html).toContain('href="/assessments/a-1"');
    expect(body({ kind: "quiz", assessmentId: null, body: null })).toContain("isn&#x27;t ready");
  });

  const classAt = Date.parse("2026-12-30T18:00:00Z");
  const live = (now: number, overrides = {}) =>
    renderToStaticMarkup(
      createElement(LiveSessionCard, {
        now,
        live: {
          provider: "zoom",
          meetingUrl: "https://zoom.us/j/1",
          scheduledAt: "2026-12-30T18:00:00Z",
          instructions: "Bring a chart",
          ...overrides,
        },
      }),
    );

  it("shows the class time only in the browser, so locales never clash", () => {
    const html = body({
      kind: "live",
      live: {
        provider: "zoom",
        meetingUrl: "https://zoom.us/j/1",
        scheduledAt: "2026-12-30T18:00:00Z",
        instructions: null,
      },
      body: null,
    });
    expect(html).toContain("Loading the class time");
    expect(html).not.toContain("2026");
    expect(html).not.toContain("Join live class");
  });

  it("shows a live class with its time and a join link once open", () => {
    const html = live(classAt - 10 * 60_000);
    expect(html).toContain("Live class");
    expect(html).toContain("2026");
    expect(html).toContain("Zoom");
    expect(html).toContain("Bring a chart");
    expect(html).toContain("Join live class");
    expect(html).toContain('href="https://zoom.us/j/1"');
  });

  it("holds the join link until 15 minutes before the class", () => {
    const html = live(classAt - 16 * 60_000, { provider: "teams" });
    expect(html).toContain("Microsoft Teams");
    expect(html).not.toContain("Join live class");
    expect(html).toContain("opens 15 minutes before");
  });

  it("shows a time without a zone exactly as written", () => {
    expect(live(classAt, { scheduledAt: "2026-12-30T18:00" })).toMatch(/6:00|18:00/);
  });

  it("says when the time or link is missing", () => {
    const html = live(classAt, { scheduledAt: null, meetingUrl: null });
    expect(html).toContain("hasn&#x27;t been set yet");
    expect(html).toContain("The join link will appear here.");
  });

  const file = {
    name: "notes.pdf",
    url: "https://storage.example.com/signed",
    contentType: "application/pdf",
    expiresAt: null,
  };

  it("shows a PDF in a frame", () => {
    const html = body({ kind: "file", fileType: "pdf", file, body: null });
    expect(html).toContain("<iframe");
    expect(html).toContain("Open in a new tab");
  });

  it("plays audio", () => {
    const html = body({
      kind: "file",
      fileType: "audio",
      file: { ...file, name: "talk.mp3", contentType: "audio/mpeg" },
      body: null,
    });
    expect(html).toContain("<audio");
  });

  it("offers slide decks as a download", () => {
    const html = body({
      kind: "file",
      fileType: "slides",
      file: {
        ...file,
        name: "deck.pptx",
        contentType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      },
      body: null,
    });
    expect(html).toContain("Download slides");
    expect(html).not.toContain("<iframe");
  });

  it("says so when the file is missing", () => {
    expect(body({ kind: "file", fileType: "pdf", file: null, body: null })).toContain(
      "isn&#x27;t available yet",
    );
  });

  it("shows assignment instructions or says there are none", () => {
    expect(body({ kind: "assignment", body: "Write a plan" })).toContain("Write a plan");
    expect(body({ kind: "assignment", body: null })).toContain("no instructions yet");
  });
});

describe("article editor text", () => {
  it("edits the article's text, never its JSON", () => {
    expect(articleTextOf({ body: "Hello" })).toBe("Hello");
    expect(articleTextOf("Hello")).toBe("Hello");
    expect(articleTextOf({ assessmentId: "x" })).toBe("");
    expect(articleTextOf(null)).toBe("");
    expect(articleTextOf(["x"])).toBe("");
  });
});
