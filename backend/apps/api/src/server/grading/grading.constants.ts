export const MANUAL_ITEM_TYPE_KEYS = [
  "short_answer",
  "long_answer",
  "file_upload",
  "assignment",
] as const;

export const GRADEABLE_TASK_STATUSES = new Set(["open", "in_progress"]);
