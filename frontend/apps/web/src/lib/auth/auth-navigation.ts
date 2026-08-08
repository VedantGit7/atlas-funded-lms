import { resolveSafeRedirectPath } from "./safe-redirect";

export function buildLoginRedirectUrl(returnTo: string): string {
  const safe = resolveSafeRedirectPath(returnTo) ?? "/";
  return `/login?next=${encodeURIComponent(safe)}`;
}
