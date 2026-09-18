import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  LEGAL_DOCUMENT_SLUGS,
  LegalDocumentSchema,
} from "@atlas/domain-branding/schemas/public-legal";

/**
 * Terms and Privacy used to be module constants in the web app
 * (`features/public/components/legal/terms-content.ts` / `privacy-content.ts`)
 * holding tenant #1's text, so every academy on the platform served
 * FundedBeyond's legal agreements from its own domain.
 *
 * They are tenant configuration now. These tests pin the two properties that
 * made the change worth making: the documents live in a tenant manifest and
 * still parse, and a tenant that has not supplied its own gets nothing rather
 * than somebody else's.
 */

function readManifest(slug: string): Record<string, unknown> {
  return JSON.parse(readFileSync(`configs/tenants/${slug}/manifest.json`, "utf8")) as Record<
    string,
    unknown
  >;
}

function readLegalSection(slug: string): Record<string, unknown> {
  const manifest = readManifest(slug);
  const config = manifest["tenantConfigJson"];
  if (!config || typeof config !== "object") return {};
  const legal = (config as Record<string, unknown>)["legal"];
  if (!legal || typeof legal !== "object") return {};
  return legal as Record<string, unknown>;
}

describe("tenant legal documents", () => {
  it("ships FundedBeyond's documents as its own tenant configuration", () => {
    const legal = readLegalSection("fundedbeyond");

    for (const slug of LEGAL_DOCUMENT_SLUGS) {
      const parsed = LegalDocumentSchema.safeParse(legal[slug]);
      expect(parsed.success, `${slug} must parse`).toBe(true);
      if (!parsed.success) continue;

      expect(parsed.data.slug).toBe(slug);
      expect(parsed.data.sections.length).toBeGreaterThan(0);
      expect(parsed.data.title.trim().length).toBeGreaterThan(0);
    }
  });

  it("does not ship legal text for a tenant that has not supplied any", () => {
    // The whole point of the move: absence must stay absence. If this starts
    // failing because a default was reintroduced, every tenant is once again
    // serving another tenant's agreements.
    expect(readLegalSection("second-smoke-academy")).toEqual({});
  });

  it("treats a malformed stored document as unpublished rather than rendering it", () => {
    // `readTenantLegalDocument` validates before returning, so operator-edited
    // config cannot put half an agreement on a public page.
    expect(LegalDocumentSchema.safeParse({ slug: "terms" }).success).toBe(false);
    expect(LegalDocumentSchema.safeParse(null).success).toBe(false);
    expect(
      LegalDocumentSchema.safeParse({
        slug: "terms",
        title: "T",
        subtitle: "",
        lastUpdated: "",
        sections: [{ id: "a", sectionNumber: "1", title: "A", blocks: [{ type: "nope" }] }],
      }).success,
    ).toBe(false);
  });

  it("keeps no hardcoded legal content modules in the web app", () => {
    // A regression here means the constants came back.
    const removed = [
      "frontend/apps/web/src/features/public/components/legal/terms-content.ts",
      "frontend/apps/web/src/features/public/components/legal/privacy-content.ts",
    ];
    for (const path of removed) {
      expect(() => readFileSync(path, "utf8"), `${path} must not exist`).toThrow();
    }
  });
});
