export const OAUTH_REMEMBER_COOKIE = "atlas_oauth_remember";
export const OAUTH_NEXT_COOKIE = "atlas_oauth_next";
/**
 * When "I agree" was ticked on the sign-up page before going to Google (launch
 * plan 5.7). Set only by a sign-up start, read once by the callback.
 */
export const OAUTH_TERMS_COOKIE = "atlas_oauth_terms";

export { resolveRequestOrigin } from "@/lib/server/resolve-request-origin";
