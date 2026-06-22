import { PlatformTenantDetailClient } from "../../../../features/platform/components/PlatformTenantDetailClient";
import { loadPlatformShellContext } from "../../../../lib/server/platform-shell-context";
import { projectPlatformCapabilities } from "../../../../features/platform/platform-capability-projection";

export default async function PlatformTenantDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const context = await loadPlatformShellContext();
  const capabilities =
    context.kind === "ready" ? context.capabilities : projectPlatformCapabilities([]);

  return <PlatformTenantDetailClient tenantId={id} capabilities={capabilities} />;
}
