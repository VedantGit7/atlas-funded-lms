import type { AboutSchoolResponse } from "@atlas/domain-branding/schemas/about-school";
import { AdminPageGate } from "../../../../components/patterns/AdminPageGate";
import { AboutSchoolWizard } from "../_components/AboutSchoolWizard";
import { ServerApiError, serverApi } from "../../../../lib/server-api";

export default async function AboutSchoolPage() {
  try {
    const about = await serverApi.get<AboutSchoolResponse>("/api/v1/branding/about-school");

    return (
      <AdminPageGate screenId="T6" state="ready" title="About School">
        <div className="mx-auto max-w-7xl">
          <AboutSchoolWizard initial={about.data} />
        </div>
      </AdminPageGate>
    );
  } catch (error) {
    if (error instanceof ServerApiError && (error.status === 401 || error.status === 403)) {
      return (
        <AdminPageGate
          screenId="T6"
          state="denied"
          title="About School"
          deniedMessage="You do not have permission to manage branding."
        />
      );
    }

    throw error;
  }
}
