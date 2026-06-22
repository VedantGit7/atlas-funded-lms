import { PlatformConsoleShell } from "../../components/shells/PlatformConsoleShell";

export default function PlatformLayout({ children }: { children: React.ReactNode }) {
  return <PlatformConsoleShell>{children}</PlatformConsoleShell>;
}
