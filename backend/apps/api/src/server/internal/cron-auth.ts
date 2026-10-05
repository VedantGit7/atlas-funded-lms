import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { structuredLogger } from "@atlas/observability/logger";

/**
 * Shared guard and error handling for the CRON_SECRET endpoints (audit M5).
 *
 * The endpoints compared `authorization !== "Bearer <secret>"`, which returns
 * as soon as a character differs and so leaks how much of a guess was right,
 * and they returned `String(error)` to the caller, which can carry SQL,
 * hostnames and stack fragments. Both now go through here.
 */

function digest(value: string): Buffer {
  return createHash("sha256").update(value, "utf8").digest();
}

/**
 * Constant-time check of the bearer credential. Both sides are hashed first,
 * so the comparison also reveals nothing about the secret's length.
 */
export function cronCredentialMatches(header: string | null, secret: string): boolean {
  return timingSafeEqual(digest(header ?? ""), digest(`Bearer ${secret}`));
}

/** A response to send instead of running the job, or null when authorised. */
export function rejectUnauthorizedCron(req: NextRequest): NextResponse | null {
  const secret = process.env["CRON_SECRET"];
  if (!secret) {
    return NextResponse.json({ error: { code: "CRON_NOT_CONFIGURED" } }, { status: 503 });
  }
  if (!cronCredentialMatches(req.headers.get("authorization"), secret)) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED" } }, { status: 401 });
  }
  return null;
}

export function createCronRequestId(job: string): string {
  return `cron:${job}:${randomUUID()}`;
}

/**
 * Logs the failure with its detail and answers with a stable code and the
 * request id to look it up by. The detail never leaves the server.
 */
export function cronJobFailed(job: string, code: string, requestId: string, error: unknown) {
  structuredLogger.error({
    message: `Scheduled job ${job} failed`,
    module: "cron",
    eventType: "cron.job_failed",
    errorCode: code,
    requestId,
    detail: error instanceof Error ? error.message.slice(0, 500) : String(error).slice(0, 500),
  });
  return NextResponse.json(
    { error: { code, message: "The scheduled job failed. See server logs.", requestId } },
    { status: 502 },
  );
}

/** The whole handler shape the scheduled endpoints share. */
export function createCronHandler<T>(args: {
  job: string;
  failureCode: string;
  run: (requestId: string) => Promise<T>;
}) {
  return async function handle(req: NextRequest): Promise<NextResponse> {
    const rejected = rejectUnauthorizedCron(req);
    if (rejected) return rejected;

    const requestId = createCronRequestId(args.job);
    try {
      const data = await args.run(requestId);
      return NextResponse.json({ data, requestId }, { status: 200 });
    } catch (error) {
      return cronJobFailed(args.job, args.failureCode, requestId, error);
    }
  };
}
