import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { loadReviewShellContext } from "../../lib/server/review-shell-context";
import { buildTenantUnavailableUrl } from "../../lib/tenant-unavailable-redirect";
import { ReviewShellClient } from "./ReviewShellClient";

type ReviewShellGateProps = {
  children: ReactNode;
};

export async function ReviewShellGate({ children }: ReviewShellGateProps) {
  const context = await loadReviewShellContext();

  if (context.kind === "tenant_unavailable") {
    redirect(
      buildTenantUnavailableUrl({
        reason: context.reason,
        returnTo: "/review",
      }),
    );
  }

  return (
    <ReviewShellClient
      branding={context.branding}
      pendingReviewCount={context.pendingReviewCount}
      requestId={context.requestId}
    >
      {children}
    </ReviewShellClient>
  );
}
