import { createHash } from "node:crypto";

export function hashPrivacyValue(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function hashClientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  const raw =
    forwarded != null
      ? (forwarded.split(",")[0]?.trim() ?? "unknown")
      : (req.headers.get("x-real-ip") ?? "unknown");
  return hashPrivacyValue(raw);
}

export function hashUserAgent(req: Request): string {
  return hashPrivacyValue(req.headers.get("user-agent") ?? "unknown");
}
