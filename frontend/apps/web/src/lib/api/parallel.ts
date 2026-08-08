/**
 * Run independent server loaders in parallel to avoid request waterfalls.
 *
 * @example
 * const [me, navigation] = await parallelLoad<[Me, Nav]>([
 *   () => serverApi.get("/api/v1/me"),
 *   () => loadLearnerNavigationProjection(),
 * ]);
 */
export async function parallelLoad<T extends readonly unknown[]>(
  loaders: { [K in keyof T]: () => Promise<T[K]> },
): Promise<T> {
  const results = await Promise.all(
    (loaders as ReadonlyArray<() => Promise<unknown>>).map((loader) => loader()),
  );
  return results as unknown as T;
}
