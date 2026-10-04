import vm from "node:vm";
import { describe, expect, it } from "vitest";
import {
  buildScormRuntimeScript,
  injectScormRuntimeTag,
  parseScormDurationSeconds,
  readableScormValues,
  scormEntryFor,
  SCORM_TOTAL_SECONDS_KEY,
  type ScormRuntimeConfig,
} from "../../../backend/apps/api/src/server/courses/scorm-runtime";

const LAUNCH = "launch_0123456789abcdef";
const ORIGIN = "https://academy.example.test";
const TAG = '<script src="/api/v1/public/scorm/tok/.atlas-scorm-runtime.js"></script>';

type Api = Record<string, (...args: string[]) => string>;
type Posted = { message: Record<string, unknown>; targetOrigin: string };

/** Runs the runtime in a minimal stand-in for a sandboxed package document. */
function loadRuntime(overrides: Partial<ScormRuntimeConfig> = {}, origin = ORIGIN) {
  const posted: Posted[] = [];
  const listeners: Record<string, Array<(event: unknown) => void>> = {};
  const player = {
    postMessage: (message: Record<string, unknown>, targetOrigin: string) =>
      posted.push({ message, targetOrigin }),
  };
  const window: Record<string, unknown> = {
    location: { origin },
    top: player,
    addEventListener: (type: string, listener: (event: unknown) => void) => {
      (listeners[type] ??= []).push(listener);
    },
  };
  window.window = window;
  vm.runInNewContext(
    buildScormRuntimeScript({
      launchId: LAUNCH,
      version: "2004",
      values: {},
      learnerId: "membership-1",
      learnerName: "Asha Rao",
      entry: "ab-initio",
      totalSeconds: 0,
      ...overrides,
    }),
    window,
  );
  const dispatch = (type: string, event: unknown) => {
    for (const listener of listeners[type] ?? []) listener(event);
  };
  return {
    api2004: window.API_1484_11 as Api,
    api12: window.API as Api,
    posted,
    player,
    dispatch,
    window,
  };
}

describe("runtime tag injection", () => {
  const inject = (html: string) =>
    injectScormRuntimeTag(
      Buffer.from(html, "latin1"),
      "/api/v1/public/scorm/tok/.atlas-scorm-runtime.js",
    ).toString("latin1");

  it("goes after a <meta charset>, which must stay inside the first 1024 bytes", () => {
    expect(inject('<!doctype html><html><head><meta charset="windows-1252"><title>x</title>')).toBe(
      `<!doctype html><html><head><meta charset="windows-1252">${TAG}<title>x</title>`,
    );
  });

  it("falls back to <head>, then <html>, then the doctype, then the start", () => {
    expect(inject("<html><HEAD lang=en><script>a()</script>")).toBe(
      `<html><HEAD lang=en>${TAG}<script>a()</script>`,
    );
    expect(inject("<html><body>")).toBe(`<html>${TAG}<body>`);
    expect(inject("<!DOCTYPE html><p>x")).toBe(`<!DOCTYPE html>${TAG}<p>x`);
    expect(inject("<p>fragment")).toBe(`${TAG}<p>fragment`);
  });

  it("keeps a UTF-8 BOM first and leaves every original byte unchanged", () => {
    const original = Buffer.concat([
      Buffer.from([0xef, 0xbb, 0xbf]),
      Buffer.from("<p>café — ü</p>", "utf8"),
    ]);
    const result = injectScormRuntimeTag(original, "/r.js");
    expect([...result.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    expect(
      Buffer.concat([
        result.subarray(0, 3),
        result.subarray(3 + '<script src="/r.js"></script>'.length),
      ]),
    ).toEqual(original);
  });

  it("leaves UTF-16 documents untouched rather than corrupting them", () => {
    const utf16 = Buffer.from([0xff, 0xfe, 0x3c, 0x00, 0x70, 0x00]);
    expect(injectScormRuntimeTag(utf16, "/r.js")).toEqual(utf16);
  });

  it("refuses a URL that could break out of the attribute", () => {
    expect(() => injectScormRuntimeTag(Buffer.from("<p>"), '/r.js" onload="x')).toThrow();
  });
});

describe("runtime script", () => {
  it("cannot be broken out of by saved values", () => {
    const script = buildScormRuntimeScript({
      launchId: LAUNCH,
      version: "1.2",
      values: { "cmi.suspend_data": "</script><script>alert(1)</script>  é" },
      learnerId: "m",
      learnerName: "<b>x</b>",
      entry: "resume",
      totalSeconds: 0,
    });
    expect(script).not.toContain("</script>");
    expect(script).not.toMatch(/[\u0080-￿]/);
    const { api12 } = loadRuntime({
      values: { "cmi.suspend_data": "</script> é" },
    });
    api12.LMSInitialize?.("");
    expect(api12.LMSGetValue?.("cmi.suspend_data")).toBe("</script> é");
  });
});

describe("SCORM 2004 API (API_1484_11)", () => {
  it("enforces the session state machine with the standard error codes", () => {
    const { api2004 } = loadRuntime();
    const call = (name: string, ...args: string[]) => [
      api2004[name]?.(...args),
      api2004.GetLastError?.(),
    ];
    expect(call("GetValue", "cmi.location")).toEqual(["", "122"]);
    expect(call("SetValue", "cmi.location", "x")).toEqual(["false", "132"]);
    expect(call("Commit", "")).toEqual(["false", "142"]);
    expect(call("Terminate", "")).toEqual(["false", "112"]);
    expect(call("Initialize", "x")).toEqual(["false", "201"]);
    expect(call("Initialize", "")).toEqual(["true", "0"]);
    expect(call("Initialize", "")).toEqual(["false", "103"]);
    expect(call("Terminate", "")).toEqual(["true", "0"]);
    expect(call("Terminate", "")).toEqual(["false", "113"]);
    expect(call("GetValue", "cmi.location")).toEqual(["", "123"]);
    expect(call("SetValue", "cmi.location", "x")).toEqual(["false", "133"]);
    expect(call("Commit", "")).toEqual(["false", "143"]);
    expect(call("Initialize", "")).toEqual(["false", "104"]);
    expect(api2004.GetErrorString?.("406")).toBe("Data Model Element Type Mismatch");
  });

  it("serves the learner, launch and saved data, and protects read-only and write-only elements", () => {
    const { api2004 } = loadRuntime({
      values: { "cmi.location": "slide-7", "cmi.learner_id": "forged" },
      entry: "resume",
      totalSeconds: 3725,
    });
    api2004.Initialize?.("");
    const get = (element: string) => [api2004.GetValue?.(element), api2004.GetLastError?.()];
    expect(get("cmi.location")).toEqual(["slide-7", "0"]);
    expect(get("cmi.learner_id")).toEqual(["membership-1", "0"]);
    expect(get("cmi.learner_name")).toEqual(["Asha Rao", "0"]);
    expect(get("cmi.entry")).toEqual(["resume", "0"]);
    expect(get("cmi.total_time")).toEqual(["PT1H2M5S", "0"]);
    expect(get("cmi.completion_status")).toEqual(["unknown", "0"]);
    expect(get("cmi._version")).toEqual(["1.0", "0"]);
    expect(get("cmi.score.raw")).toEqual(["", "403"]);
    expect(get("cmi.exit")).toEqual(["", "405"]);
    expect(get("cmi.not_a_thing")).toEqual(["", "401"]);
    const set = (element: string, value: string) => [
      api2004.SetValue?.(element, value),
      api2004.GetLastError?.(),
    ];
    expect(set("cmi.learner_id", "x")).toEqual(["false", "404"]);
    expect(set("cmi._version", "2")).toEqual(["false", "404"]);
    expect(set("cmi.completion_status", "done")).toEqual(["false", "406"]);
    expect(set("cmi.score.scaled", "1.5")).toEqual(["false", "407"]);
    expect(set("cmi.session_time", "1 hour")).toEqual(["false", "406"]);
    expect(set("cmi.session_time", "PT1H5M2.5S")).toEqual(["true", "0"]);
    expect(set("cmi.suspend_data", "x".repeat(64_001))).toEqual(["false", "406"]);
  });

  it("orders collections and enforces their dependencies", () => {
    const { api2004 } = loadRuntime();
    api2004.Initialize?.("");
    const set = (element: string, value: string) => [
      api2004.SetValue?.(element, value),
      api2004.GetLastError?.(),
    ];
    expect(set("cmi.interactions.1.id", "q2")).toEqual(["false", "351"]);
    // An item's other fields depend on its id (2004 RTE 4.1.7: 408).
    expect(set("cmi.interactions.0.result", "correct")).toEqual(["false", "408"]);
    expect(set("cmi.interactions.0.id", "q1")).toEqual(["true", "0"]);
    expect(set("cmi.interactions.0.result", "correct")).toEqual(["true", "0"]);
    expect(set("cmi.interactions.0.objectives.0.id", "obj")).toEqual(["true", "0"]);
    expect(set("cmi.interactions.1.type", "choice")).toEqual(["false", "408"]);
    expect(api2004.GetValue?.("cmi.interactions._count")).toBe("1");
    expect(api2004.GetValue?.("cmi.interactions.0.objectives._count")).toBe("1");
    expect(api2004.GetValue?.("cmi.interactions.0.result")).toBe("correct");
    expect(api2004.GetValue?.("cmi.interactions.5.id")).toBe("");
    expect(api2004.GetLastError?.()).toBe("301");
  });
});

describe("SCORM 1.2 API (API)", () => {
  it("follows the 1.2 data model and error codes", () => {
    const { api12 } = loadRuntime({ entry: "", totalSeconds: 59 });
    const call = (name: string, ...args: string[]) => [
      api12[name]?.(...args),
      api12.LMSGetLastError?.(),
    ];
    expect(call("LMSGetValue", "cmi.core.lesson_status")).toEqual(["", "301"]);
    expect(call("LMSInitialize", "")).toEqual(["true", "0"]);
    expect(call("LMSGetValue", "cmi.core.lesson_status")).toEqual(["not attempted", "0"]);
    expect(call("LMSGetValue", "cmi.core.student_name")).toEqual(["Asha Rao", "0"]);
    expect(call("LMSGetValue", "cmi.core.total_time")).toEqual(["0000:00:59", "0"]);
    expect(call("LMSGetValue", "cmi.core._children")).toEqual([
      "student_id,student_name,lesson_location,credit,lesson_status,entry,score,total_time,lesson_mode,exit,session_time",
      "0",
    ]);
    expect(call("LMSSetValue", "cmi.core._children", "x")).toEqual(["false", "402"]);
    expect(call("LMSSetValue", "cmi.core.student_name", "x")).toEqual(["false", "403"]);
    expect(call("LMSGetValue", "cmi.core.exit")).toEqual(["", "404"]);
    expect(call("LMSSetValue", "cmi.core.lesson_status", "not attempted")).toEqual([
      "false",
      "405",
    ]);
    expect(call("LMSSetValue", "cmi.core.score.raw", "101")).toEqual(["false", "405"]);
    expect(call("LMSSetValue", "cmi.core.score.raw", "87.5")).toEqual(["true", "0"]);
    expect(call("LMSSetValue", "cmi.core.session_time", "0001:02:03.25")).toEqual(["true", "0"]);
    expect(call("LMSSetValue", "cmi.interactions.0.id", "q1")).toEqual(["true", "0"]);
    expect(call("LMSGetValue", "cmi.interactions.0.id")).toEqual(["", "404"]);
    expect(call("LMSGetValue", "cmi.interactions._count")).toEqual(["1", "0"]);
    expect(call("LMSFinish", "")).toEqual(["true", "0"]);
  });
});

describe("player channel", () => {
  it("says hello, then reports writable data on commit and terminate, to the app origin only", () => {
    const { api12, posted } = loadRuntime({ values: { "cmi.core.lesson_location": "p1" } });
    expect(posted).toEqual([
      {
        message: { protocol: "atlas-scorm", version: 1, launchId: LAUNCH, type: "hello" },
        targetOrigin: ORIGIN,
      },
    ]);
    api12.LMSInitialize?.("");
    api12.LMSSetValue?.("cmi.core.lesson_status", "completed");
    api12.LMSSetValue?.("cmi.core.exit", "suspend");
    api12.LMSCommit?.("");
    api12.LMSFinish?.("");
    expect(posted.map((entry) => entry.message.type)).toEqual([
      "hello",
      "initialize",
      "commit",
      "terminate",
    ]);
    expect(posted.every((entry) => entry.targetOrigin === ORIGIN)).toBe(true);
    expect(posted.at(-1)?.message.values).toEqual({
      "cmi.core.lesson_location": "p1",
      "cmi.core.lesson_status": "completed",
      "cmi.core.exit": "suspend",
    });
  });

  it("never posts when it cannot name the player's origin", () => {
    const { api12, posted } = loadRuntime({}, "null");
    api12.LMSInitialize?.("");
    api12.LMSCommit?.("");
    expect(posted).toEqual([]);
  });

  it("adopts newer saved data from the player, but never over its own writes or read-only data", () => {
    const { api2004, player, dispatch } = loadRuntime({ values: { "cmi.location": "old" } });
    api2004.Initialize?.("");
    api2004.SetValue?.("cmi.suspend_data", "mine");
    const state = (values: Record<string, unknown>, extra: Record<string, unknown> = {}) => ({
      source: player,
      data: { protocol: "atlas-scorm-player", launchId: LAUNCH, type: "state", values, ...extra },
    });
    dispatch("message", { ...state({ "cmi.location": "spoofed" }), source: {} });
    dispatch(
      "message",
      state({ "cmi.location": "other-launch" }, { launchId: "launch_other_00000000" }),
    );
    expect(api2004.GetValue?.("cmi.location")).toBe("old");
    dispatch(
      "message",
      state({
        "cmi.location": "newer",
        "cmi.suspend_data": "theirs",
        "cmi.learner_id": "forged",
        "atlas.x": "1",
      }),
    );
    expect(api2004.GetValue?.("cmi.location")).toBe("newer");
    expect(api2004.GetValue?.("cmi.suspend_data")).toBe("mine");
    expect(api2004.GetValue?.("cmi.learner_id")).toBe("membership-1");
  });

  it("reports uncommitted writes when the page goes away", () => {
    const { api2004, posted, dispatch } = loadRuntime();
    api2004.Initialize?.("");
    api2004.SetValue?.("cmi.location", "p9");
    dispatch("pagehide", {});
    expect(posted.at(-1)?.message).toMatchObject({
      type: "commit",
      values: { "cmi.location": "p9" },
    });
    dispatch("pagehide", {});
    expect(posted.filter((entry) => entry.message.type === "commit")).toHaveLength(1);
  });
});

describe("saved data for a new document", () => {
  it("hides write-only, internal and 1.2-interaction elements", () => {
    expect(
      readableScormValues({
        "cmi.location": "a",
        "cmi.exit": "suspend",
        "cmi.core.session_time": "0000:01:00",
        [SCORM_TOTAL_SECONDS_KEY]: 60,
        "cmi.interactions.0.id": "q1",
        "cmi.interactions.0.student_response": "b",
        "cmi.score.raw": 80,
        "cmi.nested": { not: "a string" },
      }),
    ).toEqual({ "cmi.location": "a", "cmi.interactions.0.id": "q1", "cmi.score.raw": "80" });
  });

  it("resumes only after a suspend", () => {
    expect(scormEntryFor(null)).toBe("ab-initio");
    expect(scormEntryFor({})).toBe("ab-initio");
    expect(scormEntryFor({ "cmi.core.exit": "suspend" })).toBe("resume");
    expect(scormEntryFor({ "cmi.exit": "suspend" })).toBe("resume");
    expect(scormEntryFor({ "cmi.exit": "normal" })).toBe("");
  });
});

describe("parseScormDurationSeconds", () => {
  it.each([
    ["0001:02:03.25", 3723.25],
    ["00:00:30", 30],
    ["PT1H2M3.5S", 3723.5],
    ["PT90S", 90],
    ["PT2H", 7200],
    // A session is credited at most 12 hours: a tab left open overnight is not study.
    ["P1DT1S", 43200],
    ["PT1000H", 43200],
  ])("%s → %d", (value, seconds) => {
    expect(parseScormDurationSeconds(value)).toBe(seconds);
  });

  it.each(["", "P", "PT", "P1Y", "P1M", "1:2:3", "-PT1S", 5, null])("rejects %j", (value) => {
    expect(parseScormDurationSeconds(value)).toBeNull();
  });
});
