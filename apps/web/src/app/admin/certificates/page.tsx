import Link from "next/link";
import type { MembersListResponse } from "@atlas/membership";
import type { z } from "zod";
import { AdminPageGate, PageHeader } from "../../../components/patterns/AdminPageGate";
import { AdminCertificatesClient } from "../../../features/certificates/components/AdminCertificatesClient";
import { ServerApiError, serverApi } from "../../../lib/server-api";
import type {
  certificateListResponseSchema,
  certificateTemplateListResponseSchema,
} from "../../../server/certificates/certificate.dto";

type CertificateListResponse = z.infer<typeof certificateListResponseSchema>;
type CertificateTemplateListResponse = z.infer<typeof certificateTemplateListResponseSchema>;

export default async function AdminCertificatesPage() {
  try {
    const [certificates, templates, members] = await Promise.all([
      serverApi.get<CertificateListResponse>("/api/v1/certificates?limit=50"),
      serverApi.get<CertificateTemplateListResponse>("/api/v1/certificate-templates"),
      serverApi.get<MembersListResponse>("/api/v1/members?limit=25&status=ACTIVE"),
    ]);

    const publishedTemplates = templates.data.filter((template) => template.status === "PUBLISHED");
    const defaultSource = { type: "course" as const, id: members.data.items[0]?.id ?? "" };

    return (
      <AdminPageGate screenId="T13" state="ready" title="Issued Certificates">
        <main className="space-y-6">
          <header className="flex flex-wrap items-center justify-between gap-3">
            <PageHeader
              title="Issued Certificates"
              description="Issue and revoke tenant credentials."
            />
            <Link href="/admin/certificates/templates" className="text-sm underline">
              Manage templates
            </Link>
          </header>
          <AdminCertificatesClient
            initialCertificates={certificates.data}
            templates={publishedTemplates.map((template) => ({
              id: template.id,
              name: template.name,
            }))}
            members={members.data.items.map((member) => ({
              id: member.id,
              label: member.profile?.displayName ?? member.id,
            }))}
            defaultSource={defaultSource}
          />
        </main>
      </AdminPageGate>
    );
  } catch (error: unknown) {
    if (error instanceof ServerApiError && (error.status === 401 || error.status === 403)) {
      return (
        <AdminPageGate
          screenId="T13"
          state="denied"
          title="Issued Certificates"
          deniedMessage="You do not have permission to manage certificates."
        />
      );
    }

    if (error instanceof ServerApiError) {
      return (
        <AdminPageGate
          screenId="T13"
          state="error"
          title="Issued Certificates"
          errorMessage={`Failed to load certificates. Request ID: ${error.requestId}`}
        />
      );
    }

    throw error;
  }
}
