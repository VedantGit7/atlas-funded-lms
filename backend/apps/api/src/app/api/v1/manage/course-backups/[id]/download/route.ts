import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import { z as zod } from "zod";
import { manageCourseBackupDownloadResponseSchema } from "@atlas/api-server/manage/manage-course-backups.schemas";
import { listManageCourseBackupsMetadata } from "@atlas/api-server/manage/manage-course-backups.route-metadata";
import { downloadManageCourseBackup } from "@atlas/api-server/manage/manage-course-backups.service";

const paramsSchema = zod.object({ id: zod.uuid() });

export const GET = createTenantRoute<
  Record<string, never>,
  z.output<typeof manageCourseBackupDownloadResponseSchema>,
  typeof paramsSchema
>({
  metadata: listManageCourseBackupsMetadata,
  params: paramsSchema,
  output: manageCourseBackupDownloadResponseSchema,
  handler: async ({ tx, ctx, params }) => downloadManageCourseBackup(tx, ctx, params["id"]),
});
