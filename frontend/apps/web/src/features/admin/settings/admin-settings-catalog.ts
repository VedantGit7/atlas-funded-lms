import type { AdminRouteEntitlement } from "../admin-route-registry";
import type { AdminNavigationCapabilities } from "../admin-navigation";

export type AdminSettingsIconKey =
  | "settings-2"
  | "flag"
  | "key-round"
  | "languages"
  | "palette"
  | "globe"
  | "target"
  | "award"
  | "trophy"
  | "file-badge"
  | "puzzle"
  | "zap"
  | "users"
  | "scroll-text"
  | "trash-2"
  | "download"
  | "shield-check"
  | "bell"
  | "git-branch"
  | "bar-chart-3"
  | "credit-card"
  | "globe-2"
  | "clock"
  | "monitor-play"
  | "banknote"
  | "circle-dollar-sign"
  | "wallet-cards"
  | "receipt"
  | "folder-cog"
  | "file-text"
  | "map-pin"
  | "shopping-cart"
  | "mail-check"
  | "user-lock"
  | "smartphone"
  | "mail"
  | "mail-open"
  | "at-sign";

export type AdminSettingsItem = {
  id: string;
  title: string;
  description: string;
  href: string;
  iconKey: AdminSettingsIconKey;
  keywords?: string[];
  entitlement?: AdminRouteEntitlement;
  requiresWorkflowReview?: boolean;
};

export type AdminSettingsSection = {
  id: string;
  title: string;
  description: string;
  items: AdminSettingsItem[];
};

export const ADMIN_SETTINGS_SECTIONS: readonly AdminSettingsSection[] = [
  {
    id: "general",
    title: "General",
    description: "Setup general academy settings.",
    items: [
      {
        id: "configuration",
        title: "Configuration",
        description: "Runtime tenant config, policies, and version history.",
        href: "/admin/config",
        iconKey: "settings-2",
        keywords: ["config", "runtime", "policies", "json"],
      },
      {
        id: "feature-flags",
        title: "Feature flags",
        description: "Toggle tenant capabilities and experimental features.",
        href: "/admin/feature-flags",
        iconKey: "flag",
        keywords: ["flags", "capabilities", "toggle"],
      },
      {
        id: "entitlements",
        title: "Entitlements",
        description: "Plan capabilities and what this academy can access.",
        href: "/admin/entitlements",
        iconKey: "key-round",
        keywords: ["plan", "capabilities", "limits"],
      },
      {
        id: "locales",
        title: "Locales and time",
        description: "Languages, regional formats, and translation resources.",
        href: "/admin/locales",
        iconKey: "languages",
        keywords: ["language", "timezone", "translation", "i18n"],
      },
      {
        id: "billing",
        title: "Billing/Pricing Plan",
        description: "Check your current billing cycle and manage your plan.",
        href: "/admin/billing",
        iconKey: "credit-card",
        keywords: ["billing", "subscription", "pricing", "plan", "invoice"],
      },
      {
        id: "seo",
        title: "SEO",
        description: "Add SEO details to help bring your academy to the top of search results.",
        href: "/admin/seo",
        iconKey: "globe-2",
        keywords: ["seo", "search", "metadata", "google", "ranking"],
      },
      {
        id: "time-zones",
        title: "Time Zones",
        description: "Set a time zone for your academy.",
        href: "/admin/timezones",
        iconKey: "clock",
        keywords: ["timezone", "time zone", "clock", "regional"],
      },
      {
        id: "video-quality",
        title: "Video Quality",
        description: "Select a default video quality for your learners.",
        href: "/admin/video-quality",
        iconKey: "monitor-play",
        keywords: ["video", "streaming", "hd", "quality", "playback"],
      },
    ],
  },
  {
    id: "learner-billing",
    title: "Learner Billing",
    description: "Manage billing and payment settings.",
    items: [
      {
        id: "pricing-model",
        title: "Pricing Model",
        description: "Pick a pricing model for your school.",
        href: "/admin/learner-billing/pricing-model",
        iconKey: "banknote",
        keywords: ["pricing", "model", "plans", "courses", "monetization"],
      },
      {
        id: "home-currency",
        title: "Home Currency",
        description: "Set and view all the statistics in your preferred currency.",
        href: "/admin/learner-billing/home-currency",
        iconKey: "circle-dollar-sign",
        keywords: ["currency", "money", "exchange", "statistics"],
      },
      {
        id: "payment-gateway",
        title: "Payment Gateway",
        description: "Manage pricing and expiry details for your course.",
        href: "/admin/learner-billing/payment-gateway",
        iconKey: "wallet-cards",
        keywords: ["payments", "gateway", "stripe", "checkout"],
      },
      {
        id: "gst",
        title: "Goods & Service Tax (GST)",
        description:
          "GST is an indirect tax applicable if you are selling courses within certain regions.",
        href: "/admin/learner-billing/gst",
        iconKey: "receipt",
        keywords: ["gst", "tax", "vat", "india", "compliance"],
      },
      {
        id: "learner-config",
        title: "Learner Configurations",
        description: "Configure learner addresses and invoice settings.",
        href: "/admin/learner-billing/learner-config",
        iconKey: "folder-cog",
        keywords: ["learner", "address", "invoice", "billing profile"],
      },
      {
        id: "invoice-config",
        title: "Invoice Configuration",
        description: "Enable to generate invoices for learners when they make a purchase.",
        href: "/admin/learner-billing/invoice-config",
        iconKey: "file-text",
        keywords: ["invoice", "receipt", "billing", "pdf"],
      },
      {
        id: "locations",
        title: "Locations",
        description: "Sell content in multiple locations with different currencies.",
        href: "/admin/learner-billing/locations",
        iconKey: "map-pin",
        keywords: ["locations", "regions", "countries", "multi-currency"],
      },
    ],
  },
  {
    id: "platform",
    title: "Platform",
    description: "Manage branding, domains, and learner readiness.",
    items: [
      {
        id: "branding",
        title: "Branding",
        description: "Logo, colors, and theme tokens for your academy.",
        href: "/admin/branding",
        iconKey: "palette",
        keywords: ["logo", "theme", "colors", "identity"],
      },
      {
        id: "domains",
        title: "Domains",
        description: "Custom domains and DNS verification for your site.",
        href: "/admin/domains",
        iconKey: "globe",
        entitlement: "branding.custom_domain.enable",
        keywords: ["dns", "hostname", "custom domain"],
      },
      {
        id: "readiness-policy",
        title: "Readiness policy",
        description: "Learner readiness bands, routing, and prominence rules.",
        href: "/admin/readiness-policy",
        iconKey: "target",
        keywords: ["readiness", "bands", "routing"],
      },
      {
        id: "competency",
        title: "Competency framework",
        description: "Skills, levels, and competency mapping for learning paths.",
        href: "/admin/competency",
        iconKey: "award",
        keywords: ["skills", "competency", "framework"],
      },
    ],
  },
  {
    id: "features",
    title: "Features",
    description: "Use academy features to enhance the learner experience.",
    items: [
      {
        id: "gamification",
        title: "Gamification",
        description: "XP rules, levels, streaks, and learner motivation.",
        href: "/admin/gamification",
        iconKey: "trophy",
        entitlement: "gamification.enable",
        keywords: ["xp", "badges", "streaks", "levels"],
      },
      {
        id: "certificates",
        title: "Certificates",
        description: "Issued certificates and learner credential records.",
        href: "/admin/certificates",
        iconKey: "file-badge",
        entitlement: "certification.enable",
        keywords: ["credentials", "issued"],
      },
      {
        id: "certificate-templates",
        title: "Certificate templates",
        description: "Design templates used when certificates are issued.",
        href: "/admin/certificates/templates",
        iconKey: "award",
        entitlement: "certification.enable",
        keywords: ["templates", "design", "diploma"],
      },
      {
        id: "languages",
        title: "Languages",
        description: "Manage language settings for your school.",
        href: "/admin/languages",
        iconKey: "languages",
        keywords: ["language", "translation", "i18n", "locale", "multilingual"],
      },
      {
        id: "extensions",
        title: "Extensions",
        description: "Installed extensions and integration capabilities.",
        href: "/admin/extensions",
        iconKey: "puzzle",
        keywords: ["integrations", "plugins", "addons"],
      },
      {
        id: "automation",
        title: "Automation",
        description: "Rules that run when events occur in your academy.",
        href: "/admin/automation",
        iconKey: "zap",
        keywords: ["rules", "triggers", "workflows"],
      },
      {
        id: "fast-checkout",
        title: "Fast Checkout",
        description: "Allow learners to buy your products with quick and easy checkout.",
        href: "/admin/fast-checkout",
        iconKey: "shopping-cart",
        keywords: ["checkout", "commerce", "purchase", "cart", "payments"],
      },
    ],
  },
  {
    id: "security",
    title: "Security",
    description: "Use security features for protection against unauthorized mediums.",
    items: [
      {
        id: "roles",
        title: "Roles and permissions",
        description: "Who can access admin tools and what they can do.",
        href: "/admin/roles",
        iconKey: "users",
        keywords: ["rbac", "permissions", "access"],
      },
      {
        id: "audit",
        title: "Audit log",
        description: "Review administrative actions and system events.",
        href: "/admin/audit",
        iconKey: "scroll-text",
        keywords: ["history", "events", "compliance"],
      },
      {
        id: "deletion-requests",
        title: "School-access removal",
        description:
          "Review school-access removal requests. Records are retained; erasure requires a separate review.",
        href: "/admin/deletion-requests",
        iconKey: "trash-2",
        keywords: ["gdpr", "privacy", "delete"],
      },
      {
        id: "exports",
        title: "Data exports",
        description: "Export academy data for reporting or migration.",
        href: "/admin/exports",
        iconKey: "download",
        entitlement: "data.export.enable",
        keywords: ["export", "download", "backup"],
      },
      {
        id: "admin-security",
        title: "Admin account security",
        description: "Password, MFA, and sign-in methods for your admin account.",
        href: "/profile/security",
        iconKey: "shield-check",
        keywords: ["mfa", "otp", "password", "2fa"],
      },
      {
        id: "learner-email-verification",
        title: "Learner Email Verification",
        description: "Verify your learner email and allow access based on verification.",
        href: "/admin/security/learner-email-verification",
        iconKey: "mail-check",
        keywords: ["email", "verification", "learner", "access"],
      },
      {
        id: "admin-otp",
        title: "Admin OTP",
        description: "Set admin login limit for OTP verification.",
        href: "/admin/security/admin-otp",
        iconKey: "user-lock",
        keywords: ["otp", "admin", "login", "mfa", "2fa"],
      },
      {
        id: "device-monitor",
        title: "Device Monitor",
        description: "Manage device restrictions and parallel login settings.",
        href: "/admin/security/device-monitor",
        iconKey: "smartphone",
        keywords: ["device", "sessions", "parallel login", "restrictions"],
      },
    ],
  },
  {
    id: "channels",
    title: "Channels",
    description: "Configure channels for communication with learners.",
    items: [
      {
        id: "notifications",
        title: "Notifications",
        description: "Academy notification settings and delivery channels.",
        href: "/admin/notifications",
        iconKey: "bell",
        keywords: ["alerts", "in-app", "email"],
      },
      {
        id: "notification-templates",
        title: "Notification templates",
        description: "Email and message templates for system events.",
        href: "/admin/notifications/templates",
        iconKey: "bell",
        keywords: ["email templates", "messages"],
      },
      {
        id: "workflows",
        title: "Workflows",
        description: "Approval flows and review queues for governed changes.",
        href: "/admin/workflows",
        iconKey: "git-branch",
        requiresWorkflowReview: true,
        keywords: ["approvals", "review", "queue"],
      },
      {
        id: "analytics",
        title: "Analytics",
        description: "Engagement and usage insights across your academy.",
        href: "/admin/analytics",
        iconKey: "bar-chart-3",
        entitlement: "analytics.dashboard.view",
        keywords: ["reports", "insights", "metrics"],
      },
      {
        id: "transactional-email",
        title: "Transactional Email",
        description: "Configure details for sending transactional emails.",
        href: "/admin/channels/transactional-email",
        iconKey: "mail",
        keywords: ["email", "transactional", "smtp", "delivery"],
      },
      {
        id: "marketing-email",
        title: "Marketing Email",
        description: "Configure details for sending marketing emails.",
        href: "/admin/channels/marketing-email",
        iconKey: "mail-open",
        keywords: ["email", "marketing", "campaigns", "newsletter"],
      },
      {
        id: "support-email",
        title: "Support Email",
        description: "Configure support email details to send support responses.",
        href: "/admin/channels/support-email",
        iconKey: "at-sign",
        keywords: ["email", "support", "helpdesk", "replies"],
      },
    ],
  },
] as const;

function itemMatchesCapabilities(
  item: AdminSettingsItem,
  capabilities: AdminNavigationCapabilities,
): boolean {
  if (item.entitlement && !capabilities.enabledEntitlements.has(item.entitlement)) {
    return false;
  }
  if (item.requiresWorkflowReview && !capabilities.canAccessWorkflowReview) {
    return false;
  }
  return true;
}

export function filterAdminSettingsSections(
  sections: readonly AdminSettingsSection[],
  capabilities: AdminNavigationCapabilities,
): AdminSettingsSection[] {
  return sections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => itemMatchesCapabilities(item, capabilities)),
    }))
    .filter((section) => section.items.length > 0);
}

export function flattenAdminSettingsItems(
  sections: readonly AdminSettingsSection[],
): AdminSettingsItem[] {
  return sections.flatMap((section) => section.items);
}
