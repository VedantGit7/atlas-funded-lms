import type { LegalDocument } from "./legal-types";

export const TERMS_DOCUMENT: LegalDocument = {
  slug: "terms",
  title: "Terms and Conditions",
  subtitle:
    "These Terms and Conditions govern your access to and use of FundedBeyond Academy, including our free diagnostic, courses, practice tools, community features, and related educational services.",
  lastUpdated: "June 26, 2026",
  sections: [
    {
      id: "introduction",
      sectionNumber: "Section 01",
      title: "Introduction and Acceptance",
      blocks: [
        {
          type: "p",
          text: 'Welcome to FundedBeyond Academy ("Academy," "we," "us," or "our"), the education and trader-development platform operated as part of the FundedBeyond ecosystem. By creating an account, accessing our website at academy.fundedbeyond.com (or your tenant domain), or using any Academy service, you agree to be bound by these Terms and Conditions ("Terms").',
        },
        {
          type: "p",
          text: "If you do not agree to these Terms, you must not use the Academy. We may update these Terms from time to time. Material changes will be communicated through the platform or by email where appropriate. Continued use after changes take effect constitutes acceptance of the revised Terms.",
        },
        {
          type: "p",
          text: "The Academy provides educational content, assessments, practice tools, and community features designed to help traders develop skills and prepare for proprietary trading evaluations. The Academy does not operate trading accounts, sell prop-trading challenges, or provide investment advice.",
        },
      ],
    },
    {
      id: "eligibility",
      sectionNumber: "Section 02",
      title: "Eligibility and Account Registration",
      blocks: [
        {
          type: "p",
          text: "You must be at least 18 years of age (or the age of majority in your jurisdiction, whichever is higher) to create an account and use the Academy. By registering, you represent that you meet this requirement and that all information you provide is accurate, current, and complete.",
        },
        {
          type: "h3",
          text: "Account responsibilities",
        },
        {
          type: "ul",
          items: [
            "You are responsible for maintaining the confidentiality of your login credentials and for all activity under your account.",
            "You must notify us promptly at support@fundedbeyond.com if you suspect unauthorized access.",
            "One person may not maintain more than one personal account unless we expressly authorize otherwise (for example, separate admin or instructor roles).",
            "You may sign in using email and password or supported third-party authentication providers where available.",
          ],
        },
        {
          type: "p",
          text: "We reserve the right to refuse registration, suspend, or terminate accounts that violate these Terms or that we reasonably believe pose a risk to the platform or other users.",
        },
      ],
    },
    {
      id: "code-of-conduct",
      sectionNumber: "Section 03",
      title: "Code of Conduct",
      blocks: [
        {
          type: "p",
          text: "FundedBeyond Academy is a learning community. All users are expected to interact respectfully and in good faith. The following conduct is prohibited:",
        },
        {
          type: "ul",
          items: [
            "Harassment, hate speech, threats, or discrimination based on protected characteristics.",
            "Sharing false, misleading, or manipulative trading signals presented as guaranteed outcomes.",
            "Spamming, scraping, automated abuse, or attempts to circumvent access controls or rate limits.",
            "Uploading malware, attempting unauthorized access, or interfering with platform security or performance.",
            "Sharing login credentials, course materials, or proprietary Academy content outside permitted use.",
            "Impersonating another person, instructor, or FundedBeyond representative.",
            "Using the community or messaging features for unsolicited commercial promotion unrelated to permitted educational discussion.",
          ],
        },
        {
          type: "p",
          text: "Violations may result in content removal, feature restrictions, or permanent account termination at our discretion. Serious violations may be referred to appropriate authorities.",
        },
      ],
    },
    {
      id: "educational-services",
      sectionNumber: "Section 04",
      title: "Educational Services and Platform Scope",
      blocks: [
        {
          type: "p",
          text: "The Academy offers structured learning paths, lessons, diagnostics, simulated practice tools, progress tracking, certificates of completion where applicable, and community spaces. Availability of specific features may vary by membership tier, enrollment, or tenant configuration.",
        },
        {
          type: "h3",
          text: "Relationship to FundedBeyond challenges",
        },
        {
          type: "p",
          text: "Prop-trading challenges, funded accounts, and related trading services are offered separately through fundedbeyond.com and its trading infrastructure. The Academy may display readiness indicators, recommendations, or outbound links to challenge purchase flows. Those purchases are governed by the terms and policies of the main FundedBeyond platform, not these Academy Terms alone.",
        },
        {
          type: "p",
          text: "Completion of Academy courses or achievement of readiness scores does not guarantee challenge approval, funding, or trading profits. Outcomes depend on your performance, market conditions, and the rules of any third-party evaluation program you choose to pursue.",
        },
      ],
    },
    {
      id: "fees",
      sectionNumber: "Section 05",
      title: "Fees, Subscriptions, and Payments",
      blocks: [
        {
          type: "p",
          text: "Certain Academy features are free (including the trader diagnostic in applicable configurations). Paid courses, memberships, or premium tools may require payment as displayed at checkout. Prices are shown in the currency indicated and may include applicable taxes where required by law.",
        },
        {
          type: "table",
          headers: ["Offering type", "Billing", "Access"],
          rows: [
            ["Free diagnostic and selected public content", "No charge", "As described on the product page"],
            ["Individual course purchase", "One-time or installment per checkout", "Per course enrollment terms"],
            ["Membership or bundle plans", "Recurring until cancelled", "While subscription remains active"],
            ["Enterprise or custom tenant plans", "Per agreement", "Per contract with your organization"],
          ],
        },
        {
          type: "p",
          text: "You authorize us and our payment processors to charge your selected payment method for applicable fees. Failed payments may result in suspension of paid features until the balance is resolved. We may change pricing for future billing periods with reasonable notice; changes do not affect amounts already paid for the current term unless required by law.",
        },
      ],
    },
    {
      id: "intellectual-property",
      sectionNumber: "Section 06",
      title: "Intellectual Property",
      blocks: [
        {
          type: "p",
          text: "All content on the Academy platform, including videos, text, graphics, assessments, software, logos, and course materials, is owned by FundedBeyond or its licensors and is protected by copyright, trademark, and other intellectual property laws.",
        },
        {
          type: "h3",
          text: "Limited license to learners",
        },
        {
          type: "p",
          text: "Subject to these Terms and your active enrollment, we grant you a personal, non-exclusive, non-transferable, revocable license to access and use Academy materials solely for your own educational purposes. You may not copy, redistribute, publicly perform, resell, sublicense, or create derivative works from Academy content except where expressly permitted (for example, personal notes or exports explicitly provided by the platform).",
        },
        {
          type: "p",
          text: "User-generated content you post in community areas remains yours, but you grant us a worldwide, royalty-free license to host, display, and moderate that content in connection with operating the Academy.",
        },
      ],
    },
    {
      id: "termination",
      sectionNumber: "Section 07",
      title: "Account Suspension and Termination",
      blocks: [
        {
          type: "p",
          text: "You may close your account at any time by contacting support@fundedbeyond.com or through account settings where available. We may suspend or terminate your access immediately, with or without notice, if you breach these Terms, engage in fraudulent activity, abuse other users, or if required by law.",
        },
        {
          type: "h3",
          text: "Effect of termination",
        },
        {
          type: "ul",
          items: [
            "Your right to access enrolled courses and community features ends upon termination, except where law requires continued access to previously purchased digital goods.",
            "Provisions that by nature should survive (including intellectual property, disclaimers, limitation of liability, and dispute resolution) remain in effect.",
            "We may retain certain records as described in our Privacy Policy and as required for legal, security, or accounting purposes.",
          ],
        },
      ],
    },
    {
      id: "refunds",
      sectionNumber: "Section 08",
      title: "Refund and Cancellation Policy",
      blocks: [
        {
          type: "p",
          text: "Refund eligibility depends on the product purchased and the laws of your jurisdiction. The table below summarizes our standard approach; specific offers may include additional terms shown at checkout.",
        },
        {
          type: "table",
          headers: ["Product", "Refund window", "Notes"],
          rows: [
            [
              "One-time course purchase",
              "14 days from purchase",
              "If less than 20% of course content has been completed",
            ],
            [
              "Subscription plans",
              "No refund for current period",
              "Cancel anytime; access continues until period end",
            ],
            [
              "Free diagnostic and free tiers",
              "Not applicable",
              "No payment collected",
            ],
            [
              "Promotional or bundled offers",
              "Per offer terms",
              "As stated on the promotional page",
            ],
          ],
        },
        {
          type: "p",
          text: "To request a refund, contact support@fundedbeyond.com with your account email and order details. Approved refunds are processed to the original payment method within a reasonable timeframe. Nothing in this section limits mandatory consumer rights where applicable law provides otherwise.",
        },
      ],
    },
    {
      id: "disclaimers",
      sectionNumber: "Section 09",
      title: "Educational Disclaimers and Trading Risk",
      blocks: [
        {
          type: "p",
          text: "FUNDEDBEYOND ACADEMY PROVIDES EDUCATIONAL INFORMATION ONLY. NOTHING ON THE PLATFORM CONSTITUTES FINANCIAL, INVESTMENT, TAX, OR LEGAL ADVICE. YOU ALONE ARE RESPONSIBLE FOR YOUR TRADING AND INVESTMENT DECISIONS.",
        },
        {
          type: "p",
          text: "Trading financial instruments, including forex, futures, and other leveraged products, involves substantial risk of loss and is not suitable for every person. Past performance in simulations, diagnostics, or practice tools does not guarantee future results. You should seek independent professional advice before trading with real capital.",
        },
        {
          type: "p",
          text: "Simulated reviews, readiness scores, and practice metrics are educational aids. They do not represent actual trading results and may not reflect slippage, liquidity, psychology, or rule changes in live evaluation programs.",
        },
      ],
    },
    {
      id: "liability",
      sectionNumber: "Section 10",
      title: "Limitation of Liability",
      blocks: [
        {
          type: "p",
          text: "TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, FUNDEDBEYOND ACADEMY AND ITS AFFILIATES, OFFICERS, DIRECTORS, EMPLOYEES, AND SUPPLIERS SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS, DATA, GOODWILL, OR TRADING LOSSES, ARISING FROM YOUR USE OF OR INABILITY TO USE THE PLATFORM.",
        },
        {
          type: "p",
          text: "OUR TOTAL LIABILITY FOR ANY CLAIM ARISING OUT OF THESE TERMS OR THE ACADEMY SHALL NOT EXCEED THE GREATER OF (A) THE AMOUNTS YOU PAID TO US FOR THE ACADEMY IN THE TWELVE (12) MONTHS BEFORE THE CLAIM, OR (B) ONE HUNDRED U.S. DOLLARS (USD $100), EXCEPT WHERE LIABILITY CANNOT BE LIMITED BY LAW.",
        },
        {
          type: "p",
          text: "Some jurisdictions do not allow certain limitations; in those cases, our liability is limited to the fullest extent permitted by law.",
        },
      ],
    },
    {
      id: "disputes",
      sectionNumber: "Section 11",
      title: "Dispute Resolution",
      blocks: [
        {
          type: "p",
          text: "We prefer to resolve concerns informally. Before initiating formal proceedings, please contact support@fundedbeyond.com with a description of the issue and your desired resolution. We will attempt to address the matter within a reasonable period.",
        },
        {
          type: "h3",
          text: "Binding arbitration (where permitted)",
        },
        {
          type: "p",
          text: "If informal resolution fails and permitted by law, disputes arising from these Terms or the Academy shall be resolved through binding arbitration on an individual basis, rather than in class or representative proceedings, except that either party may seek injunctive relief in court for intellectual property or unauthorized access.",
        },
        {
          type: "p",
          text: "Arbitration rules, venue, and administering body will be specified in a separate dispute notice or as required by applicable consumer protection law in your region.",
        },
      ],
    },
    {
      id: "governing-law",
      sectionNumber: "Section 12",
      title: "Governing Law",
      blocks: [
        {
          type: "p",
          text: "These Terms are governed by the laws of the jurisdiction in which FundedBeyond's operating entity is registered, without regard to conflict-of-law principles, except where mandatory local consumer protection laws apply to you as an individual consumer.",
        },
        {
          type: "p",
          text: "If any provision of these Terms is held invalid or unenforceable, the remaining provisions remain in full force. Our failure to enforce a right does not waive that right.",
        },
      ],
    },
    {
      id: "changes",
      sectionNumber: "Section 13",
      title: "Changes to These Terms",
      blocks: [
        {
          type: "p",
          text: "We may modify these Terms to reflect changes in our services, legal requirements, or business practices. We will post the updated Terms on this page and update the \"Last updated\" date. For material changes affecting paid subscribers, we will provide additional notice by email or in-product message where practicable.",
        },
        {
          type: "p",
          text: "Questions about these Terms may be directed to support@fundedbeyond.com.",
        },
      ],
    },
  ],
};
