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

/**
 * Where a signed-in person who hasn't agreed to this academy's Terms and
 * Privacy Policy goes (launch plan 5.7): the join page, which carries on to
 * where they were headed once they agree.
 */
export function termsRequiredDestination(clientRedirect: string | null): string {
  const next = resolveSafeRedirectPath(clientRedirect);
  return next ? `/join?next=${encodeURIComponent(next)}` : "/join";
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
