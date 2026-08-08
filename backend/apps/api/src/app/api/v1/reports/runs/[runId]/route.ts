import { z } from "zod";
import type { z as Zod } from "zod";
import { createTenantRoute } from "@atlas/api";
import { getReportRun } from "@atlas/domain/reports/reports.service";
import { getReportRunMetadata } from "@atlas/domain/reports/reports.route-metadata";
import { reportRunResponseSchema } from "../../../../../../server/reports/reports.schemas";

const paramsSchema = z.object({ runId: z.string().uuid() });

function mapLegacyStatus(status: string): "queued" | "running" | "completed" | "failed" {
  switch (status) {
    case "QUEUED":
      return "queued";
    case "RUNNING":
      return "running";
    case "SUCCEEDED":
      return "completed";
    case "FAILED":
    case "CANCELLED":
      return "failed";
    default:
      return "failed";
  }
}

export const GET = createTenantRoute<
  Record<string, never>,
  Zod.output<typeof reportRunResponseSchema>,
  typeof paramsSchema
>({
  metadata: getReportRunMetadata,
  params: paramsSchema,
  output: reportRunResponseSchema,
  handler: async ({ tx, ctx, params }) => {
    const result = await getReportRun(tx, ctx, params["runId"]);

    return {
      data: {
        id: result.data.id,
        definitionId: result.data.definitionKey,
        status: mapLegacyStatus(result.data.status),
        createdAt: result.data.createdAt,
        completedAt: result.data.completedAt,
        errorMessage: result.data.errorCode,
      },
    };
  },
});
