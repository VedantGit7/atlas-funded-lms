import { describe, expect, it } from "vitest";
import { createElement } from "../../../frontend/apps/web/node_modules/react";
import { renderToStaticMarkup } from "../../../frontend/apps/web/node_modules/react-dom/server.node.js";
import {
  LessonVideoEmbed,
  canEmbedLessonVideo,
} from "../../../frontend/apps/web/src/features/lessons/lesson-video-embed";

/** Learners click the link an author typed: only an http(s) URL is ever rendered. */

const render = (provider: string, url: string) =>
  renderToStaticMarkup(createElement(LessonVideoEmbed, { provider, url }));

describe("lesson video embed", () => {
  it("links to a Bunny video over https", () => {
    const html = render("bunny", "https://video.bunnycdn.com/play/1/abc");
    expect(html).toContain('href="https://video.bunnycdn.com/play/1/abc"');
    expect(canEmbedLessonVideo("bunny", "https://video.bunnycdn.com/play/1/abc")).toBe(true);
  });

  it.each([
    "javascript:alert(1)",
    "java\tscript:alert(1)",
    "data:text/html,<script>alert(1)</script>",
  ])("renders nothing for %j", (url) => {
    expect(render("bunny", url)).toBe("");
    expect(canEmbedLessonVideo("bunny", url)).toBe(false);
  });

  it("embeds YouTube and Vimeo players by id only", () => {
    expect(render("youtube", "https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toContain(
      'src="https://www.youtube.com/embed/dQw4w9WgXcQ"',
    );
    expect(render("vimeo", "https://vimeo.com/76979871")).toContain(
      'src="https://player.vimeo.com/video/76979871"',
    );
  });
});
