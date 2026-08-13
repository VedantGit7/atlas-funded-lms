import { NextResponse, type NextRequest } from "next/server";
import {
  createReportsTickRequestId,
  tickReportSchedulesForActiveTenants,
} from "../../../../../../server/reports/reports-tick.service";
import { routeMetadata } from "./route.metadata";

void routeMetadata;

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Alias of `/api/v1/internal/reports/tick`.
 * Fan-out across active tenants with CRON_SECRET — does not require x-tenant-id.
 */
async function handle(req: NextRequest): Promise<NextResponse> {
  const secret = process.env["CRON_SECRET"];
  if (!secret) {
    return NextResponse.json({ error: { code: "CRON_NOT_CONFIGURED" } }, { status: 503 });
  }
  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED" } }, { status: 401 });
  }

  const requestId = createReportsTickRequestId();
  try {
    const result = await tickReportSchedulesForActiveTenants(requestId);
    return NextResponse.json({ data: result }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: { code: "REPORT_TICK_FAILED", message: String(error) } },
      { status: 502 },
    );
  }
}

export const GET = handle;
export const POST = handle;
