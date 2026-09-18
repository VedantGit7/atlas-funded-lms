import type { TenantTx } from "@atlas/db";
import { auditWriter } from "@atlas/audit";
import { AtlasHttpError } from "@atlas/core/http/errors";
import { confirmAssetUpload } from "@atlas/storage/asset-reference.service";
import { findAssetReferenceById } from "@atlas/storage/asset-reference.repository";
import { createModuleScormUpload } from "@atlas/storage/module-scorm.service";
import { getStorageProvider } from "@atlas/storage/providers/storage-provider-factory";
import { parseStorageEnv } from "@atlas/storage/schemas/storage-env";
import {
  buildScormContentStorageKey,
  extractScormPackage,
} from "@atlas/storage/scorm-package-extract";
import type {
  ModuleScormPackageBlobBody,
  ModuleScormPackageConfirmBody,
  ModuleScormPackageUploadBody,
} from "./course-authoring-schemas";
import { moduleNotFound } from "./courses.errors";
import {
  findModuleWithCourse,
  findModuleScormStorageReference,
  listCourseModulesForBuilder,
  updateModuleScormLaunchMetadata,
  updateModuleScormPackageReference,
} from "./course-authoring.repository";
import { assertModuleEditable } from "./course-state-guards";

type ServiceCtx = {
  tenantId: string;
  actorMembershipId: string;
  requestId: string;
};

async function requireEditableScormModule(tx: TenantTx, ctx: ServiceCtx, moduleId: string) {
  const module = await findModuleWithCourse({ tx, moduleId });

  if (!module || module.tenantId !== ctx.tenantId) {
    throw moduleNotFound();
  }

  if (module.createdByMembershipId !== ctx.actorMembershipId) {
    throw moduleNotFound();
  }

  assertModuleEditable(module.courseStatus);

  if (module.contentKind !== "scorm") {
    throw new AtlasHttpError({
      code: "VALIDATION_ERROR",
      status: 400,
      message: "This chapter is not configured for SCORM packages.",
    });
  }

  return module;
}

async function extractAndPublishScormPackage(
  tx: TenantTx,
  ctx: ServiceCtx,
  moduleId: string,
  assetReferenceId: string,
) {
  const env = parseStorageEnv(process.env);
  const asset = await findAssetReferenceById(tx, assetReferenceId);

  if (!asset || asset.tenant_id !== ctx.tenantId) {
    throw new AtlasHttpError({
      code: "VALIDATION_ERROR",
      status: 400,
      message: "SCORM package reference was not found.",
    });
  }

  const provider = getStorageProvider();
  const zipBuffer = await provider.getObjectBody({
    bucket: asset.bucket,
    key: asset.object_key,
  });

  if (!zipBuffer) {
    throw new AtlasHttpError({
      code: "VALIDATION_ERROR",
      status: 400,
      message: "SCORM package file is missing. Upload the ZIP file before confirming.",
    });
  }

  const extracted = extractScormPackage(zipBuffer);

  for (const file of extracted.files) {
    await provider.putObject({
      bucket: env.R2_BUCKET_NAME,
      key: buildScormContentStorageKey({
        tenantId: ctx.tenantId,
        moduleId,
        relativePath: file.relativePath,
      }),
      body: file.content,
      contentType: file.contentType,
    });
  }

  await updateModuleScormLaunchMetadata({
    tx,
    moduleId,
    launchPath: extracted.launchPath,
    scormVersion: extracted.scormVersion,
  });
}

export async function createModuleScormPackageUploadService(
  tx: TenantTx,
  ctx: ServiceCtx,
  moduleId: string,
  input: ModuleScormPackageUploadBody,
) {
  await requireEditableScormModule(tx, ctx, moduleId);

  return createModuleScormUpload(
    tx,
    { tenantId: ctx.tenantId },
    {
      moduleId,
      fileName: input.fileName,
      contentType: input.contentType,
      sizeBytes: input.sizeBytes,
      checksumSha256: input.checksumSha256 ?? null,
    },
  );
}

export async function storeModuleScormPackageBlobService(
  tx: TenantTx,
  ctx: ServiceCtx,
  moduleId: string,
  input: ModuleScormPackageBlobBody,
) {
  await requireEditableScormModule(tx, ctx, moduleId);

  const asset = await findAssetReferenceById(tx, input.assetReferenceId);

  if (!asset || asset.tenant_id !== ctx.tenantId) {
    throw new AtlasHttpError({
      code: "VALIDATION_ERROR",
      status: 404,
      message: "SCORM package reference was not found.",
    });
  }

  if (asset.purpose !== "module.scorm" || asset.resource_id !== moduleId) {
    throw new AtlasHttpError({
      code: "VALIDATION_ERROR",
      status: 400,
      message: "SCORM package reference does not belong to this chapter.",
    });
  }

  if (asset.status !== "PENDING_UPLOAD") {
    throw new AtlasHttpError({
      code: "VALIDATION_ERROR",
      status: 409,
      message: "SCORM package upload is no longer pending.",
    });
  }

  const body = Buffer.from(input.contentBase64, "base64");
  if (body.byteLength !== Number(asset.size_bytes)) {
    throw new AtlasHttpError({
      code: "VALIDATION_ERROR",
      status: 400,
      message: "Uploaded SCORM package size does not match the declared file size.",
    });
  }

  const provider = getStorageProvider();
  await provider.putObject({
    bucket: asset.bucket,
    key: asset.object_key,
    body,
    contentType: asset.content_type,
  });

  return {
    data: {
      assetReferenceId: asset.id,
      stored: true as const,
    },
  };
}

export async function confirmModuleScormPackageUploadService(
  tx: TenantTx,
  ctx: ServiceCtx,
  moduleId: string,
  input: ModuleScormPackageConfirmBody,
) {
  const module = await requireEditableScormModule(tx, ctx, moduleId);

  const storageRef = await findModuleScormStorageReference({
    tx,
    tenantId: ctx.tenantId,
    storageReferenceId: input.assetReferenceId,
  });

  if (!storageRef) {
    throw new AtlasHttpError({
      code: "VALIDATION_ERROR",
      status: 400,
      message: "SCORM package reference was not found.",
    });
  }

  if (storageRef.purpose !== "module.scorm" || storageRef.resourceId !== moduleId) {
    throw new AtlasHttpError({
      code: "VALIDATION_ERROR",
      status: 400,
      message: "SCORM package reference does not belong to this chapter.",
    });
  }

  const provider = getStorageProvider();
  await confirmAssetUpload(
    tx,
    provider,
    { tenantId: ctx.tenantId },
    {
      assetReferenceId: input.assetReferenceId,
    },
  );

  await updateModuleScormPackageReference({
    tx,
    moduleId,
    assetReferenceId: input.assetReferenceId,
  });

  await extractAndPublishScormPackage(tx, ctx, moduleId, input.assetReferenceId);

  await auditWriter.write(
    tx,
    {
      tenantId: ctx.tenantId,
      actorMembershipId: ctx.actorMembershipId,
      platformPrincipalId: null,
      requestId: ctx.requestId,
    },
    {
      action: "course.module.scorm_package.attached",
      target: { type: "course_module", id: moduleId },
      before: { scormPackageReferenceId: module.scormPackageReferenceId },
      after: { scormPackageReferenceId: input.assetReferenceId },
      reason: null,
      metadata: {},
    },
  );

  const modules = await listCourseModulesForBuilder({ tx, courseId: module.courseId });
  const updated = modules.find((item) => item.id === moduleId);

  if (!updated) {
    throw moduleNotFound();
  }

  return { data: updated };
}
