/**
 * The player's side of the SCORM runtime bridge.
 *
 * Package documents run in an opaque sandboxed origin with their own local
 * SCORM API (served by the API with each document). They report here over
 * `postMessage`; this module decides which messages to believe and turns them
 * into serialized, throttled progress saves. It never acts on anything else a
 * package sends: no URLs, no fetches, no navigation.
 */

export const SCORM_BRIDGE_PROTOCOL = "atlas-scorm";
export const SCORM_PLAYER_PROTOCOL = "atlas-scorm-player";

const MESSAGE_TYPES = ["hello", "initialize", "commit", "terminate"] as const;
export type ScormBridgeMessageType = (typeof MESSAGE_TYPES)[number];

export type ScormBridgeMessage = {
  type: ScormBridgeMessageType;
  values: Record<string, string> | null;
};

// Mirrors the progress endpoint's limits, so nothing is sent that it would reject.
const KEY = /^(?:cmi\.[A-Za-z0-9_.]{1,250}|adl\.nav\.request)$/;
const MAX_VALUE_LENGTH = 64_000;
const MAX_KEYS = 4_000;
const MAX_TOTAL_LENGTH = 1_000_000;
/** How far up the frame tree a package document may be nested. */
const MAX_FRAME_DEPTH = 8;

/**
 * True when `source` is the package iframe or a frame nested inside it.
 *
 * The sender's origin is "null" for every opaque document, so origin proves
 * nothing; what matters is which window sent it. `parent` is one of the few
 * properties readable across origins.
 */
export function isFromPackageFrame(source: unknown, frame: Window | null | undefined): boolean {
  if (!frame || !source || typeof source !== "object") return false;
  let current = source as Window;
  for (let depth = 0; depth <= MAX_FRAME_DEPTH; depth += 1) {
    if (current === frame) return true;
    let parent: Window;
    try {
      parent = current.parent;
    } catch {
      return false;
    }
    // A top-level window is its own parent.
    if (parent === current) return false;
    current = parent;
  }
  return false;
}

/** Validates shape and bounds; returns null for anything that is not this launch's protocol. */
export function parseScormBridgeMessage(
  data: unknown,
  launchId: string,
): ScormBridgeMessage | null {
  if (!data || typeof data !== "object") return null;
  const record = data as Record<string, unknown>;
  if (record["protocol"] !== SCORM_BRIDGE_PROTOCOL || record["version"] !== 1) return null;
  if (record["launchId"] !== launchId) return null;
  const type = record["type"];
  if (typeof type !== "string" || !(MESSAGE_TYPES as readonly string[]).includes(type)) return null;
  const raw = record["values"];
  if (raw === undefined) return { type: type as ScormBridgeMessageType, values: null };
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const entries = Object.entries(raw as Record<string, unknown>);
  if (entries.length > MAX_KEYS) return null;
  const values: Record<string, string> = {};
  let total = 0;
  for (const [key, value] of entries) {
    if (!KEY.test(key) || typeof value !== "string" || value.length > MAX_VALUE_LENGTH) return null;
    total += value.length;
    if (total > MAX_TOTAL_LENGTH) return null;
    values[key] = value;
  }
  return { type: type as ScormBridgeMessageType, values };
}

export type ScormSave = { cmi: Record<string, string>; terminated: boolean };

/**
 * Serializes saves: at most one in flight, at least `minIntervalMs` apart,
 * later values merged over earlier ones while waiting. A terminate is sent as
 * soon as the channel is free, and is never merged away.
 */
export class ScormSaveQueue {
  private pending: ScormSave | null = null;
  private inFlight = false;
  private lastSentAt = Number.NEGATIVE_INFINITY;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private disposed = false;
  private failures = 0;

  private readonly send: (save: ScormSave) => Promise<void>;
  private readonly options: {
    minIntervalMs: number;
    onError: (error: unknown) => void;
    now?: () => number;
  };

  constructor(send: (save: ScormSave) => Promise<void>, options: ScormSaveQueue["options"]) {
    this.send = send;
    this.options = options;
  }

  enqueue(save: ScormSave): void {
    if (this.disposed) return;
    this.pending = this.pending
      ? {
          cmi: { ...this.pending.cmi, ...save.cmi },
          terminated: this.pending.terminated || save.terminated,
        }
      : { cmi: { ...save.cmi }, terminated: save.terminated };
    this.schedule();
  }

  /** What has not been sent yet, for a last-chance keepalive save. */
  takePending(): ScormSave | null {
    const pending = this.pending;
    this.pending = null;
    return pending;
  }

  dispose(): void {
    this.disposed = true;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  private now(): number {
    return this.options.now?.() ?? Date.now();
  }

  private schedule(): void {
    if (this.inFlight || this.timer || !this.pending || this.disposed) return;
    // Back off while saves keep failing, so an outage is not hammered every interval.
    const interval = Math.min(this.options.minIntervalMs * 2 ** this.failures, 60_000);
    const wait =
      this.pending.terminated && this.failures === 0
        ? 0
        : Math.max(0, this.lastSentAt + interval - this.now());
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.flush();
    }, wait);
  }

  private async flush(): Promise<void> {
    const save = this.pending;
    if (!save || this.inFlight || this.disposed) return;
    this.pending = null;
    this.inFlight = true;
    this.lastSentAt = this.now();
    try {
      await this.send(save);
      this.failures = 0;
    } catch (error) {
      this.failures += 1;
      // Keep what failed, under anything newer, so the next save carries it.
      // (Read through a local: enqueue() may have run during the await.)
      const newer = this.pending as ScormSave | null;
      this.pending = newer
        ? {
            cmi: { ...save.cmi, ...newer.cmi },
            terminated: save.terminated || newer.terminated,
          }
        : save;
      this.options.onError(error);
    } finally {
      this.inFlight = false;
    }
    this.schedule();
  }
}
