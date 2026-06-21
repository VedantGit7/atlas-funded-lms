import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const webRoot = resolve(import.meta.dirname, "../../apps/web/src");

const moderationPages = [
  "app/(moderation)/moderate/cases/page.tsx",
  "app/(moderation)/moderate/cases/[id]/page.tsx",
  "app/(moderation)/moderate/appeals/page.tsx",
  "app/(moderation)/moderate/spaces/page.tsx",
];

describe("moderation page authorization patterns", () => {
  for (const relativePath of moderationPages) {
    it(`${relativePath} handles denied auth states`, () => {
      const source = readFileSync(resolve(webRoot, relativePath), "utf8");
      expect(source).toMatch(/ServerApiError|PageGate/);
      expect(source).toMatch(/401|403|denied|not_found|ENTITLEMENT_REQUIRED/);
    });
  }

  it("M2 uses approved case detail read via list selector", () => {
    const source = readFileSync(
      resolve(webRoot, "app/(moderation)/moderate/cases/[id]/page.tsx"),
      "utf8",
    );
    expect(source).toContain("/api/v1/moderation/cases?caseId=");
    expect(source).not.toMatch(/moderation\/cases\/\$\{id\}|moderation\/cases\/:id/);
  });

  it("M3 uses approved appeals projection without GET /appeals", () => {
    const source = readFileSync(
      resolve(webRoot, "app/(moderation)/moderate/appeals/page.tsx"),
      "utf8",
    );
    expect(source).toContain("/api/v1/moderation/cases?view=appeals");
    expect(source).not.toContain("/api/v1/appeals");
  });

  it("moderation shell gate blocks nav before membership resolves", () => {
    const source = readFileSync(
      resolve(webRoot, "components/shells/ModerationShellGate.tsx"),
      "utf8",
    );
    expect(source).toContain("loadModerationShellContext");
    expect(source).toContain("membership_blocked");
    expect(source).toContain("entitlement_blocked");
    expect(source).not.toMatch(/role\.name|membership\.role/);
  });
});

describe("moderation shell component expectations", () => {
  it("includes required nav destinations without forbidden links", () => {
    const navSource = readFileSync(
      resolve(webRoot, "features/moderation/moderation-navigation.ts"),
      "utf8",
    );
    const shellSource = readFileSync(
      resolve(webRoot, "components/shells/ModerationShellClient.tsx"),
      "utf8",
    );

    for (const href of ["/moderate/cases", "/moderate/appeals", "/moderate/spaces", "/review"]) {
      expect(navSource).toContain(`"${href}"`);
    }

    expect(navSource + shellSource).not.toMatch(/\/admin|\/platform|\/moderate\/audit/);
    expect(shellSource).not.toContain('href="/community"');
    expect(shellSource).toContain('aria-label="Moderation sidebar"');
    expect(shellSource).toContain('aria-label="Mobile moderation navigation"');
  });

  it("M2 does not expose foreign content body editor", () => {
    const source = readFileSync(
      resolve(webRoot, "features/moderation/components/ModerationCaseDetailClient.tsx"),
      "utf8",
    );
    expect(source).not.toMatch(/PUT.*posts|comment body|post body|dangerouslySetInnerHTML/);
    expect(source).toContain("Decision history");
  });

  it("M3 surfaces self-review unavailable state", () => {
    const source = readFileSync(
      resolve(webRoot, "features/moderation/components/AppealsReviewClient.tsx"),
      "utf8",
    );
    expect(source).toContain("isAppealSelfReviewBlocked");
    expect(source).toContain("You cannot review your own appeal");
  });
});
