import { AdminPageGate } from "../../../components/patterns/AdminPageGate";
import { AdminVideoQualityPage } from "../../../features/admin/general-settings/AdminVideoQualityPage";
import { isVideoQualityValue } from "../../../features/admin/general-settings/video-quality-options";
import { ServerApiError, serverApi } from "../../../lib/server-api";

type TenantVideoQualityResponse = {
  data: { quality: string };
};

export default async function AdminVideoQualityPageRoute() {
  try {
    const response = await serverApi.get<TenantVideoQualityResponse>(
      "/api/v1/tenant-settings/video-quality",
    );
    const initialQuality = isVideoQualityValue(response.data.quality)
      ? response.data.quality
      : "low";

    return (
      <AdminPageGate screenId="T30" state="ready" title="Video Quality">
        <AdminVideoQualityPage initialQuality={initialQuality} />
      </AdminPageGate>
    );
  } catch (error) {
    if (error instanceof ServerApiError && (error.status === 401 || error.status === 403)) {
      return (
        <AdminPageGate
          screenId="T30"
          state="denied"
          title="Video Quality"
          deniedMessage="You do not have permission to manage video quality settings."
        />
      );
    }

    if (error instanceof ServerApiError) {
      return (
        <AdminPageGate
          screenId="T30"
          state="error"
          title="Video Quality"
          errorMessage={`Failed to load video quality settings. Request ID: ${error.requestId}`}
        />
      );
    }

    throw error;
  }
}
