import type { ReactNode } from "react";
import { ReviewShellGate } from "./ReviewShellGate";

type ReviewShellProps = {
  children: ReactNode;
};

/** @deprecated Use ReviewShellGate from layouts; kept for barrel export parity. */
export function ReviewShell({ children }: ReviewShellProps) {
  return <ReviewShellGate>{children}</ReviewShellGate>;
}

export { ReviewShellClient } from "./ReviewShellClient";
export { ReviewShellGate } from "./ReviewShellGate";
