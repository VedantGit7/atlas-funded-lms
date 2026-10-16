import { clientApi } from "../client-api";
import { clearStoredUtmAttribution, storedUtmFields } from "./utm-storage";

/**
 * Reports an event for the signed-in member. The server attributes it to the
 * caller's own membership. Kept apart from utm-storage so public pages do not
 * load the API client. Attribution must never get in the member's way, so
 * failures are ignored.
 */
export async function sendMemberAttributionEvent(args: {
  eventType: string;
  clearAfterSend?: boolean;
}): Promise<void> {
  try {
    await clientApi.post(
      "/api/v1/sales/attribution",
      { eventType: args.eventType, ...storedUtmFields() },
      "attribution-event",
      { silent: true },
    );
  } catch {
    return;
  }

  if (args.clearAfterSend) {
    clearStoredUtmAttribution();
  }
}
