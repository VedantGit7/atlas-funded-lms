import "server-only";
import { cache } from "react";
import { loadPublicBootstrap } from "../server/bootstrap";
import {
  DEFAULT_ACADEMY_FORMAT,
  setAcademyFormatResolver,
  type AcademyFormat,
} from "./academy-format";
import { academyFormatFrom } from "./academy-settings";

/** This request's academy format, once loaded. `cache` keeps one per request. */
const requestFormat = cache((): { format: AcademyFormat | null } => ({ format: null }));

/*
 * Server components sit outside AcademyFormatProvider, so they read the
 * academy's format from the request. The root layout loads it before anything
 * renders; a server component that formats before the layout has finished can
 * await `loadAcademyFormat()` itself.
 */
setAcademyFormatResolver(() => requestFormat().format ?? DEFAULT_ACADEMY_FORMAT);

/**
 * The academy's time zone, locale and currency for server code: the root
 * layout hands it to `AcademyFormatProvider` for client components, and
 * server components format with it directly.
 */
export const loadAcademyFormat = cache(async (): Promise<AcademyFormat> => {
  let format = DEFAULT_ACADEMY_FORMAT;
  try {
    const bootstrap = await loadPublicBootstrap();
    format = academyFormatFrom({ timeZone: bootstrap.timeZone, currency: bootstrap.homeCurrency });
  } catch {
    // No resolvable academy (the platform host): keep the defaults.
  }
  requestFormat().format = format;
  return format;
});
