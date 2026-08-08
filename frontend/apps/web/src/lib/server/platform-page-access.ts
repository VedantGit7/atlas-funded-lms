import { loadPlatformShellContext } from "./platform-shell-context";
import type { PlatformCapabilityProjection } from "../../features/platform/platform-capability-projection";
import { projectPlatformCapabilities } from "../../features/platform/platform-capability-projection";

export type PlatformPageAccess =
  | { kind: "ready"; capabilities: PlatformCapabilityProjection }
  | { kind: "denied"; message: string };

export async function loadPlatformPageAccess(): Promise<PlatformPageAccess> {
  const context = await loadPlatformShellContext();

  if (context.kind !== "ready") {
    return {
      kind: "denied",
      message:
        context.kind === "host_blocked"
          ? context.message
          : context.kind === "session_assurance_blocked"
            ? context.message
            : context.kind === "platform_forbidden"
              ? context.message
              : "Sign in with a platform operator account to access this screen.",
    };
  }

  return { kind: "ready", capabilities: context.capabilities };
}

export function emptyPlatformCapabilities(): PlatformCapabilityProjection {
  return projectPlatformCapabilities([]);
}
