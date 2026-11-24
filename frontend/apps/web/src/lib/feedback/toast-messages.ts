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
  | "added"
  | "invited";

type ToastDefinition = {
  label: string;
  action?: ToastAction;
};

// Undefined entries are stripped from labels but keep HTTP-method inference.
const ACTION_SUFFIXES: Record<string, ToastAction | undefined> = {
  update: undefined,
  save: "saved",
  create: "created",
  delete: "deleted",
  publish: "published",
  archive: "archived",
  restore: "restored",
  submit: "submitted",
  attach: "attached",
  confirm: undefined,
  link: "attached",
  move: "moved",
  set: undefined,
  start: undefined,
  verify: undefined,
  enroll: "enrolled",
  issue: "issued",
  revoke: "revoked",
  join: "joined",
  suspend: "suspended",
  remove: "removed",
  resend: undefined,
  invite: undefined,
  unenroll: undefined,
  freeze: undefined,
  reindex: undefined,
};

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
  // Publishing a course sends it for review; a reviewer's approval puts it live.
  "course-publish": { label: "Course", action: "submitted" },
  "course-archive": { label: "Course", action: "archived" },
  "course-enroll-student": { label: "Student", action: "enrolled" },
  "course-create": { label: "Course", action: "created" },
  "module-delete": { label: "Section", action: "deleted" },
  "module-create": { label: "Section", action: "created" },
  "module-update": { label: "Section", action: "updated" },
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
  "chapter-create": { label: "Section", action: "created" },
  "branding-update": { label: "Branding", action: "updated" },
  "branding-restore": { label: "Branding version", action: "restored" },
  "branding-publish": { label: "Branding", action: "published" },
  "theme-update": { label: "Theme", action: "updated" },
  "config-update": { label: "Settings", action: "updated" },
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
  "create-item": { label: "Question", action: "created" },
  "update-item": { label: "Question", action: "updated" },
  "delete-item": { label: "Question", action: "deleted" },
  "delete-item-collection": { label: "Collection", action: "deleted" },
  "create-item-collection": { label: "Collection", action: "created" },
  "update-item-collection": { label: "Collection", action: "updated" },
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
  "mfa-unenroll": { label: "Two-step sign-in", action: "removed" },
  "streak-freeze": { label: "Streak freeze", action: "saved" },
  "readiness-policy-update": { label: "Readiness policy", action: "updated" },
  "competency-dimension-create": { label: "Competency dimension", action: "created" },
  "competency-dimension-update": { label: "Competency dimension", action: "updated" },
  "scoring-profile-create": { label: "Scoring profile", action: "created" },
  "scoring-profile-update": { label: "Scoring profile", action: "updated" },
  "scoring-config-publish": { label: "Scoring configuration", action: "published" },
  "course-member-add": { label: "Course member", action: "added" },
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
  "add-collection-item": { label: "Question", action: "added" },
  "remove-collection-item": { label: "Question", action: "removed" },
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

/**
 * Confirmations for actions whose screens show none of their own, keyed by the
 * request's idempotency key. Written for the person who did it, in their words.
 * Keys built with an id (`badge-update-${id}`) are matched by prefix, longest
 * first.
 */
const WRITTEN_MESSAGES: Record<string, string> = {
  "active-devices-policy-block-delete": "Device block removed",
  "active-devices-policy-override-delete": "Device override removed",
  "avatar-confirm": "Profile photo updated",
  "avatar-remove": "Profile photo removed",
  "badge-manual-award-bulk": "Badges awarded",
  "batches-roster-remove-learner": "Learner removed from the batch",
  "certificate-brand-kit-delete": "Brand kit deleted",
  "community-comment": "Comment posted",
  "community-comment-update": "Comment updated",
  "competency-bands-replace": "Bands saved",
  "competency-dimension-delete": "Dimension deleted",
  "course-backup-create": "Backup started",
  "course-gamification-update": "Gamification settings saved",
  "custom-field-segment-delete": "Segment deleted",
  "export-settings-purge-expired": "Expired exports deleted",
  "export-settings-update": "Export settings saved",
  "insights-alerts": "Alert settings saved",
  "insights-digests": "Digest settings saved",
  "insights-settings": "Insight settings saved",
  "lesson-comment-create": "Comment posted",
  "locale-remove": "Language removed",
  "member-assign-role": "Role assigned",
  "member-role-assign": "Role assigned",
  "member-role-revoke": "Role removed",
  "path-delete": "Learning path deleted",
  "permission-override-create": "Permission override added",
  "permission-override-delete": "Permission override removed",
  "readiness-policy": "Readiness policy saved",
  "studio-template-approve": "Template approved",
  "studio-template-create": "Template created",
  "studio-template-delete": "Template deleted",
  "studio-template-publish": "Template published",
  "studio-template-update": "Template saved",
  "tag-bulk": "Tags updated",
  "tag-merge": "Tags merged",
};

const WRITTEN_PREFIX_MESSAGES: ReadonlyArray<readonly [string, string]> = [
  ["badge-revoke-", "Badge revoked"],
  ["badge-update-", "Badge saved"],
  ["batch-delete-", "Batch deleted"],
  ["batch-member-", "Learner added to the batch"],
  ["batch-update-", "Batch saved"],
  ["batch-", "Batch created"],
  ["bi-export-", "Export started"],
  ["course-encryption-", "Encryption setting saved"],
  ["custom-field-value-", "Saved"],
  ["custom-field-", "Custom field saved"],
  ["custom-report-", "Report saved"],
  ["destination-create-", "Destination added"],
  ["destination-update-", "Destination saved"],
  ["issue-cert-", "Certificate issued"],
  ["learner-archive-", "Learner archived"],
  ["learner-unarchive-", "Learner unarchived"],
  ["live-session-", "Live session saved"],
  ["message-", "Message sent"],
  ["moderation-decide-", "Decision saved"],
  ["poll-delete-", "Poll deleted"],
  ["poll-update-", "Poll saved"],
  ["poll-", "Poll created"],
  ["product-enroll-", "You're enrolled"],
  ["report-export-run-", "Export started"],
  ["report-schedule-", "Report scheduled"],
  ["review-delete-", "Review deleted"],
  ["review-status-", "Review updated"],
  ["schedule-delete-", "Schedule deleted"],
  ["schedule-duplicate-", "Schedule duplicated"],
  ["schedule-run-now-", "Export started"],
  ["schedule-update-", "Schedule saved"],
  ["schedules-bulk-", "Schedules updated"],
  ["sub-school-delete-", "Sub-school deleted"],
  ["tag-delete-", "Tag deleted"],
];

function writtenMessageFor(key: string): string | null {
  const exact = WRITTEN_MESSAGES[key];
  if (exact) return exact;
  if (/^course-[a-z]+-pricing-update$/.test(key)) return "Pricing saved";
  if (key.endsWith("-export-create")) return "Export started";
  let best: readonly [string, string] | undefined;
  for (const entry of WRITTEN_PREFIX_MESSAGES) {
    if (key.startsWith(entry[0]) && (!best || entry[0].length > best[0].length)) best = entry;
  }
  return best ? best[1] : null;
}

function isUuidSegment(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function inferActionFromPrefix(prefix: string, method: MutationHttpMethod): ToastAction {
  const separator = prefix.lastIndexOf("-");
  const suffix = prefix.slice(separator + 1);
  if (separator >= 0 && Object.hasOwn(ACTION_SUFFIXES, suffix)) {
    const action = ACTION_SUFFIXES[suffix];
    if (action) return action;
  }
  if (prefix.endsWith("-set-primary")) return "set";

  if (method === "DELETE") return "deleted";
  if (method === "POST") return "created";
  return "updated";
}

export function formatToastSuccessMessage(label: string, action: ToastAction): string {
  return `${label} ${action} successfully`;
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
    return "Enrollment cancelled";
  }

  if (key.startsWith("update-item-collection-")) {
    return formatToastSuccessMessage("Collection", "updated");
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

  const written = writtenMessageFor(key);
  if (written) return written;

  // Anything else says nothing. Messages used to be made up from the request's
  // internal key: "Device Session Capture created successfully" on every page,
  // "Coupon Validate … created", "Email Campaign created" for a delete (QA
  // review 1 M16, review 2 H1). A screen that wants a confirmation passes
  // successMessage, or has its key written below.
  return null;
}
