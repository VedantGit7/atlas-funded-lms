import { headers } from "next/headers";
import { randomUUID } from "node:crypto";
import { getOrCreateRequestId } from "../request-id";
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
import { serverApi } from "../server-api";

type PlatformShellApiResponse = {
  data: {
    email: string;
    mfaEnabled: boolean;
    platformPermissions: string[];
  };
};

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
    const principal = await serverApi.get<PlatformShellApiResponse>("/api/v1/platform/shell");

    if (!principal.data.mfaEnabled) {
      return {
        kind: "session_assurance_blocked",
        requestId,
        message:
          "Platform console access requires multi-factor authentication on your account. Enable MFA and sign in again.",
      };
    }

    const capabilities = projectPlatformCapabilities(principal.data.platformPermissions);
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
      displayEmail: principal.data.email,
      mfaEnabled: principal.data.mfaEnabled,
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
