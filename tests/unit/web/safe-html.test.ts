import { describe, expect, it } from "vitest";
import { sanitizeHtml } from "../../../frontend/apps/web/src/lib/sanitize-html";

/**
 * Regression tests for audit finding H1.
 *
 * The repository contained NO HTML sanitizer — no DOMPurify, no sanitize-html —
 * while eight `dangerouslySetInnerHTML` sites rendered author-controlled HTML,
 * two of them on public unauthenticated pages.
 */

describe("sanitizeHtml — rich variant", () => {
  it.each([
    ["<script>alert(1)</script>", "script tag"],
    ['<img src=x onerror="alert(1)">', "event handler"],
    ['<a href="javascript:alert(1)">x</a>', "javascript: URL"],
    ['<iframe src="https://evil.example"></iframe>', "iframe"],
    ['<object data="evil.swf"></object>', "object"],
    ['<embed src="evil.swf">', "embed"],
    ['<form action="https://evil.example"><input name="a"></form>', "form"],
    ["<svg><script>alert(1)</script></svg>", "svg script"],
  ])("strips %s", (input) => {
    const clean = sanitizeHtml(input);
    expect(clean).not.toMatch(/<script/i);
    expect(clean).not.toMatch(/onerror|onload|onclick/i);
    expect(clean).not.toMatch(/javascript:/i);
    expect(clean).not.toMatch(/<iframe|<object|<embed|<form/i);
  });

  it("keeps legitimate formatting", () => {
    const clean = sanitizeHtml("<p>Hello <strong>world</strong> and <em>friends</em></p>");
    expect(clean).toContain("<strong>world</strong>");
    expect(clean).toContain("<em>friends</em>");
  });

  it("keeps ordinary links", () => {
    expect(sanitizeHtml('<a href="https://example.com">x</a>')).toContain("https://example.com");
  });
});

describe("sanitizeHtml — inline variant", () => {
  it("keeps only simple inline markup", () => {
    const clean = sanitizeHtml("<p>ok <b>bold</b></p><div>block</div><script>x</script>", "inline");
    expect(clean).toContain("<b>bold</b>");
    expect(clean).not.toMatch(/<script/i);
    expect(clean).not.toMatch(/<div/i);
  });
});

describe("sanitizeHtml — svg variant", () => {
  it("keeps QR-style SVG markup", () => {
    const clean = sanitizeHtml('<svg viewBox="0 0 2 2"><rect width="1" height="1"/></svg>', "svg");
    expect(clean).toContain("<svg");
    expect(clean).toContain("rect");
  });

  it("strips script and handlers from SVG", () => {
    const clean = sanitizeHtml(
      '<svg onload="alert(1)"><script>alert(1)</script><rect/></svg>',
      "svg",
    );
    expect(clean).not.toMatch(/<script/i);
    expect(clean).not.toMatch(/onload/i);
  });
});
