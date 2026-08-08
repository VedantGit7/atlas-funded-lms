/**
 * Restrict post-auth redirects to same-origin relative paths.
 */
export function resolveSafeRedirectPath(value: string | undefined | null): string | null {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) {
    return null;
  }

  if (trimmed.includes("://") || trimmed.includes("\\")) {
    return null;
  }

  return trimmed;
}

export function resolvePostAuthRedirect(
  clientRedirect: string | null,
  apiRedirect: string | null,
  fallback: string | null = null,
): string | null {
  return (
    resolveSafeRedirectPath(clientRedirect) ??
    resolveSafeRedirectPath(apiRedirect) ??
    resolveSafeRedirectPath(fallback)
  );
}
