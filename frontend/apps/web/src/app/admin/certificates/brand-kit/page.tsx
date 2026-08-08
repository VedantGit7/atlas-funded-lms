import Link from "next/link";
import { Award, Home, PenTool } from "lucide-react";
import { AdminPageGate, PageHeader } from "../../../../components/patterns/AdminPageGate";
import { ServerApiError, serverApi } from "../../../../lib/server-api";
import {
  CertificateBrandKitManager,
  type BrandKit,
} from "../../../../features/certificates/certificate-brand-kit-manager";

type BrandKitListResponse = { data: BrandKit[] };

export default async function AdminCertificateBrandKitPage() {
  try {
    const kits = await serverApi.get<BrandKitListResponse>("/api/v1/certificate-brand-kits");

    return (
      <AdminPageGate screenId="T12" state="ready" title="Certificate Brand Kit">
        <main className="space-y-6">
          <header className="flex flex-wrap items-center justify-between gap-3">
            <PageHeader
              title="Certificate Brand Kit"
              description="Reusable logos, colors and fonts that Certificate Studio designs can pull from."
            />
            <div className="flex flex-wrap items-center gap-3">
              <Link
                href="/admin/certificate-builder/home"
                className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--admin-primary)] px-3 py-2 text-sm font-semibold text-[var(--admin-on-primary)] shadow-md transition-all hover:opacity-90"
              >
                <Home className="h-4 w-4" aria-hidden="true" strokeWidth={2.25} />
                Go to Home screen
              </Link>
              <Link
                href="/admin/certificate-builder/home"
                className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--admin-border)] px-3 py-2 text-sm font-semibold text-[var(--admin-on-surface)] transition-colors hover:bg-[var(--admin-surface-low)]"
              >
                <PenTool className="h-4 w-4" aria-hidden="true" strokeWidth={2.25} />
                Open Studio
              </Link>
              <Link
                href="/admin/certificates/templates"
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--admin-primary)] transition-colors hover:text-[var(--admin-primary-strong)]"
              >
                <Award className="h-4 w-4" aria-hidden="true" strokeWidth={2.25} />
                Templates
              </Link>
            </div>
          </header>

          <CertificateBrandKitManager initialKits={kits.data} />
        </main>
      </AdminPageGate>
    );
  } catch (error: unknown) {
    if (error instanceof ServerApiError && (error.status === 401 || error.status === 403)) {
      return (
        <AdminPageGate
          screenId="T12"
          state="denied"
          title="Certificate Brand Kit"
          deniedMessage="You do not have permission to view the certificate brand kit."
        />
      );
    }

    if (error instanceof ServerApiError) {
      return (
        <AdminPageGate
          screenId="T12"
          state="error"
          title="Certificate Brand Kit"
          errorMessage={`Failed to load brand kit. Request ID: ${error.requestId}`}
        />
      );
    }

    throw error;
  }
}
