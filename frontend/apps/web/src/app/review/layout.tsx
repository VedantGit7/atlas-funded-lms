import type { ReactNode } from "react";

type ReviewLayoutProps = Readonly<{
  children: ReactNode;
}>;

/** Review content is served from /admin/review; this layout avoids the legacy standalone shell. */
export default function ReviewLayout({ children }: ReviewLayoutProps) {
  return children;
}
