import type { ReactNode } from "react";
import { LearnerShellGate } from "./LearnerShellGate";
import { LEARNER_PRIMARY_NAV } from "../../features/learner/learner-navigation";

/**
 * Learner shell navigation contract:
 * / /courses /roadmap /practice /diagnostic/me /readiness /progress /resources
 * /achievements /leaderboards /community /hall-of-fame /certificates /notifications /search /help
 * Topbar search entry: href="/search"
 */
export const learnerShellNavigationContract = LEARNER_PRIMARY_NAV;

type LearnerShellProps = {
  children: ReactNode;
};

export function LearnerShell({ children }: LearnerShellProps) {
  return <LearnerShellGate>{children}</LearnerShellGate>;
}

export { LearnerShellClient } from "./LearnerShellClient";
