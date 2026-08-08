import Link from "next/link";
import { Award, Home, PenTool } from "lucide-react";
import type { z } from "zod";
import { AdminPageGate, PageHeader } from "../../../../components/patterns/AdminPageGate";
import {
  CERTIFICATE_STUDIO_HOME,
  CERTIFICATE_STUDIO_NEW,
} from "../../../../features/certificates/certificate-builder/studio-routes";
import { CertificateTemplateManager } from "../../../../features/certificates/components/CertificateTemplateManager";
import { ServerApiError, serverApi } from "../../../../lib/server-api";
import type { certificateTemplateListResponseSchema } from "@atlas/contracts/certificates/certificate.dto";

type CertificateTemplateListResponse = z.infer<typeof certificateTemplateListResponseSchema>;

export default async function AdminCertificateTemplatesPage() {
  try {
    const templates = await serverApi.get<CertificateTemplateListResponse>(
      "/api/v1/certificate-templates",
    );

    return (
      <AdminPageGate screenId="T12" state="ready" title="Certificate Templates">
        <main className="space-y-6">
          <header className="flex flex-wrap items-center justify-between gap-3">
            <PageHeader
              title="Certificate Templates"
              description="Create, preview, publish, and delete certificate templates."
            />
            <div className="flex flex-wrap items-center gap-3">
              <Link
                href={CERTIFICATE_STUDIO_HOME}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--admin-primary)] px-3 py-2 text-sm font-semibold text-[var(--admin-on-primary)] shadow-md transition-all hover:opacity-90"
              >
                <Home className="h-4 w-4" aria-hidden="true" strokeWidth={2.25} />
                Go to Home screen
              </Link>
              <Link
                href={CERTIFICATE_STUDIO_NEW}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--admin-border)] px-3 py-2 text-sm font-semibold text-[var(--admin-on-surface)] transition-colors hover:bg-[var(--admin-surface-low)]"
              >
                <PenTool className="h-4 w-4" aria-hidden="true" strokeWidth={2.25} />
                New design
              </Link>
              <Link
                href="/admin/certificates"
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--admin-primary)] transition-colors hover:text-[var(--admin-primary-strong)]"
              >
                <Award className="h-4 w-4" aria-hidden="true" strokeWidth={2.25} />
                Issued certificates
              </Link>
            </div>
          </header>
          <CertificateTemplateManager initialTemplates={templates.data} />
        </main>
      </AdminPageGate>
    );
  } catch (error: unknown) {
    if (error instanceof ServerApiError && (error.status === 401 || error.status === 403)) {
      return (
        <AdminPageGate
          screenId="T12"
          state="denied"
          title="Certificate Templates"
          deniedMessage="You do not have permission to manage certificate templates."
        />
      );
    }

    if (error instanceof ServerApiError) {
      return (
        <AdminPageGate
          screenId="T12"
          state="error"
          title="Certificate Templates"
          errorMessage={`Failed to load templates. Request ID: ${error.requestId}`}
        />
      );
    }

    throw error;
  }
}
