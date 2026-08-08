export type LearnerBillingNavItem = {
  id: string;
  label: string;
  href: string;
};

export const LEARNER_BILLING_NAV_ITEMS: readonly LearnerBillingNavItem[] = [
  {
    id: "pricing-model",
    label: "Pricing Model",
    href: "/admin/learner-billing/pricing-model",
  },
  {
    id: "home-currency",
    label: "Home Currency",
    href: "/admin/learner-billing/home-currency",
  },
  {
    id: "payment-gateway",
    label: "Payment Gateway",
    href: "/admin/learner-billing/payment-gateway",
  },
  {
    id: "gst",
    label: "Goods & Service Tax (GST)",
    href: "/admin/learner-billing/gst",
  },
  {
    id: "learner-config",
    label: "Learner Configurations",
    href: "/admin/learner-billing/learner-config",
  },
  {
    id: "invoice-config",
    label: "Invoice Configuration",
    href: "/admin/learner-billing/invoice-config",
  },
  {
    id: "locations",
    label: "Locations",
    href: "/admin/learner-billing/locations",
  },
] as const;
