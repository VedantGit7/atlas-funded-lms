import { redirect } from "next/navigation";
import { CERTIFICATE_STUDIO_HOME } from "../../../features/certificates/certificate-builder/studio-routes";

/**
 * `/admin/certificate-builder` → `/admin/certificate-builder/home`
 * Preserves legacy `?templateId=` deep links by sending them to `/studio/{id}`.
 */
export default async function AdminCertificateBuilderIndex({
  searchParams,
}: {
  searchParams: Promise<{ templateId?: string }>;
}) {
  const params = await searchParams;
  if (params.templateId) {
    redirect(`/admin/certificate-builder/studio/${encodeURIComponent(params.templateId)}`);
  }
  redirect(CERTIFICATE_STUDIO_HOME);
}
