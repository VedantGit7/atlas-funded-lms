export const MARKETING_EMAIL_TEMPLATES = [
  {
    key: "blank",
    name: "Blank",
    description: "Start from an empty marketing email.",
    subject: "An update from our academy",
    bodyHtml: `<p>Hi {{learner_name}},</p>
<p>Write your marketing message here.</p>
<p>Thanks,<br/>The team</p>`,
  },
  {
    key: "course_announce",
    name: "New course announcement",
    description: "Announce a new course or program.",
    subject: "New course is live — enroll today",
    bodyHtml: `<p>Hi {{learner_name}},</p>
<p>We're excited to announce a new course in our academy.</p>
<p><strong>What you'll learn:</strong> practical skills you can apply immediately.</p>
<p><a href="{{deep_link}}">View the course</a></p>
<p>See you inside!</p>`,
  },
  {
    key: "offer",
    name: "Limited offer",
    description: "Promote a time-bound offer or coupon.",
    subject: "A special offer for you",
    bodyHtml: `<p>Hi {{learner_name}},</p>
<p>For a limited time, unlock exclusive savings on selected programs.</p>
<p>Use this opportunity to level up your skills.</p>
<p><a href="{{deep_link}}">Claim your offer</a></p>`,
  },
  {
    key: "reminder",
    name: "Friendly reminder",
    description: "Nudge learners to continue learning.",
    subject: "Don't lose your momentum",
    bodyHtml: `<p>Hi {{learner_name}},</p>
<p>Just a quick reminder to continue where you left off.</p>
<p>A few minutes today can make a big difference.</p>
<p><a href="{{deep_link}}">Resume learning</a></p>`,
  },
] as const;

const SPAM_WORDS = [
  "free money",
  "act now",
  "limited time only!!!",
  "click here now",
  "winner",
  "congratulations you won",
  "crypto giveaway",
  "100% free",
  "risk free",
  "double your",
  "make money fast",
  "viagra",
  "casino",
  "lottery",
] as const;

export function detectMarketingEmailSpam(
  subject: string,
  bodyHtml: string,
): {
  spamDetected: boolean;
  spamWords: string[];
} {
  const haystack = `${subject}\n${bodyHtml}`.toLowerCase();
  const found = SPAM_WORDS.filter((word) => haystack.includes(word));
  return { spamDetected: found.length > 0, spamWords: [...found] };
}

export function renderMarketingEmailBody(
  bodyHtml: string,
  vars: { learnerName: string; deepLink?: string },
): string {
  return bodyHtml
    .replaceAll("{{learner_name}}", vars.learnerName)
    .replaceAll("{{deep_link}}", vars.deepLink ?? "/");
}
