/** Tenant host segment for React Query keys (host-based tenancy in local dev). */
export type QueryHostScope = Readonly<{
  host: string;
}>;

export function resolveQueryHostScope(host?: string): QueryHostScope {
  if (host) {
    return { host };
  }

  if (typeof window === "undefined") {
    return { host: "server" };
  }

  return { host: window.location.host };
}

export function withQueryHost<T extends readonly unknown[]>(
  base: T,
  host?: string,
): readonly [...T, QueryHostScope] {
  return [...base, resolveQueryHostScope(host)] as readonly [...T, QueryHostScope];
}
