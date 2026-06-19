import type { ReactNode } from "react";
import { ReviewShell } from "../../components/shells/ReviewShell";

export default function ReviewLayout({ children }: { children: ReactNode }) {
  return <ReviewShell>{children}</ReviewShell>;
}
