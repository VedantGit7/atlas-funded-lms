import { AdminPageGate } from "../../../components/patterns/AdminPageGate";
import { AdminSeoPage } from "../../../features/admin/seo/AdminSeoPage";
import { ServerApiError, serverApi } from "../../../lib/server-api";

type TenantSeoResponse = {
  data: {
    metaDescription: string;
    metaKeywords: string;
    metaImageRefId: string | null;
    metaImageUrl: string | null;
  };
};

export default async function AdminSeoPageRoute() {
  try {
    const response = await serverApi.get<TenantSeoResponse>("/api/v1/tenant-settings/seo");

    return (
      <AdminPageGate screenId="T31" state="ready" title="SEO">
        <AdminSeoPage initialSeo={response.data} />
      </AdminPageGate>
    );
  } catch (error) {
    if (error instanceof ServerApiError && (error.status === 401 || error.status === 403)) {
      return (
        <AdminPageGate
          screenId="T31"
          state="denied"
          title="SEO"
          deniedMessage="You do not have permission to manage SEO settings."
        />
      );
    }

    if (error instanceof ServerApiError) {
      return (
        <AdminPageGate
          screenId="T31"
          state="error"
          title="SEO"
          errorMessage={`Failed to load SEO settings. Request ID: ${error.requestId}`}
        />
      );
    }

    throw error;
  }
}
