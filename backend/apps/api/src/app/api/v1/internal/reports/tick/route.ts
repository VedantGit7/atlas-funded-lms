import { tickReportSchedulesForActiveTenants } from "../../../../../../server/reports/reports-tick.service";
import { createCronHandler } from "../../../../../../server/internal/cron-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Manual report-schedule tick for every active tenant. The worker ticks each
 * tenant every minute; this is an operator tool, authorised with CRON_SECRET.
 * Do not also register it with a scheduler.
 */
const handle = createCronHandler({
  job: "reports-tick",
  failureCode: "REPORT_TICK_FAILED",
  run: (requestId) => tickReportSchedulesForActiveTenants(requestId),
});

export const GET = handle;
export const POST = handle;
