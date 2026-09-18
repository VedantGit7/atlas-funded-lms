// Poisons this module for any client bundle. Audit finding M9: nothing at the
// language level stopped a server module being pulled into a client component,
// so a leak of service code -- and whatever secrets or privileged queries it
// closes over -- would only have shown up as a runtime surprise.
import "server-only";

export const MANUAL_ITEM_TYPE_KEYS = [
  "short_answer",
  "long_answer",
  "file_upload",
  "assignment",
] as const;

export const GRADEABLE_TASK_STATUSES = new Set(["open", "in_progress"]);
