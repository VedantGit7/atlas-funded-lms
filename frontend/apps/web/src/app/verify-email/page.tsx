import type { Metadata } from "next";
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

  return (
    <VerifyEmailScreen
      initialEmail={email}
      status={normalizedStatus}
      next={sanitizeNext(next)}
    />
  );
}
