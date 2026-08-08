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

export function persistUtmAttribution(attribution: StoredUtmAttribution): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(UTM_STORAGE_KEY, JSON.stringify(attribution));
}

export function readStoredUtmAttribution(): StoredUtmAttribution | null {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = window.localStorage.getItem(UTM_STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as StoredUtmAttribution;
  } catch {
    return null;
  }
}

export function clearStoredUtmAttribution(): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(UTM_STORAGE_KEY);
}

export async function sendAttributionEvent(args: {
  eventType: string;
  membershipId?: string;
  clearAfterSend?: boolean;
}): Promise<void> {
  const stored = readStoredUtmAttribution();

  await fetch("/api/v1/public/sales/attribution", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      eventType: args.eventType,
      membershipId: args.membershipId,
      utmSource: stored?.utmSource,
      utmMedium: stored?.utmMedium,
      utmCampaign: stored?.utmCampaign,
      utmTerm: stored?.utmTerm,
      utmContent: stored?.utmContent,
    }),
  });

  if (args.clearAfterSend) {
    clearStoredUtmAttribution();
  }
}

export async function sendSignupAttributionEvent(args?: {
  eventType?: string;
  membershipId?: string;
}): Promise<void> {
  const stored = readStoredUtmAttribution();
  if (!stored) {
    return;
  }

  await sendAttributionEvent({
    eventType: args?.eventType ?? "signup",
    ...(args?.membershipId !== undefined ? { membershipId: args.membershipId } : {}),
    clearAfterSend: true,
  });
}
