import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  reportHistoryQuerySchema,
  reportHistoryResponseSchema,
} from "../../../../../server/reports/reports.schemas";
import { listReportRuns } from "@atlas/domain/reports/reports.service";
import { listReportRunsMetadata } from "@atlas/domain/reports/reports.route-metadata";
import { SYSTEM_REPORT_DEFINITIONS } from "@atlas/domain/reports/reports.registry";

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
  z.output<typeof reportHistoryQuerySchema>,
  z.output<typeof reportHistoryResponseSchema>
>({
  metadata: listReportRunsMetadata,
  input: reportHistoryQuerySchema,
  output: reportHistoryResponseSchema,
  handler: async ({ tx, ctx, input }) => {
    const categoryKeys = new Set(
      SYSTEM_REPORT_DEFINITIONS.filter((definition) => definition.category === input.category).map(
        (definition) => definition.key,
      ),
    );

    const result = await listReportRuns(tx, ctx, { limit: input.limit });
    const items = result.data.items
      .filter((item) => categoryKeys.has(item.definitionKey))
      .map((item) => ({
        id: item.id,
        definitionId: item.definitionKey,
        definitionName: item.definitionTitle,
        status: mapLegacyStatus(item.status),
        createdAt: item.createdAt,
        completedAt: item.completedAt,
      }));

    return {
      data: {
        category: input.category,
        items,
      },
    };
  },
});
