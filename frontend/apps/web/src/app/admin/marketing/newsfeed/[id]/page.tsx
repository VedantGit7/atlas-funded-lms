import { AdminPageGate } from "../../../../../components/patterns/AdminPageGate";
import { NewsfeedBuilderPanel } from "../../../../../features/admin/grow/NewsfeedBuilderPanel";
import { runTenantStateGate } from "../../../../../lib/server/tenant-state-gate";

type PageProps = { params: Promise<{ id: string }> };

export default async function AdminNewsfeedBuilderPage({ params }: PageProps) {
  const { id } = await params;
  const gate = await runTenantStateGate();
  if (gate.kind !== "ok") {
    return (
      <AdminPageGate
        screenId="T98"
        state="denied"
        title="Newsfeed Post"
        deniedMessage="This academy is not available."
      />
    );
  }
  return (
    <AdminPageGate screenId="T98" state="ready" title="Newsfeed Post">
      <NewsfeedBuilderPanel postId={id} />
    </AdminPageGate>
  );
}
