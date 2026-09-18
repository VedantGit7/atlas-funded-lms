export const SUB_SCHOOLS_HREF = "/admin/sub-schools";
export const SUB_SCHOOLS_CREATE_HREF = "/admin/sub-schools/create";

/** Platform subdomain suffix shown next to the URL slug field. */
/**
 * Domain suffix shown beside the slug field when an academy creates a sub-school.
 *
 * This was hardcoded to tenant #1's domain, so every other academy was shown a
 * URL preview pointing at a competitor's host. It is platform configuration:
 * set NEXT_PUBLIC_SUB_SCHOOL_URL_SUFFIX per deployment. The fallback is
 * deliberately generic rather than a real domain, so a missing value looks
 * obviously unconfigured instead of silently wrong.
 */
export const SUB_SCHOOL_URL_SUFFIX =
  process.env["NEXT_PUBLIC_SUB_SCHOOL_URL_SUFFIX"] ?? ".your-platform-domain";

export function subSchoolDetailHref(id: string): string {
  return `${SUB_SCHOOLS_HREF}/${id}`;
}

export function subSchoolCopyProductHref(id: string): string {
  return `${SUB_SCHOOLS_HREF}/${id}/copy-product`;
}

export function subSchoolPublicUrl(key: string): string {
  return `https://${key}${SUB_SCHOOL_URL_SUFFIX}`;
}

export function slugifySubSchoolUrl(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}
