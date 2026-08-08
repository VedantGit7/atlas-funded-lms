/**
 * Shared Certificate Studio side-nav destinations (stay inside the builder).
 */

import type { LucideIcon } from "lucide-react";
import { BadgeCheck, BarChart3, FileText, LayoutTemplate, Palette } from "lucide-react";
import {
  CERTIFICATE_BUILDER_ROOT,
  CERTIFICATE_STUDIO_HOME,
  CERTIFICATE_STUDIO_TEMPLATES,
} from "./studio-routes";

export type StudioNavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Match against pathname for active state. */
  match: (pathname: string) => boolean;
};

export const STUDIO_NAV_ITEMS: StudioNavItem[] = [
  {
    href: CERTIFICATE_STUDIO_HOME,
    label: "Studio Home",
    icon: LayoutTemplate,
    match: (pathname) =>
      pathname === CERTIFICATE_STUDIO_HOME || pathname === CERTIFICATE_BUILDER_ROOT,
  },
  {
    href: "/admin/certificates",
    label: "Issued Certificates",
    icon: BadgeCheck,
    match: (pathname) =>
      pathname === "/admin/certificates" ||
      (pathname.startsWith("/admin/certificates/") &&
        !pathname.startsWith("/admin/certificates/analytics") &&
        !pathname.startsWith("/admin/certificates/brand-kit") &&
        !pathname.startsWith("/admin/certificates/templates")),
  },
  {
    href: CERTIFICATE_STUDIO_TEMPLATES,
    label: "Templates",
    icon: FileText,
    match: (pathname) => pathname === CERTIFICATE_STUDIO_TEMPLATES,
  },
  {
    href: "/admin/certificates/analytics",
    label: "Analytics",
    icon: BarChart3,
    match: (pathname) => pathname.startsWith("/admin/certificates/analytics"),
  },
  {
    href: "/admin/certificates/brand-kit",
    label: "Brand Kit",
    icon: Palette,
    match: (pathname) => pathname.startsWith("/admin/certificates/brand-kit"),
  },
];
