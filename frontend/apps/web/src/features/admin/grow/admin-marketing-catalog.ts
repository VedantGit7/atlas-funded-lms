export type AdminGrowNavBadge = "new" | "beta";

export const ADMIN_MARKETING_SECTIONS = [
  {
    slug: "messenger",
    label: "Messenger",
    title: "Messenger",
    description:
      "Orchestrate cross-platform messaging from one hub. Configure channels, monitor performance, and launch automated flows.",
  },
  {
    slug: "workflows",
    label: "Workflows",
    title: "Workflows",
    description: "Automate marketing and operational workflows.",
  },
  {
    slug: "forms",
    label: "Forms",
    title: "Forms",
    description: "Build lead capture and inquiry forms for your academy.",
  },
  {
    slug: "campaign",
    label: "Campaigns",
    title: "Campaigns",
    description:
      "Unified email, push, and WhatsApp campaigns to engage learners across the lifecycle.",
    badge: "new" as const,
  },
  {
    slug: "cta",
    label: "CTA",
    title: "CTA",
    description:
      "Pop-ups, sticky banners, slide-ins, and embedded buttons with form connect and targeting.",
  },
  {
    slug: "promo-slider",
    label: "Promo Slider",
    title: "Promo Slider",
    description: "Learner-dashboard carousel banners with images, links, and scheduled visibility.",
    badge: "beta" as const,
  },
  {
    slug: "events",
    label: "Events",
    title: "Events",
    description: "Schedule and promote live or virtual academy events.",
  },
  {
    slug: "integrations",
    label: "Integrations",
    title: "Integrations",
    description: "Webhooks, Zapier/Pabbly credentials, and site tracking snippets (GA, Ads, Meta).",
  },
  {
    slug: "newsfeed",
    label: "Newsfeed",
    title: "Newsfeed",
    description: "Publish updates and announcements to your learners.",
  },
] as const;

export type AdminMarketingSlug = (typeof ADMIN_MARKETING_SECTIONS)[number]["slug"];

export function getAdminMarketingSection(slug: string) {
  return ADMIN_MARKETING_SECTIONS.find((section) => section.slug === slug) ?? null;
}

export const ADMIN_MARKETING_HREF = "/admin/marketing";
export const ADMIN_MARKETING_DEFAULT_HREF = `${ADMIN_MARKETING_HREF}/messenger`;

export function adminMarketingHref(slug: AdminMarketingSlug): string {
  const section = getAdminMarketingSection(slug);
  if (section && "href" in section && typeof section.href === "string") {
    return section.href;
  }
  return `${ADMIN_MARKETING_HREF}/${slug}`;
}

export function isAdminMarketingPath(pathname: string): boolean {
  if (pathname === ADMIN_MARKETING_HREF || pathname.startsWith(`${ADMIN_MARKETING_HREF}/`)) {
    return true;
  }
  return ADMIN_MARKETING_SECTIONS.some((section) => {
    const href = adminMarketingHref(section.slug);
    return pathname === href || pathname.startsWith(`${href}/`);
  });
}
