export const ADMIN_MANAGE_SECTIONS = [
  {
    slug: "course-encryption",
    label: "Course Encryption",
    title: "Course Encryption",
    description: "Protect course content with encryption and review which courses are secured.",
  },
  {
    slug: "discussions",
    label: "Discussions",
    title: "Discussions",
    description: "Moderate learner discussions across courses and keep conversations healthy.",
  },
  {
    slug: "ratings-and-reviews",
    label: "Ratings and Reviews",
    title: "Ratings and Reviews",
    description: "Approve, edit, or remove learner ratings and reviews for your products.",
  },
  {
    slug: "answer-reviews",
    label: "Answer reviews",
    title: "Answer reviews",
    description: "Evaluate essay and manual answers submitted by learners.",
  },
  {
    slug: "learner-support",
    label: "Learner Support",
    title: "Learner Support",
    description: "View and respond to learner support conversations.",
  },
  {
    slug: "archive-learners",
    label: "Archive Learners",
    title: "Archive Learners",
    description: "Archive learner access while preserving their progress and history.",
  },
  {
    slug: "course-backup",
    label: "Course Backup",
    title: "Course Backup",
    description: "Generate downloadable backups of course sections and lessons.",
  },
] as const;

export type AdminManageSlug = (typeof ADMIN_MANAGE_SECTIONS)[number]["slug"];

export function getAdminManageSection(slug: string) {
  return ADMIN_MANAGE_SECTIONS.find((section) => section.slug === slug) ?? null;
}

export const ADMIN_MANAGE_HREF = "/admin/manage";
export const ADMIN_MANAGE_DEFAULT_HREF = `${ADMIN_MANAGE_HREF}/course-encryption`;

export function adminManageHref(slug: AdminManageSlug): string {
  return `${ADMIN_MANAGE_HREF}/${slug}`;
}
