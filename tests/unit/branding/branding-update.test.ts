import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { UpdateTenantBrandingRequestSchema } from "@atlas/domain-branding/schemas/branding";

const tenantId = "018f0000-0000-7000-8000-000000000001";
const storageRefId = "018f0000-0000-7000-8000-000000000010";

const {
  upsertTenantBrandingDraftMock,
  insertTenantBrandingVersionMock,
  publishTenantBrandingAndThemeMock,
  auditWriterWriteMock,
  outboxPublishMock,
} = vi.hoisted(() => ({
  upsertTenantBrandingDraftMock: vi.fn(),
  insertTenantBrandingVersionMock: vi.fn(),
  publishTenantBrandingAndThemeMock: vi.fn(),
  auditWriterWriteMock: vi.fn(),
  outboxPublishMock: vi.fn(),
}));

vi.mock("@atlas/domain-branding/repositories/branding.repository", () => ({
  upsertTenantBrandingDraft: (...args: unknown[]) => upsertTenantBrandingDraftMock(...args),
  insertTenantBrandingVersion: (...args: unknown[]) => insertTenantBrandingVersionMock(...args),
}));

vi.mock("@atlas/domain-branding/services/branding-publish.service", () => ({
  publishTenantBrandingAndTheme: (...args: unknown[]) => publishTenantBrandingAndThemeMock(...args),
}));

vi.mock("@atlas/audit", () => ({
  auditWriter: {
    write: (...args: unknown[]) => auditWriterWriteMock(...args),
  },
}));

vi.mock("@atlas/events", () => ({
  outbox: {
    publish: (...args: unknown[]) => outboxPublishMock(...args),
  },
}));

import { updateTenantBrandingDraft } from "@atlas/domain-branding/services/branding-update.service";

const tx = { $queryRaw: vi.fn(), $executeRaw: vi.fn() } as unknown as Parameters<
  typeof updateTenantBrandingDraft
>[0];

const draftRow = {
  tenant_id: tenantId,
  display_name: "Atlas Tenant",
  public_name: "Acme Academy",
  logo_light_ref_id: storageRefId,
  logo_dark_ref_id: null,
  favicon_ref_id: null,
  issuer_name: "Acme Academy Issuer",
  public_landing_copy_json: { headline: "Welcome" },
  status: "DRAFT",
  version: 0,
  updated_at: new Date("2025-01-01T00:00:00.000Z"),
  published_at: null,
};

const validInput = {
  publicName: "Acme Academy",
  issuerName: "Acme Academy Issuer",
  logoLight: {
    storageRefId,
    altText: "Acme logo",
  },
  publicLandingCopy: {
    headline: "Welcome",
  },
};

describe("branding update", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    upsertTenantBrandingDraftMock.mockResolvedValue(draftRow);
  });

  it("validates branding input", () => {
    expect(() =>
      UpdateTenantBrandingRequestSchema.parse({
        issuerName: "A",
      }),
    ).toThrow();

    expect(() =>
      UpdateTenantBrandingRequestSchema.parse({
        logoLight: {
          storageRefId: "not-a-uuid",
          altText: null,
        },
      }),
    ).toThrow();
  });

  it("updates draft only", async () => {
    const result = await updateTenantBrandingDraft(tx, validInput);

    expect(upsertTenantBrandingDraftMock).toHaveBeenCalledWith(tx, validInput);
    expect(result.data.status).toBe("DRAFT");
    expect(result.data.publicName).toBe("Acme Academy");
    expect(result.data.publishedAt).toBeNull();
  });

  it("does not publish", async () => {
    await updateTenantBrandingDraft(tx, validInput);

    expect(publishTenantBrandingAndThemeMock).not.toHaveBeenCalled();
    expect(auditWriterWriteMock).not.toHaveBeenCalled();
    expect(outboxPublishMock).not.toHaveBeenCalled();
  });

  it("does not create version row", async () => {
    await updateTenantBrandingDraft(tx, validInput);

    expect(insertTenantBrandingVersionMock).not.toHaveBeenCalled();
  });

  it("does not hardcode tenant-specific branding slugs in update sources", () => {
    const blockedTenantSlug = ["funded", "beyond"].join("");
    const serviceSource = readFileSync(
      resolve(
        import.meta.dirname,
        "../../../backend/packages/domain/branding/src/services/branding-update.service.ts",
      ),
      "utf8",
    );
    const schemaSource = readFileSync(
      resolve(
        import.meta.dirname,
        "../../../backend/packages/domain/branding/src/schemas/branding.ts",
      ),
      "utf8",
    );

    expect(serviceSource.toLowerCase()).not.toContain(blockedTenantSlug);
    expect(schemaSource.toLowerCase()).not.toContain(blockedTenantSlug);
  });
});
