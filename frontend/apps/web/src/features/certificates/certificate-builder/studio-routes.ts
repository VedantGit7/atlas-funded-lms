/**
 * Certificate Studio App Router paths (dev-friendly nested URLs).
 *
 * /admin/certificate-builder          → redirects to /home
 * /admin/certificate-builder/home     → Studio Home
 * /admin/certificate-builder/templates → Use a template gallery
 * /admin/certificate-builder/studio/new → new canvas (?starter=…)
 * /admin/certificate-builder/studio/[templateId] → edit canvas
 */

export const CERTIFICATE_BUILDER_ROOT = "/admin/certificate-builder";
export const CERTIFICATE_STUDIO_HOME = `${CERTIFICATE_BUILDER_ROOT}/home`;
export const CERTIFICATE_STUDIO_TEMPLATES = `${CERTIFICATE_BUILDER_ROOT}/templates`;
export const CERTIFICATE_STUDIO_NEW = `${CERTIFICATE_BUILDER_ROOT}/studio/new`;

export function certificateStudioEditPath(templateId: string): string {
  return `${CERTIFICATE_BUILDER_ROOT}/studio/${encodeURIComponent(templateId)}`;
}

export function certificateStudioNewPath(starterId?: string): string {
  if (!starterId) return CERTIFICATE_STUDIO_NEW;
  const params = new URLSearchParams({ starter: starterId });
  return `${CERTIFICATE_STUDIO_NEW}?${params.toString()}`;
}
