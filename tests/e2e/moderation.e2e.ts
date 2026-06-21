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
  "server/moderation/moderation.service.ts",
  "features/moderation/components/ModerationQueueClient.tsx",
  "features/moderation/components/ModerationCaseDetailClient.tsx",
  "features/moderation/components/AppealsReviewClient.tsx",
];

describe("moderation e2e wiring", () => {
  it("includes approved moderation screens, APIs, and services", () => {
    for (const relativePath of moderationPaths) {
      expect(existsSync(resolve(webRoot, relativePath))).toBe(true);
    }
  });

  it("uses ModerationShell in moderation layout", () => {
    const source = readFileSync(resolve(webRoot, "app/(moderation)/layout.tsx"), "utf8");
    expect(source).toContain("ModerationShell");
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

  it("registers only approved moderation outbox events", () => {
    const eventsSource = readFileSync(
      resolve(webRoot, "server/moderation/moderation.events.ts"),
      "utf8",
    );
    const serviceSource = readFileSync(
      resolve(webRoot, "server/moderation/moderation.service.ts"),
      "utf8",
    );
    expect(eventsSource).toContain("moderation.reported");
    expect(eventsSource).toContain("moderation.decided");
    expect(serviceSource).toContain("MODERATION_REPORTED_EVENT");
    expect(serviceSource).toContain("MODERATION_DECIDED_EVENT");
    expect(serviceSource).not.toContain("moderation.case_opened");
  });

  it("blocks self-review in appeal review service", () => {
    const source = readFileSync(
      resolve(webRoot, "server/moderation/moderation.service.ts"),
      "utf8",
    );
    expect(source).toContain("appealSelfReviewBlocked");
  });
});
