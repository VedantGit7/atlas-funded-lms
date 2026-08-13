import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { expireDueCertificatesForActiveTenants } from "../../../../../../server/certificates/certificate-expiry.service";
import { routeMetadata } from "./route.metadata";

void routeMetadata;

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Expire due certificates across all active tenants and best-effort drain
 * certificate PDF outbox events. Triggered by cron with CRON_SECRET.
 */
async function handle(req: NextRequest): Promise<NextResponse> {
  const secret = process.env["CRON_SECRET"];
  if (!secret) {
    return NextResponse.json({ error: { code: "CRON_NOT_CONFIGURED" } }, { status: 503 });
  }
  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED" } }, { status: 401 });
  }

  const requestId = randomUUID();
  try {
    const result = await expireDueCertificatesForActiveTenants(requestId);
    return NextResponse.json({ data: result }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: { code: "CERTIFICATE_EXPIRY_FAILED", message: String(error) } },
      { status: 502 },
    );
  }
}

export const GET = handle;
export const POST = handle;
