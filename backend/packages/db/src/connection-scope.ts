import { AsyncLocalStorage } from "node:async_hooks";

/**
 * One pooled connection per request path at a time (audit H3).
 *
 * `withGlobalDb` and `withTenantTx` draw from the same pool. A request that
 * opens one inside the other holds a connection while it waits for a second:
 * at DATABASE_POOL_MAX concurrent requests every one of them holds one and
 * waits for another, none can finish, and all fail at the connect timeout.
 * `createTenantRoute` measured 0 successful requests at 20 concurrent before
 * it was un-nested.
 *
 * Each helper records that its callback holds a connection, and refuses to
 * acquire another while one is held. Outside deployed runtimes that is an
 * error, so tests and local runs find every nested site, including indirect
 * ones a lexical check cannot see. Deployed runtimes log instead: a site that
 * was missed should be visible, not an outage.
 */
type HeldConnection = { helper: string; active: boolean };

const held = new AsyncLocalStorage<HeldConnection>();

export class NestedConnectionError extends Error {
  constructor(outer: string, inner: string) {
    super(
      `${inner} was called while ${outer} still holds a pooled connection. ` +
        "Finish (or return from) the outer callback first; see connection-scope.ts.",
    );
    this.name = "NestedConnectionError";
  }
}

const lastLoggedAt = new Map<string, number>();

function reportNested(outer: string, inner: string): void {
  if (process.env["NODE_ENV"] !== "production") throw new NestedConnectionError(outer, inner);
  const key = `${outer}>${inner}`;
  const now = Date.now();
  if (now - (lastLoggedAt.get(key) ?? Number.NEGATIVE_INFINITY) < 60_000) return;
  lastLoggedAt.set(key, now);
  console.error(
    JSON.stringify({
      level: "error",
      event: "db.nested_connection",
      outer,
      inner,
      // Function names and file positions only; no arguments or values.
      stack: new NestedConnectionError(outer, inner).stack?.split("\n").slice(2, 8),
    }),
  );
}

/** Call before acquiring a pooled connection. */
export function assertNoHeldConnection(helper: string): void {
  const current = held.getStore();
  // `active` is cleared when the holder finishes, so work it started that
  // outlives it (a detached promise) is not mistaken for nesting.
  if (current?.active) reportNested(current.helper, helper);
}

/** Runs `fn` as the holder of a pooled connection. */
export async function holdingConnection<T>(helper: string, fn: () => Promise<T>): Promise<T> {
  const scope: HeldConnection = { helper, active: true };
  try {
    return await held.run(scope, fn);
  } finally {
    scope.active = false;
  }
}
