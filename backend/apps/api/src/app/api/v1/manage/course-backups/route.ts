import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  createManageCourseBackupBodySchema,
  manageCourseBackupResponseSchema,
  manageCourseBackupsListResponseSchema,
} from "../../../../../server/manage/manage-course-backups.schemas";
import {
  listManageCourseBackupsMetadata,
  mutateManageCourseBackupsMetadata,
} from "../../../../../server/manage/manage-course-backups.route-metadata";
import {
  createManageCourseBackup,
  listManageCourseBackups,
} from "../../../../../server/manage/manage-course-backups.service";

export const GET = createTenantRoute<
  Record<string, never>,
  z.output<typeof manageCourseBackupsListResponseSchema>
>({
  metadata: listManageCourseBackupsMetadata,
  output: manageCourseBackupsListResponseSchema,
  handler: async ({ tx, ctx }) => listManageCourseBackups(tx, ctx),
});

export const POST = createTenantRoute<
  z.output<typeof createManageCourseBackupBodySchema>,
  z.output<typeof manageCourseBackupResponseSchema>
>({
  metadata: mutateManageCourseBackupsMetadata,
  body: createManageCourseBackupBodySchema,
  output: manageCourseBackupResponseSchema,
  handler: async ({ tx, ctx, input }) => createManageCourseBackup(tx, ctx, input),
});
