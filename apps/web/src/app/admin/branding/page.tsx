import type { z } from "zod";
import type {
  BrandingResponseSchema,
  BrandingVersionsResponseSchema,
} from "@atlas/domain-branding/schemas/branding";
import { AdminPageGate, PageHeader } from "../../../components/patterns/AdminPageGate";
import { BrandingEditor } from "./_components/BrandingEditor";
import { BrandPreview } from "./_components/BrandPreview";
import { BrandingVersionHistory } from "./_components/BrandingVersionHistory";
import { createDefaultAdminTheme } from "./_components/default-theme";
import { ServerApiError, serverApi } from "../../../lib/server-api";

type BrandingResponse = z.infer<typeof BrandingResponseSchema>;
type BrandingVersionsResponse = z.infer<typeof BrandingVersionsResponseSchema>;

export default async function AdminBrandingPage() {
  try {
    const [branding, versions] = await Promise.all([
      serverApi.get<BrandingResponse>("/api/v1/branding"),
      serverApi.get<BrandingVersionsResponse>("/api/v1/branding/versions"),
    ]);

    const theme = createDefaultAdminTheme(branding.data.tenantId, branding.data.updatedAt);

    return (
      <AdminPageGate screenId="T6" state="ready" title="Branding & Theme">
        <main className="space-y-6">
          <PageHeader
            title="Branding & Theme"
            description="Configure tenant white-label identity, draft changes, preview, and publish."
          />

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_420px]">
            <BrandingEditor branding={branding.data} theme={theme} />
            <BrandPreview branding={branding.data} theme={theme} />
          </div>

          <BrandingVersionHistory versions={versions.data} />
        </main>
      </AdminPageGate>
    );
  } catch (error) {
    if (error instanceof ServerApiError && (error.status === 401 || error.status === 403)) {
      return (
        <AdminPageGate
          screenId="T6"
          state="denied"
          title="Branding & Theme"
          deniedMessage="You do not have permission to manage branding."
        />
      );
    }

    throw error;
  }
}
