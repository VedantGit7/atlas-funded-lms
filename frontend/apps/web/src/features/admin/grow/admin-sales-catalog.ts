export const ADMIN_SALES_SECTIONS = [
  {
    slug: "coupons",
    label: "Coupons",
    title: "Coupons",
    description: "Create and manage discount coupons for your products.",
  },
  {
    slug: "wallet",
    label: "Wallet",
    title: "Wallet",
    description: "Track learner wallet balances and credit activity.",
  },
  {
    slug: "referral-code",
    label: "Referral Code",
    title: "Referral Code",
    description: "Enable Refer & Earn, set signup/purchase wallet credits, and track referrers.",
  },
  {
    slug: "affiliates",
    label: "Affiliates",
    title: "Affiliates",
    description:
      "Let partners promote courses, earn commissions on sales, and receive payouts.",
  },
] as const;

export type AdminSalesSlug = (typeof ADMIN_SALES_SECTIONS)[number]["slug"];

export function getAdminSalesSection(slug: string) {
  return ADMIN_SALES_SECTIONS.find((section) => section.slug === slug) ?? null;
}

export const ADMIN_SALES_HREF = "/admin/sales";
export const ADMIN_SALES_DEFAULT_HREF = `${ADMIN_SALES_HREF}/coupons`;

export function adminSalesHref(slug: AdminSalesSlug): string {
  return `${ADMIN_SALES_HREF}/${slug}`;
}

export function isAdminSalesPath(pathname: string): boolean {
  return pathname === ADMIN_SALES_HREF || pathname.startsWith(`${ADMIN_SALES_HREF}/`);
}
