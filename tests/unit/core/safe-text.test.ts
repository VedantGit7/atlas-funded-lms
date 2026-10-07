import { describe, expect, it } from "vitest";
import { isHttpUrl, isHttpUrlOrRootPath, toPlainText } from "@atlas/core/text/safe-text";

/**
 * The shared plain-text and link checks that replaced one-pass cleaners CodeQL
 * flagged: removal must not assemble new markup, and a link check must read
 * the scheme the way a browser does.
 */

describe("toPlainText", () => {
  it.each([
    ["<b>Bold</b> text", "Bold text"],
    // Leftover text is harmless; what matters is that no tag can re-form.
    ["<scr<b>ipt>alert(1)</scr</b>ipt>", "ipt>alert(1)ipt>"],
    ["<<a href=x>y", "y"],
    ["javajavascript:script:alert(1)", "alert(1)"],
    ["JaVaScRiPt:alert(1)", "alert(1)"],
    ["<!-- hidden -->text", "text"],
    ["<script", "script"],
  ])("leaves no markup in %j", (input, expected) => {
    const output = toPlainText(input);
    expect(output).toBe(expected);
    expect(output).not.toMatch(/<[!/?a-z]/i);
    expect(output).not.toMatch(/javascript:/i);
  });

  it("keeps ordinary text, including a < that cannot open a tag", () => {
    expect(toPlainText("  Score a < b and <5 attempts  ")).toBe("Score a < b and <5 attempts");
  });
});

describe("isHttpUrl", () => {
  it.each(["https://example.com/x", "http://example.com", "HTTPS://EXAMPLE.COM/"])(
    "accepts %s",
    (url) => expect(isHttpUrl(url)).toBe(true),
  );

  it.each([
    "javascript:alert(1)",
    "java\tscript:alert(1)",
    "java\nscript:alert(1)",
    " \u0001javascript:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "vbscript:msgbox(1)",
    "/relative/path",
    "not a url",
  ])("refuses %j", (url) => expect(isHttpUrl(url)).toBe(false));
});

describe("isHttpUrlOrRootPath", () => {
  it.each(["/brand/logo.svg", "https://cdn.example.com/logo.png"])("accepts %s", (value) =>
    expect(isHttpUrlOrRootPath(value)).toBe(true),
  );

  it.each([
    "//evil.example/logo.png",
    "/\\evil.example/logo.png",
    "/\t/evil.example/logo.png",
    "javascript:alert(1)",
    "data:image/svg+xml,<svg onload=alert(1)>",
  ])("refuses %j", (value) => expect(isHttpUrlOrRootPath(value)).toBe(false));
});
