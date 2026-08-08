import {
  Award,
  BookOpen,
  Compass,
  CreditCard,
  Rocket,
  User,
  Wrench,
} from "lucide-react";
import type { HelpArticle, HelpCategory, HelpTipOfWeek } from "./help-center-types";

export const HELP_CATEGORIES: readonly HelpCategory[] = [
  {
    id: "getting-started",
    title: "Getting Started",
    description:
      "Set up your account, learn the dashboard, and find your first course or diagnostic.",
    icon: Rocket,
  },
  {
    id: "courses",
    title: "Courses",
    description:
      "Enrollments, lesson playback, assessments, practice sessions, and your learning roadmap.",
    icon: BookOpen,
  },
  {
    id: "certificates",
    title: "Certificates",
    description:
      "Earn credentials, download PDFs, share verification links, and manage your wallet.",
    icon: Award,
  },
  {
    id: "diagnostics",
    title: "Diagnostics & Readiness",
    description:
      "Readiness assessments, competency bands, progress signals, and what your scores mean.",
    icon: Compass,
  },
  {
    id: "billing",
    title: "Billing",
    description:
      "Subscriptions, invoices, refunds, and how paid access works alongside free tools.",
    icon: CreditCard,
  },
  {
    id: "account",
    title: "Account",
    description:
      "Profile, security, notifications, appearance, privacy, and data export.",
    icon: User,
  },
  {
    id: "troubleshooting",
    title: "Troubleshooting",
    description:
      "Fix sign-in issues, playback problems, failed page loads, and other common errors.",
    icon: Wrench,
  },
] as const;

export const HELP_TIPS: readonly HelpTipOfWeek[] = [
  {
    label: "Tip of the week",
    body: 'Use Practice mode from the sidebar to review flashcards and drills without affecting your course completion percentage.',
  },
  {
    label: "Study smarter",
    body: "Your Readiness page shows competency bands and next steps. Revisit it after completing a diagnostic or major course module.",
  },
  {
    label: "Stay on track",
    body: "The Progress page heatmap reflects daily XP. Even short sessions keep your streak visible and your roadmap recommendations fresh.",
  },
  {
    label: "Credentials",
    body: "Certificates in your wallet include a public verification link employers can open without signing in.",
  },
];

export const HELP_ARTICLES: readonly HelpArticle[] = [
  {
    slug: "welcome-to-your-academy",
    categoryId: "getting-started",
    title: "Welcome to your academy",
    summary:
      "A quick tour of the learner home, primary navigation, and where to start after sign-in.",
    lastUpdated: "July 10, 2026",
    readMinutes: 4,
    popular: true,
    relatedSlugs: ["navigating-the-dashboard", "taking-the-readiness-diagnostic"],
    sections: [
      {
        id: "overview",
        title: "Overview",
        blocks: [
          {
            type: "p",
            text: "After you sign in, you land on your learner home. From here you can resume courses, open practice drills, check notifications, and see recommendations based on your roadmap and readiness band.",
          },
          {
            type: "p",
            text: "The left sidebar (or mobile drawer) is your main navigation. Core areas include Home, Courses, Roadmap, Practice, Readiness, Progress, Resources, Diagnostic, Achievements, Community, Certificates, and Settings. Some items appear only when your academy enables the related feature.",
          },
        ],
      },
      {
        id: "first-steps",
        title: "Recommended first steps",
        blocks: [
          {
            type: "step",
            number: 1,
            title: "Complete your profile",
            body: "Open Settings and add your display name, time zone, and notification preferences so reminders arrive at sensible times.",
          },
          {
            type: "step",
            number: 2,
            title: "Take a diagnostic",
            body: "Visit Diagnostic in the sidebar to run a readiness assessment. Results feed your competency band and help prioritize what to study next.",
          },
          {
            type: "step",
            number: 3,
            title: "Enroll in a course",
            body: "Browse Courses to enroll in structured learning paths. Trial lessons may be available before purchase, depending on how your academy configured the catalog.",
          },
          {
            type: "callout",
            variant: "note",
            title: "Education only",
            text: "The academy provides educational content and skill development tools. It does not operate live trading accounts or provide investment advice.",
          },
        ],
      },
    ],
  },
  {
    slug: "navigating-the-dashboard",
    categoryId: "getting-started",
    title: "Navigating the dashboard",
    summary:
      "How home, search, notifications, and the mobile drawer work across devices.",
    lastUpdated: "July 8, 2026",
    readMinutes: 3,
    popular: true,
    relatedSlugs: ["welcome-to-your-academy", "when-pages-fail-to-load"],
    sections: [
      {
        id: "overview",
        title: "Overview",
        blocks: [
          {
            type: "p",
            text: "The learner shell keeps navigation consistent on desktop and mobile. On large screens the sidebar stays fixed; on small screens use the menu icon in the top bar to open the drawer.",
          },
        ],
      },
      {
        id: "top-bar",
        title: "Top bar shortcuts",
        blocks: [
          {
            type: "ul",
            items: [
              "Search — opens global search across courses, lessons, and community content where enabled.",
              "Notifications — shows unread in-app alerts; email delivery is controlled in Settings.",
              "Account menu — quick access to profile and sign out.",
            ],
          },
        ],
      },
      {
        id: "deep-links",
        title: "Bookmarks and return URLs",
        blocks: [
          {
            type: "p",
            text: "Most learner URLs are stable. If you are sent to sign-in, you return to the page you requested after authentication. If a link fails once, refresh before assuming the route is missing — transient load errors are retried automatically.",
          },
        ],
      },
    ],
  },
  {
    slug: "understanding-your-roadmap",
    categoryId: "getting-started",
    title: "Understanding your roadmap",
    summary:
      "How learning paths, milestones, and recommendations connect courses, practice, and assessments.",
    lastUpdated: "July 5, 2026",
    readMinutes: 5,
    relatedSlugs: ["enrolling-in-a-course", "understanding-diagnostic-results"],
    sections: [
      {
        id: "overview",
        title: "Overview",
        blocks: [
          {
            type: "p",
            text: "Your Roadmap visualizes the sequence your academy recommends — often mixing courses, practice modules, diagnostics, and assessments. Completing items can unlock the next stage or update your readiness signals.",
          },
        ],
      },
      {
        id: "milestones",
        title: "Milestones and locks",
        blocks: [
          {
            type: "p",
            text: "Some roadmap nodes stay locked until prerequisites are complete (for example, finishing Module 1 before Module 2, or reaching a minimum diagnostic score). Locked items show requirements in the detail panel.",
          },
          {
            type: "callout",
            variant: "tip",
            text: "If you believe a milestone should be unlocked, confirm the prior lesson is marked complete and any required assessment is graded — not merely submitted.",
          },
        ],
      },
    ],
  },
  {
    slug: "enrolling-in-a-course",
    categoryId: "courses",
    title: "Enrolling in a course",
    summary:
      "Browse the catalog, start trial lessons, and gain full access after purchase or admin grant.",
    lastUpdated: "July 12, 2026",
    readMinutes: 4,
    popular: true,
    relatedSlugs: ["tracking-lesson-progress", "managing-your-subscription"],
    sections: [
      {
        id: "overview",
        title: "Overview",
        blocks: [
          {
            type: "p",
            text: "Open Courses to see published programs available to your membership. Each card shows progress, level, and whether trial content is available.",
          },
        ],
      },
      {
        id: "enrollment-steps",
        title: "Enrollment steps",
        blocks: [
          {
            type: "step",
            number: 1,
            title: "Open the course detail page",
            body: "Review the syllabus, FAQs, and requirements before enrolling.",
          },
          {
            type: "step",
            number: 2,
            title: "Start a trial or enroll",
            body: "Trial lessons are labeled in the curriculum. Full enrollment may require checkout or an invitation from your organization.",
          },
          {
            type: "step",
            number: 3,
            title: "Resume from Home",
            body: "After enrollment, the course appears on your home dashboard with the next incomplete lesson highlighted.",
          },
        ],
      },
    ],
  },
  {
    slug: "tracking-lesson-progress",
    categoryId: "courses",
    title: "Tracking lesson progress",
    summary:
      "How completion is recorded for video lessons, readings, SCORM modules, and quizzes.",
    lastUpdated: "July 11, 2026",
    readMinutes: 5,
    popular: true,
    relatedSlugs: ["completing-assessments", "fixing-video-playback-issues"],
    sections: [
      {
        id: "overview",
        title: "Overview",
        blocks: [
          {
            type: "p",
            text: "Lesson progress syncs as you consume content. Video lessons typically mark progress when you watch the required portion; readings mark complete when you reach the end; SCORM packages report completion from the packaged activity.",
          },
        ],
      },
      {
        id: "completion-rules",
        title: "Completion rules",
        blocks: [
          {
            type: "ul",
            items: [
              "Sequential courses may block later lessons until earlier ones are complete.",
              "Some lessons require a minimum time on page before the Complete button enables.",
              "Downloads and external links may open in a new tab; return to the lesson to confirm completion.",
            ],
          },
          {
            type: "callout",
            variant: "warning",
            text: "Closing a lesson before progress saves may delay the completion checkmark. Wait for the saved indicator or refresh the course page if progress looks stuck.",
          },
        ],
      },
    ],
  },
  {
    slug: "completing-assessments",
    categoryId: "courses",
    title: "Completing assessments",
    summary:
      "Starting attempts, submitting answers, viewing results, and retake policies.",
    lastUpdated: "July 9, 2026",
    readMinutes: 6,
    relatedSlugs: ["tracking-lesson-progress", "understanding-diagnostic-results"],
    sections: [
      {
        id: "overview",
        title: "Overview",
        blocks: [
          {
            type: "p",
            text: "Assessments include quizzes, exams, and structured evaluations linked to courses or your roadmap. Each assessment page shows time limits, attempt limits, and passing thresholds when configured.",
          },
        ],
      },
      {
        id: "attempt-flow",
        title: "Attempt flow",
        blocks: [
          {
            type: "step",
            number: 1,
            title: "Start attempt",
            body: "Confirm you have a stable connection. The timer starts when the first question loads, if a time limit applies.",
          },
          {
            type: "step",
            number: 2,
            title: "Submit",
            body: "Review unanswered questions flagged in the navigator. Submitting is final unless your academy allows drafts.",
          },
          {
            type: "step",
            number: 3,
            title: "View results",
            body: "Graded attempts show score, feedback, and whether you met the pass mark. Some assessments hide detailed explanations until a review period ends.",
          },
        ],
      },
    ],
  },
  {
    slug: "using-practice-mode",
    categoryId: "courses",
    title: "Using practice mode",
    summary:
      "Spaced repetition, drills, and swipe review without affecting formal course grades.",
    lastUpdated: "July 7, 2026",
    readMinutes: 3,
    relatedSlugs: ["tracking-lesson-progress", "understanding-your-roadmap"],
    sections: [
      {
        id: "overview",
        title: "Overview",
        blocks: [
          {
            type: "p",
            text: "Practice is designed for reinforcement. Sessions pull from decks tied to your enrollments and readiness gaps. XP earned in practice contributes to your Progress heatmap but does not replace required course assessments.",
          },
        ],
      },
      {
        id: "sessions",
        title: "Session types",
        blocks: [
          {
            type: "ul",
            items: [
              "Hub — pick a focus area or let the system suggest weak topics.",
              "Swipe — rapid review on mobile-friendly cards.",
              "Scheduled drills — appear when your roadmap recommends refreshers.",
            ],
          },
        ],
      },
    ],
  },
  {
    slug: "downloading-your-certificates",
    categoryId: "certificates",
    title: "Downloading your certificates",
    summary:
      "Access your credential wallet, export PDFs, and share verification links.",
    lastUpdated: "July 14, 2026",
    readMinutes: 4,
    popular: true,
    relatedSlugs: ["sharing-and-verifying-credentials", "completing-assessments"],
    sections: [
      {
        id: "overview",
        title: "Overview",
        blocks: [
          {
            type: "p",
            text: "When certification is enabled for your academy, earned credentials appear under Certificates in the sidebar. Each entry shows issue date, course or program name, and verification status.",
          },
        ],
      },
      {
        id: "export-steps",
        title: "Export steps",
        blocks: [
          {
            type: "step",
            number: 1,
            title: "Open Certificates",
            body: "Use the credential wallet to browse active and revoked credentials. Revoked items remain listed for audit but cannot be re-shared.",
          },
          {
            type: "step",
            number: 2,
            title: "Download or copy link",
            body: "Choose Download PDF for a printable file, or Copy verification link for employers and partners.",
          },
          {
            type: "step",
            number: 3,
            title: "Confirm details",
            body: "PDFs include your display name, issuer, completion date, and a unique credential ID matching the public verify page.",
          },
          {
            type: "callout",
            variant: "note",
            text: "Certificates generate only after all required modules and assessments are complete and any admin issuance rules have run.",
          },
        ],
      },
    ],
  },
  {
    slug: "sharing-and-verifying-credentials",
    categoryId: "certificates",
    title: "Sharing and verifying credentials",
    summary:
      "Public verify URLs, LinkedIn sharing, and what third parties see.",
    lastUpdated: "July 13, 2026",
    readMinutes: 3,
    relatedSlugs: ["downloading-your-certificates"],
    sections: [
      {
        id: "overview",
        title: "Overview",
        blocks: [
          {
            type: "p",
            text: "Each credential has a verification URL that works without a login. Third parties see issuer name, recipient, issue date, and validity — not your full account details.",
          },
        ],
      },
      {
        id: "sharing",
        title: "Sharing options",
        blocks: [
          {
            type: "ul",
            items: [
              "Copy the verification link into email, portfolios, or job applications.",
              "Download a PDF and attach it where a file is required.",
              "Use your academy’s social share action when available on the certificate detail drawer.",
            ],
          },
        ],
      },
    ],
  },
  {
    slug: "taking-the-readiness-diagnostic",
    categoryId: "diagnostics",
    title: "Taking the readiness diagnostic",
    summary:
      "Start an assessment, save progress, and submit for competency scoring.",
    lastUpdated: "July 15, 2026",
    readMinutes: 5,
    popular: true,
    relatedSlugs: [
      "understanding-diagnostic-results",
      "retaking-diagnostics",
    ],
    sections: [
      {
        id: "overview",
        title: "Overview",
        blocks: [
          {
            type: "p",
            text: "Diagnostics measure readiness across dimensions such as risk management, psychology, technical knowledge, and prop-style rules familiarity. Open Diagnostic in the sidebar to see available assessments and your in-progress attempts.",
          },
        ],
      },
      {
        id: "before-you-start",
        title: "Before you start",
        blocks: [
          {
            type: "ul",
            items: [
              "Allow 15–25 minutes for a full diagnostic, depending on the catalog item.",
              "Use a quiet environment — some items are timed.",
              "Answer based on your current habits, not what you aspire to do.",
            ],
          },
        ],
      },
      {
        id: "during-attempt",
        title: "During the attempt",
        blocks: [
          {
            type: "p",
            text: "Progress saves between sections when configured. If you leave mid-attempt, resume from Diagnostic — your in-progress card shows remaining questions.",
          },
          {
            type: "callout",
            variant: "tip",
            text: "After submitting, open Readiness to see how your composite band updated and which courses or practice areas are recommended next.",
          },
        ],
      },
    ],
  },
  {
    slug: "understanding-diagnostic-results",
    categoryId: "diagnostics",
    title: "Understanding diagnostic results",
    summary:
      "Bands, dimension scores, momentum charts, and how results affect your roadmap.",
    lastUpdated: "July 14, 2026",
    readMinutes: 6,
    popular: true,
    relatedSlugs: [
      "taking-the-readiness-diagnostic",
      "understanding-your-roadmap",
    ],
    sections: [
      {
        id: "overview",
        title: "Overview",
        blocks: [
          {
            type: "p",
            text: "Results appear on the diagnostic result page and feed the Readiness hub. You see an overall band plus per-dimension scores. Bands are educational signals — they describe preparation level, not a guarantee of funding or trading performance.",
          },
        ],
      },
      {
        id: "bands",
        title: "Competency bands",
        blocks: [
          {
            type: "p",
            text: "Your academy configures band names and thresholds. Typical bands progress from foundational to advanced readiness. The Readiness page explains legal disclaimers and what actions are suggested at each band.",
          },
          {
            type: "ul",
            items: [
              "Lower bands emphasize fundamentals and risk hygiene.",
              "Middle bands highlight structured courses and deliberate practice.",
              "Higher bands focus on evaluation prep and consistency habits.",
            ],
          },
        ],
      },
      {
        id: "momentum",
        title: "Momentum over time",
        blocks: [
          {
            type: "p",
            text: "The Readiness momentum chart plots recent composite snapshots so you can see improvement after courses and practice — not only your latest attempt.",
          },
        ],
      },
    ],
  },
  {
    slug: "retaking-diagnostics",
    categoryId: "diagnostics",
    title: "Retaking diagnostics",
    summary:
      "Cooldowns, best-score vs latest-score, and when a retake is worthwhile.",
    lastUpdated: "July 6, 2026",
    readMinutes: 3,
    relatedSlugs: ["taking-the-readiness-diagnostic", "using-practice-mode"],
    sections: [
      {
        id: "overview",
        title: "Overview",
        blocks: [
          {
            type: "p",
            text: "Retakes are useful after meaningful study. Some catalogs enforce a cooldown or maximum attempts per month to prevent score chasing without learning.",
          },
        ],
      },
      {
        id: "policy",
        title: "Retake policy",
        blocks: [
          {
            type: "p",
            text: "If retakes are limited, the diagnostic card shows the next eligible date. Your Readiness view may display the latest attempt, the best attempt, or a rolling composite — depending on academy configuration.",
          },
          {
            type: "callout",
            variant: "tip",
            text: "Complete at least one practice cycle and relevant course modules before retaking; otherwise scores often plateau.",
          },
        ],
      },
    ],
  },
  {
    slug: "managing-your-subscription",
    categoryId: "billing",
    title: "Managing your subscription",
    summary:
      "View plan status, update payment methods, and understand renewal timing.",
    lastUpdated: "July 12, 2026",
    readMinutes: 4,
    popular: true,
    relatedSlugs: ["understanding-invoices-and-refunds", "enrolling-in-a-course"],
    sections: [
      {
        id: "overview",
        title: "Overview",
        blocks: [
          {
            type: "p",
            text: "Open Settings and select Subscription to see your current plan, renewal date, and entitlements. Free tools (such as diagnostics and selected practice items) may remain available without a paid plan depending on academy policy.",
          },
        ],
      },
      {
        id: "changes",
        title: "Plan changes",
        blocks: [
          {
            type: "ul",
            items: [
              "Upgrades usually take effect immediately with prorated charges when supported.",
              "Downgrades apply at the next billing cycle unless stated otherwise at checkout.",
              "Canceled subscriptions retain access until the period ends.",
            ],
          },
        ],
      },
    ],
  },
  {
    slug: "understanding-invoices-and-refunds",
    categoryId: "billing",
    title: "Understanding invoices and refunds",
    summary:
      "Receipts, tax details, refund eligibility, and how to request billing support.",
    lastUpdated: "July 10, 2026",
    readMinutes: 5,
    relatedSlugs: ["managing-your-subscription"],
    sections: [
      {
        id: "overview",
        title: "Overview",
        blocks: [
          {
            type: "p",
            text: "Invoices are emailed to your account address and may also be listed in Subscription settings. Keep your billing email current under Settings → Profile.",
          },
        ],
      },
      {
        id: "refunds",
        title: "Refund requests",
        blocks: [
          {
            type: "p",
            text: "Refund eligibility depends on your academy’s terms and how much of the course you consumed. Digital content with substantial progress may be non-refundable. Submit requests through the support channel your academy provides, including your invoice ID and reason.",
          },
          {
            type: "callout",
            variant: "note",
            text: "Chargebacks without contacting support first may result in account suspension per the Terms of Service.",
          },
        ],
      },
    ],
  },
  {
    slug: "updating-your-profile",
    categoryId: "account",
    title: "Updating your profile",
    summary:
      "Display name, avatar, locale, and fields visible to other learners.",
    lastUpdated: "July 13, 2026",
    readMinutes: 3,
    popular: true,
    relatedSlugs: ["notification-preferences", "privacy-and-data-export"],
    sections: [
      {
        id: "overview",
        title: "Overview",
        blocks: [
          {
            type: "p",
            text: "Settings → Profile lets you update how you appear on leaderboards, community posts, and certificates. Your login email is managed separately under Security.",
          },
        ],
      },
      {
        id: "avatar",
        title: "Avatar uploads",
        blocks: [
          {
            type: "p",
            text: "Accepted formats are JPG, PNG, and WebP up to 800 KB. Images are cropped to a square for display across the platform.",
          },
        ],
      },
    ],
  },
  {
    slug: "changing-your-password",
    categoryId: "account",
    title: "Changing your password and MFA",
    summary:
      "Password updates, multi-factor authentication, and connected sign-in providers.",
    lastUpdated: "July 11, 2026",
    readMinutes: 4,
    relatedSlugs: ["resolving-sign-in-problems", "updating-your-profile"],
    sections: [
      {
        id: "overview",
        title: "Overview",
        blocks: [
          {
            type: "p",
            text: "Security settings live under Settings → Security. You can change your password, enroll in MFA, and review connected OAuth providers.",
          },
        ],
      },
      {
        id: "mfa",
        title: "Multi-factor authentication",
        blocks: [
          {
            type: "step",
            number: 1,
            title: "Enroll authenticator app",
            body: "Scan the QR code with a TOTP app and enter the verification code to confirm.",
          },
          {
            type: "step",
            number: 2,
            title: "Store recovery codes",
            body: "Save backup codes offline. They are required if you lose your device.",
          },
        ],
      },
    ],
  },
  {
    slug: "notification-preferences",
    categoryId: "account",
    title: "Notification preferences",
    summary:
      "Control email and in-app alerts for course, community, and system events.",
    lastUpdated: "July 9, 2026",
    readMinutes: 3,
    relatedSlugs: ["updating-your-profile"],
    sections: [
      {
        id: "overview",
        title: "Overview",
        blocks: [
          {
            type: "p",
            text: "Settings → Notifications lists events such as course updates, mentions, achievements, and billing reminders. Toggle email and in-app columns independently.",
          },
          {
            type: "callout",
            variant: "note",
            text: "Transactional messages (password reset, security alerts, purchase receipts) may still be sent when required for account safety or legal compliance.",
          },
        ],
      },
    ],
  },
  {
    slug: "privacy-and-data-export",
    categoryId: "account",
    title: "Privacy and data export",
    summary:
      "Analytics opt-out, profile visibility, downloading your data, and account deletion.",
    lastUpdated: "July 8, 2026",
    readMinutes: 5,
    relatedSlugs: ["updating-your-profile"],
    sections: [
      {
        id: "overview",
        title: "Overview",
        blocks: [
          {
            type: "p",
            text: "Settings → Privacy & Data controls optional analytics, visibility of your profile to other members, and self-service export of your personal data as JSON.",
          },
        ],
      },
      {
        id: "deletion",
        title: "Account deletion",
        blocks: [
          {
            type: "p",
            text: "Deletion requests are processed per your academy’s data retention policy. Some records (billing, certificates issued) may be retained in anonymized or legal-hold form. Review the Privacy Policy linked in the site footer before confirming.",
          },
        ],
      },
    ],
  },
  {
    slug: "fixing-video-playback-issues",
    categoryId: "troubleshooting",
    title: "Fixing video playback issues",
    summary:
      "Buffering, DRM, browser extensions, and mobile playback tips.",
    lastUpdated: "July 14, 2026",
    readMinutes: 4,
    relatedSlugs: ["tracking-lesson-progress", "resolving-sign-in-problems"],
    sections: [
      {
        id: "overview",
        title: "Overview",
        blocks: [
          {
            type: "p",
            text: "Lessons stream from protected CDNs. Most playback issues come from network instability, aggressive ad blockers, or outdated browsers.",
          },
        ],
      },
      {
        id: "checks",
        title: "Quick checks",
        blocks: [
          {
            type: "ol",
            items: [
              "Refresh the lesson page and resume playback.",
              "Disable ad blockers and privacy extensions on your academy domain.",
              "Try Chrome or Edge latest version; Safari is supported on macOS/iOS.",
              "Switch from cellular to Wi‑Fi if buffering persists.",
              "Clear site data only as a last resort — you may need to sign in again.",
            ],
          },
        ],
      },
    ],
  },
  {
    slug: "resolving-sign-in-problems",
    categoryId: "troubleshooting",
    title: "Resolving sign-in problems",
    summary:
      "Password reset, MFA lockouts, invited accounts, and suspended memberships.",
    lastUpdated: "July 13, 2026",
    readMinutes: 4,
    popular: true,
    relatedSlugs: ["changing-your-password", "when-pages-fail-to-load"],
    sections: [
      {
        id: "overview",
        title: "Overview",
        blocks: [
          {
            type: "p",
            text: "Sign-in issues usually fall into credential problems, MFA challenges, or membership state (invited, suspended, removed).",
          },
        ],
      },
      {
        id: "scenarios",
        title: "Common scenarios",
        blocks: [
          {
            type: "ul",
            items: [
              "Forgot password — use the reset link on the sign-in page; check spam folders.",
              "MFA device lost — use a backup code or contact your academy admin for recovery.",
              "Invited — accept the invitation email before signing in.",
              "Suspended — you see a membership blocked message; contact support or your organization admin.",
            ],
          },
        ],
      },
    ],
  },
  {
    slug: "when-pages-fail-to-load",
    categoryId: "troubleshooting",
    title: "When pages fail to load",
    summary:
      "Intermittent errors, request IDs, and what to do before opening a ticket.",
    lastUpdated: "July 16, 2026",
    readMinutes: 3,
    popular: true,
    relatedSlugs: ["navigating-the-dashboard", "resolving-sign-in-problems"],
    sections: [
      {
        id: "overview",
        title: "Overview",
        blocks: [
          {
            type: "p",
            text: 'Occasionally a page shows "Failed to load" with a Request ID. The platform retries automatically; a single refresh often resolves transient session or network races.',
          },
        ],
      },
      {
        id: "steps",
        title: "What to try",
        blocks: [
          {
            type: "step",
            number: 1,
            title: "Hard refresh",
            body: "Reload the page once or twice. Avoid rapid navigation immediately after sign-in.",
          },
          {
            type: "step",
            number: 2,
            title: "Sign out and back in",
            body: "This refreshes your session cookie if errors persist across multiple routes.",
          },
          {
            type: "step",
            number: 3,
            title: "Capture the Request ID",
            body: "If the error continues, copy the Request ID when contacting support — it maps to server logs for your tenant.",
          },
        ],
      },
    ],
  },
  {
    slug: "achievements-and-leaderboards",
    categoryId: "courses",
    title: "Achievements and leaderboards",
    summary:
      "XP, badges, leagues, and how gamification interacts with your progress.",
    lastUpdated: "July 7, 2026",
    readMinutes: 4,
    relatedSlugs: ["using-practice-mode", "understanding-your-roadmap"],
    sections: [
      {
        id: "overview",
        title: "Overview",
        blocks: [
          {
            type: "p",
            text: "When gamification is enabled, Achievements shows badges and milestones; Leaderboards ranks members by XP for the selected period. League tiers (gold, silver, bronze) use accent colors tuned for light and dark mode.",
          },
        ],
      },
      {
        id: "fair-play",
        title: "Fair play",
        blocks: [
          {
            type: "p",
            text: "Automated activity or shared accounts can violate the code of conduct and result in leaderboard removal. Play fairly — practice and course completion are the intended ways to earn XP.",
          },
        ],
      },
    ],
  },
  {
    slug: "community-guidelines",
    categoryId: "courses",
    title: "Community spaces and posting",
    summary:
      "Join spaces, create posts, moderation, and reporting content.",
    lastUpdated: "July 6, 2026",
    readMinutes: 4,
    relatedSlugs: ["updating-your-profile", "privacy-and-data-export"],
    sections: [
      {
        id: "overview",
        title: "Overview",
        blocks: [
          {
            type: "p",
            text: "Community features include spaces, threads, and the Hall of Fame when enabled. Your display name and avatar appear on posts according to profile settings.",
          },
        ],
      },
      {
        id: "moderation",
        title: "Moderation",
        blocks: [
          {
            type: "p",
            text: "Report content that violates community guidelines. Moderators may remove posts, issue warnings, or restrict access. Educational discussion of strategies is welcome; promotional spam and harassment are not.",
          },
        ],
      },
    ],
  },
];

export function getHelpCategory(id: string) {
  return HELP_CATEGORIES.find((category) => category.id === id) ?? null;
}

export function getHelpArticle(slug: string) {
  return HELP_ARTICLES.find((article) => article.slug === slug) ?? null;
}

export function getArticlesByCategory(categoryId: string) {
  return HELP_ARTICLES.filter((article) => article.categoryId === categoryId);
}

export function getPopularArticles(limit = 5) {
  return HELP_ARTICLES.filter((article) => article.popular).slice(0, limit);
}

export function getRelatedArticles(article: HelpArticle, limit = 3) {
  const slugs = article.relatedSlugs ?? [];
  const related = slugs
    .map((slug) => getHelpArticle(slug))
    .filter((entry): entry is HelpArticle => entry != null);

  if (related.length >= limit) {
    return related.slice(0, limit);
  }

  const sameCategory = HELP_ARTICLES.filter(
    (entry) => entry.categoryId === article.categoryId && entry.slug !== article.slug,
  );

  const merged = [...related];
  for (const entry of sameCategory) {
    if (merged.length >= limit) break;
    if (!merged.some((item) => item.slug === entry.slug)) {
      merged.push(entry);
    }
  }

  return merged.slice(0, limit);
}

export function getTipOfWeek(referenceDate = new Date()): HelpTipOfWeek {
  const start = new Date(referenceDate.getFullYear(), 0, 1);
  const dayOfYear = Math.floor(
    (referenceDate.getTime() - start.getTime()) / (24 * 60 * 60 * 1000),
  );
  const index = dayOfYear % HELP_TIPS.length;
  return HELP_TIPS[index] ?? HELP_TIPS[0]!;
}

export const HELP_SEARCH_SUGGESTIONS = [
  "Certificate download",
  "Reset password",
  "Diagnostic results",
  "Subscription billing",
  "Video playback",
  "Request ID error",
] as const;
