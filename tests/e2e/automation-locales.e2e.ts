import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const webRoot = resolve(import.meta.dirname, "../../apps/web/src");

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
      expect(existsSync(resolve(webRoot, relativePath))).toBe(true);
    }
  });

  it("registers automation worker in outbox consumers", () => {
    const source = readFileSync(resolve(webRoot, "events/outbox-consumers.ts"), "utf8");
    expect(source).toContain("createAutomationOutboxConsumers");
    expect(source).toContain("AUTOMATION_WORKER_DESTINATION");
  });

  it("automation admin UI excludes run now and webhook fields", () => {
    const source = readFileSync(
      resolve(webRoot, "features/automation/components/AutomationRulesAdmin.tsx"),
      "utf8",
    );
    expect(source).not.toMatch(/run now|webhook|javascript/i);
    expect(source).toContain("Confirm delete");
  });

  it("locale admin UI excludes translation integrations", () => {
    const source = readFileSync(
      resolve(webRoot, "features/locales/components/LocalesAdmin.tsx"),
      "utf8",
    );
    expect(source).not.toMatch(/translate|openai|google/i);
    expect(source).not.toContain("delete");
  });

  it("worker uses withTenantTx and cycle guard", () => {
    const source = readFileSync(resolve(webRoot, "server/automation/automation.worker.ts"), "utf8");
    expect(source).toContain("withTenantTx");
    expect(source).toContain("isAutomationCycleEvent");
    expect(source).not.toMatch(/fetch\(|eval\(/);
  });
});
