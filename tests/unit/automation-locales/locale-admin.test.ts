import { describe, expect, it } from "vitest";
import {
  buildImportPreview,
  extractPlaceholders,
  runLocaleQaChecks,
} from "../../../backend/apps/api/src/server/locales/locale.qa";

describe("locale QA engine", () => {
  it("extracts unique placeholders", () => {
    expect(extractPlaceholders("Hello {name}, you have {count} messages")).toEqual([
      "{count}",
      "{name}",
    ]);
  });

  it("detects missing keys and placeholder mismatches", () => {
    const issues = runLocaleQaChecks({
      canonicalKeys: ["welcome.title", "welcome.body"],
      sourceLocale: "en",
      sourceValues: new Map([
        ["welcome.title", "Hello {name}"],
        ["welcome.body", "Body copy"],
      ]),
      localeValuesByLocale: new Map([
        ["en", new Map([
          ["welcome.title", "Hello {name}"],
          ["welcome.body", "Body copy"],
        ])],
        ["fr", new Map([
          ["welcome.title", "Bonjour"],
        ])],
      ]),
      targetLocales: ["en", "fr"],
    });

    expect(issues.some((issue) => issue.issue_type === "missing_key" && issue.key === "welcome.body")).toBe(
      true,
    );
    expect(
      issues.some((issue) => issue.issue_type === "placeholder_mismatch" && issue.key === "welcome.title"),
    ).toBe(true);
  });
});

describe("locale import preview", () => {
  it("classifies add, update, and unchanged entries", () => {
    const preview = buildImportPreview({
      locale: "fr",
      incoming: [
        { key: "welcome.title", value: "Bonjour" },
        { key: "welcome.footer", value: "Footer" },
      ],
      existing: new Map([["welcome.title", "Salut"]]),
    });

    expect(preview.summary).toEqual({ add: 1, update: 1, unchanged: 0 });
    expect(preview.entries.map((entry) => entry.action)).toEqual(["update", "add"]);
  });
});
