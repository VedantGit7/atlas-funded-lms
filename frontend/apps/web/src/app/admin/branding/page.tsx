import type { z } from "zod";
import type {
  BrandingResponseSchema,
  BrandingVersionsResponseSchema,
} from "@atlas/domain-branding/schemas/branding";
import type { ThemeResponseSchema } from "@atlas/domain-branding/schemas/theme";
import { AdminPageGate } from "../../../components/patterns/AdminPageGate";
import { BrandingEditor } from "./_components/BrandingEditor";
import { BrandingVersionHistory } from "./_components/BrandingVersionHistory";
import { ServerApiError, serverApi } from "../../../lib/server-api";

type BrandingResponse = z.infer<typeof BrandingResponseSchema>;
type BrandingVersionsResponse = z.infer<typeof BrandingVersionsResponseSchema>;
type ThemeResponse = z.infer<typeof ThemeResponseSchema>;

export default async function AdminBrandingPage() {
  try {
    const [branding, theme, versions] = await Promise.all([
      serverApi.get<BrandingResponse>("/api/v1/branding"),
      serverApi.get<ThemeResponse>("/api/v1/theme"),
      serverApi.get<BrandingVersionsResponse>("/api/v1/branding/versions"),
    ]);

    return (
      <AdminPageGate screenId="T6" state="ready" title="Branding & Theme">
        <div className="mx-auto max-w-7xl">
          <BrandingEditor
            branding={branding.data}
            theme={theme.data}
            publishedBaselineTokens={theme.publishedBaselineTokens}
          >
            <BrandingVersionHistory versions={versions.data} />
          </BrandingEditor>
        </div>
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
