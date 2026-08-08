import type { ReactNode } from "react";
import { PlatformConsoleShellGate } from "./PlatformConsoleShellGate";

export const platformConsoleShellNavigationContract = {
  shell: "PlatformConsoleShell",
  routes: "P1-P8",
};

type PlatformConsoleShellProps = {
  children: ReactNode;
};

export function PlatformConsoleShell({ children }: PlatformConsoleShellProps) {
  return <PlatformConsoleShellGate>{children}</PlatformConsoleShellGate>;
}

export { PlatformConsoleShellClient } from "./PlatformConsoleShellClient";
