/**
 * Cancellation token for async work started inside a `useEffect`.
 *
 * The idiomatic form is a plain local:
 *
 * ```ts
 * let cancelled = false;
 * void (async () => {
 *   const data = await load();
 *   if (cancelled) return;
 *   setState(data);
 * })();
 * return () => {
 *   cancelled = true;
 * };
 * ```
 *
 * That code is correct, but TypeScript does not invalidate narrowing for
 * assignments made inside a closure (microsoft/TypeScript#9998). It therefore
 * narrows `cancelled` to `false` for the whole effect body, and
 * `@typescript-eslint/no-unnecessary-condition` reports every guard as dead —
 * guards that in fact stop a state update after unmount. Deleting them to
 * satisfy the linter would reintroduce the race they exist to prevent.
 *
 * The flag is exposed as a *function* rather than a property on purpose. A
 * property is still narrowed by control flow, so an effect that checks twice
 * (once after the fetch, once after parsing) has its second check reported as
 * dead. A call expression is never narrowed, so every guard stays honest no
 * matter how many times it appears.
 */
export type CancellationToken = {
  /** True once the effect cleanup has run. */
  isCancelled: () => boolean;
  /** Call from the effect's cleanup function. */
  cancel: () => void;
};

export function cancellationFlag(): CancellationToken {
  let cancelled = false;
  return {
    isCancelled: () => cancelled,
    cancel: () => {
      cancelled = true;
    },
  };
}
