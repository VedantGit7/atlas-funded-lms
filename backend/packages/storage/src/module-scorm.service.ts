import type { TenantTx } from "@atlas/db";
import { createSignedUpload } from "./signed-upload";

export async function createModuleScormUpload(
  tx: TenantTx,
  ctx: {
    tenantId: string;
  },
  input: {
    moduleId: string;
    fileName: string;
    contentType: string;
    sizeBytes: number;
    checksumSha256?: string | null;
  },
) {
  return createSignedUpload(tx, ctx, {
    purpose: "module.scorm",
    resourceType: "course_module",
    resourceId: input.moduleId,
    fileName: input.fileName,
    contentType: input.contentType,
    sizeBytes: input.sizeBytes,
    checksumSha256: input.checksumSha256 ?? null,
    visibility: "private",
  });
}
