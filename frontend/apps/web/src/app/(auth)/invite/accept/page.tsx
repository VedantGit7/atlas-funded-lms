import { Suspense } from "react";
import { InviteAcceptCard } from "./_components/InviteAcceptCard";
import { loadInviteAcceptContext } from "@/lib/server/load-invite-accept-context";

type InviteAcceptPageProps = {
  searchParams: Promise<{ token?: string }>;
};

export default async function InviteAcceptPage({ searchParams }: InviteAcceptPageProps) {
  const { token } = await searchParams;
  const context = await loadInviteAcceptContext(token);

  return (
    <Suspense fallback={<p>Loading invitation...</p>}>
      <InviteAcceptCard
        token={token ?? ""}
        isAuthenticated={context.isAuthenticated}
        signedInEmail={context.signedInEmail}
        invitedEmail={context.invitedEmail}
        inviteValid={context.inviteValid}
      />
    </Suspense>
  );
}
