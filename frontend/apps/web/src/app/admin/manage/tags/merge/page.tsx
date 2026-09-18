import { AdminPageGate } from "../../../../../components/patterns/AdminPageGate";
import { AdminTagMergePage } from "../../../../../features/admin/tags/AdminTagMergePage";
import { runTenantStateGate } from "../../../../../lib/server/tenant-state-gate";

/**
 * `/admin/manage/tags/merge`.
 *
 * A static segment beside `new` and the `[tagId]` route, both of which Next
 * resolves ahead of the dynamic one, so this deep link never falls through to
 * the tag detail page.
 */
export default async function AdminTagMergeRoute() {
  const gate = await runTenantStateGate();
  if (gate.kind !== "ok") {
    return (
      <AdminPageGate
        screenId="T60"
        state="denied"
        title="Merge tags"
        deniedMessage="This academy is not available."
      />
    );
  }

  return (
    <AdminPageGate screenId="T60" state="ready" title="Merge tags">
      <AdminTagMergePage />
    </AdminPageGate>
  );
}
