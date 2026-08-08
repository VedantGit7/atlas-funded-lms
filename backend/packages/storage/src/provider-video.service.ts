import { ProviderVideoRefSchema, type ProviderVideoRef } from "./schemas/provider-video";

const ALLOWED_HOSTS: Record<ProviderVideoRef["provider"], RegExp[]> = {
  youtube: [/(^|\.)youtube\.com$/i, /(^|\.)youtu\.be$/i],
  vimeo: [/(^|\.)vimeo\.com$/i],
  bunny: [/(^|\.)bunnycdn\.com$/i, /(^|\.)b-cdn\.net$/i],
};

const BLOCKED_VIDEO_EXTENSIONS = [".mp4", ".mov", ".m4v", ".webm", ".avi", ".mkv"];

export function validateProviderVideoRef(input: unknown): ProviderVideoRef {
  const ref = ProviderVideoRefSchema.parse(input);
  const url = new URL(ref.url);

  if (BLOCKED_VIDEO_EXTENSIONS.some((ext) => url.pathname.toLowerCase().endsWith(ext))) {
    throw new Error("SELF_HOSTED_VIDEO_FORBIDDEN");
  }

  const hostAllowed = ALLOWED_HOSTS[ref.provider].some((pattern) => pattern.test(url.hostname));

  if (!hostAllowed) {
    throw new Error("VIDEO_PROVIDER_HOST_MISMATCH");
  }

  return ref;
}
