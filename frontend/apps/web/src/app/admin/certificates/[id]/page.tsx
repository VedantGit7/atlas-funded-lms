import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink } from "lucide-react";
import type { z } from "zod";
import type { certificateDetailResponseSchema } from "@atlas/contracts/certificates/certificate.dto";
import { AdminPageGate, PageHeader } from "../../../../components/patterns/AdminPageGate";
import { CertificateDetailActions } from "../../../../features/certificates/components/CertificateDetailActions";
import {
  CertificateStatusPill,
  ghostButtonClassName,
  outlineButtonClassName,
} from "../../../../features/certificates/components/certificate-template-admin-shared";
import { ServerApiError, serverApi } from "../../../../lib/server-api";

type CertificateDetailResponse = z.infer<typeof certificateDetailResponseSchema>;

export default async function AdminCertificateDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  try {
    const { data: certificate } = await serverApi.get<CertificateDetailResponse>(
      `/api/v1/certificates/${id}`,
    );
    const recipient =
      certificate.recipientName ?? certificate.recipientLabel ?? certificate.membershipId;

    return (
      <AdminPageGate screenId="T13" state="ready" title="Certificate details">
        <main className="flex flex-col gap-6">
          <header className="flex flex-wrap items-center justify-between gap-3">
            <PageHeader
              title={certificate.courseTitle ?? certificate.templateName}
              description={`Credential ${certificate.credentialId}`}
            />
            <Link href="/admin/certificates" className={ghostButtonClassName}>
              Back to certificates
            </Link>
          </header>

          <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
            <article className="overflow-hidden rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-sm">
              <div className="border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-6 py-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--admin-on-surface-variant)]">
                      Recipient
                    </p>
                    <h2 className="mt-1 text-xl font-semibold text-[var(--admin-on-surface)]">
                      {recipient}
                    </h2>
                  </div>
                  <CertificateStatusPill status={certificate.status} />
                </div>
              </div>

              <dl className="grid gap-px bg-[var(--admin-border)] sm:grid-cols-2">
                {[
                  ["Template", certificate.templateName],
                  ["Issued", new Date(certificate.issuedAt).toLocaleString()],
                  [
                    "Expires",
                    certificate.expiresAt
                      ? new Date(certificate.expiresAt).toLocaleString()
                      : "No expiration",
                  ],
                  ["Snapshot hash", certificate.designSnapshotHash ?? "Not recorded"],
                ].map(([label, value]) => (
                  <div key={label} className="bg-[var(--admin-surface)] px-6 py-5">
                    <dt className="text-xs font-bold uppercase tracking-wide text-[var(--admin-on-surface-variant)]">
                      {label}
                    </dt>
                    <dd className="mt-2 break-all text-sm font-medium text-[var(--admin-on-surface)]">
                      {value}
                    </dd>
                  </div>
                ))}
              </dl>
            </article>

            <aside className="flex h-fit flex-col gap-4 rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5 shadow-sm">
              <div>
                <h2 className="font-semibold text-[var(--admin-on-surface)]">Credential actions</h2>
                <p className="mt-1 text-sm text-[var(--admin-on-surface-variant)]">
                  Lifecycle changes are reflected on the public verification page.
                </p>
              </div>
              <a
                href={certificate.verificationUrl}
                target="_blank"
                rel="noreferrer"
                className={outlineButtonClassName}
              >
                <ExternalLink className="h-4 w-4" aria-hidden="true" />
                Open verification
              </a>
              <CertificateDetailActions certificate={certificate} />
            </aside>
          </section>
        </main>
      </AdminPageGate>
    );
  } catch (error) {
    if (error instanceof ServerApiError && error.status === 404) notFound();
    if (error instanceof ServerApiError && (error.status === 401 || error.status === 403)) {
      return (
        <AdminPageGate
          screenId="T13"
          state="denied"
          title="Certificate details"
          deniedMessage="You do not have permission to view this certificate."
        />
      );
    }
    throw error;
  }
}
