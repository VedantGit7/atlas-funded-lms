import { cookies, headers } from "next/headers";
import { randomUUID } from "node:crypto";
import { getOrCreateRequestId } from "@atlas/core/request/request-id";
import { requirePlatformPrincipal } from "@atlas/auth/platform-auth";
import { withGlobalDb } from "@atlas/db/global-db";
import { withPlatformScope } from "@atlas/db";
import { listActivePlatformSupportSessions } from "@atlas/domain-tenancy";
import { readPlatformDeadLetterList } from "@atlas/events";
import type { DeadLetterListQuery } from "@atlas/events/schemas/dead-letter-list";

const MIN_REASON_LENGTH = 10;

function assertReason(reason: string): string {
  const normalized = reason.trim();
  if (normalized.length < MIN_REASON_LENGTH) {
    throw new Error("PLATFORM_REASON_REQUIRED");
  }
  return normalized;
}

async function buildServerRequest(): Promise<Request> {
  const headerList = await headers();
  const cookieStore = await cookies();
  const cookieHeader = cookieStore
    .getAll()
    .map((cookie) => `${cookie.name}=${cookie.value}`)
    .join("; ");

  const host = headerList.get("host") ?? "localhost:3000";
  const proto = headerList.get("x-forwarded-proto") ?? "http";

  return new Request(`${proto}://${host}/platform`, {
    headers: {
      cookie: cookieHeader,
      host,
    },
  });
}

async function runPlatformRead<T>(
  requiredPermission: `platform.${string}`,
  reason: string,
  fn: (tx: Parameters<Parameters<typeof withPlatformScope>[2]>[0]) => Promise<T>,
): Promise<T> {
  const normalizedReason = assertReason(reason);
  const headerList = await headers();
  const requestId = getOrCreateRequestId(headerList) || randomUUID();
  const req = await buildServerRequest();

  return withGlobalDb(async (db) => {
    const principal = await requirePlatformPrincipal({
      req: req as never,
      db,
      requiredPermission,
    });

    return withPlatformScope(
      {
        principalId: principal.platformPrincipalId,
        requestId,
        requiredPermission,
        platformPermissions: principal.platformPermissions as never,
        route: "platform.server-read",
      },
      normalizedReason,
      fn,
    );
  });
}

export async function loadActiveSupportSessionsProjection(reason: string) {
  return runPlatformRead("platform.support.access", reason, async (tx) =>
    listActivePlatformSupportSessions(tx),
  );
}

export async function loadDeadLetterListProjection(reason: string, query: DeadLetterListQuery) {
  return runPlatformRead("platform.tenant.manage", reason, async (tx) =>
    readPlatformDeadLetterList(tx, query),
  );
}
