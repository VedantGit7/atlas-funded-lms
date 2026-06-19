import type { ReactNode } from "react";
import { LearnerShell } from "../../../components/shells/LearnerShell";

export default function LearnerProgressLayout({ children }: { children: ReactNode }) {
  return <LearnerShell>{children}</LearnerShell>;
}
