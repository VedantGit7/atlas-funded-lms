import type { ReactNode } from "react";
import { ModerationShell } from "../../components/shells/ModerationShell";
import { QueryProvider } from "../../components/providers/QueryProvider";

export default function ModerationLayout({ children }: { children: ReactNode }) {
  return (
    <QueryProvider>
      <ModerationShell>{children}</ModerationShell>
    </QueryProvider>
  );
}
