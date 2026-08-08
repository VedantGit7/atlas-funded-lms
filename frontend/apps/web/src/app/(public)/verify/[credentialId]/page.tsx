import { headers } from "next/headers";
import QRCode from "qrcode";
import { loadPublicTenantBranding } from "@atlas/tenant-branding";
import { runTenantStateGate } from "@atlas/tenant-gate";
import {
  VerificationCard,
  VerificationNotFound,
} from "../../../../features/certificates/components/VerificationCard";
import { CertificateVerifyTracker } from "../../../../features/certificates/components/CertificateVerifyTracker";
import { ServerApiError, serverApi } from "../../../../lib/server-api";
import { resolveRequestOriginFromHeaders } from "../../../../lib/server/resolve-request-origin";
import type { z } from "zod";
import type { publicVerifyResponseSchema } from "@atlas/contracts/certificates/certificate.dto";

type PublicVerifyResponse = z.infer<typeof publicVerifyResponseSchema>;

type VerifyPageProps = {
  params: Promise<{ credentialId: string }>;
};

async function buildQrDataUrl(value: string): Promise<string | null> {
  try {
    return await QRCode.toDataURL(value, {
      errorCorrectionLevel: "M",
      margin: 1,
      width: 240,
      type: "image/png",
    });
  } catch {
    return null;
  }
}

export default async function PublicVerifyPage({ params }: VerifyPageProps) {
  const { credentialId } = await params;
  const gate = await runTenantStateGate();

  if (gate.kind !== "ok") {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10">
        <VerificationNotFound />
      </main>
    );
  }

  const branding = await loadPublicTenantBranding({
    tenantId: gate.tenant.tenantId,
    requestId: gate.tenant.requestId,
  });

  try {
    const response = await serverApi.get<PublicVerifyResponse>(
      `/api/v1/public/verify/${encodeURIComponent(credentialId)}`,
    );

    const origin = resolveRequestOriginFromHeaders(await headers());
    const verificationUrl = `${origin}/verify/${encodeURIComponent(credentialId)}`;
    const openBadgeUrl = `${origin}/api/v1/public/credentials/${encodeURIComponent(credentialId)}/open-badge`;
    const qrDataUrl = await buildQrDataUrl(verificationUrl);

    return (
      <main className="mx-auto max-w-3xl px-4 py-10 print:px-0">
        <CertificateVerifyTracker credentialId={credentialId} verified />
        <VerificationCard
          data={response.data}
          issuerName={branding.issuerName}
          verificationUrl={verificationUrl}
          openBadgeUrl={openBadgeUrl}
          qrDataUrl={qrDataUrl}
        />
      </main>
    );
  } catch (error: unknown) {
    if (error instanceof ServerApiError && error.status === 404) {
      return (
        <main className="mx-auto max-w-3xl px-4 py-10">
          <VerificationNotFound />
        </main>
      );
    }

    throw error;
  }
}
