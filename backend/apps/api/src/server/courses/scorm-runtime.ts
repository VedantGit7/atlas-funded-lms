/**
 * The SCORM runtime that runs inside package documents.
 *
 * SCORM content finds its LMS by walking `window`, `window.parent`, … looking
 * for `API` (1.2) or `API_1484_11` (2004), and calls it synchronously. Package
 * documents run in an opaque sandboxed origin, so they cannot reach anything on
 * the player page; every document instead gets its own local, synchronous API,
 * seeded with the learner's saved data, which reports to the player over a
 * narrow `postMessage` protocol. The player validates and persists.
 *
 * Every package HTML file gets one small `<script src>` tag pointing at
 * RUNTIME_FILE beneath the same capability. That response carries the runtime
 * and this learner's data; the HTML itself stays byte-for-byte the package's,
 * apart from the tag.
 */

/** Reserved name beneath the capability root; it cannot be a package file in practice. */
export const SCORM_RUNTIME_FILE = ".atlas-scorm-runtime.js";

export const SCORM_BRIDGE_PROTOCOL = "atlas-scorm";
export const SCORM_PLAYER_PROTOCOL = "atlas-scorm-player";

/** Internal bookkeeping keys stored alongside CMI; never accepted from or sent to content. */
export const SCORM_INTERNAL_PREFIX = "atlas.";
export const SCORM_TOTAL_SECONDS_KEY = "atlas.total_time_seconds";

export type ScormRuntimeConfig = {
  launchId: string;
  version: "1.2" | "2004";
  /** Previously saved, content-readable values. */
  values: Record<string, string>;
  learnerId: string;
  learnerName: string;
  entry: "ab-initio" | "resume" | "";
  totalSeconds: number;
};

// Elements content may set but never read back (SCORM write-only elements).
const WRITE_ONLY = new Set([
  "cmi.core.exit",
  "cmi.core.session_time",
  "cmi.exit",
  "cmi.session_time",
]);

/** Saved CMI → the values a new document may read. */
export function readableScormValues(cmi: Record<string, unknown>): Record<string, string> {
  const values: Record<string, string> = {};
  for (const [key, value] of Object.entries(cmi)) {
    if (key.startsWith(SCORM_INTERNAL_PREFIX) || WRITE_ONLY.has(key)) continue;
    if (/^cmi\.interactions\./.test(key) && !/\._count$/.test(key)) {
      // 1.2 interactions are write-only; 2004 interactions are readable.
      if (
        !/^cmi\.interactions\.\d+\.(?:id|type|timestamp|weighting|learner_response|result|latency|description|objectives\.\d+\.id|correct_responses\.\d+\.pattern)$/.test(
          key,
        )
      )
        continue;
    }
    if (typeof value === "string") values[key] = value;
    else if (typeof value === "number" || typeof value === "boolean") values[key] = String(value);
  }
  return values;
}

/** Entry mode for a new launch, from what the previous session left behind. */
export function scormEntryFor(cmi: Record<string, unknown> | null): ScormRuntimeConfig["entry"] {
  if (!cmi || Object.keys(cmi).length === 0) return "ab-initio";
  const exit = cmi["cmi.exit"] ?? cmi["cmi.core.exit"];
  return exit === "suspend" ? "resume" : "";
}

/** Longest single session credited to total time: a tab left open overnight is not study. */
const MAX_SESSION_SECONDS = 12 * 60 * 60;

/**
 * Seconds in a SCORM 1.2 timespan (`HHHH:MM:SS.SS`) or a SCORM 2004 ISO 8601
 * interval (`PT1H2M3.5S`). Null for anything else. Years and months have no
 * fixed length and are rejected rather than guessed.
 */
export function parseScormDurationSeconds(value: unknown): number | null {
  if (typeof value !== "string") return null;
  let seconds: number | null = null;
  const timespan = /^(\d{2,4}):(\d{2}):(\d{2}(?:\.\d{1,2})?)$/.exec(value);
  if (timespan) {
    seconds = Number(timespan[1]) * 3600 + Number(timespan[2]) * 60 + Number(timespan[3]);
  } else {
    const interval =
      /^P(?:(\d+(?:\.\d+)?)D)?(?:T(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?)?$/.exec(
        value,
      );
    if (interval && value !== "P" && !value.endsWith("T")) {
      const [, days, hours, minutes, secs] = interval;
      seconds =
        Number(days ?? 0) * 86400 +
        Number(hours ?? 0) * 3600 +
        Number(minutes ?? 0) * 60 +
        Number(secs ?? 0);
    }
  }
  if (seconds === null || !Number.isFinite(seconds) || seconds < 0) return null;
  return Math.min(seconds, MAX_SESSION_SECONDS);
}

/** JSON that is safe inside a script and independent of the document's charset. */
function scriptSafeJson(value: unknown): string {
  return JSON.stringify(value).replace(
    /[<>&\u0080-￿]/g,
    (char) => `\\u${char.charCodeAt(0).toString(16).padStart(4, "0")}`,
  );
}

export function buildScormRuntimeScript(config: ScormRuntimeConfig): string {
  return `${RUNTIME_SOURCE}(${scriptSafeJson({
    protocol: SCORM_BRIDGE_PROTOCOL,
    playerProtocol: SCORM_PLAYER_PROTOCOL,
    ...config,
  })});\n`;
}

const HTML_TYPES = new Set(["text/html", "application/xhtml+xml"]);

export function isScormHtml(contentType: string): boolean {
  return HTML_TYPES.has(contentType.split(";")[0]?.trim().toLowerCase() ?? "");
}

/**
 * Insert the runtime tag so it runs before any package script.
 *
 * Works on raw bytes (latin1 is a 1:1 byte view) so the package's own encoding
 * is never touched, and goes after a `<meta charset>` when one is declared:
 * browsers only honour that declaration in the first 1024 bytes.
 */
export function injectScormRuntimeTag(html: Buffer, runtimeUrl: string): Buffer {
  if (!/^[\x21-\x7e]+$/.test(runtimeUrl))
    throw new Error("SCORM runtime URL must be printable ASCII");
  // UTF-16 documents cannot take an ASCII tag; leave them untouched rather than corrupt them.
  if (
    html.length >= 2 &&
    ((html[0] === 0xff && html[1] === 0xfe) || (html[0] === 0xfe && html[1] === 0xff))
  )
    return html;
  const text = html.toString("latin1");
  const tag = `<script src="${runtimeUrl.replace(/&/g, "&amp;").replace(/"/g, "&quot;")}"></script>`;
  const anchors = [
    /<meta\b[^>]*\bcharset\s*=[^>]*>/i,
    /<head\b[^>]*>/i,
    /<html\b[^>]*>/i,
    /<!doctype\b[^>]*>/i,
  ];
  let at =
    text.charCodeAt(0) === 0xef && text.charCodeAt(1) === 0xbb && text.charCodeAt(2) === 0xbf
      ? 3
      : 0;
  for (const anchor of anchors) {
    const match = anchor.exec(text);
    if (match) {
      at = match.index + match[0].length;
      break;
    }
  }
  return Buffer.concat([html.subarray(0, at), Buffer.from(tag, "latin1"), html.subarray(at)]);
}

/*
 * The runtime itself: plain browser JavaScript, self-contained, run as
 * `(<source>)(config)`. It never fetches, navigates or touches anything but
 * its own document and the player's message channel.
 */
const RUNTIME_SOURCE = String.raw`(function (config) {
  "use strict";
  if (window.__atlasScormRuntime) return;
  window.__atlasScormRuntime = true;

  var MAX_ITEMS = { interactions: 250, objectives: 100, comments_from_learner: 250, "interactions.n.objectives": 10, "interactions.n.correct_responses": 36 };

  // --- Player channel ------------------------------------------------------------------
  function findPlayer() {
    try {
      if (window.top && window.top !== window) return window.top;
      if (window.opener) return window.opener.top || window.opener;
    } catch (ignored) {}
    return null;
  }
  var player = findPlayer();
  // A sandboxed document's own origin is opaque, but location still reports the
  // URL's origin: the player's. Never fall back to "*", which would hand the
  // learner's data to whatever the top window happens to be.
  var playerOrigin = location.origin;
  function post(type, values) {
    if (!player || !playerOrigin || playerOrigin === "null") return;
    var message = { protocol: config.protocol, version: 1, launchId: config.launchId, type: type };
    if (values) message.values = values;
    try { player.postMessage(message, playerOrigin); } catch (ignored) {}
  }

  // --- Data store ----------------------------------------------------------------------
  var values = {};
  var touched = {};
  var dirty = false;
  function writable(key) {
    var rule = lookup(model12, key) || lookup(model2004, key);
    return !!rule && rule.a !== "ro" && !rule.k;
  }
  function writableValues() {
    var out = {};
    Object.keys(values).forEach(function (key) { if (writable(key)) out[key] = values[key]; });
    return out;
  }
  function report(type) { dirty = false; post(type, writableValues()); }
  Object.keys(config.values || {}).forEach(function (key) { values[key] = String(config.values[key]); });

  function pad(number, width) { var text = String(number); while (text.length < width) text = "0" + text; return text; }
  function totalTime12(seconds) {
    var whole = Math.max(0, Math.floor(seconds));
    return pad(Math.floor(whole / 3600), 4) + ":" + pad(Math.floor(whole / 60) % 60, 2) + ":" + pad(whole % 60, 2);
  }
  function totalTime2004(seconds) {
    var whole = Math.max(0, Math.floor(seconds));
    return "PT" + Math.floor(whole / 3600) + "H" + (Math.floor(whole / 60) % 60) + "M" + (whole % 60) + "S";
  }

  // --- Validators: return 0, "type" or "range" -----------------------------------------
  var REAL = /^[-+]?(\d+(\.\d*)?|\.\d+)$/;
  var INTEGER = /^[-+]?\d+$/;
  function any() { return 0; }
  function text(max) { return function (value) { return value.length <= max ? 0 : "type"; }; }
  function vocab(list) { return function (value) { return list.indexOf(value) >= 0 ? 0 : "type"; }; }
  function real(min, max) {
    return function (value) {
      if (!REAL.test(value)) return "type";
      var number = parseFloat(value);
      return (min !== null && number < min) || (max !== null && number > max) ? "range" : 0;
    };
  }
  function integer(min, max) {
    return function (value) {
      if (!INTEGER.test(value)) return "type";
      var number = parseInt(value, 10);
      return number < min || number > max ? "range" : 0;
    };
  }
  function blankOr(check) { return function (value) { return value === "" ? 0 : check(value); }; }
  function pattern(regex) { return function (value) { return regex.test(value) ? 0 : "type"; }; }
  function oneOf(a, b) { return function (value) { return a(value) === 0 || b(value) === 0 ? 0 : "type"; }; }
  var TIMESPAN_12 = pattern(/^\d{2,4}:\d{2}:\d{2}(\.\d{1,2})?$/);
  var TIME_12 = pattern(/^\d{2}:\d{2}:\d{2}(\.\d{1,2})?$/);
  var INTERVAL = pattern(/^P(?!$)(\d+(\.\d+)?Y)?(\d+(\.\d+)?M)?(\d+(\.\d+)?D)?(T(?=\d)(\d+(\.\d+)?H)?(\d+(\.\d+)?M)?(\d+(\.\d{1,2})?S)?)?$/);
  var TIMESTAMP = pattern(/^\d{4}(-\d{2}(-\d{2}(T\d{2}(:\d{2}(:\d{2}(\.\d{1,2})?)?)?(Z|[+-]\d{2}(:\d{2})?)?)?)?)?$/);
  var LONG_ID = text(4000);
  var LANGUAGE = blankOr(pattern(/^[A-Za-z]{1,8}(-[A-Za-z0-9]{1,8})*$/));

  // --- Data models -----------------------------------------------------------------------
  // a: ro | rw | wo; k: keyword element; d: default (undefined = not initialized);
  // t: validator; dep: an earlier sibling that must be set first (2004 error 408).
  function ro(defaultValue) { return { a: "ro", d: defaultValue, t: any }; }
  function keyword(defaultValue) { return { a: "ro", k: true, d: defaultValue, t: any }; }
  function rw(check, defaultValue) { return { a: "rw", t: check, d: defaultValue }; }
  function wo(check) { return { a: "wo", t: check }; }

  var model12 = {
    "cmi.core._children": keyword("student_id,student_name,lesson_location,credit,lesson_status,entry,score,total_time,lesson_mode,exit,session_time"),
    "cmi.core.student_id": ro(config.learnerId),
    "cmi.core.student_name": ro(config.learnerName),
    "cmi.core.lesson_location": rw(text(1000), ""),
    "cmi.core.credit": ro("credit"),
    "cmi.core.lesson_status": rw(vocab(["passed", "completed", "failed", "incomplete", "browsed"]), "not attempted"),
    "cmi.core.entry": ro(config.entry),
    "cmi.core.score._children": keyword("raw,min,max"),
    "cmi.core.score.raw": rw(blankOr(real(0, 100)), ""),
    "cmi.core.score.min": rw(blankOr(real(0, 100)), ""),
    "cmi.core.score.max": rw(blankOr(real(0, 100)), ""),
    "cmi.core.total_time": ro(totalTime12(config.totalSeconds)),
    "cmi.core.lesson_mode": ro("normal"),
    "cmi.core.exit": wo(vocab(["time-out", "suspend", "logout", ""])),
    "cmi.core.session_time": wo(TIMESPAN_12),
    // Spec maximum is 4096; real packages routinely write more, so accept what 2004 allows.
    "cmi.suspend_data": rw(text(64000), ""),
    "cmi.launch_data": ro(""),
    "cmi.comments": rw(text(4096), ""),
    "cmi.comments_from_lms": ro(""),
    "cmi.objectives._children": keyword("id,score,status"),
    "cmi.objectives._count": { a: "ro", k: true, count: "cmi.objectives" },
    "cmi.objectives.n.id": rw(text(255), ""),
    "cmi.objectives.n.score._children": keyword("raw,min,max"),
    "cmi.objectives.n.score.raw": rw(blankOr(real(0, 100)), ""),
    "cmi.objectives.n.score.min": rw(blankOr(real(0, 100)), ""),
    "cmi.objectives.n.score.max": rw(blankOr(real(0, 100)), ""),
    "cmi.objectives.n.status": rw(vocab(["passed", "completed", "failed", "incomplete", "browsed", "not attempted"]), "not attempted"),
    "cmi.student_data._children": keyword("mastery_score,max_time_allowed,time_limit_action"),
    "cmi.student_data.mastery_score": ro(""),
    "cmi.student_data.max_time_allowed": ro(""),
    "cmi.student_data.time_limit_action": ro(""),
    "cmi.student_preference._children": keyword("audio,language,speed,text"),
    "cmi.student_preference.audio": rw(integer(-1, 100), "0"),
    "cmi.student_preference.language": rw(text(255), ""),
    "cmi.student_preference.speed": rw(integer(-100, 100), "0"),
    "cmi.student_preference.text": rw(integer(-1, 1), "0"),
    "cmi.interactions._children": keyword("id,objectives,time,type,correct_responses,weighting,student_response,result,latency"),
    "cmi.interactions._count": { a: "ro", k: true, count: "cmi.interactions" },
    "cmi.interactions.n.id": wo(text(255)),
    "cmi.interactions.n.objectives._count": { a: "ro", k: true, count: "objectives" },
    "cmi.interactions.n.objectives.n.id": wo(text(255)),
    "cmi.interactions.n.time": wo(TIME_12),
    "cmi.interactions.n.type": wo(vocab(["true-false", "choice", "fill-in", "matching", "performance", "sequencing", "likert", "numeric"])),
    "cmi.interactions.n.correct_responses._count": { a: "ro", k: true, count: "correct_responses" },
    "cmi.interactions.n.correct_responses.n.pattern": wo(text(4000)),
    "cmi.interactions.n.weighting": wo(real(null, null)),
    "cmi.interactions.n.student_response": wo(text(4000)),
    "cmi.interactions.n.result": wo(oneOf(vocab(["correct", "wrong", "unanticipated", "neutral"]), real(null, null))),
    "cmi.interactions.n.latency": wo(TIMESPAN_12)
  };

  var SUCCESS = ["passed", "failed", "unknown"];
  var COMPLETION = ["completed", "incomplete", "not attempted", "unknown"];
  var model2004 = {
    "cmi._version": keyword("1.0"),
    "cmi.comments_from_learner._children": keyword("comment,location,timestamp"),
    "cmi.comments_from_learner._count": { a: "ro", k: true, count: "cmi.comments_from_learner" },
    "cmi.comments_from_learner.n.comment": rw(text(4000)),
    "cmi.comments_from_learner.n.location": rw(text(250)),
    "cmi.comments_from_learner.n.timestamp": rw(TIMESTAMP),
    "cmi.comments_from_lms._children": keyword("comment,location,timestamp"),
    "cmi.comments_from_lms._count": keyword("0"),
    "cmi.completion_status": rw(vocab(COMPLETION), "unknown"),
    "cmi.completion_threshold": ro(undefined),
    "cmi.credit": ro("credit"),
    "cmi.entry": ro(config.entry),
    "cmi.exit": wo(vocab(["time-out", "suspend", "logout", "normal", ""])),
    "cmi.interactions._children": keyword("id,type,objectives,timestamp,correct_responses,weighting,learner_response,result,latency,description"),
    "cmi.interactions._count": { a: "ro", k: true, count: "cmi.interactions" },
    "cmi.interactions.n.id": rw(LONG_ID),
    "cmi.interactions.n.type": { a: "rw", t: vocab(["true-false", "choice", "fill-in", "long-fill-in", "matching", "performance", "sequencing", "likert", "numeric", "other"]), dep: "id" },
    "cmi.interactions.n.objectives._count": { a: "ro", k: true, count: "objectives" },
    "cmi.interactions.n.objectives.n.id": { a: "rw", t: LONG_ID, dep: "id" },
    "cmi.interactions.n.timestamp": { a: "rw", t: TIMESTAMP, dep: "id" },
    "cmi.interactions.n.correct_responses._count": { a: "ro", k: true, count: "correct_responses" },
    "cmi.interactions.n.correct_responses.n.pattern": { a: "rw", t: text(4000), dep: "id" },
    "cmi.interactions.n.weighting": { a: "rw", t: real(null, null), dep: "id" },
    "cmi.interactions.n.learner_response": { a: "rw", t: text(4000), dep: "id" },
    "cmi.interactions.n.result": { a: "rw", t: oneOf(vocab(["correct", "incorrect", "unanticipated", "neutral"]), real(null, null)), dep: "id" },
    "cmi.interactions.n.latency": { a: "rw", t: INTERVAL, dep: "id" },
    "cmi.interactions.n.description": { a: "rw", t: text(250), dep: "id" },
    "cmi.launch_data": ro(undefined),
    "cmi.learner_id": ro(config.learnerId),
    "cmi.learner_name": ro(config.learnerName),
    "cmi.learner_preference._children": keyword("audio_level,language,delivery_speed,audio_captioning"),
    "cmi.learner_preference.audio_level": rw(real(0, null), "1"),
    "cmi.learner_preference.language": rw(LANGUAGE, ""),
    "cmi.learner_preference.delivery_speed": rw(real(0, null), "1"),
    "cmi.learner_preference.audio_captioning": rw(vocab(["-1", "0", "1"]), "0"),
    "cmi.location": rw(text(1000)),
    "cmi.max_time_allowed": ro(undefined),
    "cmi.mode": ro("normal"),
    "cmi.objectives._children": keyword("id,score,success_status,completion_status,progress_measure,description"),
    "cmi.objectives._count": { a: "ro", k: true, count: "cmi.objectives" },
    "cmi.objectives.n.id": rw(LONG_ID),
    "cmi.objectives.n.score._children": keyword("scaled,raw,min,max"),
    "cmi.objectives.n.score.scaled": { a: "rw", t: real(-1, 1), dep: "id" },
    "cmi.objectives.n.score.raw": { a: "rw", t: real(null, null), dep: "id" },
    "cmi.objectives.n.score.min": { a: "rw", t: real(null, null), dep: "id" },
    "cmi.objectives.n.score.max": { a: "rw", t: real(null, null), dep: "id" },
    "cmi.objectives.n.success_status": { a: "rw", t: vocab(SUCCESS), d: "unknown", dep: "id" },
    "cmi.objectives.n.completion_status": { a: "rw", t: vocab(COMPLETION), d: "unknown", dep: "id" },
    "cmi.objectives.n.progress_measure": { a: "rw", t: real(0, 1), dep: "id" },
    "cmi.objectives.n.description": { a: "rw", t: text(250), dep: "id" },
    "cmi.progress_measure": rw(real(0, 1)),
    "cmi.scaled_passing_score": ro(undefined),
    "cmi.score._children": keyword("scaled,raw,min,max"),
    "cmi.score.scaled": rw(real(-1, 1)),
    "cmi.score.raw": rw(real(null, null)),
    "cmi.score.min": rw(real(null, null)),
    "cmi.score.max": rw(real(null, null)),
    "cmi.session_time": wo(INTERVAL),
    "cmi.success_status": rw(vocab(SUCCESS), "unknown"),
    "cmi.suspend_data": rw(text(64000)),
    "cmi.time_limit_action": ro("continue,no message"),
    "cmi.total_time": ro(totalTime2004(config.totalSeconds)),
    "adl.nav.request": rw(pattern(/^(continue|previous|exit|exitAll|abandon|abandonAll|suspendAll|_none_|\{target=[^}]+\}(choice|jump))$/), "_none_"),
    "adl.nav.request_valid.continue": ro("unknown"),
    "adl.nav.request_valid.previous": ro("unknown")
  };

  // Collection element names carry indices; rules are keyed with "n" in their place.
  function template(element) { return element.replace(/\.\d+(?=\.)/g, ".n"); }
  function lookup(model, element) {
    if (/^adl\.nav\.request_valid\.(choice|jump)\.\{target=[^}]+\}$/.test(element)) return ro("unknown");
    return Object.prototype.hasOwnProperty.call(model, template(element)) ? model[template(element)] : null;
  }
  // Number of items in a collection: one more than the highest stored index.
  function countOf(prefix) {
    var count = 0;
    var escaped = prefix.replace(/[.]/g, "\\.");
    var matcher = new RegExp("^" + escaped + "\\.(\\d+)\\.");
    Object.keys(values).forEach(function (key) {
      var match = matcher.exec(key);
      if (match) count = Math.max(count, parseInt(match[1], 10) + 1);
    });
    return count;
  }
  function countFor(element, rule) {
    if (rule.count.indexOf("cmi.") === 0) return countOf(rule.count);
    // Nested: "<collection>.<n>.objectives._count" -> items under that parent.
    return countOf(element.replace(/\._count$/, ""));
  }
  // Each index must already exist or be the next one; returns false otherwise.
  function indicesInOrder(element, forSet) {
    var parts = element.split(".");
    for (var i = 0; i < parts.length; i += 1) {
      if (!/^\d+$/.test(parts[i])) continue;
      var collection = parts.slice(0, i).join(".");
      var index = parseInt(parts[i], 10);
      var count = countOf(collection);
      var limitKey = collection.replace(/^cmi\./, "").replace(/\.\d+\./g, ".n.");
      var limit = MAX_ITEMS[limitKey] || 250;
      if (index > count || (!forSet && index >= count) || index >= limit) return false;
    }
    return true;
  }

  // --- API factory ---------------------------------------------------------------------------
  function createApi(version) {
    var is2004 = version === "2004";
    var model = is2004 ? model2004 : model12;
    var state = 0; // 0 not initialized, 1 running, 2 terminated
    var lastError = "0";
    var diagnostic = "";
    var MESSAGES = is2004
      ? { "0": "No Error", "101": "General Exception", "102": "General Initialization Failure", "103": "Already Initialized", "104": "Content Instance Terminated", "111": "General Termination Failure", "112": "Termination Before Initialization", "113": "Termination After Termination", "122": "Retrieve Data Before Initialization", "123": "Retrieve Data After Termination", "132": "Store Data Before Initialization", "133": "Store Data After Termination", "142": "Commit Before Initialization", "143": "Commit After Termination", "201": "General Argument Error", "301": "General Get Failure", "351": "General Set Failure", "391": "General Commit Failure", "401": "Undefined Data Model Element", "402": "Unimplemented Data Model Element", "403": "Data Model Element Value Not Initialized", "404": "Data Model Element Is Read Only", "405": "Data Model Element Is Write Only", "406": "Data Model Element Type Mismatch", "407": "Data Model Element Value Out Of Range", "408": "Data Model Dependency Not Established" }
      : { "0": "No error", "101": "General exception", "201": "Invalid argument error", "202": "Element cannot have children", "203": "Element not an array - cannot have count", "301": "Not initialized", "401": "Not implemented error", "402": "Invalid set value, element is a keyword", "403": "Element is read only", "404": "Element is write only", "405": "Incorrect data type" };
    var codes = is2004
      ? { initTwice: "103", initAfterEnd: "104", endBeforeInit: "112", endTwice: "113", getBeforeInit: "122", getAfterEnd: "123", setBeforeInit: "132", setAfterEnd: "133", commitBeforeInit: "142", commitAfterEnd: "143", argument: "201", undefined: "401", notInitialized: "403", readOnly: "404", writeOnly: "405", type: "406", range: "407", dependency: "408", getFailure: "301", setFailure: "351" }
      : { initTwice: "101", initAfterEnd: "101", endBeforeInit: "301", endTwice: "301", getBeforeInit: "301", getAfterEnd: "101", setBeforeInit: "301", setAfterEnd: "101", commitBeforeInit: "301", commitAfterEnd: "101", argument: "201", undefined: "401", notInitialized: "0", readOnly: "403", writeOnly: "404", type: "405", range: "405", dependency: "201", getFailure: "201", setFailure: "201", keyword: "402" };

    function fail(code, detail) { lastError = code; diagnostic = detail || ""; return "false"; }
    function ok() { lastError = "0"; diagnostic = ""; return "true"; }
    function emptyArg(value) { return value === "" || value === undefined || value === null; }

    function initialize(arg) {
      if (!emptyArg(arg)) return fail(codes.argument);
      if (state === 1) return fail(codes.initTwice);
      if (state === 2) return fail(codes.initAfterEnd);
      state = 1;
      post("initialize");
      return ok();
    }
    function terminate(arg) {
      if (!emptyArg(arg)) return fail(codes.argument);
      if (state === 0) return fail(codes.endBeforeInit);
      if (state === 2) return fail(codes.endTwice);
      state = 2;
      report("terminate");
      return ok();
    }
    function commit(arg) {
      if (!emptyArg(arg)) return fail(codes.argument);
      if (state === 0) return fail(codes.commitBeforeInit);
      if (state === 2) return fail(codes.commitAfterEnd);
      report("commit");
      return ok();
    }
    function getValue(element) {
      element = element === undefined || element === null ? "" : String(element);
      if (state === 0) { fail(codes.getBeforeInit); return ""; }
      if (state === 2) { fail(codes.getAfterEnd); return ""; }
      if (element === "") { fail(is2004 ? codes.getFailure : codes.argument); return ""; }
      var rule = lookup(model, element);
      if (!rule) {
        var parent = element.replace(/\.(_children|_count)$/, "");
        if (/\._children$/.test(element) && lookup(model, parent + ".n.id")) { fail(is2004 ? "301" : "202"); return ""; }
        if (/\._count$/.test(element) && lookup(model, parent)) { fail(is2004 ? "301" : "203"); return ""; }
        fail(codes.undefined, element); return "";
      }
      if (rule.a === "wo") { fail(codes.writeOnly, element); return ""; }
      if (/\.\d+\./.test(element) && !indicesInOrder(element, false)) { fail(codes.getFailure, element); return ""; }
      if (rule.count) { lastError = "0"; return String(countFor(element, rule)); }
      // Read-only elements always come from the LMS, never from stored values.
      if (rule.a !== "ro" && Object.prototype.hasOwnProperty.call(values, element)) { lastError = "0"; return values[element]; }
      if (rule.d === undefined) { fail(codes.notInitialized, element); return ""; }
      lastError = "0";
      return rule.d;
    }
    function setValue(element, value) {
      element = element === undefined || element === null ? "" : String(element);
      value = value === undefined || value === null ? "" : String(value);
      if (state === 0) return fail(codes.setBeforeInit);
      if (state === 2) return fail(codes.setAfterEnd);
      if (element === "") return fail(is2004 ? codes.setFailure : codes.argument);
      var rule = lookup(model, element);
      if (!rule) return fail(codes.undefined, element);
      if (rule.k) return fail(is2004 ? codes.readOnly : codes.keyword, element);
      if (rule.a === "ro") return fail(codes.readOnly, element);
      if (/\.\d+\./.test(element) && !indicesInOrder(element, true)) return fail(codes.setFailure, element);
      if (rule.dep) {
        var sibling = element.replace(/\.\d+\..*$/, function (match) { return match.split(".").slice(0, 2).join(".") + "." + rule.dep; });
        if (!Object.prototype.hasOwnProperty.call(values, sibling)) return fail(codes.dependency, element);
      }
      var problem = rule.t(value);
      if (problem) return fail(problem === "range" ? codes.range : codes.type, element);
      values[element] = value;
      touched[element] = true;
      dirty = true;
      return ok();
    }
    function errorString(code) { return MESSAGES[String(code)] || ""; }

    if (is2004) {
      return {
        Initialize: initialize, Terminate: terminate, GetValue: getValue, SetValue: setValue, Commit: commit,
        GetLastError: function () { return lastError; },
        GetErrorString: errorString,
        GetDiagnostic: function (code) { return diagnostic || errorString(code === undefined || code === "" ? lastError : code); }
      };
    }
    return {
      LMSInitialize: initialize, LMSFinish: terminate, LMSGetValue: getValue, LMSSetValue: setValue, LMSCommit: commit,
      LMSGetLastError: function () { return lastError; },
      LMSGetErrorString: errorString,
      LMSGetDiagnostic: function (code) { return diagnostic || errorString(code === undefined || code === "" ? lastError : code); }
    };
  }

  // Both APIs are offered: version detection from the manifest is heuristic, and each
  // writes its own namespace, which the server reads independently.
  window.API = createApi("1.2");
  window.API_1484_11 = createApi("2004");

  // --- Freshness: another document of this launch may have saved since this one was served.
  window.addEventListener("message", function (event) {
    var data = event.data;
    if (event.source !== player || !data || data.protocol !== config.playerProtocol) return;
    if (data.launchId !== config.launchId || data.type !== "state" || !data.values || typeof data.values !== "object") return;
    Object.keys(data.values).forEach(function (key) {
      if (!touched[key] && typeof data.values[key] === "string" && writable(key)) values[key] = data.values[key];
    });
  });
  // Content that sets values without committing still loses nothing when the page goes away.
  window.addEventListener("pagehide", function () { if (dirty) report("commit"); });
  post("hello");
})`;
