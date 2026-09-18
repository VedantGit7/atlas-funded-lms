export type MutationHttpMethod = "POST" | "PUT" | "PATCH" | "DELETE";

export type ToastAction =
  | "updated"
  | "created"
  | "deleted"
  | "saved"
  | "published"
  | "archived"
  | "removed"
  | "enrolled"
  | "submitted"
  | "issued"
  | "revoked"
  | "restored"
  | "joined"
  | "sent"
  | "suspended"
  | "linked"
  | "attached"
  | "moved"
  | "set"
  | "invited";

type ToastDefinition = {
  label: string;
  action?: ToastAction;
};

const ACTION_SUFFIXES = new Set([
  "update",
  "save",
  "create",
  "delete",
  "publish",
  "archive",
  "restore",
  "submit",
  "attach",
  "confirm",
  "link",
  "move",
  "set",
  "start",
  "verify",
  "enroll",
  "issue",
  "revoke",
  "join",
  "suspend",
  "remove",
  "resend",
  "invite",
  "unenroll",
  "freeze",
  "reindex",
]);

const SILENT_PREFIXES = [
  "lesson-progress-",
  "lesson-complete-",
  "lesson-asset-confirm-",
  "lesson-asset-upload-",
  "branding-upload-",
  "attempt-answer-",
  "search-reindex",
  "public-",
  "magic-link",
  "change-phone-start",
  "link-",
  "module-scorm-progress",
  "swipe-",
  "practice-",
  "diagnostic-public-",
  "attribution-",
] as const;

const SILENT_EXACT = new Set([
  "mfa-enroll",
  "branding-asset-upload",
  "lesson-asset-upload",
  "module-scorm-upload",
  "module-scorm-confirm",
  "module-scorm-blob",
  "community-reaction",
  "community-reaction-remove",
]);

const IDEMPOTENCY_TOASTS: Record<string, ToastDefinition> = {
  "course-update": { label: "Course settings", action: "updated" },
  "course-permissions-update": { label: "Permissions", action: "updated" },
  "course-ratings-reviews-update": { label: "Ratings & reviews", action: "updated" },
  "course-discussions-bookmarks-update": { label: "Discussions & bookmarks", action: "updated" },
  "course-leaderboard-update": { label: "Leaderboard", action: "updated" },
  "course-certificates-update": { label: "Certificates", action: "updated" },
  "course-content-dripping-update": { label: "Content dripping", action: "updated" },
  "course-remove-learners": { label: "Learners", action: "removed" },
  "course-learner-configurations-update": { label: "Learner configurations", action: "updated" },
  "course-learning-path-update": { label: "Learning path", action: "updated" },
  "course-seo-update": { label: "SEO settings", action: "updated" },
  "course-seo-save": { label: "SEO settings", action: "saved" },
  "course-branding-update": { label: "Branding", action: "updated" },
  "course-branding-save": { label: "Branding", action: "saved" },
  "course-pricing-plans-save": { label: "Pricing plans", action: "saved" },
  "course-faqs-save": { label: "FAQs", action: "saved" },
  "course-instructors-save": { label: "Instructors", action: "saved" },
  "course-tags-save": { label: "Course tags", action: "saved" },
  "course-publish": { label: "Course", action: "published" },
  "course-archive": { label: "Course", action: "archived" },
  "course-enroll-student": { label: "Student", action: "enrolled" },
  "course-create": { label: "Course", action: "created" },
  "module-delete": { label: "Module", action: "deleted" },
  "module-create": { label: "Module", action: "created" },
  "module-update": { label: "Module", action: "updated" },
  "lesson-delete": { label: "Lesson", action: "deleted" },
  "lesson-create": { label: "Lesson", action: "created" },
  "lesson-settings-save": { label: "Lesson settings", action: "saved" },
  "lesson-article-save": { label: "Article content", action: "saved" },
  "lesson-live-config-save": { label: "Live session", action: "saved" },
  "lesson-embed-save": { label: "Lesson embed", action: "saved" },
  "lesson-primary-asset-save": { label: "Lesson file", action: "saved" },
  "lesson-move-section": { label: "Lesson", action: "moved" },
  "lesson-move-bottom": { label: "Lesson order", action: "updated" },
  "lesson-assessment-link": { label: "Quiz", action: "linked" },
  "lesson-asset-attach": { label: "Attachment", action: "attached" },
  "lesson-asset-attach-ref": { label: "Attachment", action: "attached" },
  "lesson-asset-link": { label: "Link attachment", action: "attached" },
  "lesson-asset-delete": { label: "Attachment", action: "removed" },
  "lesson-editor-save": { label: "Lesson", action: "saved" },
  "chapter-create": { label: "Chapter", action: "created" },
  "branding-update": { label: "Branding", action: "updated" },
  "branding-restore": { label: "Branding version", action: "restored" },
  "branding-publish": { label: "Branding", action: "published" },
  "theme-update": { label: "Theme", action: "updated" },
  "config-update": { label: "Tenant configuration", action: "updated" },
  "config-publish": { label: "Configuration", action: "published" },
  "domain-delete": { label: "Domain", action: "deleted" },
  "domain-set-primary": { label: "Primary domain", action: "set" },
  "domain-create": { label: "Domain", action: "created" },
  "role-delete": { label: "Role", action: "deleted" },
  "role-create": { label: "Role", action: "created" },
  "role-update": { label: "Role", action: "updated" },
  "member-suspend": { label: "Member", action: "suspended" },
  "member-remove": { label: "Member", action: "removed" },
  "member-resend-invite": { label: "Invitation", action: "sent" },
  "member-invite": { label: "Member", action: "invited" },
  "member-profile-update": { label: "Member profile", action: "updated" },
  "member-role-update": { label: "Member role", action: "updated" },
  "permission-override-update": { label: "Permission override", action: "updated" },
  "feature-flag-update": { label: "Feature flag", action: "updated" },
  "automation-rule-update": { label: "Automation rule", action: "updated" },
  "automation-rule-delete": { label: "Automation rule", action: "deleted" },
  "automation-rule-create": { label: "Automation rule", action: "created" },
  "workflow-definition-create": { label: "Workflow", action: "created" },
  "template-update": { label: "Certificate template", action: "updated" },
  "template-publish": { label: "Certificate template", action: "published" },
  "template-delete": { label: "Certificate template", action: "deleted" },
  "template-create": { label: "Certificate template", action: "created" },
  "issue-certificate": { label: "Certificate", action: "issued" },
  "revoke-certificate": { label: "Certificate", action: "revoked" },
  "enrollment-create": { label: "Enrollment", action: "created" },
  "create-item": { label: "Item", action: "created" },
  "update-item": { label: "Item", action: "updated" },
  "delete-item": { label: "Item", action: "deleted" },
  "delete-item-collection": { label: "Item collection", action: "deleted" },
  "create-item-collection": { label: "Item collection", action: "created" },
  "update-item-collection": { label: "Item collection", action: "updated" },
  "path-create": { label: "Learning path", action: "created" },
  "path-update": { label: "Learning path", action: "updated" },
  "path-publish": { label: "Learning path", action: "submitted" },
  "assessment-delete": { label: "Assessment", action: "deleted" },
  "assessment-save": { label: "Assessment", action: "saved" },
  "assessment-update": { label: "Assessment", action: "updated" },
  "assessment-create": { label: "Assessment", action: "created" },
  "assessment-publish": { label: "Assessment", action: "submitted" },
  "attempt-submit": { label: "Attempt", action: "submitted" },
  "community-space-create": { label: "Community space", action: "created" },
  "community-space-update": { label: "Community space", action: "updated" },
  "community-space-delete": { label: "Community space", action: "deleted" },
  "community-post": { label: "Post", action: "created" },
  "community-comment-delete": { label: "Comment", action: "deleted" },
  "community-join": { label: "Community space", action: "joined" },
  "notification-template-create": { label: "Notification template", action: "created" },
  "notification-template-update": { label: "Notification template", action: "updated" },
  "notification-template-delete": { label: "Notification template", action: "deleted" },
  "notification-preferences-update": { label: "Notification preferences", action: "updated" },
  "profile-update": { label: "Profile", action: "updated" },
  "appearance-update": { label: "Appearance", action: "updated" },
  "preferences-update": { label: "Appearance", action: "updated" },
  "locale-update": { label: "Locale settings", action: "updated" },
  "gamification-update": { label: "Gamification settings", action: "updated" },
  "grade-task": { label: "Grade", action: "saved" },
  "change-phone-verify": { label: "Phone number", action: "updated" },
  "change-password": { label: "Password", action: "updated" },
  "change-email": { label: "Email", action: "updated" },
  "unlink-identity": { label: "Connected account", action: "removed" },
  "mfa-unenroll": { label: "MFA factor", action: "removed" },
  "streak-freeze": { label: "Streak freeze", action: "saved" },
  "readiness-policy-update": { label: "Readiness policy", action: "updated" },
  "competency-dimension-create": { label: "Competency dimension", action: "created" },
  "competency-dimension-update": { label: "Competency dimension", action: "updated" },
  "scoring-profile-create": { label: "Scoring profile", action: "created" },
  "scoring-profile-update": { label: "Scoring profile", action: "updated" },
  "scoring-config-publish": { label: "Scoring configuration", action: "published" },
  "course-member-add": { label: "Course member", action: "created" },
  "lesson-tag-create": { label: "Lesson tag", action: "created" },
  "course-tag-create": { label: "Course tag", action: "created" },
  "lesson-tag-detach": { label: "Lesson tag", action: "removed" },
  "course-tag-detach": { label: "Course tag", action: "removed" },
  "lesson-tags-replace": { label: "Lesson tags", action: "updated" },
  "course-tags-replace": { label: "Course tags", action: "updated" },
  "moderation-case-create": { label: "Report", action: "submitted" },
  "moderation-appeal-create": { label: "Appeal", action: "submitted" },
  "moderation-review-begin": { label: "Moderation review", action: "updated" },
  "moderation-case-decide": { label: "Moderation case", action: "updated" },
  "moderation-appeal-review": { label: "Appeal", action: "updated" },
  "workflow-transition": { label: "Workflow", action: "updated" },
  "create-extension-registration": { label: "Extension", action: "created" },
  "update-extension-registration": { label: "Extension", action: "updated" },
  "delete-extension-registration": { label: "Extension", action: "deleted" },
  "add-collection-item": { label: "Collection item", action: "created" },
  "remove-collection-item": { label: "Collection item", action: "removed" },
  "put-dimension-weights": { label: "Dimension weights", action: "updated" },
  "badge-create": { label: "Badge", action: "created" },
  "leaderboard-create": { label: "Leaderboard", action: "created" },
  "badge-manual-award": { label: "Badge award", action: "saved" },
  "platform-suspend": { label: "Tenant", action: "suspended" },
  "platform-resume": { label: "Tenant", action: "updated" },
  "platform-archive": { label: "Tenant", action: "archived" },
  "platform-entitlements": { label: "Tenant entitlements", action: "updated" },
  "platform-catalog-permission": { label: "Catalog permission", action: "created" },
  "platform-catalog-item-type": { label: "Item type", action: "created" },
  "platform-catalog-extension-point": { label: "Extension point", action: "created" },
  "platform-flag-create": { label: "Platform feature flag", action: "created" },
  "platform-flag-update": { label: "Platform feature flag", action: "updated" },
  "platform-dead-letter-replay": { label: "Dead letter replay", action: "sent" },
  "platform-provision": { label: "Tenant", action: "created" },
  "platform-support-open": { label: "Support session", action: "created" },
};

const ACTION_MESSAGES: Record<ToastAction, string> = {
  updated: "updated",
  created: "created",
  deleted: "deleted",
  saved: "saved",
  published: "published",
  archived: "archived",
  removed: "removed",
  enrolled: "enrolled",
  submitted: "submitted",
  issued: "issued",
  revoked: "revoked",
  restored: "restored",
  joined: "joined",
  sent: "sent",
  suspended: "suspended",
  linked: "linked",
  attached: "attached",
  moved: "moved",
  set: "set",
  invited: "invited",
};

function isUuidSegment(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function titleCaseWords(words: string[]): string {
  return words
    .filter(Boolean)
    .map((word) => {
      if (word === "seo") return "SEO";
      if (word === "mfa") return "MFA";
      if (word === "ios") return "iOS";
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(" ");
}

function inferActionFromPrefix(prefix: string, method: MutationHttpMethod): ToastAction {
  if (prefix.endsWith("-publish")) return "published";
  if (prefix.endsWith("-archive")) return "archived";
  if (prefix.endsWith("-delete")) return "deleted";
  if (prefix.endsWith("-create")) return "created";
  if (prefix.endsWith("-save")) return "saved";
  if (prefix.endsWith("-restore")) return "restored";
  if (prefix.endsWith("-submit")) return "submitted";
  if (prefix.endsWith("-enroll")) return "enrolled";
  if (prefix.endsWith("-issue")) return "issued";
  if (prefix.endsWith("-revoke")) return "revoked";
  if (prefix.endsWith("-join")) return "joined";
  if (prefix.endsWith("-suspend")) return "suspended";
  if (prefix.endsWith("-remove")) return "removed";
  if (prefix.endsWith("-attach") || prefix.endsWith("-link")) return "attached";
  if (prefix.endsWith("-move")) return "moved";
  if (prefix.endsWith("-set-primary")) return "set";

  if (method === "DELETE") return "deleted";
  if (method === "POST") return "created";
  return "updated";
}

function normalizePrefix(prefix: string): string {
  const parts = prefix.split("-").filter(Boolean);
  for (;;) {
    const last = parts.at(-1);
    if (last === undefined) break;
    if (!ACTION_SUFFIXES.has(last) && !isUuidSegment(last)) break;
    parts.pop();
  }
  return parts.join("-");
}

function humanizePrefix(prefix: string): string {
  const normalized = normalizePrefix(prefix);
  if (!normalized) return "Changes";

  const special: Record<string, string> = {
    "course-pricing-plans": "Pricing plans",
    "course-ratings-reviews": "Ratings & reviews",
    "course-discussions-bookmarks": "Discussions & bookmarks",
    "workflow-definition": "Workflow",
    "notification-template": "Notification template",
    "certificate-template": "Certificate template",
    "item-collection": "Item collection",
    "learning-path": "Learning path",
    "feature-flag": "Feature flag",
    "automation-rule": "Automation rule",
    "community-space": "Community space",
    "lesson-settings": "Lesson settings",
    "lesson-asset": "Attachment",
    "cancel-enrollment": "Enrollment",
  };

  if (special[normalized]) return special[normalized];

  return titleCaseWords(normalized.split("-"));
}

export function formatToastSuccessMessage(label: string, action: ToastAction): string {
  return `${label} ${ACTION_MESSAGES[action]} successfully`;
}

function stripTrailingUuid(key: string): string {
  const parts = key.split("-");
  const last = parts.at(-1);
  if (parts.length > 1 && last !== undefined && isUuidSegment(last)) {
    return parts.slice(0, -1).join("-");
  }
  return key;
}

export function shouldSuppressSuccessToast(idempotencyKeyPrefix: string): boolean {
  const normalizedKey = stripTrailingUuid(idempotencyKeyPrefix);
  if (SILENT_EXACT.has(normalizedKey)) return true;
  return SILENT_PREFIXES.some((prefix) => normalizedKey.startsWith(prefix));
}

export function resolveMutationSuccessToast(
  idempotencyKeyPrefix: string,
  method: MutationHttpMethod,
  explicitMessage?: string,
): string | null {
  if (explicitMessage?.trim()) return explicitMessage.trim();

  const key = stripTrailingUuid(idempotencyKeyPrefix);
  if (shouldSuppressSuccessToast(key)) return null;

  const exact = IDEMPOTENCY_TOASTS[key];
  if (exact) {
    return formatToastSuccessMessage(
      exact.label,
      exact.action ?? inferActionFromPrefix(key, method),
    );
  }

  if (key.startsWith("workflow-definition-")) {
    return formatToastSuccessMessage("Workflow", inferActionFromPrefix(key, method));
  }

  if (key.startsWith("cancel-enrollment-")) {
    return formatToastSuccessMessage("Enrollment", "removed");
  }

  if (key.startsWith("update-item-collection-")) {
    return formatToastSuccessMessage("Item collection", "updated");
  }

  if (key.startsWith("badge-update-")) {
    return formatToastSuccessMessage("Badge", "updated");
  }

  if (key.startsWith("leaderboard-update-")) {
    return formatToastSuccessMessage("Leaderboard", "updated");
  }

  if (key.startsWith("locale-upsert-")) {
    return formatToastSuccessMessage("Locale resource", "saved");
  }

  if (key.startsWith("feature-flag-")) {
    return formatToastSuccessMessage("Feature flag", "updated");
  }

  if (key.startsWith("export-run-")) {
    return "Export job queued successfully";
  }

  if (key.startsWith("deletion-file-") || key.startsWith("deletion-self-")) {
    return "Deletion request filed successfully";
  }

  if (key.startsWith("deletion-process-")) {
    return "Deletion request processed successfully";
  }

  const label = humanizePrefix(key);
  const action = inferActionFromPrefix(key, method);
  return formatToastSuccessMessage(label, action);
}
