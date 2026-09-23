import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { z } from "zod";
import * as dto from "../../../backend/apps/api/src/server/certificates/certificate.dto";
import {
  listCertificateBrandKitsMetadata,
  mutateCertificateBrandKitsMetadata,
} from "../../../backend/apps/api/src/server/certificates/certificate.route-metadata";

const mocks = vi.hoisted(() => ({
  createTenantRoute: vi.fn((options: unknown) => options),
  listCertificateBrandKits: vi.fn(),
  createCertificateBrandKit: vi.fn(),
  updateCertificateBrandKit: vi.fn(),
  deleteCertificateBrandKit: vi.fn(),
}));
vi.mock("@atlas/api", () => ({ createTenantRoute: mocks.createTenantRoute }));
vi.mock("../../../backend/apps/api/src/server/certificates/certificate.service", () => mocks);

type RouteOptions = {
  metadata: typeof listCertificateBrandKitsMetadata | typeof mutateCertificateBrandKitsMetadata;
  body?: z.ZodType;
  output: z.ZodType;
  handler: (args: { tx: object; ctx: object; input?: object }) => Promise<unknown>;
};

describe("F18 canonical certificate brand-kit routes", () => {
  beforeEach(() => vi.clearAllMocks());

  it("preserves all protected methods, schemas, metadata and backend service delegation", async () => {
    expect(
      existsSync(resolve("backend/apps/api/src/app/api/v1/certificate-brand-kits/route.ts")),
    ).toBe(true);
    const routes =
      (await import("../../../backend/apps/api/src/app/api/v1/certificate-brand-kits/route")) as unknown as Record<
        "GET" | "POST" | "PUT" | "DELETE",
        RouteOptions
      >;
    const cases = [
      ["GET", mocks.listCertificateBrandKits, undefined, dto.certificateBrandKitListResponseSchema],
      [
        "POST",
        mocks.createCertificateBrandKit,
        dto.createCertificateBrandKitBodySchema,
        dto.certificateBrandKitDetailResponseSchema,
      ],
      [
        "PUT",
        mocks.updateCertificateBrandKit,
        dto.updateCertificateBrandKitBodySchema,
        dto.certificateBrandKitDetailResponseSchema,
      ],
      [
        "DELETE",
        mocks.deleteCertificateBrandKit,
        dto.deleteCertificateBrandKitBodySchema,
        dto.deleteCertificateBrandKitResponseSchema,
      ],
    ] as const;
    const tx = {};
    const ctx = { tenantId: "server-resolved-tenant", actorMembershipId: "authenticated-member" };
    const input = { name: "Atlas" };
    for (const [method, service, body, output] of cases) {
      const route = routes[method];
      const metadata =
        method === "GET" ? listCertificateBrandKitsMetadata : mutateCertificateBrandKitsMetadata;
      expect(route.metadata).toBe(metadata);
      expect(route.body).toBe(body);
      expect(route.output).toBe(output);
      const result = { data: method };
      service.mockResolvedValueOnce(result);
      expect(await route.handler({ tx, ctx, input })).toBe(result);
      expect(service).toHaveBeenCalledWith(...(method === "GET" ? [tx, ctx] : [tx, ctx, input]));
    }
    expect(listCertificateBrandKitsMetadata).toMatchObject({
      permission: "certificate_template.read",
      entitlement: "certification.enable",
      rateLimit: "authenticatedTenantRead",
    });
    expect(mutateCertificateBrandKitsMetadata).toMatchObject({
      permission: "certificate_template.manage",
      entitlement: "certification.enable",
      audit: "required",
      rateLimit: "authenticatedTenantWrite",
      idempotency: "required",
    });
    expect(mutateCertificateBrandKitsMetadata.resourceLoader).toBeTypeOf("function");
    expect(
      dto.createCertificateBrandKitBodySchema.safeParse({
        name: "Atlas",
        tenantId: "client-tenant",
      }).success,
    ).toBe(false);
  });
});
