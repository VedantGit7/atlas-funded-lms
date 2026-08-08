import type { ReactNode } from "react";
import { ModerationShell } from "../../components/shells/ModerationShell";

export default function ModerationLayout({ children }: { children: ReactNode }) {
  return <ModerationShell>{children}</ModerationShell>;
}
