import type { AuthPrincipalBridge, SessionSafeIdentity } from "./types";

export function toSessionSafeIdentity(principal: AuthPrincipalBridge): SessionSafeIdentity {
  return {
    authenticated: true,
    email: principal.email,
    emailNormalized: principal.emailNormalized,
    mfaEnabled: principal.mfaEnabled,
    globalStatus: principal.globalStatus,
  };
}
