import { Suspense } from "react";
import { headers } from "next/headers";
import { extractAccessToken } from "@atlas/auth/session";
import { InviteAcceptCard } from "./_components/InviteAcceptCard";

export default async function InviteAcceptPage() {
  const headerList = await headers();
  const request = new Request("https://placeholder.local", {
    headers: { cookie: headerList.get("cookie") ?? "" },
  });
  const accessToken = await extractAccessToken(request);

  return (
    <Suspense fallback={<p>Loading invitation...</p>}>
      <InviteAcceptCard isAuthenticated={Boolean(accessToken)} />
    </Suspense>
  );
}
