import type { BetterAuthSessionUser } from "./better-auth-runtime";

export type SessionAssuranceLevel = "aal1" | "aal2" | null;

/** The signed-in user: the principal behind a Better Auth session. */
export type SessionUser = BetterAuthSessionUser;
