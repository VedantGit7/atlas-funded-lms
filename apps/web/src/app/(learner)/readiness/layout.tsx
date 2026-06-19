import type { ReactNode } from "react";
import { LearnerShell } from "../../../components/shells/LearnerShell";

export default function ReadinessLayout({ children }: { children: ReactNode }) {
  return <LearnerShell>{children}</LearnerShell>;
}
