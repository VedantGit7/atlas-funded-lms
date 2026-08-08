import type { StudioLessonType, StudioLessonTypeCreate } from "@atlas/contracts/lessons/lesson-schemas";
import { LESSON_TYPE_OPTIONS } from "../lesson-type-options";

export type InlineLessonEditorType = Extract<
  StudioLessonTypeCreate,
  "video" | "audio" | "pdf" | "slides" | "live" | "article" | "section_quiz"
>;

export const INLINE_LESSON_EDITOR_TYPES = new Set<InlineLessonEditorType>([
  "video",
  "audio",
  "pdf",
  "slides",
  "live",
  "article",
  "section_quiz",
]);

export function isInlineLessonEditorType(
  lessonType: string | null | undefined,
): lessonType is InlineLessonEditorType {
  return lessonType != null && INLINE_LESSON_EDITOR_TYPES.has(lessonType as InlineLessonEditorType);
}

export function resolveLessonTypeLabel(lessonType: string | null | undefined): string {
  if (!lessonType) return "Lesson";
  const match = LESSON_TYPE_OPTIONS.find((option) => option.id === lessonType);
  if (match) return match.label;
  if (lessonType === "text") return "Article";
  if (lessonType === "mixed") return "Mixed";
  return lessonType.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

export function resolveLessonAccentToken(lessonType: string | null | undefined): string {
  const match = LESSON_TYPE_OPTIONS.find((option) => option.id === lessonType);
  return match?.accentToken ?? "--admin-primary";
}

type UploadWorkspaceMeta = {
  panelTitle: string;
  accept?: string;
  showCloudStorage: boolean;
  showEmbedVideo: boolean;
};

export function uploadWorkspaceMeta(
  lessonType: InlineLessonEditorType,
): UploadWorkspaceMeta | null {
  if (lessonType === "video") {
    return {
      panelTitle: "Upload Video lesson",
      accept: "video/*",
      showCloudStorage: true,
      showEmbedVideo: true,
    };
  }
  if (lessonType === "audio") {
    return {
      panelTitle: "Upload Audio lesson",
      accept: "audio/*",
      showCloudStorage: true,
      showEmbedVideo: false,
    };
  }
  if (lessonType === "pdf") {
    return {
      panelTitle: "Upload PDF lesson",
      accept: "application/pdf,.pdf",
      showCloudStorage: true,
      showEmbedVideo: false,
    };
  }
  if (lessonType === "slides") {
    return {
      panelTitle: "Upload Slide lesson",
      accept: ".ppt,.pptx,.pdf,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation",
      showCloudStorage: true,
      showEmbedVideo: true,
    };
  }
  return null;
}

export function normalizeLessonTypeForEditor(
  lessonType: StudioLessonType | string | null | undefined,
): InlineLessonEditorType | "unsupported" {
  if (lessonType === "text") return "article";
  if (isInlineLessonEditorType(lessonType)) return lessonType;
  return "unsupported";
}
