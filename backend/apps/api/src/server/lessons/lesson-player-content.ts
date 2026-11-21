import type { LessonPlayerContent, LessonPlayerFile } from "./lesson-schemas";

/**
 * What a lesson shows, built from its stored `content_json`.
 *
 * `content_json` is one flat object mixing what the learner reads (an
 * article's body, a quiz's id, a live session) with internal fields (the
 * discussion thread, storage references, settings). The player used to print
 * whatever was left of it as JSON, so learners saw code instead of lessons
 * (QA review 1 C5, C6, C23, C24; review 2 C1, C5, C7). This builds a small,
 * typed object per lesson type and leaves every internal field out.
 */

/** How many layers of `{"body": …}` wrapping to undo; real nesting stays shallow. */
const MAX_UNWRAP_DEPTH = 20;

function parseJsonObject(text: string): Record<string, unknown> | null {
  const trimmed = text.trim();
  if (!trimmed.startsWith("{") || !trimmed.endsWith("}")) return null;
  try {
    const parsed: unknown = JSON.parse(trimmed);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

/** Every key content_json can hold; JSON made only of these is leaked lesson content. */
const CONTENT_JSON_KEYS = new Set([
  "body",
  "type",
  "lessonType",
  "description",
  "isPreview",
  "features",
  "displayInSyllabus",
  "thumbnailAssetReferenceId",
  "primaryAssetReferenceId",
  "primaryAssetFileName",
  "transcriptText",
  "transcriptAssetReferenceId",
  "live",
  "assessmentId",
  "discussionPostId",
  "videoProvider",
  "videoUrl",
]);

function isLeakedLessonContent(parsed: Record<string, unknown>): boolean {
  const keys = Object.keys(parsed);
  return keys.length > 0 && keys.every((key) => CONTENT_JSON_KEYS.has(key));
}

/**
 * Undoes one or more layers of the old editors' `{"body": …}` wrapping.
 *
 * Both lesson editors used to load an article as `{ body }`, show it as JSON
 * and save that JSON back as the body, wrapping it once more on every save:
 * `{"body": "{\"body\": \"text\"}"}`. This peels those layers off. It only
 * peels JSON made entirely of content_json keys, so an article whose text
 * really is a JSON sample keeps it.
 *
 * Returns the unwrapped text, or null when the value was a leaked copy of
 * other lesson content (a quiz id, a file reference, with no body).
 */
export function unwrapBodyText(value: string): string | null {
  let body = value;
  for (let depth = 0; depth < MAX_UNWRAP_DEPTH; depth += 1) {
    const parsed = parseJsonObject(body);
    if (!parsed || !isLeakedLessonContent(parsed)) break;
    const inner = parsed["body"];
    if (typeof inner !== "string") return null;
    body = inner;
  }
  return body;
}

/** An article's text for display: unwrapped, and null when empty. */
export function unwrapArticleBody(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const body = unwrapBodyText(value);
  return body !== null && body.trim() ? body : null;
}

type LiveDetails = Extract<LessonPlayerContent, { kind: "live" }>["live"];

function readLive(value: unknown): LiveDetails | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const live = value as Record<string, unknown>;
  const text = (key: string): string | null =>
    typeof live[key] === "string" && live[key].trim() ? live[key].trim() : null;
  const meetingUrl = text("meetingUrl");
  const safeMeetingUrl = meetingUrl && /^https?:\/\//i.test(meetingUrl) ? meetingUrl : null;
  const provider = text("provider");
  return {
    provider:
      provider === "zoom" || provider === "teams" || provider === "custom" ? provider : null,
    meetingUrl: safeMeetingUrl,
    scheduledAt: text("scheduledAt"),
    instructions: text("instructions"),
  };
}

const FILE_KINDS = new Set(["audio", "pdf", "slides", "scorm"]);

/**
 * The player content for one lesson.
 *
 * @param lessonType the resolved lesson type (see resolveLessonType)
 * @param contentJson the stored content_json
 * @param primaryFile the lesson's main file, already signed for download, or
 *   null when there is none or it can't be served
 */
export function buildPlayerContent(args: {
  lessonType: string | null;
  contentJson: unknown;
  primaryFile: LessonPlayerFile | null;
}): LessonPlayerContent {
  const stored =
    args.contentJson && typeof args.contentJson === "object" && !Array.isArray(args.contentJson)
      ? (args.contentJson as Record<string, unknown>)
      : {};
  const body = unwrapArticleBody(stored["body"]);
  const type = args.lessonType ?? "";

  if (type === "section_quiz" || type === "quiz") {
    const assessmentId =
      typeof stored["assessmentId"] === "string" && stored["assessmentId"].trim()
        ? stored["assessmentId"].trim()
        : null;
    return { kind: "quiz", assessmentId, body };
  }

  if (type === "live") {
    return { kind: "live", live: readLive(stored["live"]), body };
  }

  if (FILE_KINDS.has(type)) {
    return {
      kind: "file",
      fileType: type as "audio" | "pdf" | "slides" | "scorm",
      file: args.primaryFile,
      body,
    };
  }

  if (type === "video") {
    return { kind: "video", body };
  }

  if (type === "assignment") {
    return { kind: "assignment", body };
  }

  return { kind: "article", body };
}
