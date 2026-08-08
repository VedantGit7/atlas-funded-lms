import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  MODERATION_ROUTE_REGISTRY,
  type ModerationScreenId,
} from "../../../frontend/apps/web/src/features/moderation/moderation-route-registry";

const webRoot = resolve(import.meta.dirname, "../../../frontend/apps/web/src");

const pageByScreen: Record<ModerationScreenId, string> = {
  M1: "app/admin/moderation/cases/page.tsx",
  M2: "app/admin/moderation/cases/[id]/page.tsx",
  M3: "app/admin/moderation/appeals/page.tsx",
  M4: "app/(moderation)/moderate/spaces/page.tsx",
};

describe("moderation route integration wiring", () => {
  it("maps every approved screenId to a page module", () => {
    for (const route of MODERATION_ROUTE_REGISTRY) {
      expect(existsSync(resolve(webRoot, pageByScreen[route.screenId]))).toBe(true);
    }
  });

  it("M1 uses GET moderation cases only", () => {
    const page = readFileSync(resolve(webRoot, pageByScreen.M1), "utf8");
    const client = readFileSync(
      resolve(webRoot, "features/moderation/components/ModerationQueueClient.tsx"),
      "utf8",
    );
    expect(page).toContain("/api/v1/moderation/cases?view=cases");
    expect(client).toContain("listModerationCases");
    expect(client).toContain("beginModerationReview");
  });

  it("M2 uses existing approved detail read mechanism", () => {
    const page = readFileSync(resolve(webRoot, pageByScreen.M2), "utf8");
    const client = readFileSync(
      resolve(webRoot, "features/moderation/components/ModerationCaseDetailClient.tsx"),
      "utf8",
    );
    expect(page).toContain("/api/v1/moderation/cases?caseId=");
    expect(client).toContain("getModerationCase");
    expect(client).toContain("decideModerationCase");
    expect(client).not.toMatch(/GET.*\/appeals|\/posts\/.*PUT/);
  });

  it("M3 uses existing appeals projection without GET /appeals route", () => {
    const page = readFileSync(resolve(webRoot, pageByScreen.M3), "utf8");
    const client = readFileSync(
      resolve(webRoot, "features/moderation/components/AppealsReviewClient.tsx"),
      "utf8",
    );
    expect(page).toContain("/api/v1/moderation/cases?view=appeals");
    expect(client).toContain("reviewAppeal");
    expect(client).not.toMatch(/fetch\(`\/api\/v1\/appeals\?/);
  });

  it("M4 uses spaces APIs only", () => {
    const page = readFileSync(resolve(webRoot, pageByScreen.M4), "utf8");
    const editor = readFileSync(
      resolve(webRoot, "features/community/components/AdminSpacesEditor.tsx"),
      "utf8",
    );
    expect(page).toContain("communityServerApi.listSpaces");
    expect(editor).toContain("/api/v1/spaces");
  });

  it("does not import prisma or repositories in moderation app pages", () => {
    for (const relativePath of Object.values(pageByScreen)) {
      const source = readFileSync(resolve(webRoot, relativePath), "utf8");
      expect(source).not.toMatch(
        /from.*prisma|from.*repository|withTenantTx|withPlatformScope|new PrismaClient/,
      );
    }
  });

  it("does not expose moderation audit route or client", () => {
    const nav = readFileSync(
      resolve(webRoot, "features/moderation/moderation-navigation.ts"),
      "utf8",
    );
    expect(nav).not.toMatch(/\/moderate\/audit|audit\.read|GET.*audit/);
  });
});
