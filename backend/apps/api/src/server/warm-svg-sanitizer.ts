import { structuredLogger } from "@atlas/observability/logger";
import { preloadSvgSanitizer } from "@atlas/storage/svg-sanitize";

/**
 * Load the SVG sanitizer (DOMPurify on jsdom, a slow import) in the background
 * at startup, so the first SVG upload confirm after a restart does not load it
 * inside its database transaction. Not awaited: readiness is not delayed, and
 * a confirm that arrives first shares the same load.
 */
export async function warmSvgSanitizer(): Promise<void> {
  const startedAt = performance.now();
  try {
    await preloadSvgSanitizer();
    structuredLogger.info({
      message: "SVG sanitizer loaded",
      module: "storage",
      eventType: "storage.svg_sanitizer_ready",
      durationMs: Math.round(performance.now() - startedAt),
    });
  } catch (error) {
    // The first SVG confirm retries the load; nothing else depends on it.
    structuredLogger.warn({
      message: "SVG sanitizer preload failed; it will load on first use",
      module: "storage",
      eventType: "storage.svg_sanitizer_preload_failed",
      detail: error instanceof Error ? error.message.slice(0, 300) : String(error).slice(0, 300),
    });
  }
}
