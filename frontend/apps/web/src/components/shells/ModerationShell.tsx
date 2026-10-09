import type { ReactNode } from "react";
import { ModerationShellGate } from "./ModerationShellGate";
import { MODERATION_PRIMARY_NAV } from "../../features/moderation/moderation-navigation";

/**
 * Moderation shell navigation contract:
 * /moderate/cases /moderate/appeals /moderate/spaces
 * /review (when workflow.transition.act is available for moderation workflows)
 */
export const moderationShellNavigationContract = MODERATION_PRIMARY_NAV;

type ModerationShellProps = {
  children: ReactNode;
};

export function ModerationShell({ children }: ModerationShellProps) {
  return <ModerationShellGate>{children}</ModerationShellGate>;
}

export { ModerationShellClient } from "./ModerationShellClient";
