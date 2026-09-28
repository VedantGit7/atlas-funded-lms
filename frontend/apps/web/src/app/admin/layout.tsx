import { headers } from "next/headers";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { TenantAdminShell } from "../../components/shells/TenantAdminShell";
import { QueryProvider } from "../../components/providers/QueryProvider";
import {
  resolveDocumentDescription,
  resolveDocumentTitle,
} from "../../lib/branding/document-title";
import { loadPublicBootstrap } from "../../lib/server/bootstrap";

export const dynamic = "force-dynamic";

/**
 * Belt-and-suspenders: admin segment always re-asserts the tenant LMS title
 * so a child absolute title (or a failed root pass) cannot leave "Atlas LMS"
 * on tenant admin pages.
 */
export async function generateMetadata(): Promise<Metadata> {
  try {
    const bootstrap = await loadPublicBootstrap();
    const title = resolveDocumentTitle(bootstrap);
    return {
      title: {
        default: title,
        template: `%s · ${title}`,
      },
      description: resolveDocumentDescription(bootstrap),
    };
  } catch {
    return {};
  }
}

function isCertificateBuilderRoute(pathname: string): boolean {
  return (
    pathname === "/admin/certificate-builder" || pathname.startsWith("/admin/certificate-builder/")
  );
}

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const pathname = (await headers()).get("x-atlas-pathname") ?? "";

  // Dedicated Certificate Builder — no admin shell chrome; owns its own UI.
  if (isCertificateBuilderRoute(pathname)) {
    return <QueryProvider>{children}</QueryProvider>;
  }

  return (
    <QueryProvider>
      <TenantAdminShell>{children}</TenantAdminShell>
    </QueryProvider>
  );
}
