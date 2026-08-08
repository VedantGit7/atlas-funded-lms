import Link from "next/link";
import { BarChart3, FileEdit, Home } from "lucide-react";
import type { MembersListResponse } from "@atlas/contracts/membership/schemas/admin-members";
import type { z } from "zod";
import { AdminPageGate, PageHeader } from "../../../components/patterns/AdminPageGate";
import { AdminCertificatesClient } from "../../../features/certificates/components/AdminCertificatesClient";
import { ghostButtonClassName } from "../../../features/certificates/components/certificate-template-admin-shared";
import { ServerApiError, serverApi } from "../../../lib/server-api";
import type {
  certificateListResponseSchema,
  certificateTemplateListResponseSchema,
} from "@atlas/contracts/certificates/certificate.dto";

type CertificateListResponse = z.infer<typeof certificateListResponseSchema>;
type CertificateTemplateListResponse = z.infer<typeof certificateTemplateListResponseSchema>;
type MemberListItem = MembersListResponse["data"]["items"][number];

type CourseListResponse = {
  data: {
    items: Array<{ id: string; title: string }>;
  };
};

function memberLabel(member: MemberListItem): string {
  return member.profile?.displayName ?? member.invitedEmail ?? member.id;
}

export default async function AdminCertificatesPage() {
  try {
    const [certificates, templates, members, courses] = await Promise.all([
      serverApi.get<CertificateListResponse>("/api/v1/certificates?limit=50"),
      serverApi.get<CertificateTemplateListResponse>("/api/v1/certificate-templates"),
      serverApi.get<MembersListResponse>("/api/v1/members?limit=25&status=ACTIVE"),
      serverApi
        .get<CourseListResponse>("/api/v1/courses?limit=25&status=PUBLISHED")
        .catch(() => ({ data: { items: [] as Array<{ id: string; title: string }> } })),
    ]);

    const publishedTemplates = templates.data.filter(
      (template: { status?: string }) => template.status === "PUBLISHED",
    );
    const sourceOptions = courses.data.items.map((course) => ({
      type: "course" as const,
      id: course.id,
      label: `Course · ${course.title}`,
    }));
    const defaultSource = {
      type: "course" as const,
      id: sourceOptions[0]?.id ?? "",
    };

    return (
      <AdminPageGate screenId="T13" state="ready" title="Issued Certificates">
        <main className="flex min-h-0 flex-1 flex-col gap-6">
          <header className="flex flex-wrap items-center justify-between gap-3">
            <PageHeader
              title="Issued Certificates"
              description="Issue and revoke tenant credentials."
            />
            <div className="flex items-center gap-4">
              <Link
                href="/admin/certificate-builder/home"
                className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--admin-primary)] px-3 py-2 text-sm font-semibold text-[var(--admin-on-primary)] shadow-md transition-all hover:opacity-90"
              >
                <Home className="h-4 w-4" aria-hidden="true" strokeWidth={2.25} />
                Go to Home screen
              </Link>
              <Link href="/admin/certificates/analytics" className={ghostButtonClassName}>
                <BarChart3 className="h-4 w-4" aria-hidden="true" />
                Analytics
              </Link>
              <Link href="/admin/certificates/templates" className={ghostButtonClassName}>
                <FileEdit className="h-4 w-4" aria-hidden="true" />
                Manage templates
              </Link>
            </div>
          </header>
          <AdminCertificatesClient
            initialCertificates={certificates.data}
            templates={publishedTemplates.map((template: { id: string; name: string }) => ({
              id: template.id,
              name: template.name,
            }))}
            members={members.data.items.map((member) => ({
              id: member.id,
              label: memberLabel(member),
            }))}
            sourceOptions={sourceOptions}
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
