export const SUB_SCHOOLS_HREF = "/admin/sub-schools";
export const SUB_SCHOOLS_CREATE_HREF = "/admin/sub-schools/create";

/** Platform subdomain suffix shown next to the URL slug field. */
export const SUB_SCHOOL_URL_SUFFIX = ".academy.fundedbeyond.com";

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
