import { headers } from "next/headers";
import { randomUUID } from "node:crypto";
import { getOrCreateRequestId } from "@atlas/core/request/request-id";
import { requirePlatformPrincipal } from "@atlas/auth/platform-auth";
import { withGlobalDb } from "@atlas/db/global-db";
import { cookies } from "next/headers";
import {
  filterPlatformNavigation,
  PLATFORM_PRIMARY_NAV,
  type PlatformNavItem,
} from "../../features/platform/platform-navigation";
import {
  projectPlatformCapabilities,
  type PlatformCapabilityProjection,
} from "../../features/platform/platform-capability-projection";
import { resolvePlatformHost } from "./platform-host-gate";

export type PlatformShellContext =
  | {
      kind: "ready";
      requestId: string;
      displayEmail: string;
      mfaEnabled: boolean;
      capabilities: PlatformCapabilityProjection;
      navigationItems: PlatformNavItem[];
    }
  | {
      kind: "host_blocked";
      requestId: string;
      message: string;
    }
  | {
      kind: "auth_blocked";
      requestId: string;
      message: string;
    }
  | {
      kind: "session_assurance_blocked";
      requestId: string;
      message: string;
    }
  | {
      kind: "platform_forbidden";
      requestId: string;
      message: string;
    };

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
    headers: { cookie: cookieHeader, host },
  });
}

export async function loadPlatformShellContext(): Promise<PlatformShellContext> {
  const headerList = await headers();
  const requestId = getOrCreateRequestId(headerList) || randomUUID();
  const host = headerList.get("host") ?? "localhost:3000";

  if (!resolvePlatformHost(host)) {
    return {
      kind: "host_blocked",
      requestId,
      message: "Platform console is only available on the configured platform host.",
    };
  }

  try {
    const req = await buildServerRequest();

    const principal = await withGlobalDb(async (db) => {
      const supabasePrincipal = await requirePlatformPrincipal({
        req: req as never,
        db,
        requiredPermission: "platform.tenant.read",
      });

      const rows = await db.$queryRaw<{ email: string; mfa_enabled: boolean }[]>`
        SELECT email, mfa_enabled
        FROM auth_principals
        WHERE id = ${supabasePrincipal.platformPrincipalId}::uuid
        LIMIT 1
      `;

      return {
        ...supabasePrincipal,
        email: rows[0]?.email ?? "platform-operator",
        mfaEnabled: rows[0]?.mfa_enabled ?? false,
      };
    });

    if (!principal.mfaEnabled) {
      return {
        kind: "session_assurance_blocked",
        requestId,
        message:
          "Platform console access requires multi-factor authentication on your account. Enable MFA and sign in again.",
      };
    }

    const capabilities = projectPlatformCapabilities(principal.platformPermissions);
    if (!capabilities.canTenantRead) {
      return {
        kind: "platform_forbidden",
        requestId,
        message: "You do not have platform console access.",
      };
    }

    return {
      kind: "ready",
      requestId,
      displayEmail: principal.email,
      mfaEnabled: principal.mfaEnabled,
      capabilities,
      navigationItems: filterPlatformNavigation(PLATFORM_PRIMARY_NAV, capabilities),
    };
  } catch {
    return {
      kind: "auth_blocked",
      requestId,
      message: "Sign in with a platform operator account to access the platform console.",
    };
  }
}
