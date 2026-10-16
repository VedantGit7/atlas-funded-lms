// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { postMock } = vi.hoisted(() => ({ postMock: vi.fn() }));
vi.mock("../../../frontend/apps/web/src/lib/client-api", () => ({
  clientApi: { post: (...args: unknown[]) => postMock(...args) },
}));

import {
  persistUtmAttribution,
  readStoredUtmAttribution,
  sendAttributionEvent,
  sendSignupAttributionEvent,
} from "../../../frontend/apps/web/src/lib/attribution/utm-storage";
import { sendMemberAttributionEvent } from "../../../frontend/apps/web/src/lib/attribution/member-attribution";

/**
 * A visit must carry the campaign it arrived with on any page. The home page
 * has no capture effect (it is outside the public layout), and inside that
 * layout the effect can run after the page's own "visited" event.
 */
const fetchMock = vi.fn();

function visit(path: string) {
  window.history.replaceState(null, "", path);
}

function sentBodies(): Array<Record<string, unknown>> {
  return fetchMock.mock.calls.map(
    ([, init]) => JSON.parse(String((init as RequestInit).body)) as Record<string, unknown>,
  );
}

beforeEach(() => {
  window.localStorage.clear();
  fetchMock.mockReset().mockResolvedValue(new Response("{}"));
  postMock.mockReset().mockResolvedValue({});
  vi.stubGlobal("fetch", fetchMock);
  visit("/");
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("campaign on the visit itself", () => {
  it("sends and saves the UTM in the address of the page that reports the visit", async () => {
    visit("/?utm_source=newsletter&utm_medium=email&utm_campaign=october");

    await sendAttributionEvent({ eventType: "visited" });

    expect(sentBodies()[0]).toMatchObject({
      eventType: "visited",
      utmSource: "newsletter",
      utmMedium: "email",
      utmCampaign: "october",
    });
    expect(readStoredUtmAttribution()).toMatchObject({ utmSource: "newsletter" });
  });

  it("keeps the earlier campaign on a page without UTM", async () => {
    persistUtmAttribution({ utmSource: "ads", capturedAt: "2026-10-01T00:00:00.000Z" });
    visit("/courses/intro");

    await sendAttributionEvent({ eventType: "started_diagnostic" });

    expect(sentBodies()[0]).toMatchObject({ utmSource: "ads" });
    expect(readStoredUtmAttribution()).toMatchObject({ utmSource: "ads" });
  });

  it("lets a newer campaign replace the saved one", async () => {
    persistUtmAttribution({ utmSource: "ads", capturedAt: "2026-10-01T00:00:00.000Z" });
    visit("/?utm_source=partner");

    await sendAttributionEvent({ eventType: "visited" });

    expect(sentBodies()[0]).toMatchObject({ utmSource: "partner" });
    expect(readStoredUtmAttribution()).toMatchObject({ utmSource: "partner" });
  });

  it("still sends the address's campaign when storage is blocked", async () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("blocked", "SecurityError");
    });
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("blocked", "SecurityError");
    });
    visit("/?utm_source=newsletter");

    await sendAttributionEvent({ eventType: "visited" });

    expect(sentBodies()[0]).toMatchObject({ eventType: "visited", utmSource: "newsletter" });
  });
});

describe("signup", () => {
  it("sends nothing for a signup with no campaign", async () => {
    visit("/signup");

    await sendSignupAttributionEvent();

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("reports a signup whose campaign is only in the address, then forgets it", async () => {
    visit("/signup?utm_source=newsletter");

    await sendSignupAttributionEvent();

    expect(sentBodies()[0]).toMatchObject({ eventType: "signup", utmSource: "newsletter" });
    expect(readStoredUtmAttribution()).toBeNull();
  });
});

describe("member events", () => {
  it("send the saved campaign through the signed-in route and clear it", async () => {
    persistUtmAttribution({ utmSource: "ads", capturedAt: "2026-10-01T00:00:00.000Z" });
    visit("/courses/intro");

    await sendMemberAttributionEvent({ eventType: "enrolled", clearAfterSend: true });

    expect(postMock).toHaveBeenCalledWith(
      "/api/v1/sales/attribution",
      expect.objectContaining({ eventType: "enrolled", utmSource: "ads" }),
      "attribution-event",
      { silent: true },
    );
    expect(readStoredUtmAttribution()).toBeNull();
  });

  it("keep the campaign when the event could not be sent", async () => {
    postMock.mockRejectedValue(new Error("offline"));
    persistUtmAttribution({ utmSource: "ads", capturedAt: "2026-10-01T00:00:00.000Z" });

    await sendMemberAttributionEvent({ eventType: "enrolled", clearAfterSend: true });

    expect(readStoredUtmAttribution()).toMatchObject({ utmSource: "ads" });
  });
});
