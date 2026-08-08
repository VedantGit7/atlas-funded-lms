import { AdminPageGate } from "../../../../../../components/patterns/AdminPageGate";
import { SystemEmailEditorPanel } from "../../../../../../features/admin/grow/SystemEmailEditorPanel";
import { runTenantStateGate } from "../../../../../../lib/server/tenant-state-gate";

type PageProps = {
  params: Promise<{ key: string }>;
};

export default async function AdminSystemEmailDetailPage({ params }: PageProps) {
  const { key } = await params;
  const decodedKey = decodeURIComponent(key);
  const gate = await runTenantStateGate();
  if (gate.kind !== "ok") {
    return (
      <AdminPageGate
        screenId="T77"
        state="denied"
        title="System Email"
        deniedMessage="This academy is not available."
      />
    );
  }

  return (
    <AdminPageGate screenId="T77" state="ready" title="Edit System Email">
      <SystemEmailEditorPanel emailKey={decodedKey} />
    </AdminPageGate>
  );
}
