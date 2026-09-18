import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import { requestCourseBackupOtpResponseSchema } from "../../../../../../server/manage/manage-course-backups.schemas";
import { mutateManageCourseBackupsMetadata } from "../../../../../../server/manage/manage-course-backups.route-metadata";
import { requestManageCourseBackupOtp } from "../../../../../../server/manage/manage-course-backups.service";

export const POST = createTenantRoute<
  Record<string, never>,
  z.output<typeof requestCourseBackupOtpResponseSchema>
>({
  metadata: mutateManageCourseBackupsMetadata,
  output: requestCourseBackupOtpResponseSchema,
  handler: ({ tx, ctx }) => Promise.resolve(requestManageCourseBackupOtp(tx, ctx)),
});
