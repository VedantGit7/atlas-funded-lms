import type { Metadata } from "next";
import { loadPublicBootstrap } from "@/lib/server/bootstrap";
import { resolveTenantLogoUrl } from "@/lib/brand";
import { VerifyEmailScreen, type VerifyEmailStatus } from "./_components/VerifyEmailScreen";

export const metadata: Metadata = {
  title: "Verify your email",
  robots: { index: false, follow: false },
};

type VerifyEmailSearchParams = Promise<{
  email?: string;
  status?: string;
  next?: string;
}>;

/**
 * Only allow same-origin absolute paths as the success auto-redirect target, and
 * never bounce back into the auth/verify namespaces (which would loop).
 */
function sanitizeNext(value: string | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/";
  }
  if (value.startsWith("/auth/") || value.startsWith("/verify-email")) {
    return "/";
  }
  return value;
}

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: VerifyEmailSearchParams;
}) {
  const { email = "", status = "sent", next } = await searchParams;
  const normalizedStatus: VerifyEmailStatus =
    status === "success" || status === "expired" || status === "invalid" ? status : "sent";

  const branding = await loadPublicBootstrap();

  // Prefer the tenant's own support address. `PLATFORM_SUPPORT_EMAIL` is the
  // operator-configured fallback; when neither is set the contact line is
  // hidden rather than pointing learners at some other academy's inbox.
  const platformSupportEmail = process.env["PLATFORM_SUPPORT_EMAIL"]?.trim();
  const supportEmail = branding.supportEmail ?? (platformSupportEmail || null);

  return (
    <VerifyEmailScreen
      initialEmail={email}
      status={normalizedStatus}
      next={sanitizeNext(next)}
      logoUrl={resolveTenantLogoUrl(branding)}
      tenantName={branding.publicName}
      supportEmail={supportEmail}
    />
  );
}
