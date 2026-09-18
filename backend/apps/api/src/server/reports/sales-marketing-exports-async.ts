import { after } from "next/server";
import {
  REPORT_GENERATE_REQUESTED_EVENT,
  reportGenerateRequestedPayloadSchema,
} from "@atlas/domain/reports/reports.events";
import { processReportGenerateStandalone } from "@atlas/domain/reports/reports.worker";
import { processReportsOutboxBatch } from "./reports-worker-router";

/**
 * After the create/retry TX commits and the response is sent, generate the
 * artifact (with visible progress) then drain delivery for report.run_succeeded.
 */
export function scheduleSalesMarketingExportProcessing(args: {
  tenantId: string;
  requestId: string;
  actorMembershipId: string;
  reportRunId: string;
  format: "csv" | "xlsx" | "pdf" | "json";
  requestedAt: string;
}): void {
  after(() => {
    void (async () => {
      const payload = reportGenerateRequestedPayloadSchema.parse({
        reportRunId: args.reportRunId,
        reportDefinitionKey: "sales-marketing",
        requestedAt: args.requestedAt,
        requestedByMembershipId: args.actorMembershipId,
        format: args.format,
        schemaVersion: 1,
      });

      await processReportGenerateStandalone({
        tenantId: args.tenantId,
        requestId: args.requestId,
        actorMembershipId: args.actorMembershipId,
        event: {
          id: args.reportRunId,
          eventType: REPORT_GENERATE_REQUESTED_EVENT,
          payload,
        },
      });

      await processReportsOutboxBatch({
        tenantId: args.tenantId,
        requestId: `${args.requestId}:delivery`,
        limit: 10,
      });
    })().catch((error: unknown) => {
      console.error("[sales-marketing-exports] async generate/delivery failed", {
        reportRunId: args.reportRunId,
        requestId: args.requestId,
        message: error instanceof Error ? error.message : "unknown",
      });
    });
  });
}
