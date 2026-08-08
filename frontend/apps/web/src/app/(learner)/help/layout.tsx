import type { ReactNode } from "react";
import { LearnerShell } from "../../../components/shells/LearnerShell";

export default function HelpLayout({ children }: { children: ReactNode }) {
  return <LearnerShell>{children}</LearnerShell>;
}
