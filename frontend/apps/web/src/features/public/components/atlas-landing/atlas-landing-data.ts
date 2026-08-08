export const ATLAS_STATS = [
  { value: "1 day", label: "From signup to live academy", accent: true },
  { value: "100%", label: "White-label, your brand only" },
  { value: "40+", label: "Built-in learner surfaces" },
  { value: "99.95%", label: "Platform uptime target", grn: true },
] as const;

export const ATLAS_STEPS = [
  {
    step: "01",
    title: "Provision your tenant",
    body: "Create an isolated academy from the platform console. Data, roles, and configuration are scoped to your tenant from the first request.",
  },
  {
    step: "02",
    title: "Apply your brand",
    body: "Upload logos, set theme tokens, and connect a custom domain. Every learner, admin, and email surface renders in your identity, not ours.",
  },
  {
    step: "03",
    title: "Launch to learners",
    body: "Publish courses, open enrollment, and invite your team. Learners land on a branded experience with no trace of the underlying platform.",
  },
] as const;

export const ATLAS_CAPABILITIES = [
  {
    title: "Multi-tenant isolation",
    body: "Every academy runs in its own data scope with host-based resolution and per-tenant roles. No shared state, no cross-tenant leakage.",
  },
  {
    title: "Custom domains",
    body: "Map your own domain or use an Atlas subdomain. Certificates, emails, and links all use your hostname.",
  },
  {
    title: "Course authoring",
    body: "Build courses, lessons, learning paths, and assessments with versioned publishing and a review workflow.",
  },
  {
    title: "Engagement engine",
    body: "Streaks, XP, leaderboards, and achievements are built in, with policies you control per tenant.",
  },
  {
    title: "Certificates",
    body: "Issue verifiable credentials with branded templates and public verification pages.",
  },
  {
    title: "Community and moderation",
    body: "Spaces, posts, and a full moderation queue with appeals, so your team keeps discussions healthy.",
  },
] as const;

export const ATLAS_PRICING = [
  {
    tier: "Launch",
    price: "$0",
    cadence: "while you build",
    note: "One academy, Atlas subdomain.",
    cta: "Start building",
    featured: false,
    features: [
      "1 tenant academy",
      "Atlas subdomain",
      "Course authoring and assessments",
      "Up to 100 active learners",
      "Community read access",
    ],
  },
  {
    tier: "Growth",
    price: "$399",
    cadence: "/month",
    note: "For academies going to market.",
    cta: "Book a demo",
    featured: true,
    features: [
      "Custom domain and full white-label",
      "Up to 5,000 active learners",
      "Gamification and certificates",
      "Community and moderation",
      "Email and theme customization",
    ],
  },
  {
    tier: "Scale",
    price: "Custom",
    cadence: "annual",
    note: "Multiple academies and SSO.",
    cta: "Talk to sales",
    featured: false,
    features: [
      "Multiple tenant academies",
      "Unlimited active learners",
      "Priority support and SLA",
      "Audit log and data export",
      "Dedicated onboarding",
    ],
  },
] as const;

export const ATLAS_TESTIMONIALS = [
  {
    quote:
      "We moved off a generic LMS and launched our own branded academy in under a week. Learners never see a third-party name anywhere.",
    name: "Priya Nair",
    detail: "Head of Learning, Meridian Trading School",
    badge: "Growth",
  },
  {
    quote:
      "Running three separate academies used to mean three logins and three bills. With Atlas they share one console and stay fully isolated.",
    name: "Daniel Okafor",
    detail: "Operations Lead, Northbridge Institute",
    badge: "Scale",
  },
  {
    quote:
      "The certificate verification pages and custom domain made us look established on day one. Setup was genuinely a single afternoon.",
    name: "Sofia Bianchi",
    detail: "Founder, Atelier Skills Lab",
    badge: "Growth",
  },
] as const;

export const ATLAS_FAQ = [
  {
    q: "Is the platform truly white-label?",
    a: "Yes. Learners, admins, instructors, and email recipients only ever see your brand. The Atlas name does not appear on any tenant surface. Branding, theme tokens, and the domain are all yours.",
  },
  {
    q: "How does multi-tenancy work?",
    a: "Each academy is a separate tenant resolved by hostname. Data is scoped per tenant with isolated roles and configuration, so one customer can never read another customer's content.",
  },
  {
    q: "Can I use my own domain?",
    a: "Yes. Map a custom domain or start on an Atlas subdomain and switch later. Certificates, links, and emails all use your hostname once the domain is active.",
  },
  {
    q: "Can I run more than one academy?",
    a: "On Scale you can operate multiple tenant academies from a single platform console while each academy stays fully isolated, with its own learners, branding, and data.",
  },
  {
    q: "What is included out of the box?",
    a: "Course authoring, learning paths, assessments, certificates, gamification, community with moderation, notifications, and learner analytics. You configure what each tenant uses.",
  },
  {
    q: "How do operators access the platform console?",
    a: "Platform operators sign in on the platform host with a dedicated operator account and multi-factor authentication. Tenant administrators use their own academy domain.",
  },
] as const;
