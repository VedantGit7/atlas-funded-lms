import { describe, expect, it } from "vitest";
import {
  formatLessonDuration,
  outlineProgressLabel,
  withLessonStatus,
  type LearnerCourseOutline,
} from "../../../frontend/apps/web/src/features/lessons/course-outline-model";
import {
  parseArticleBlocks,
  safeImageSrc,
  tableCells,
} from "../../../frontend/apps/web/src/features/lessons/article-markdown";
import {
  TABLE_TEMPLATE,
  imageMarkdown,
  insertBlock,
  insertLink,
  prefixLines,
  wrapSelection,
} from "../../../frontend/apps/web/src/features/studio/courses/inline-lesson-editor/markdown-edit";

/** QA remediation S3.1: lesson player outline (m41, H20) and article editor (m19). */

const lessonA = "018f0000-0000-7000-8000-0000000000a1";
const lessonB = "018f0000-0000-7000-8000-0000000000b2";

function outline(): LearnerCourseOutline {
  return {
    courseId: "018f0000-0000-7000-8000-0000000000c0",
    modules: [
      {
        id: "018f0000-0000-7000-8000-0000000000d0",
        title: "Basics",
        position: 1,
        contentKind: "standard",
        lessons: [
          {
            id: lessonA,
            title: "A",
            position: 1,
            durationSeconds: 300,
            lessonType: "article",
            status: "completed",
          },
          {
            id: lessonB,
            title: "B",
            position: 2,
            durationSeconds: null,
            lessonType: "video",
            status: "in_progress",
          },
        ],
      },
    ],
    completedLessons: 1,
    totalLessons: 3,
    progressPct: 33,
    resumeLessonId: lessonB,
  };
}

describe("lesson player outline", () => {
  it("updates the tick and the course totals when the open lesson is completed", () => {
    const next = withLessonStatus(outline(), lessonB, "completed");
    expect(next.modules[0]?.lessons[1]?.status).toBe("completed");
    expect(next.completedLessons).toBe(2);
    expect(next.progressPct).toBe(67);
    expect(outlineProgressLabel(next)).toBe("2 of 3 lessons done");
  });

  it("leaves the totals alone when the status doesn't change or the lesson isn't listed", () => {
    expect(withLessonStatus(outline(), lessonA, "completed").completedLessons).toBe(1);
    expect(withLessonStatus(outline(), "not-listed", "completed").completedLessons).toBe(1);
  });

  it("formats lesson lengths for the outline", () => {
    expect(formatLessonDuration(null)).toBeNull();
    expect(formatLessonDuration(20)).toBe("1 min");
    expect(formatLessonDuration(420)).toBe("7 min");
    expect(formatLessonDuration(3900)).toBe("1 h 5 min");
    expect(formatLessonDuration(7200)).toBe("2 h");
  });
});

describe("article text the learner sees", () => {
  it("reads a table with its header, alignment and rows, padding short rows", () => {
    const blocks = parseArticleBlocks(
      [
        "| Setup | Risk | Target |",
        "| :--- | :---: | ---: |",
        "| Breakout | 1% | 2R |",
        "| Pullback | 0.5% |",
      ].join("\n"),
    );
    expect(blocks).toEqual([
      {
        kind: "table",
        header: ["Setup", "Risk", "Target"],
        align: ["left", "center", "right"],
        rows: [
          ["Breakout", "1%", "2R"],
          ["Pullback", "0.5%", ""],
        ],
      },
    ]);
  });

  it("keeps an escaped bar inside a table cell", () => {
    expect(tableCells("| a \\| b | c |")).toEqual(["a | b", "c"]);
  });

  it("does not read a lone row of bars as a table", () => {
    expect(parseArticleBlocks("| not | a table |")[0]?.kind).toBe("paragraph");
  });

  it("reads an image on its own line, quotes and dividers", () => {
    const blocks = parseArticleBlocks(
      [
        "Intro",
        "",
        "![Daily chart](https://cdn.example/chart.png)",
        "> Cut losses",
        "> early",
        "---",
        "After",
      ].join("\n"),
    );
    expect(blocks.map((block) => block.kind)).toEqual([
      "paragraph",
      "image",
      "quote",
      "rule",
      "paragraph",
    ]);
    expect(blocks[1]).toEqual({
      kind: "image",
      alt: "Daily chart",
      src: "https://cdn.example/chart.png",
    });
    expect(blocks[2]).toEqual({ kind: "quote", lines: ["Cut losses", "early"] });
  });

  it("still reads a dashed list item as a list, not a divider", () => {
    expect(parseArticleBlocks("- one\n- two")[0]).toEqual({
      kind: "list",
      ordered: false,
      items: ["one", "two"],
    });
  });

  it("loads images only from web addresses", () => {
    expect(safeImageSrc("https://cdn.example/a.png")).toBe("https://cdn.example/a.png");
    expect(safeImageSrc("asset:018f0000-0000-7000-8000-0000000000a1")).toBeNull();
    expect(safeImageSrc("javascript:alert(1)")).toBeNull();
    expect(safeImageSrc("data:image/png;base64,AAAA")).toBeNull();
  });
});

describe("article toolbar edits", () => {
  it("wraps the selection, or a placeholder when nothing is selected", () => {
    expect(wrapSelection("buy low", 0, 3, "**", "bold text")).toEqual({
      value: "**buy** low",
      start: 2,
      end: 5,
    });
    expect(wrapSelection("", 0, 0, "*", "italic text").value).toBe("*italic text*");
  });

  it("turns whole lines into headings, replacing an existing heading mark", () => {
    expect(prefixLines("Intro\n### Old", 6, 13, "h2").value).toBe("Intro\n# Old");
    expect(prefixLines("Section", 3, 3, "h3").value).toBe("## Section");
  });

  it("numbers selected lines and quotes them", () => {
    expect(prefixLines("a\n- b\nc", 0, 7, "numbered").value).toBe("1. a\n2. b\n3. c");
    expect(prefixLines("one\ntwo", 0, 7, "quote").value).toBe("> one\n> two");
  });

  it("puts a table on its own lines and selects the first header to rename", () => {
    const value = "Text";
    const result = insertBlock(value, 4, 4, TABLE_TEMPLATE, "Column 1");
    expect(result.value).toBe(`Text\n\n${TABLE_TEMPLATE}\n`);
    expect(result.value.slice(result.start, result.end)).toBe("Column 1");
  });

  it("doesn't add extra blank lines when there already are some", () => {
    expect(insertBlock("A\n\nB", 3, 3, "---").value).toBe("A\n\n---\n\nB");
  });

  it("inserts a link with its address selected", () => {
    const result = insertLink("See docs", 4, 8);
    expect(result.value).toBe("See [docs](https://)");
    expect(result.value.slice(result.start, result.end)).toBe("https://");
  });

  it("writes image Markdown that stays valid whatever the description", () => {
    expect(imageMarkdown("Chart [daily]", "asset:abc")).toBe("![Chart  daily](asset:abc)");
  });
});
