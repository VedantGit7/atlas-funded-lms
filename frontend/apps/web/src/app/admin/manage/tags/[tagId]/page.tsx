import { notFound } from "next/navigation";
import { AdminPageGate } from "../../../../../components/patterns/AdminPageGate";
import { AdminTagDetailPage } from "../../../../../features/admin/tags/AdminTagDetailPage";
import { runTenantStateGate } from "../../../../../lib/server/tenant-state-gate";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type AdminTagDetailRouteProps = {
  params: Promise<{ tagId: string }>;
};

/**
 * `/admin/manage/tags/[tagId]`.
 *
 * Sibling to the static `new` segment, which Next resolves first, so
 * `/admin/manage/tags/new` never reaches this route. The id is shape-checked
 * here rather than left to the API: a non-uuid path is a bad link, and a 404 is
 * a truer answer than a validation error from an endpoint.
 */
export default async function AdminTagDetailRoute({ params }: AdminTagDetailRouteProps) {
  const { tagId } = await params;
  if (!UUID_PATTERN.test(tagId)) {
    notFound();
  }

  const gate = await runTenantStateGate();
  if (gate.kind !== "ok") {
    return (
      <AdminPageGate
        screenId="T60"
        state="denied"
        title="Tag"
        deniedMessage="This academy is not available."
      />
    );
  }

  return (
    <AdminPageGate screenId="T60" state="ready" title="Tag">
      <AdminTagDetailPage tagId={tagId} />
    </AdminPageGate>
  );
}
