import type { LegalDocument } from "./legal-types";

export const PRIVACY_DOCUMENT: LegalDocument = {
  slug: "privacy",
  title: "Privacy Policy",
  subtitle:
    "This Privacy Policy explains how FundedBeyond Academy collects, uses, stores, and protects personal information when you use our educational platform, diagnostic tools, courses, and community features.",
  lastUpdated: "June 26, 2026",
  sections: [
    {
      id: "introduction",
      sectionNumber: "Section 01",
      title: "Introduction",
      blocks: [
        {
          type: "p",
          text: "FundedBeyond Academy (\"Academy,\" \"we,\" \"us,\" or \"our\") respects your privacy. This Privacy Policy describes our practices when you visit academy.fundedbeyond.com (or your organization's tenant domain), create an account, take the free trader diagnostic, enroll in courses, use practice tools, or participate in community spaces.",
        },
        {
          type: "p",
          text: "This policy applies to the Academy platform. Separate privacy practices may apply when you leave the Academy for fundedbeyond.com, challenge purchase flows, or third-party trading platforms. Those services are governed by their own policies.",
        },
        {
          type: "p",
          text: "By using the Academy, you acknowledge that you have read this Privacy Policy. If you do not agree with our practices, please do not use the platform.",
        },
      ],
    },
    {
      id: "information-we-collect",
      sectionNumber: "Section 02",
      title: "Information We Collect",
      blocks: [
        {
          type: "h3",
          text: "Information you provide",
        },
        {
          type: "ul",
          items: [
            "Account details: name, display name, email address, password (stored in hashed form via our authentication provider), and profile preferences.",
            "Enrollment and learning data: course progress, assessment responses, diagnostic results, practice tool usage, and certificate information.",
            "Payment information: billing name, address, and transaction metadata processed by our payment partners (we do not store full card numbers on Academy servers).",
            "Communications: messages you send to support, community posts, comments, and survey responses.",
            "Optional profile information you choose to share, such as trading experience level or goals.",
          ],
        },
        {
          type: "h3",
          text: "Information collected automatically",
        },
        {
          type: "ul",
          items: [
            "Device and browser data: IP address, browser type, operating system, and device identifiers.",
            "Usage data: pages viewed, features used, session duration, click paths, and error logs.",
            "Authentication events: sign-in timestamps, multi-factor authentication status, and session tokens managed through secure cookies.",
            "Approximate location derived from IP address for security, fraud prevention, and regional compliance.",
          ],
        },
        {
          type: "h3",
          text: "Information from third parties",
        },
        {
          type: "p",
          text: "If you sign in with Google, Apple, or another supported provider, we receive basic profile information permitted by that provider (such as email and name). If you arrive via an invitation or organizational tenant, we may receive enrollment data from your institution.",
        },
      ],
    },
    {
      id: "how-we-use",
      sectionNumber: "Section 03",
      title: "How We Use Your Information",
      blocks: [
        {
          type: "p",
          text: "We use personal information for the following purposes:",
        },
        {
          type: "ul",
          items: [
            "Provide, operate, and improve the Academy, including diagnostics, courses, practice tools, and community features.",
            "Create and manage your account, authenticate sessions, and enforce our Terms and Conditions.",
            "Process payments, fulfill enrollments, and send transactional messages (receipts, password resets, course updates).",
            "Personalize learning recommendations, readiness insights, and progress reporting.",
            "Monitor platform security, detect fraud, and prevent abuse.",
            "Analyze aggregated usage to improve content quality and product design.",
            "Send marketing communications where you have opted in; you may unsubscribe at any time.",
            "Comply with legal obligations and respond to lawful requests.",
          ],
        },
        {
          type: "p",
          text: "We process data based on contractual necessity (to deliver services you request), legitimate interests (security, analytics, product improvement), consent (where required for marketing or optional features), and legal obligations.",
        },
      ],
    },
    {
      id: "cookies",
      sectionNumber: "Section 04",
      title: "Cookies and Similar Technologies",
      blocks: [
        {
          type: "p",
          text: "We use cookies and similar technologies to keep you signed in, remember preferences (such as theme settings), measure performance, and understand how the platform is used.",
        },
        {
          type: "table",
          headers: ["Category", "Purpose", "Examples"],
          rows: [
            ["Essential", "Authentication and security", "Session cookies, CSRF protection"],
            ["Functional", "Preferences and UX", "Theme, language, dismissed notices"],
            ["Analytics", "Usage measurement", "Page views, feature adoption (where enabled)"],
            ["Marketing", "Attribution and campaigns", "Only with consent where required"],
          ],
        },
        {
          type: "p",
          text: "You can control cookies through your browser settings. Disabling essential cookies may prevent you from signing in or using core features.",
        },
      ],
    },
    {
      id: "content-security",
      sectionNumber: "Section 05",
      title: "Content Security",
      blocks: [
        {
          type: "p",
          text: "Course videos, downloadable materials, and proprietary assessments are valuable intellectual property. We employ technical and organizational measures to reduce unauthorized copying, redistribution, or scraping of Academy content.",
        },
        {
          type: "ul",
          items: [
            "Access controls tied to active enrollment and account status.",
            "Signed or time-limited URLs for media delivery where applicable.",
            "Watermarking or viewer identification on select premium materials.",
            "Rate limiting and monitoring for abnormal download or API patterns.",
            "Termination of accounts that violate content licensing terms.",
          ],
        },
        {
          type: "p",
          text: "No security measure is perfect. You agree not to attempt to bypass protections or share access credentials with others.",
        },
      ],
    },
    {
      id: "data-retention",
      sectionNumber: "Section 06",
      title: "Data Retention",
      blocks: [
        {
          type: "p",
          text: "We retain personal information for as long as your account is active or as needed to provide services, comply with law, resolve disputes, and enforce agreements.",
        },
        {
          type: "ul",
          items: [
            "Account profile data: retained while your account exists and for a limited period after deletion for backup and legal purposes.",
            "Learning and diagnostic records: retained to support progress history and certificates; may be anonymized after account closure where appropriate.",
            "Payment records: retained as required by tax, accounting, and financial regulations.",
            "Security logs: typically retained for a shorter defined period unless needed for an investigation.",
          ],
        },
        {
          type: "p",
          text: "You may request deletion of your account and associated personal data subject to exceptions described in the \"Your Rights\" section below.",
        },
      ],
    },
    {
      id: "sharing",
      sectionNumber: "Section 07",
      title: "Information Sharing and Disclosure",
      blocks: [
        {
          type: "p",
          text: "We do not sell your personal information. We may share information in these circumstances:",
        },
        {
          type: "ul",
          items: [
            "Service providers who process data on our behalf (hosting, authentication, email delivery, payment processing, analytics) under contractual confidentiality and security obligations.",
            "Organizational tenants: if you access the Academy through an employer or partner program, certain progress data may be visible to authorized administrators of that tenant.",
            "Legal and safety: when required by law, court order, or to protect rights, safety, and security of users and the public.",
            "Business transfers: in connection with a merger, acquisition, or sale of assets, subject to continued protection consistent with this policy.",
            "With your direction: when you choose to share content publicly in community areas or integrate with a third-party service you authorize.",
          ],
        },
      ],
    },
    {
      id: "third-party",
      sectionNumber: "Section 08",
      title: "Third-Party Services",
      blocks: [
        {
          type: "p",
          text: "The Academy may contain links to external sites, including fundedbeyond.com for challenge purchases, payment processors, and social sign-in providers. We are not responsible for the privacy practices of those third parties.",
        },
        {
          type: "p",
          text: "We encourage you to review the privacy policies of any third-party service before providing personal information. OAuth sign-in is governed by both this policy and the provider's terms.",
        },
      ],
    },
    {
      id: "security",
      sectionNumber: "Section 09",
      title: "Security",
      blocks: [
        {
          type: "p",
          text: "We implement administrative, technical, and physical safeguards designed to protect personal information, including encryption in transit (TLS), access controls, tenant isolation for multi-tenant deployments, and regular security reviews.",
        },
        {
          type: "p",
          text: "No method of transmission or storage is completely secure. You are responsible for using a strong password and keeping your credentials confidential. Notify us immediately at support@fundedbeyond.com if you believe your account has been compromised.",
        },
      ],
    },
    {
      id: "your-rights",
      sectionNumber: "Section 10",
      title: "Your Rights and Choices",
      blocks: [
        {
          type: "p",
          text: "Depending on your location, you may have rights to access, correct, delete, restrict, or port your personal data, and to object to certain processing. You may also withdraw consent for marketing communications at any time.",
        },
        {
          type: "ul",
          items: [
            "Access and update profile information in account settings where available.",
            "Request a copy of personal data we hold about you.",
            "Request deletion of your account, subject to legal retention requirements.",
            "Opt out of marketing emails via the unsubscribe link in messages.",
            "Lodge a complaint with your local data protection authority if you believe we have not addressed your concern.",
          ],
        },
        {
          type: "p",
          text: "To exercise these rights, contact support@fundedbeyond.com. We may need to verify your identity before fulfilling requests.",
        },
      ],
    },
    {
      id: "children",
      sectionNumber: "Section 11",
      title: "Children's Privacy",
      blocks: [
        {
          type: "p",
          text: "The Academy is not directed to individuals under 18 years of age. We do not knowingly collect personal information from children. If you believe a child has provided us with personal data, contact us and we will take steps to delete such information.",
        },
      ],
    },
    {
      id: "international",
      sectionNumber: "Section 12",
      title: "International Data Transfers",
      blocks: [
        {
          type: "p",
          text: "FundedBeyond Academy may process and store information in countries other than your own. Where required, we use appropriate safeguards such as standard contractual clauses or equivalent mechanisms to protect data transferred across borders.",
        },
        {
          type: "p",
          text: "By using the platform, you acknowledge that your information may be processed in jurisdictions that may have different data protection laws than your country of residence.",
        },
      ],
    },
    {
      id: "changes",
      sectionNumber: "Section 13",
      title: "Changes to This Policy",
      blocks: [
        {
          type: "p",
          text: "We may update this Privacy Policy to reflect changes in our practices, technology, or legal requirements. We will post the revised policy on this page and update the \"Last updated\" date. Material changes will be communicated through the platform or by email where appropriate.",
        },
        {
          type: "p",
          text: "We encourage you to review this policy periodically to stay informed about how we protect your information.",
        },
      ],
    },
    {
      id: "contact",
      sectionNumber: "Section 14",
      title: "Contact Us",
      blocks: [
        {
          type: "p",
          text: "If you have questions, concerns, or requests regarding this Privacy Policy or our data practices, please contact us:",
        },
        {
          type: "ul",
          items: [
            "Email: support@fundedbeyond.com",
            "Subject line: Privacy Request - FundedBeyond Academy",
            "Include your account email and a description of your request for faster assistance.",
          ],
        },
        {
          type: "p",
          text: "We aim to respond to privacy inquiries within a reasonable timeframe and in accordance with applicable law.",
        },
      ],
    },
  ],
};
