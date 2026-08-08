import { randomUUID } from "node:crypto";
import type { AssetPurpose } from "./schemas/storage-policy";

function sanitizeFileName(fileName: string): string {
  const normalized = fileName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 120);

  return normalized || "asset";
}

export type BuildStorageKeyInput = {
  tenantId: string;
  purpose: AssetPurpose;
  resourceId?: string | null;
  fileName: string;
};

export function buildTenantStorageKey(input: BuildStorageKeyInput): string {
  const safeFileName = sanitizeFileName(input.fileName);
  const objectId = randomUUID();

  switch (input.purpose) {
    case "branding.logo":
      return `tenants/${input.tenantId}/branding/logos/${objectId}-${safeFileName}`;
    case "branding.favicon":
      return `tenants/${input.tenantId}/branding/favicons/${objectId}-${safeFileName}`;
    case "branding.og-image":
      return `tenants/${input.tenantId}/branding/og-images/${objectId}-${safeFileName}`;
    case "lesson.asset":
    case "lesson.attachment":
      if (!input.resourceId) throw new Error("RESOURCE_ID_REQUIRED_FOR_LESSON_ASSET");
      return `tenants/${input.tenantId}/lessons/${input.resourceId}/${objectId}-${safeFileName}`;
    case "lesson.thumbnail":
      if (!input.resourceId) throw new Error("RESOURCE_ID_REQUIRED_FOR_LESSON_ASSET");
      return `tenants/${input.tenantId}/lessons/${input.resourceId}/thumbnails/${objectId}-${safeFileName}`;
    case "module.scorm":
      if (!input.resourceId) throw new Error("RESOURCE_ID_REQUIRED_FOR_MODULE_SCORM");
      return `tenants/${input.tenantId}/modules/${input.resourceId}/scorm/${objectId}-${safeFileName}`;
    case "certificate.template":
      return `tenants/${input.tenantId}/certificates/templates/${objectId}-${safeFileName}`;
    case "member.avatar":
      if (!input.resourceId) throw new Error("RESOURCE_ID_REQUIRED_FOR_MEMBER_AVATAR");
      return `tenants/${input.tenantId}/members/${input.resourceId}/avatar/${objectId}-${safeFileName}`;
    case "community.attachment":
      if (!input.resourceId) throw new Error("RESOURCE_ID_REQUIRED_FOR_COMMUNITY_ASSET");
      return `tenants/${input.tenantId}/community/${input.resourceId}/${objectId}-${safeFileName}`;
    case "export.file":
      if (!input.resourceId) throw new Error("RESOURCE_ID_REQUIRED_FOR_EXPORT_FILE");
      return `tenants/${input.tenantId}/exports/${input.resourceId}/${objectId}-${safeFileName}`;
    case "temp.upload":
      return `tenants/${input.tenantId}/temp/uploads/${objectId}-${safeFileName}`;
    default:
      throw new Error("UNSUPPORTED_ASSET_PURPOSE");
  }
}

export function assertTenantKeyPrefix(args: { tenantId: string; key: string }): void {
  const expectedPrefix = `tenants/${args.tenantId}/`;

  if (!args.key.startsWith(expectedPrefix)) {
    throw new Error("STORAGE_KEY_TENANT_PREFIX_VIOLATION");
  }
}
