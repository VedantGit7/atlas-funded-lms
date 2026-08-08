import { notFound } from "next/navigation";
import { AdminPageGate } from "../../../../../../components/patterns/AdminPageGate";
import { CopyProductWizardPanel } from "../../../../../../features/admin/sub-schools/CopyProductWizardPanel";
import type { SubSchoolRow } from "../../../../../../features/admin/sub-schools/SubSchoolsListPanel";
import { ServerApiError, serverApi } from "../../../../../../lib/server-api";

type SubSchoolResponse = { data: SubSchoolRow };

type PageProps = {
  params: Promise<{ id: string }>;
};

async function loadSubSchool(id: string) {
  return serverApi.get<SubSchoolResponse>(`/api/v1/sub-schools/${id}`);
}

function denied(title: string) {
  return (
    <AdminPageGate
      screenId="T63"
      state="denied"
      title={title}
      deniedMessage="You do not have permission to copy products for this sub-school."
    />
  );
}

export default async function AdminCopyCoursePage({ params }: PageProps) {
  const { id } = await params;
  try {
    const response = await loadSubSchool(id);
    return (
      <AdminPageGate screenId="T63" state="ready" title="Copy Course">
        <CopyProductWizardPanel subSchool={response.data} kind="course" />
      </AdminPageGate>
    );
  } catch (error) {
    if (error instanceof ServerApiError && (error.status === 401 || error.status === 403)) {
      return denied("Copy Course");
    }
    if (error instanceof ServerApiError && error.status === 404) notFound();
    throw error;
  }
}
