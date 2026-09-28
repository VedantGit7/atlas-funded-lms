import type { ReactNode } from "react";
import { StudioShell } from "../../components/shells/StudioShell";
import { QueryProvider } from "../../components/providers/QueryProvider";

export default function StudioLayout({ children }: { children: ReactNode }) {
  return (
    <QueryProvider>
      <StudioShell>{children}</StudioShell>
    </QueryProvider>
  );
}
