import { AdminPageGate } from "../../../../../components/patterns/AdminPageGate";
import { AdminTagNewPage } from "../../../../../features/admin/tags/AdminTagNewPage";
import { runTenantStateGate } from "../../../../../lib/server/tenant-state-gate";

/**
 * `/admin/manage/tags/new`.
 *
 * A static segment beside the `[slug]` route that serves the rest of Manage, so
 * `/admin/manage/tags` still resolves through the catalogue while this deep
 * link resolves here.
 */
export default async function AdminTagNewRoute() {
  const gate = await runTenantStateGate();
  if (gate.kind !== "ok") {
    return (
      <AdminPageGate
        screenId="T60"
        state="denied"
        title="New tag"
        deniedMessage="This academy is not available."
      />
    );
  }

  return (
    <AdminPageGate screenId="T60" state="ready" title="New tag">
      <AdminTagNewPage />
    </AdminPageGate>
  );
}
