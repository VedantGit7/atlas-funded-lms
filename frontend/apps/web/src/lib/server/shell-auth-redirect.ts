import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { buildLoginRedirectUrl } from "../auth/auth-navigation";
import { resolveSafeRedirectPath } from "../auth/safe-redirect";

export async function redirectUnauthenticatedToLogin(fallbackPath: string): Promise<never> {
  const headerList = await headers();
  const pathname = headerList.get("x-atlas-pathname") ?? fallbackPath;
  redirect(buildLoginRedirectUrl(pathname));
}

/**
 * The session belongs to an account with an authenticator and hasn't passed
 * it yet (a Google or email-link sign-in), so the API answered MFA_REQUIRED
 * to the shell's own read: the sign-in page asks for the code, then comes
 * back here (security review 5.3, finding 2).
 */
export async function redirectPendingSecondFactorToLogin(fallbackPath: string): Promise<never> {
  const headerList = await headers();
  const pathname = headerList.get("x-atlas-pathname") ?? fallbackPath;
  const safe = resolveSafeRedirectPath(pathname) ?? "/";
  redirect(`/login?step=mfa&next=${encodeURIComponent(safe)}`);
}
