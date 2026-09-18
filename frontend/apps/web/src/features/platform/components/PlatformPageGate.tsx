import type { ReactNode } from "react";
import type { PlatformScreenId } from "../platform-route-registry";
import { PageGate } from "../../../components/patterns/PageGate";

type PlatformPageGateState = "ready" | "denied";

type PlatformPageGateProps = {
  screenId: PlatformScreenId;
  state: PlatformPageGateState;
  title: string;
  deniedMessage?: string;
  children?: ReactNode;
};

export function PlatformPageGate({
  state,
  title,
  deniedMessage = "You do not have permission to access this platform screen.",
  children,
}: PlatformPageGateProps) {
  return (
    <PageGate state={state} title={title} {...(deniedMessage ? { deniedMessage } : {})}>
      {children}
    </PageGate>
  );
}
