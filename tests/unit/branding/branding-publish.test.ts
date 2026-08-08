import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { routeMetadata } from "../../../backend/apps/api/src/app/api/v1/branding/publish/route.metadata";

const tenantId = "018f0000-0000-7000-8000-000000000001";
const actorMembershipId = "018f0000-0000-7000-8000-000000000002";
const requestId = "req_branding_publish_test";

const {
  getTenantBrandingMock,
  getTenantThemeMock,
  insertTenantBrandingVersionMock,
  insertTenantThemeVersionMock,
  markBrandingPublishedMock,
  markThemePublishedMock,
  auditWriterWriteMock,
  outboxPublishMock,
} = vi.hoisted(() => ({
  getTenantBrandingMock: vi.fn(),
  getTenantThemeMock: vi.fn(),
  insertTenantBrandingVersionMock: vi.fn(),
  insertTenantThemeVersionMock: vi.fn(),
  markBrandingPublishedMock: vi.fn(),
  markThemePublishedMock: vi.fn(),
  auditWriterWriteMock: vi.fn(),
  outboxPublishMock: vi.fn(),
}));

vi.mock("@atlas/domain-branding/repositories/branding.repository", () => ({
  getTenantBranding: (...args: unknown[]) => getTenantBrandingMock(...args),
  insertTenantBrandingVersion: (...args: unknown[]) => insertTenantBrandingVersionMock(...args),
  markBrandingPublished: (...args: unknown[]) => markBrandingPublishedMock(...args),
}));

vi.mock("@atlas/domain-branding/repositories/theme.repository", () => ({
  getTenantTheme: (...args: unknown[]) => getTenantThemeMock(...args),
  insertTenantThemeVersion: (...args: unknown[]) => insertTenantThemeVersionMock(...args),
  markThemePublished: (...args: unknown[]) => markThemePublishedMock(...args),
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

import { publishTenantBrandingAndTheme } from "@atlas/domain-branding/services/branding-publish.service";

const tx = { $queryRaw: vi.fn(), $executeRaw: vi.fn() } as unknown as Parameters<
  typeof publishTenantBrandingAndTheme
>[0];

const brandingBefore = {
  tenant_id: tenantId,
  display_name: "Atlas Tenant",
  public_name: "Acme Academy",
  logo_light_ref_id: null,
  logo_dark_ref_id: null,
  favicon_ref_id: null,
  issuer_name: "Acme Academy Issuer",
  public_landing_copy_json: null,
  status: "DRAFT",
  version: 0,
  updated_at: new Date("2025-01-01T00:00:00.000Z"),
  published_at: null,
};

const themeBefore = {
  tenant_id: tenantId,
  tokens_json: {
    primary: "#112233",
    radius: "md",
    modeDefault: "system",
  },
  status: "DRAFT",
  version: 0,
  updated_at: new Date("2025-01-01T00:00:00.000Z"),
  published_at: null,
};

const brandingAfter = {
  ...brandingBefore,
  status: "PUBLISHED",
  version: 1,
  published_at: new Date("2025-01-02T00:00:00.000Z"),
};

describe("branding publish", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getTenantBrandingMock.mockResolvedValue(brandingBefore);
    getTenantThemeMock.mockResolvedValue(themeBefore);
    insertTenantBrandingVersionMock.mockResolvedValue({
      id: "018f0000-0000-7000-8000-000000000010",
      version: 1,
    });
    insertTenantThemeVersionMock.mockResolvedValue({
      id: "018f0000-0000-7000-8000-000000000011",
      version: 1,
    });
    markBrandingPublishedMock.mockResolvedValue(brandingAfter);
    markThemePublishedMock.mockResolvedValue({
      ...themeBefore,
      status: "PUBLISHED",
      version: 1,
      published_at: new Date("2025-01-02T00:00:00.000Z"),
    });
    auditWriterWriteMock.mockResolvedValue(undefined);
    outboxPublishMock.mockResolvedValue({ id: "018f0000-0000-7000-8000-000000000099" });
  });

  it("creates tenant_branding_version and tenant_theme_version rows", async () => {
    await publishTenantBrandingAndTheme(tx, {
      tenantId,
      actorMembershipId,
      requestId,
    });

    expect(insertTenantBrandingVersionMock).toHaveBeenCalledWith(tx, {
      snapshot: brandingBefore,
      publishedByMembershipId: actorMembershipId,
    });
    expect(insertTenantThemeVersionMock).toHaveBeenCalledWith(tx, {
      snapshot: themeBefore,
      publishedByMembershipId: actorMembershipId,
    });
  });

  it("marks branding and theme as PUBLISHED", async () => {
    const result = await publishTenantBrandingAndTheme(tx, {
      tenantId,
      actorMembershipId,
      requestId,
    });

    expect(markBrandingPublishedMock).toHaveBeenCalledWith(tx, 1);
    expect(markThemePublishedMock).toHaveBeenCalledWith(tx, 1);
    expect(result.data.status).toBe("PUBLISHED");
    expect(result.data.publishedAt).not.toBeNull();
  });

  it("writes audit for config.branding.published", async () => {
    await publishTenantBrandingAndTheme(tx, {
      tenantId,
      actorMembershipId,
      requestId,
    });

    expect(auditWriterWriteMock).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        tenantId,
        actorMembershipId,
        requestId,
      }),
      expect.objectContaining({
        action: "config.branding.published",
        before: {
          brandingVersion: 0,
          themeVersion: 0,
        },
        after: {
          brandingVersion: 1,
          themeVersion: 1,
        },
      }),
    );
  });

  it("publishes config.branding.published outbox event", async () => {
    await publishTenantBrandingAndTheme(tx, {
      tenantId,
      actorMembershipId,
      requestId,
    });

    expect(outboxPublishMock).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        eventType: "config.branding.published",
        aggregateType: "tenant_branding",
        aggregateId: tenantId,
        payload: expect.objectContaining({
          tenantId,
          brandingVersion: 1,
          themeVersion: 1,
        }),
        idempotencyKey: `${requestId}:branding-publish`,
      }),
    );
  });

  it("requires branding.publish permission at the route layer", () => {
    expect(routeMetadata.permission).toBe("branding.publish");

    const routeSource = readFileSync(
      resolve(
        import.meta.dirname,
        "../../../backend/apps/api/src/app/api/v1/branding/publish/route.metadata.ts",
      ),
      "utf8",
    );

    expect(routeSource).toContain("branding.publish");
    expect(routeSource).not.toContain("branding.update");

    const handlerSource = readFileSync(
      resolve(import.meta.dirname, "../../../backend/apps/api/src/app/api/v1/branding/publish/route.ts"),
      "utf8",
    );

    expect(handlerSource).toContain("createTenantRoute");
  });
});
