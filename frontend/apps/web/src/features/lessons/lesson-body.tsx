"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { ClipboardCheck, Download, ExternalLink, FileText, Music, Video } from "lucide-react";
import type { z } from "zod";
import type { lessonPlayerContentSchema } from "@atlas/contracts/lessons/lesson-schemas";
import { ArticleMarkdown } from "./article-markdown";
import { LessonVideoEmbed } from "./lesson-video-embed";

type LessonPlayerContent = z.infer<typeof lessonPlayerContentSchema>;
type LiveDetails = Extract<LessonPlayerContent, { kind: "live" }>["live"];
type PlayerFile = Extract<LessonPlayerContent, { kind: "file" }>["file"];

type LessonBodyProps = {
  title: string;
  content: LessonPlayerContent | null | undefined;
  videoProvider?: string | null | undefined;
  videoUrl?: string | null | undefined;
};

/** A live class can be joined from this long before it starts. */
const JOIN_OPENS_MINUTES = 15;

const cardClassName = "space-y-3 rounded-xl border border-border bg-card p-5";
const primaryActionClassName =
  "inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2";
const secondaryActionClassName =
  "inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2";

function Notice({ children }: { children: ReactNode }) {
  return (
    <p
      role="status"
      className="rounded-xl border border-dashed border-border p-5 text-sm text-muted-foreground"
    >
      {children}
    </p>
  );
}

function CardHeading({ icon, title }: { icon: ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2">
      <span aria-hidden="true" className="text-primary">
        {icon}
      </span>
      <h2 className="text-base font-semibold text-foreground">{title}</h2>
    </div>
  );
}

function Notes({ body }: { body: string | null }) {
  return body ? <ArticleMarkdown text={body} /> : null;
}

/**
 * A stored "2026-12-30T18:00" (no zone) is shown as written; a time with a
 * zone is shown in the learner's own time zone.
 */
function describeStart(scheduledAt: string | null): { label: string; start: Date | null } | null {
  if (!scheduledAt) return null;
  const date = new Date(scheduledAt);
  if (Number.isNaN(date.getTime())) return { label: scheduledAt, start: null };
  const hasZone = /(?:z|[+-]\d{2}:?\d{2})$/i.test(scheduledAt);
  const label = new Intl.DateTimeFormat(undefined, {
    dateStyle: "full",
    timeStyle: "short",
    ...(hasZone ? {} : { timeZone: "UTC" }),
  }).format(hasZone ? date : new Date(`${scheduledAt.slice(0, 16)}:00Z`));
  return { label, start: date };
}

/**
 * The current time, ticking. Null on the server and in the first browser
 * render: times are shown in the learner's own locale and time zone, which the
 * server can't know, so they appear once the page is running in the browser.
 */
function useNow(intervalMs: number): number | null {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const timer = window.setInterval(() => {
      setNow(Date.now());
    }, intervalMs);
    return () => {
      window.clearInterval(timer);
    };
  }, [intervalMs]);
  return now;
}

function LiveSession({ live }: { live: LiveDetails }) {
  const now = useNow(30_000);

  if (now === null) {
    return (
      <section className={cardClassName} aria-label="Live class" aria-busy="true">
        <CardHeading icon={<Video className="h-5 w-5" />} title="Live class" />
        <p className="text-sm text-muted-foreground">Loading the class time…</p>
      </section>
    );
  }

  return <LiveSessionCard live={live} now={now} />;
}

/** A live class as it stands at `now` (milliseconds). */
export function LiveSessionCard({ live, now }: { live: LiveDetails; now: number }) {
  const providerName =
    live?.provider === "zoom" ? "Zoom" : live?.provider === "teams" ? "Microsoft Teams" : null;
  const when = describeStart(live?.scheduledAt ?? null);
  const opensAt = when?.start ? when.start.getTime() - JOIN_OPENS_MINUTES * 60_000 : null;
  const canJoin = Boolean(live?.meetingUrl) && (opensAt === null || now >= opensAt);

  return (
    <section className={cardClassName} aria-label="Live class">
      <CardHeading icon={<Video className="h-5 w-5" />} title="Live class" />
      {when ? (
        <p className="text-sm text-foreground">
          <span className="font-medium">{when.label}</span>
          {providerName ? <span className="text-muted-foreground"> on {providerName}</span> : null}
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">
          The time for this class hasn&apos;t been set yet.
        </p>
      )}
      {live?.instructions ? (
        <p className="text-sm text-muted-foreground">{live.instructions}</p>
      ) : null}
      {live?.meetingUrl ? (
        canJoin ? (
          <a
            href={live.meetingUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={primaryActionClassName}
          >
            <ExternalLink className="h-4 w-4" aria-hidden="true" />
            Join live class
          </a>
        ) : (
          <p className="text-sm text-muted-foreground">
            The join link opens {JOIN_OPENS_MINUTES} minutes before the class starts.
          </p>
        )
      ) : (
        <p className="text-sm text-muted-foreground">The join link will appear here.</p>
      )}
    </section>
  );
}

function FileDownload({ file, label }: { file: NonNullable<PlayerFile>; label: string }) {
  return (
    <a
      href={file.url}
      target="_blank"
      rel="noopener noreferrer"
      className={secondaryActionClassName}
    >
      <Download className="h-4 w-4" aria-hidden="true" />
      {label}
    </a>
  );
}

function FileLesson({
  fileType,
  file,
  title,
}: {
  fileType: "audio" | "pdf" | "slides" | "scorm";
  file: PlayerFile;
  title: string;
}) {
  if (fileType === "scorm") {
    return <Notice>This interactive lesson can&apos;t be opened here yet.</Notice>;
  }
  if (!file) {
    return <Notice>The file for this lesson isn&apos;t available yet.</Notice>;
  }

  if (fileType === "audio") {
    return (
      <section className={cardClassName} aria-label="Audio">
        <CardHeading icon={<Music className="h-5 w-5" />} title={file.name} />
        <audio controls preload="metadata" src={file.url} className="w-full" aria-label={title}>
          <FileDownload file={file} label="Download audio" />
        </audio>
      </section>
    );
  }

  const isPdf = (file.contentType ?? "").toLowerCase().includes("pdf");
  if (isPdf) {
    return (
      <section className="space-y-3" aria-label={fileType === "pdf" ? "PDF" : "Slides"}>
        <iframe
          src={file.url}
          title={title}
          className="h-[75vh] min-h-[24rem] w-full rounded-xl border border-border bg-card"
        />
        <div className="flex flex-wrap gap-2">
          <a
            href={file.url}
            target="_blank"
            rel="noopener noreferrer"
            className={secondaryActionClassName}
          >
            <ExternalLink className="h-4 w-4" aria-hidden="true" />
            Open in a new tab
          </a>
        </div>
      </section>
    );
  }

  // Slide decks (.pptx, .key) can't be shown in the browser safely; offer them.
  return (
    <section className={cardClassName} aria-label="Slides">
      <CardHeading icon={<FileText className="h-5 w-5" />} title={file.name} />
      <p className="text-sm text-muted-foreground">
        Download the slides to open them in PowerPoint, Keynote or Google Slides.
      </p>
      <FileDownload file={file} label="Download slides" />
    </section>
  );
}

/**
 * The main part of a lesson, by kind: an article, a video, a quiz, a live
 * class, a file or an assignment. Used by the learner player and by the
 * Studio preview, so authors see exactly what learners see. Never shows raw
 * data: anything missing gets a plain sentence instead.
 */
export function LessonBody({ title, content, videoProvider, videoUrl }: LessonBodyProps) {
  const hasVideo = Boolean(videoProvider && videoUrl);
  const video =
    hasVideo && videoProvider && videoUrl ? (
      <LessonVideoEmbed
        provider={videoProvider}
        url={videoUrl}
        title={title}
        className="aspect-video w-full rounded-xl border border-border"
      />
    ) : null;

  if (!content) {
    return video ?? <Notice>This lesson has no content yet.</Notice>;
  }

  switch (content.kind) {
    case "video":
      return (
        <div className="space-y-6">
          {video ?? <Notice>The video for this lesson isn&apos;t available yet.</Notice>}
          <Notes body={content.body} />
        </div>
      );

    case "quiz":
      return (
        <div className="space-y-6">
          <section className={cardClassName} aria-label="Quiz">
            <CardHeading icon={<ClipboardCheck className="h-5 w-5" />} title="Quiz" />
            {content.assessmentId ? (
              <>
                <p className="text-sm text-muted-foreground">
                  Answer the questions to check what you&apos;ve learned.
                </p>
                <Link
                  href={`/assessments/${encodeURIComponent(content.assessmentId)}`}
                  className={primaryActionClassName}
                >
                  Start quiz
                </Link>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">This quiz isn&apos;t ready yet.</p>
            )}
          </section>
          <Notes body={content.body} />
        </div>
      );

    case "live":
      return (
        <div className="space-y-6">
          {video}
          <LiveSession live={content.live} />
          <Notes body={content.body} />
        </div>
      );

    case "file":
      return (
        <div className="space-y-6">
          {video}
          <FileLesson fileType={content.fileType} file={content.file} title={title} />
          <Notes body={content.body} />
        </div>
      );

    case "assignment":
      return (
        <div className="space-y-6">
          {content.body ? (
            <ArticleMarkdown text={content.body} />
          ) : (
            <Notice>This assignment has no instructions yet.</Notice>
          )}
        </div>
      );

    case "article":
      if (content.body) {
        return (
          <div className="space-y-6">
            {video}
            <ArticleMarkdown text={content.body} />
          </div>
        );
      }
      return video ?? <Notice>This lesson has no content yet.</Notice>;
  }
}
