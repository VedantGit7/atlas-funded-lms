import type { Metadata } from "next";
import { resolveSafeRedirectPath } from "@/lib/auth/safe-redirect";
import { JoinForm } from "./_components/JoinForm";

export const metadata: Metadata = {
  title: "Agree to continue",
};

type JoinPageProps = {
  searchParams: Promise<{ next?: string }>;
};

/**
 * Where sign-in sends someone who hasn't agreed to this academy's Terms and
 * Privacy Policy yet (launch plan 5.7). Nothing is opened until they agree.
 */
export default async function JoinPage({ searchParams }: JoinPageProps) {
  const { next } = await searchParams;
  return <JoinForm next={resolveSafeRedirectPath(next)} />;
}
