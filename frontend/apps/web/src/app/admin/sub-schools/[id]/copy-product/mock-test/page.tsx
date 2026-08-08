import { notFound } from "next/navigation";
import { AdminPageGate } from "../../../../../../components/patterns/AdminPageGate";
import { CopyProductWizardPanel } from "../../../../../../features/admin/sub-schools/CopyProductWizardPanel";
import type { SubSchoolRow } from "../../../../../../features/admin/sub-schools/SubSchoolsListPanel";
import { ServerApiError, serverApi } from "../../../../../../lib/server-api";

type SubSchoolResponse = { data: SubSchoolRow };

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function AdminCopyMockTestPage({ params }: PageProps) {
  const { id } = await params;
  try {
    const response = await serverApi.get<SubSchoolResponse>(`/api/v1/sub-schools/${id}`);
    return (
      <AdminPageGate screenId="T64" state="ready" title="Copy Mock-Test">
        <CopyProductWizardPanel subSchool={response.data} kind="mock-test" />
      </AdminPageGate>
    );
  } catch (error) {
    if (error instanceof ServerApiError && (error.status === 401 || error.status === 403)) {
      return (
        <AdminPageGate
          screenId="T64"
          state="denied"
          title="Copy Mock-Test"
          deniedMessage="You do not have permission to copy products for this sub-school."
        />
      );
    }
    if (error instanceof ServerApiError && error.status === 404) notFound();
    throw error;
  }
}
