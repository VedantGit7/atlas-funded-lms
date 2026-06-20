import { loadPublicTenantBranding } from "../../../../lib/server/public-tenant-branding";
import { runTenantStateGate } from "../../../../lib/server/tenant-state-gate";
import {
  VerificationCard,
  VerificationNotFound,
} from "../../../../features/certificates/components/VerificationCard";
import { ServerApiError, serverApi } from "../../../../lib/server-api";
import type { z } from "zod";
import type { publicVerifyResponseSchema } from "../../../../server/certificates/certificate.dto";

type PublicVerifyResponse = z.infer<typeof publicVerifyResponseSchema>;

type VerifyPageProps = {
  params: Promise<{ credentialId: string }>;
};

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

    return (
      <main className="mx-auto max-w-3xl px-4 py-10 print:px-0">
        <VerificationCard data={response.data} issuerName={branding.issuerName} />
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
