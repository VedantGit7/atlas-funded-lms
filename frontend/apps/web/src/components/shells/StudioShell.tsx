import type { ReactNode } from "react";
import { StudioShellGate } from "./StudioShellGate";
import { STUDIO_PRIMARY_NAV } from "../../features/studio/studio-navigation";

/**
 * Studio shell navigation contract:
 * /studio /studio/courses /studio/items /studio/item-collections
 * /studio/assessments /studio/learning-paths /studio/grading /studio/analytics
 * /studio/review (when workflow.transition.act is available)
 */
export const studioShellNavigationContract = STUDIO_PRIMARY_NAV;

type StudioShellProps = {
  children: ReactNode;
};

export function StudioShell({ children }: StudioShellProps) {
  return <StudioShellGate>{children}</StudioShellGate>;
}

export { StudioShellClient } from "./StudioShellClient";
