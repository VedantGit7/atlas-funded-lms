import type { LucideIcon } from "lucide-react";
import {
  BookOpen,
  ClipboardList,
  FileText,
  Headphones,
  HelpCircle,
  MonitorPlay,
  Package,
  Presentation,
  Video,
} from "lucide-react";
import type { StudioLessonTypeCreate } from "@atlas/contracts/lessons/lesson-schemas";

export type LessonTypeOption = {
  id: StudioLessonTypeCreate;
  label: string;
  icon: LucideIcon;
  accentToken: string;
};

export const LESSON_TYPE_OPTIONS: LessonTypeOption[] = [
  { id: "video", label: "Video", icon: Video, accentToken: "--admin-lesson-video" },
  { id: "audio", label: "Audio", icon: Headphones, accentToken: "--admin-lesson-audio" },
  { id: "pdf", label: "PDF", icon: FileText, accentToken: "--admin-lesson-pdf" },
  { id: "slides", label: "Slides", icon: Presentation, accentToken: "--admin-lesson-slides" },
  { id: "live", label: "Live", icon: MonitorPlay, accentToken: "--admin-lesson-live" },
  { id: "article", label: "Article", icon: BookOpen, accentToken: "--admin-lesson-article" },
  { id: "scorm", label: "Scorm/Tincan", icon: Package, accentToken: "--admin-lesson-scorm" },
  {
    id: "section_quiz",
    label: "Section Quiz",
    icon: HelpCircle,
    accentToken: "--admin-lesson-quiz",
  },
  {
    id: "assignment",
    label: "Assignment",
    icon: ClipboardList,
    accentToken: "--admin-lesson-assignment",
  },
];

export const LESSON_TITLE_MAX_LENGTH = 60;
