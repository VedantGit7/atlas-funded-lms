import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("analytics e2e wiring", () => {
  it("registers analytics worker consumers and pages without deferred conversion metrics", () => {
    const consumers = readFileSync(
      resolve("backend/apps/api/src/events/outbox-consumers.ts"),
      "utf8",
    );
    const progressPage = readFileSync(
      resolve("frontend/apps/web/src/app/(learner)/progress/page.tsx"),
      "utf8",
    );
    const adminPage = readFileSync(
      resolve("frontend/apps/web/src/app/admin/analytics/page.tsx"),
      "utf8",
    );
    const studioPage = readFileSync(
      resolve("frontend/apps/web/src/app/studio/analytics/page.tsx"),
      "utf8",
    );

    expect(consumers).toContain("createAnalyticsOutboxConsumers");
    expect(consumers).toContain("ANALYTICS_WORKER_DESTINATION");
    expect(progressPage).not.toContain("/api/v1/analytics/");
    expect(adminPage).toContain("AnalyticsDashboard");
    expect(studioPage).toContain("StudioAnalyticsClient");
    expect(consumers).not.toContain("challenge.purchased");
    expect(adminPage.toLowerCase()).not.toContain("csv");
  });
});
