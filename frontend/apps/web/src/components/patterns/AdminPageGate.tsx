import type { ReactNode } from "react";
import type { AdminScreenId } from "../../features/admin/admin-route-registry";
import { getAdminRouteByScreenId } from "../../features/admin/admin-route-registry";
import { PageGate } from "./PageGate";

type AdminPageGateState = "ready" | "denied" | "not_found" | "error";

type AdminPageGateProps = {
  screenId: AdminScreenId;
  state: AdminPageGateState;
  title: string;
  deniedMessage?: string;
  notFoundMessage?: string;
  errorMessage?: string;
  children?: ReactNode;
};

export function AdminPageGate({
  screenId,
  state,
  title,
  deniedMessage,
  notFoundMessage,
  errorMessage,
  children,
}: AdminPageGateProps) {
  getAdminRouteByScreenId(screenId);

  return (
    <PageGate
      state={state}
      title={title}
      {...(deniedMessage ? { deniedMessage } : {})}
      {...(notFoundMessage ? { notFoundMessage } : {})}
      {...(errorMessage ? { errorMessage } : {})}
    >
      {children}
    </PageGate>
  );
}

export { PageHeader } from "./PageGate";
