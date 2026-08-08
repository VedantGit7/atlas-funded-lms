import { notFound } from "next/navigation";
import { AdminPageGate } from "../../../../components/patterns/AdminPageGate";
import { SubSchoolDetailPanel } from "../../../../features/admin/sub-schools/SubSchoolDetailPanel";
import type { SubSchoolRow } from "../../../../features/admin/sub-schools/SubSchoolsListPanel";
import { ServerApiError, serverApi } from "../../../../lib/server-api";

type SubSchoolResponse = { data: SubSchoolRow };

type AdminSubSchoolDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function AdminSubSchoolDetailPage({ params }: AdminSubSchoolDetailPageProps) {
  const { id } = await params;

  try {
    const response = await serverApi.get<SubSchoolResponse>(`/api/v1/sub-schools/${id}`);

    return (
      <AdminPageGate screenId="T61" state="ready" title={response.data.name}>
        <SubSchoolDetailPanel subSchool={response.data} />
      </AdminPageGate>
    );
  } catch (error) {
    if (error instanceof ServerApiError && (error.status === 401 || error.status === 403)) {
      return (
        <AdminPageGate
          screenId="T61"
          state="denied"
          title="Sub-School"
          deniedMessage="You do not have permission to view this sub-school."
        />
      );
    }
    if (error instanceof ServerApiError && error.status === 404) {
      notFound();
    }
    throw error;
  }
}
