import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const webRoot = resolve(import.meta.dirname, "../../apps/web/src");

const moderationPaths = [
  "app/(moderation)/layout.tsx",
  "app/(moderation)/moderate/cases/page.tsx",
  "app/(moderation)/moderate/cases/[id]/page.tsx",
  "app/(moderation)/moderate/appeals/page.tsx",
  "app/(moderation)/moderate/spaces/page.tsx",
  "app/api/v1/moderation/cases/route.ts",
  "app/api/v1/moderation/cases/[id]/decide/route.ts",
  "app/api/v1/appeals/route.ts",
  "app/api/v1/appeals/[id]/review/route.ts",
  "app/api/v1/posts/[id]/route.ts",
  "components/shells/ModerationShell.tsx",
  "components/shells/ModerationShellGate.tsx",
  "components/shells/ModerationShellClient.tsx",
  "features/moderation/moderation-navigation.ts",
  "features/moderation/moderation-route-registry.ts",
  "server/moderation/moderation.service.ts",
  "features/moderation/components/ModerationQueueClient.tsx",
  "features/moderation/components/ModerationCaseDetailClient.tsx",
  "features/moderation/components/AppealsReviewClient.tsx",
];

describe("ATL-STORY-040 moderation e2e wiring", () => {
  it("includes approved moderation screens, APIs, and services", () => {
    for (const relativePath of moderationPaths) {
      expect(existsSync(resolve(webRoot, relativePath))).toBe(true);
    }
  });

  it("uses gated ModerationShell in moderation layout", () => {
    const layout = readFileSync(resolve(webRoot, "app/(moderation)/layout.tsx"), "utf8");
    expect(layout).toContain("ModerationShell");
    expect(
      readFileSync(resolve(webRoot, "components/shells/ModerationShell.tsx"), "utf8"),
    ).toContain("ModerationShellGate");
  });

  it("moderation shell exposes accessible mobile navigation", () => {
    const source = readFileSync(
      resolve(webRoot, "components/shells/ModerationShellClient.tsx"),
      "utf8",
    );
    expect(source).toContain('aria-label="Mobile moderation navigation"');
    expect(source).toContain('aria-controls="moderation-mobile-nav"');
    expect(source).not.toContain('href="/community"');
  });

  it("M2 reads case detail through approved list selector", () => {
    const api = readFileSync(resolve(webRoot, "features/moderation/api.ts"), "utf8");
    expect(api).toContain("/api/v1/moderation/cases?caseId=");
    expect(api).not.toMatch(/fetch\(`\/api\/v1\/moderation\/cases\/\$\{caseId\}`\)/);
  });

  it("M3 reads appeals through moderation cases view projection", () => {
    const api = readFileSync(resolve(webRoot, "features/moderation/api.ts"), "utf8");
    const client = readFileSync(
      resolve(webRoot, "features/moderation/components/AppealsReviewClient.tsx"),
      "utf8",
    );
    expect(api).toContain('view?: "cases" | "appeals"');
    expect(client).toContain('view: "appeals"');
    expect(api).not.toMatch(/fetch\(`\/api\/v1\/appeals\?/);
  });

  it("does not expose learner report routes or permissions", () => {
    const serviceSource = readFileSync(
      resolve(webRoot, "server/moderation/moderation.service.ts"),
      "utf8",
    );
    expect(serviceSource).not.toContain("report.create");
    expect(serviceSource).not.toContain("moderation_reports");
    expect(serviceSource).not.toContain("notification_dispatches");
    expect(serviceSource).not.toContain("search_index_entries");
    expect(serviceSource).not.toContain("analytics_rollups");
  });

  it("registers approved moderation audit actions", () => {
    const eventsSource = readFileSync(
      resolve(webRoot, "server/moderation/moderation.events.ts"),
      "utf8",
    );
    const serviceSource = readFileSync(
      resolve(webRoot, "server/moderation/moderation.service.ts"),
      "utf8",
    );
    expect(eventsSource).toContain("moderation.case_opened");
    expect(eventsSource).toContain("community.moderation.decided");
    expect(serviceSource).toContain("MODERATION_CASE_OPENED_AUDIT");
    expect(serviceSource).toContain("MODERATION_DECIDED_AUDIT");
  });

  it("blocks self-review in appeal review service", () => {
    const source = readFileSync(
      resolve(webRoot, "server/moderation/moderation.service.ts"),
      "utf8",
    );
    expect(source).toContain("appealSelfReviewBlocked");
  });

  it("M2 decision dialog requires confirmation with cancel focus", () => {
    const source = readFileSync(
      resolve(webRoot, "features/moderation/components/ModerationCaseDetailClient.tsx"),
      "utf8",
    );
    expect(source).toContain('role="dialog"');
    expect(source).toContain("cancelRef");
    expect(source).not.toMatch(/post body|comment body|dangerouslySetInnerHTML/);
  });

  it("M4 delete confirmation focuses cancel by default", () => {
    const source = readFileSync(
      resolve(webRoot, "features/community/components/AdminSpacesEditor.tsx"),
      "utf8",
    );
    expect(source).toContain("cancelRef");
    expect(source).toContain("allowedVisibilityOptions");
  });

  it("does not expose audit navigation for moderators", () => {
    const nav = readFileSync(
      resolve(webRoot, "features/moderation/moderation-navigation.ts"),
      "utf8",
    );
    expect(nav).not.toMatch(/\/moderate\/audit|audit\.read|\/admin|\/platform/);
  });
});
