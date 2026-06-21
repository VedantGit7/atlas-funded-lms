import Link from "next/link";
import type { z } from "zod";
import { AdminPageGate, PageHeader } from "../../../../components/patterns/AdminPageGate";
import { CertificateTemplateManager } from "../../../../features/certificates/components/CertificateTemplateManager";
import { ServerApiError, serverApi } from "../../../../lib/server-api";
import type { certificateTemplateListResponseSchema } from "../../../../server/certificates/certificate.dto";

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
            <Link href="/admin/certificates" className="text-sm underline">
              Issued certificates
            </Link>
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
