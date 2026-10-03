/**
 * One verification operation only. Supabase getClaims falls back to getUser for
 * symmetric tokens, after our live getUser has already checked that exact JWT.
 * Reuse that successful response once; never share this closure between requests.
 * The SDK still performs its expiry/signature checks and we still compare sub.
 */
export function sessionVerificationFetch(
  userEndpoint: string,
  fetcher: typeof fetch,
): typeof fetch {
  let verified: { key: string; response: Response } | undefined;
  return async (input, init) => {
    const request = new Request(input, init);
    if (request.method !== "GET" || request.url !== userEndpoint) {
      return fetcher(input, init);
    }
    const key = JSON.stringify([...request.headers.entries()]);
    if (verified?.key === key) {
      const response = verified.response;
      verified = undefined;
      return response;
    }
    verified = undefined;
    // Live authentication must bypass framework fetch caching too.
    const response = await fetcher(input, { ...init, cache: "no-store" });
    if (response.ok) verified = { key, response: response.clone() };
    return response;
  };
}
