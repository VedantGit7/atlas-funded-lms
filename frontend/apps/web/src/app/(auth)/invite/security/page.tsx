import { InviteSecuritySetup } from "./_components/InviteSecuritySetup";
import { resolveSafeRedirectPath } from "@/lib/auth/safe-redirect";

type InviteSecurityPageProps = Readonly<{
  searchParams: Promise<{ next?: string }>;
}>;

export default async function InviteSecurityPage({ searchParams }: InviteSecurityPageProps) {
  const { next } = await searchParams;
  const continuePath = resolveSafeRedirectPath(next) ?? "/admin";

  return <InviteSecuritySetup continuePath={continuePath} />;
}
