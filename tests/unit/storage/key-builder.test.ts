import { describe, expect, it } from "vitest";
import { buildTenantStorageKey } from "@atlas/storage/key-builder";

const TENANT_ID = "11111111-1111-4111-8111-111111111111";
const LESSON_ID = "22222222-2222-4222-8222-222222222222";

describe("buildTenantStorageKey", () => {
  it("always starts with tenants/{tenantId}/ for tenant assets", () => {
    const cases = [
      { purpose: "branding.logo" as const, fileName: "logo.png" },
      { purpose: "branding.favicon" as const, fileName: "favicon.ico" },
      {
        purpose: "lesson.asset" as const,
        fileName: "handout.pdf",
        resourceId: LESSON_ID,
      },
      { purpose: "temp.upload" as const, fileName: "draft.zip" },
    ];

    for (const input of cases) {
      const key = buildTenantStorageKey({
        tenantId: TENANT_ID,
        ...input,
      });

      expect(key.startsWith(`tenants/${TENANT_ID}/`)).toBe(true);
    }
  });

  it("does not allow path traversal via fileName", () => {
    const key = buildTenantStorageKey({
      tenantId: TENANT_ID,
      purpose: "temp.upload",
      fileName: "../../../etc/passwd",
    });

    expect(key.startsWith(`tenants/${TENANT_ID}/`)).toBe(true);
    expect(key).not.toContain("../");
    expect(key).not.toContain("/etc/");
  });

  it("does not allow another tenant id to be injected via fileName", () => {
    const otherTenantId = "33333333-3333-4333-8333-333333333333";
    const key = buildTenantStorageKey({
      tenantId: TENANT_ID,
      purpose: "temp.upload",
      fileName: `tenants/${otherTenantId}/secret.pdf`,
    });

    expect(key.startsWith(`tenants/${TENANT_ID}/`)).toBe(true);
    expect(key.startsWith(`tenants/${otherTenantId}/`)).toBe(false);
  });

  it("uses branding/logos for branding logo assets", () => {
    const key = buildTenantStorageKey({
      tenantId: TENANT_ID,
      purpose: "branding.logo",
      fileName: "logo.png",
    });

    expect(key).toMatch(new RegExp(`^tenants/${TENANT_ID}/branding/logos/[0-9a-f-]+-logo\\.png$`));
  });

  it("uses branding/favicons for branding favicon assets", () => {
    const key = buildTenantStorageKey({
      tenantId: TENANT_ID,
      purpose: "branding.favicon",
      fileName: "favicon.ico",
    });

    expect(key).toMatch(
      new RegExp(`^tenants/${TENANT_ID}/branding/favicons/[0-9a-f-]+-favicon\\.ico$`),
    );
  });

  it("uses lessons/{lessonId} for lesson assets", () => {
    const key = buildTenantStorageKey({
      tenantId: TENANT_ID,
      purpose: "lesson.asset",
      resourceId: LESSON_ID,
      fileName: "worksheet.pdf",
    });

    expect(key).toMatch(
      new RegExp(`^tenants/${TENANT_ID}/lessons/${LESSON_ID}/[0-9a-f-]+-worksheet\\.pdf$`),
    );
  });

  it("uses module scorm path for scorm packages", () => {
    const moduleId = "018f0000-0000-7000-8000-000000000099";
    const key = buildTenantStorageKey({
      tenantId: TENANT_ID,
      purpose: "module.scorm",
      resourceId: moduleId,
      fileName: "package.zip",
    });

    expect(key).toMatch(
      new RegExp(`^tenants/${TENANT_ID}/modules/${moduleId}/scorm/[0-9a-f-]+-package\\.zip$`),
    );
  });

  it("uses temp/uploads for temp upload assets", () => {
    const key = buildTenantStorageKey({
      tenantId: TENANT_ID,
      purpose: "temp.upload",
      fileName: "draft.zip",
    });

    expect(key).toMatch(new RegExp(`^tenants/${TENANT_ID}/temp/uploads/[0-9a-f-]+-draft\\.zip$`));
  });
});
