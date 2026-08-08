"use client";

import type { ReactNode } from "react";
import { BrandingAnimatedCollapsible } from "../../../app/admin/branding/_components/branding-admin-shared";

export function GamificationAnimatedCollapsible({
  open,
  id,
  children,
  className = "",
  noTopMargin = false,
}: {
  open: boolean;
  id: string;
  children: ReactNode;
  className?: string;
  noTopMargin?: boolean;
}) {
  return (
    <BrandingAnimatedCollapsible
      open={open}
      id={id}
      className={className}
      noTopMargin={noTopMargin}
    >
      {children}
    </BrandingAnimatedCollapsible>
  );
}
