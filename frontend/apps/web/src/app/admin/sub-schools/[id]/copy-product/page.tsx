import { notFound } from "next/navigation";
import { AdminPageGate } from "../../../../../components/patterns/AdminPageGate";
import {
  CopyProductPanel,
  mapProductCopyJobToHistoryRow,
  type ProductCopyJobDto,
} from "../../../../../features/admin/sub-schools/CopyProductPanel";
import type { SubSchoolRow } from "../../../../../features/admin/sub-schools/SubSchoolsListPanel";
import { ServerApiError, serverApi } from "../../../../../lib/server-api";

type SubSchoolResponse = { data: SubSchoolRow };
type CopyJobsResponse = { data: { items: ProductCopyJobDto[] } };

type AdminSubSchoolCopyProductPageProps = {
  params: Promise<{ id: string }>;
};

export default async function AdminSubSchoolCopyProductPage({
  params,
}: AdminSubSchoolCopyProductPageProps) {
  const { id } = await params;

  try {
    const [subSchoolResponse, jobsResponse] = await Promise.all([
      serverApi.get<SubSchoolResponse>(`/api/v1/sub-schools/${id}`),
      serverApi.get<CopyJobsResponse>(`/api/v1/sub-schools/${id}/copy-jobs`).catch(() => ({
        data: { items: [] as ProductCopyJobDto[] },
      })),
    ]);

    const history = jobsResponse.data.items.map(mapProductCopyJobToHistoryRow);

    return (
      <AdminPageGate screenId="T62" state="ready" title="Copy Product">
        <CopyProductPanel subSchool={subSchoolResponse.data} history={history} />
      </AdminPageGate>
    );
  } catch (error) {
    if (error instanceof ServerApiError && (error.status === 401 || error.status === 403)) {
      return (
        <AdminPageGate
          screenId="T62"
          state="denied"
          title="Copy Product"
          deniedMessage="You do not have permission to copy products for this sub-school."
        />
      );
    }
    if (error instanceof ServerApiError && error.status === 404) {
      notFound();
    }
    throw error;
  }
}
