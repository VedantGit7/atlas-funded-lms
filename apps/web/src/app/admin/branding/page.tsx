import type { z } from "zod";
import type {
  BrandingResponseSchema,
  BrandingVersionsResponseSchema,
} from "@atlas/domain-branding/schemas/branding";
import { BrandingEditor } from "./_components/BrandingEditor";
import { BrandPreview } from "./_components/BrandPreview";
import { BrandingVersionHistory } from "./_components/BrandingVersionHistory";
import { createDefaultAdminTheme } from "./_components/default-theme";
import { serverApi } from "../../../lib/server-api";

type BrandingResponse = z.infer<typeof BrandingResponseSchema>;
type BrandingVersionsResponse = z.infer<typeof BrandingVersionsResponseSchema>;

export default async function AdminBrandingPage() {
  const [branding, versions] = await Promise.all([
    serverApi.get<BrandingResponse>("/api/v1/branding"),
    serverApi.get<BrandingVersionsResponse>("/api/v1/branding/versions"),
  ]);

  const theme = createDefaultAdminTheme(branding.data.tenantId, branding.data.updatedAt);

  return (
    <main className="space-y-6">
      <header>
        <h1>Branding & Theme</h1>
        <p>Configure tenant white-label identity, draft changes, preview, and publish.</p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_420px]">
        <BrandingEditor branding={branding.data} theme={theme} />
        <BrandPreview branding={branding.data} theme={theme} />
      </div>

      <BrandingVersionHistory versions={versions.data} />
    </main>
  );
}
