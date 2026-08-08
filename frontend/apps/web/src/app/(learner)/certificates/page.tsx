import { headers } from "next/headers";
import { PageGate, PageHeader } from "../../../components/patterns/PageGate";
import { LearnerCertificatesClient } from "../../../features/certificates/components/LearnerCertificatesClient";
import { loadPublicBootstrap } from "../../../lib/server/bootstrap";
import { ServerApiError, serverApi } from "../../../lib/server-api";
import type { z } from "zod";
import type { certificateListResponseSchema } from "@atlas/contracts/certificates/certificate.dto";

type CertificateListResponse = z.infer<typeof certificateListResponseSchema>;

async function getRequestOrigin(): Promise<string> {
  const headerList = await headers();
  const host = headerList.get("host") ?? "localhost:3000";
  const proto = headerList.get("x-forwarded-proto") ?? "http";
  return `${proto}://${host}`;
}

async function getIssuerName(): Promise<string | null> {
  try {
    const bootstrap = await loadPublicBootstrap();
    return bootstrap.issuerName ?? bootstrap.publicName;
  } catch {
    // Branding is decorative here (shown as "Institution"); degrade gracefully.
    return null;
  }
}

export default async function LearnerCertificatesPage() {
  try {
    const [response, origin, issuerName] = await Promise.all([
      serverApi.get<CertificateListResponse>("/api/v1/certificates?limit=12"),
      getRequestOrigin(),
      getIssuerName(),
    ]);

    return (
      <PageGate state="ready" title="Certificates">
        <main className="space-y-6">
          <PageHeader
            title="Your credential wallet"
            description="Manage, verify, and share your earned credentials."
          />
          <LearnerCertificatesClient initial={response} origin={origin} issuerName={issuerName} />
        </main>
      </PageGate>
    );
  } catch (error) {
    if (error instanceof ServerApiError && error.code === "ENTITLEMENT_REQUIRED") {
      return (
        <PageGate
          state="denied"
          title="Certificates"
          deniedMessage="Certification is not enabled for this tenant."
        />
      );
    }

    if (error instanceof ServerApiError && (error.status === 401 || error.status === 403)) {
      return (
        <PageGate
          state="denied"
          title="Certificates"
          deniedMessage="You do not have permission to view certificates."
        />
      );
    }

    if (error instanceof ServerApiError) {
      return (
        <PageGate
          state="error"
          title="Certificates"
          errorMessage={`Failed to load certificates. Request ID: ${error.requestId}`}
        />
      );
    }

    throw error;
  }
}
