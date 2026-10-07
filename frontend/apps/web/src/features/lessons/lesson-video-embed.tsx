import { isHttpUrl } from "@atlas/contracts/core/text/safe-text";

type LessonVideoEmbedProps = {
  provider: string;
  url: string;
  title?: string;
  className?: string;
};

function getYoutubeVideoId(url: string): string | null {
  const match = url.match(/(?:v=|youtu\.be\/)([\w-]+)/);
  return match?.[1] ?? null;
}

function getVimeoVideoId(url: string): string | null {
  const match = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  return match?.[1] ?? null;
}

export function inferVideoProviderFromUrl(url: string): "youtube" | "vimeo" | "bunny" | null {
  const trimmed = url.trim();
  if (!trimmed) return null;

  try {
    const hostname = new URL(trimmed).hostname;
    if (/(^|\.)youtube\.com$/i.test(hostname) || /(^|\.)youtu\.be$/i.test(hostname)) {
      return "youtube";
    }
    if (/(^|\.)vimeo\.com$/i.test(hostname)) {
      return "vimeo";
    }
    if (/(^|\.)bunnycdn\.com$/i.test(hostname) || /(^|\.)b-cdn\.net$/i.test(hostname)) {
      return "bunny";
    }
  } catch {
    return null;
  }

  return null;
}

export function canEmbedLessonVideo(provider: string, url: string): boolean {
  const trimmed = url.trim();
  if (!provider || !trimmed) return false;
  if (provider === "youtube") return Boolean(getYoutubeVideoId(trimmed));
  if (provider === "vimeo") return Boolean(getVimeoVideoId(trimmed));
  if (provider === "bunny") return isHttpUrl(trimmed);
  return false;
}

export function LessonVideoEmbed({
  provider,
  url,
  title = "Lesson video",
  className = "aspect-video w-full rounded-lg border border-[var(--admin-border)]",
}: LessonVideoEmbedProps) {
  // The author typed this URL and learners click it: only an http(s) link is
  // ever rendered (the API refuses anything else too).
  const safeUrl = url.trim();
  if (!isHttpUrl(safeUrl)) return null;

  if (provider === "youtube") {
    const videoId = getYoutubeVideoId(safeUrl);
    if (!videoId) return null;

    return (
      <iframe
        title={title}
        className={className}
        src={`https://www.youtube.com/embed/${videoId}`}
        loading="lazy"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
    );
  }

  if (provider === "vimeo") {
    const videoId = getVimeoVideoId(safeUrl);
    if (!videoId) return null;

    return (
      <iframe
        title={title}
        className={className}
        src={`https://player.vimeo.com/video/${videoId}`}
        loading="lazy"
        allow="autoplay; fullscreen; picture-in-picture"
        allowFullScreen
      />
    );
  }

  if (provider === "bunny") {
    return (
      <p className="rounded-lg border border-[var(--admin-border)] p-4 text-sm text-[var(--admin-on-surface-variant)]">
        Bunny video:{" "}
        <a
          href={safeUrl}
          target="_blank"
          rel="noreferrer"
          className="font-medium text-[var(--admin-primary)] underline-offset-2 hover:underline"
        >
          Open video
        </a>
      </p>
    );
  }

  return null;
}
