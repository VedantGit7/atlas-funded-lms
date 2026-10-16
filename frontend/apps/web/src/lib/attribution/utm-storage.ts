const UTM_STORAGE_KEY = "atlas-utm-attribution";

export type StoredUtmAttribution = {
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmTerm?: string;
  utmContent?: string;
  capturedAt: string;
};

const UTM_PARAM_MAP: Record<string, keyof StoredUtmAttribution> = {
  utm_source: "utmSource",
  utm_medium: "utmMedium",
  utm_campaign: "utmCampaign",
  utm_term: "utmTerm",
  utm_content: "utmContent",
};

export function captureUtmFromSearchParams(
  searchParams: URLSearchParams,
): StoredUtmAttribution | null {
  const attribution: Partial<StoredUtmAttribution> = {};
  let hasUtm = false;

  for (const [param, key] of Object.entries(UTM_PARAM_MAP)) {
    const value = searchParams.get(param);
    if (value) {
      attribution[key] = value;
      hasUtm = true;
    }
  }

  if (!hasUtm) {
    return null;
  }

  return {
    ...attribution,
    capturedAt: new Date().toISOString(),
  };
}

// Storage can be blocked (privacy settings, some private windows) and then
// throws. Attribution is best-effort, so it must never stop the page or the
// event from going out.

export function persistUtmAttribution(attribution: StoredUtmAttribution): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(UTM_STORAGE_KEY, JSON.stringify(attribution));
  } catch {
    // Storage unavailable: the event still carries the current address's UTM.
  }
}

export function readStoredUtmAttribution(): StoredUtmAttribution | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(UTM_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as StoredUtmAttribution) : null;
  } catch {
    return null;
  }
}

export function clearStoredUtmAttribution(): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.removeItem(UTM_STORAGE_KEY);
  } catch {
    // Storage unavailable: nothing was stored.
  }
}

/**
 * The campaign in the current address, if it has one. Every event checks it
 * before sending, so a visit carries the UTM it arrived with on any page:
 * pages outside the public layout (such as the home page) have no capture
 * effect, and inside it the effect may run after the page's own event.
 */
function utmFromCurrentUrl(): StoredUtmAttribution | null {
  if (typeof window === "undefined") {
    return null;
  }
  return captureUtmFromSearchParams(new URLSearchParams(window.location.search));
}

/**
 * Saves the current address's campaign, if it has one, so later events
 * (signup, enrolment) keep it after the visitor navigates on. An address
 * without UTM keeps the campaign saved earlier.
 */
function rememberUtmFromCurrentUrl(): void {
  const fromUrl = utmFromCurrentUrl();
  if (fromUrl) {
    persistUtmAttribution(fromUrl);
  }
}

/**
 * The campaign an event reports: the current address's UTM when it has any,
 * otherwise the one saved from an earlier page. Saves the current one too.
 */
export function currentUtmFields() {
  rememberUtmFromCurrentUrl();
  const attribution = utmFromCurrentUrl() ?? readStoredUtmAttribution();
  return {
    utmSource: attribution?.utmSource,
    utmMedium: attribution?.utmMedium,
    utmCampaign: attribution?.utmCampaign,
    utmTerm: attribution?.utmTerm,
    utmContent: attribution?.utmContent,
  };
}

/** Events a visitor who is not signed in can report. */
export type PublicAttributionEventType = "visited" | "started_diagnostic" | "signup";

/**
 * Reports an anonymous visitor's event. The server records it against no
 * member; it never takes a membership from the browser.
 */
export async function sendAttributionEvent(args: {
  eventType: PublicAttributionEventType;
  clearAfterSend?: boolean;
}): Promise<void> {
  await fetch("/api/v1/public/sales/attribution", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ eventType: args.eventType, ...currentUtmFields() }),
  });

  if (args.clearAfterSend) {
    clearStoredUtmAttribution();
  }
}

/** Reports a signup when the visitor came from a campaign; plain signups send nothing. */
export async function sendSignupAttributionEvent(): Promise<void> {
  if (!utmFromCurrentUrl() && !readStoredUtmAttribution()) {
    return;
  }

  await sendAttributionEvent({ eventType: "signup", clearAfterSend: true });
}
