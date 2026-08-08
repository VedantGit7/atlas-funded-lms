import type { z } from "zod";
import type { studioLessonDetailSchema } from "@atlas/contracts/lessons/lesson-schemas";

type StudioLessonDetail = z.infer<typeof studioLessonDetailSchema>;

export const LESSON_SHORT_DESCRIPTION_MAX_LENGTH = 255;
export const LESSON_TAG_TITLE_MAX_LENGTH = 60;
export const LESSON_TAG_DESCRIPTION_MAX_LENGTH = 255;

export type LessonTagVisibility = "public" | "private" | "classification";

export type LessonSettingsSection = "branding" | "lesson_tag" | "features";

export type LessonSettingsFormState = {
  title: string;
  accessType: "paid" | "trial";
  shortDescription: string;
  richDescription: string;
  thumbnailUrl: string;
  thumbnailAssetReferenceId?: string | null;
  displayInSyllabus: boolean;
  features: {
    allowComments: boolean;
    enableDownloads: boolean;
    showTranscript: boolean;
  };
  transcriptText: string;
};

function readContentRecord(content: StudioLessonDetail["content"]): Record<string, unknown> {
  if (content && typeof content === "object" && !Array.isArray(content)) {
    return content as Record<string, unknown>;
  }
  return {};
}

export function lessonSettingsFromDetail(lesson: StudioLessonDetail): LessonSettingsFormState {
  const content = readContentRecord(lesson.content);
  const richFromBody = typeof content["body"] === "string" ? content["body"] : "";
  const richFromContent = typeof lesson.content === "string" ? lesson.content : "";
  const thumbnailUrl = typeof content["thumbnailUrl"] === "string" ? content["thumbnailUrl"] : "";
  const thumbnailAssetReferenceId = 
    typeof content["thumbnailAssetReferenceId"] === "string" 
      ? content["thumbnailAssetReferenceId"] 
      : undefined;
  const displayInSyllabus =
    typeof content["displayInSyllabus"] === "boolean" ? content["displayInSyllabus"] : true;
  const featuresRecord =
    content["features"] && typeof content["features"] === "object" && !Array.isArray(content["features"])
      ? (content["features"] as Record<string, unknown>)
      : {};
  const transcriptText = typeof content["transcriptText"] === "string" ? content["transcriptText"] : "";

  return {
    title: lesson.title,
    accessType: lesson.isPreview ? "trial" : "paid",
    shortDescription: lesson.description?.trim() ?? "",
    richDescription: richFromBody || richFromContent,
    thumbnailUrl,
    ...(thumbnailAssetReferenceId ? { thumbnailAssetReferenceId } : {}),
    displayInSyllabus,
    features: {
      allowComments: featuresRecord["allowComments"] === true,
      enableDownloads: featuresRecord["enableDownloads"] === true,
      showTranscript: featuresRecord["showTranscript"] === true,
    },
    transcriptText,
  };
}

export function buildLessonSettingsPayload(
  lesson: StudioLessonDetail,
  form: LessonSettingsFormState,
): {
  title: string;
  description: string | null;
  isPreview: boolean;
  content: Record<string, unknown>;
} {
  const existingContent = readContentRecord(lesson.content);
  const { tags: _legacyTags, ...contentWithoutLegacyTags } = existingContent;

  return {
    title: form.title.trim(),
    description: form.shortDescription.trim() || null,
    isPreview: form.accessType === "trial",
    content: {
      ...contentWithoutLegacyTags,
      body: form.richDescription.trim() || null,
      thumbnailUrl: form.thumbnailUrl.trim() || null,
      thumbnailAssetReferenceId: form.thumbnailAssetReferenceId ?? null,
      displayInSyllabus: form.displayInSyllabus,
      features: form.features,
      transcriptText: form.transcriptText.trim() || null,
    },
  };
}
