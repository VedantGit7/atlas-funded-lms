import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const webRoot = resolve(import.meta.dirname, "../../apps/web/src");

const readinessPaths = [
  "app/(learner)/readiness/page.tsx",
  "app/(learner)/readiness/layout.tsx",
  "app/admin/readiness-policy/page.tsx",
  "app/api/v1/readiness-policy/route.ts",
  "app/api/v1/readiness-policy/route.metadata.ts",
  "app/api/v1/cta/attribution-token/route.ts",
  "app/api/v1/cta/attribution-token/route.metadata.ts",
  "server/readiness/readiness.worker.ts",
  "server/readiness/readiness-policy.service.ts",
  "server/readiness/cta-attribution.service.ts",
  "features/readiness/components/ReadinessCtaCard.tsx",
  "features/readiness/components/ReadinessPolicyEditor.tsx",
  "events/outbox-consumers.ts",
  "events/worker-router.ts",
];

describe("readiness e2e wiring", () => {
  it("includes approved learner/admin screens and APIs", () => {
    for (const relativePath of readinessPaths) {
      expect(existsSync(resolve(webRoot, relativePath))).toBe(true);
    }
  });

  it("learner readiness page uses PageGate and approved APIs", () => {
    const source = readFileSync(resolve(webRoot, "app/(learner)/readiness/page.tsx"), "utf8");
    expect(source).toContain("PageGate");
    expect(source).toContain("competencyServerApi");
    expect(source).toContain("readinessServerApi");
    expect(source).toContain("ReadinessCtaCard");
  });

  it("CTA card confirms external redirect and uses attribution token API", () => {
    const source = readFileSync(
      resolve(webRoot, "features/readiness/components/ReadinessCtaCard.tsx"),
      "utf8",
    );
    const clientSource = readFileSync(
      resolve(webRoot, "modules/readiness/readiness.api-client.ts"),
      "utf8",
    );

    expect(source).toContain("Continue to external site?");
    expect(source).toContain("readinessApiClient.createAttributionToken");
    expect(clientSource).toContain("/api/v1/cta/attribution-token");
    expect(source).not.toContain("checkout");
  });

  it("admin policy editor saves through readiness-policy API", () => {
    const source = readFileSync(
      resolve(webRoot, "features/readiness/components/ReadinessPolicyEditor.tsx"),
      "utf8",
    );
    expect(source).toContain("readinessApiClient.updateReadinessPolicy");
    expect(source).toContain("Legal review checklist completed");
  });

  it("worker consumes competency.score_changed only", () => {
    const consumersSource = readFileSync(resolve(webRoot, "events/outbox-consumers.ts"), "utf8");
    const workerSource = readFileSync(
      resolve(webRoot, "server/readiness/readiness.worker.ts"),
      "utf8",
    );
    expect(workerSource).toContain("competency.score_changed");
    expect(consumersSource).toContain("createReadinessOutboxConsumers");
    expect(consumersSource).not.toContain("challenge.purchased");
    expect(consumersSource).not.toContain("challenge.passed");
    expect(consumersSource).not.toContain("challenge.funded");
  });

  it("learner shell links to readiness route", () => {
    const source = readFileSync(resolve(webRoot, "components/shells/LearnerShell.tsx"), "utf8");
    expect(source).toContain("/readiness");
  });

  it("attribution route does not accept client targetUrl in schema module", () => {
    const source = readFileSync(resolve(webRoot, "server/readiness/readiness.schemas.ts"), "utf8");
    expect(source).toContain("targetUrl: z.never()");
  });
});
