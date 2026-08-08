"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";

export function AccountSettingsContentFrame({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isWide = pathname.startsWith("/profile/notifications");
  const maxWidthClass = isWide ? "max-w-[1000px]" : "max-w-[800px]";

  return (
    <div className={`mx-auto px-4 py-8 sm:px-8 sm:py-10 md:px-12 ${maxWidthClass}`}>{children}</div>
  );
}
