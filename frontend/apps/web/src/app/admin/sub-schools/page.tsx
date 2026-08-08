import { AdminPageGate } from "../../../components/patterns/AdminPageGate";
import {
  SubSchoolsListPanel,
  type SubSchoolRow,
} from "../../../features/admin/sub-schools/SubSchoolsListPanel";
import { ServerApiError, serverApi } from "../../../lib/server-api";

type SubSchoolsResponse = { data: { items: SubSchoolRow[] } };

export default async function AdminSubSchoolsPage() {
  try {
    const response = await serverApi.get<SubSchoolsResponse>("/api/v1/sub-schools");

    return (
      <AdminPageGate screenId="T59" state="ready" title="Sub-Schools">
        <div className="mx-auto max-w-7xl">
          <SubSchoolsListPanel initialItems={response.data.items} />
        </div>
      </AdminPageGate>
    );
  } catch (error) {
    if (error instanceof ServerApiError && (error.status === 401 || error.status === 403)) {
      return (
        <AdminPageGate
          screenId="T59"
          state="denied"
          title="Sub-Schools"
          deniedMessage="You do not have permission to manage sub-schools."
        />
      );
    }

    throw error;
  }
}
