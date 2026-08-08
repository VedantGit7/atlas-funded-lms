import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { resolveSplitPath, splitPathExists } from "./split-layout-paths";

const automationLocalePaths = [
  "app/admin/automation/page.tsx",
  "app/admin/locales/page.tsx",
  "app/api/v1/automation-rules/route.ts",
  "app/api/v1/locales/route.ts",
  "app/api/v1/locales/[locale]/route.ts",
  "server/automation/automation.service.ts",
  "server/automation/automation.worker.ts",
  "server/automation/automation.registry.ts",
  "server/locales/locale.service.ts",
  "features/automation/components/AutomationRulesAdmin.tsx",
  "features/locales/components/LocalesAdmin.tsx",
];

describe("automation and locale e2e wiring", () => {
  it("includes approved screens, APIs, modules, and worker wiring", () => {
    for (const relativePath of automationLocalePaths) {
      expect(splitPathExists(relativePath)).toBe(true);
    }
  });

  it("registers automation worker in outbox consumers", () => {
    const source = readFileSync(resolveSplitPath("events/outbox-consumers.ts"), "utf8");
    expect(source).toContain("createAutomationOutboxConsumers");
    expect(source).toContain("AUTOMATION_WORKER_DESTINATION");
  });

  it("automation admin UI excludes run now and webhook fields", () => {
    const source = readFileSync(
      resolveSplitPath("features/automation/components/AutomationRulesAdmin.tsx"),
      "utf8",
    );
    expect(source).not.toMatch(/run now|webhook|javascript/i);
    expect(source).toContain("Delete forever");
  });

  it("locale admin UI excludes translation integrations", () => {
    const source = readFileSync(
      resolveSplitPath("features/locales/components/LocalesAdmin.tsx"),
      "utf8",
    );
    expect(source).not.toMatch(/translate|openai|google/i);
    expect(source).toContain("LocalesOverviewTab");
    expect(source).toContain("LocalesImportExportTab");
  });

  it("locale admin exposes extended backend routes", () => {
    const routePaths = [
      "app/api/v1/locales/overview/route.ts",
      "app/api/v1/locales/coverage/route.ts",
      "app/api/v1/locales/metadata/route.ts",
      "app/api/v1/locales/review-queue/route.ts",
      "app/api/v1/locales/qa-checks/route.ts",
      "app/api/v1/locales/import/route.ts",
      "app/api/v1/locales/export/route.ts",
      "app/api/v1/locales/[locale]/[key]/route.ts",
    ];
    for (const relativePath of routePaths) {
      expect(splitPathExists(relativePath)).toBe(true);
    }
  });

  it("worker uses withTenantTx and cycle guard", () => {
    const source = readFileSync(resolveSplitPath("server/automation/automation.worker.ts"), "utf8");
    expect(source).toContain("withTenantTx");
    expect(source).toContain("isAutomationCycleEvent");
    expect(source).not.toMatch(/fetch\(|eval\(/);
  });
});
