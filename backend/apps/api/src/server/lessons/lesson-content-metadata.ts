/**
 * Lesson content_json metadata type definitions and helpers
 * 
 * The content_json field stores structured metadata that extends the core lesson model.
 * These helpers ensure safe parsing and merging without wiping unrelated keys.
 */

export type LessonContentMetadata = {
  body?: string | null;
  features?: {
    allowComments?: boolean;
    enableDownloads?: boolean;
    showTranscript?: boolean;
  };
  displayInSyllabus?: boolean;
  thumbnailAssetReferenceId?: string | null;
  primaryAssetReferenceId?: string | null;
  primaryAssetFileName?: string | null;
  transcriptText?: string | null;
  transcriptAssetReferenceId?: string | null;
  live?: {
    meetingUrl?: string | null;
    scheduledAt?: string | null;
    provider?: "custom" | "zoom" | "teams" | null;
    instructions?: string | null;
  };
  assessmentId?: string | null;
  discussionPostId?: string | null;
  videoProvider?: string | null;
  videoUrl?: string | null;
  [key: string]: unknown;
};

/**
 * Parse content_json from database into typed object
 */
export function parseContentMetadata(contentJson: unknown): LessonContentMetadata {
  if (!contentJson || typeof contentJson !== "object" || Array.isArray(contentJson)) {
    return {};
  }
  return contentJson as LessonContentMetadata;
}

/**
 * Merge partial updates into existing content_json without wiping unrelated keys
 */
export function mergeContentMetadata(
  existing: unknown,
  updates: Partial<LessonContentMetadata>,
): LessonContentMetadata {
  const existingContent = parseContentMetadata(existing);
  return {
    ...existingContent,
    ...updates,
  };
}

/**
 * Get default feature flags (all enabled by default for backward compatibility)
 */
export function getDefaultFeatures(): Required<NonNullable<LessonContentMetadata["features"]>> {
  return {
    allowComments: true,
    enableDownloads: true,
    showTranscript: true,
  };
}

/**
 * Get features with defaults applied
 */
export function getEffectiveFeatures(
  content: LessonContentMetadata,
): Required<NonNullable<LessonContentMetadata["features"]>> {
  const defaults = getDefaultFeatures();
  if (!content.features) {
    return defaults;
  }
  return {
    allowComments: content.features.allowComments ?? defaults.allowComments,
    enableDownloads: content.features.enableDownloads ?? defaults.enableDownloads,
    showTranscript: content.features.showTranscript ?? defaults.showTranscript,
  };
}

/**
 * Check if lesson should be displayed in syllabus (default true)
 */
export function shouldDisplayInSyllabus(content: LessonContentMetadata): boolean {
  return content.displayInSyllabus ?? true;
}
