/**
 * Build a tenant-unavailable URL that preserves where the user was headed so
 * transient resolution misses can retry the original destination.
 */
export function buildTenantUnavailableUrl(args: {
  reason: string;
  returnTo?: string | null;
}): string {
  const params = new URLSearchParams({ reason: args.reason });

  if (args.returnTo?.startsWith("/") && !args.returnTo.startsWith("//")) {
    params.set("next", args.returnTo);
  }

  return `/tenant-unavailable?${params.toString()}`;
}
