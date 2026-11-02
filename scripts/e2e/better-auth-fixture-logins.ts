import {
  enableTwoFactor,
  verifySecondFactor,
  type AuthRequestContext,
} from "@atlas/auth/better-auth-flows";
import { betterAuthHeaders, getAtlasAuth } from "@atlas/auth/better-auth-runtime";
import { totp } from "./totp.mjs";

/**
 * The Better Auth half of a browser journey user (launch plan task 3.7): a
 * verified principal that signs in with the pipeline's password and, for the
 * admin and platform journeys, a verified authenticator. Everything goes
 * through Better Auth itself, as a real sign-up and enrollment would, so a
 * journey logs in exactly as a person does.
 */

type Accountable = {
  user: { id: string; emailVerified: boolean };
  accounts: { providerId: string }[];
};

function cookiePairs(setCookies: string[]): string {
  return setCookies
    .map((cookie) => cookie.split(";")[0] ?? "")
    .filter((pair) => pair && !pair.endsWith("="))
    .join("; ");
}

/**
 * Creates the login, or resets its password so the credential the pipeline
 * holds is always the one that works. Idempotent, and keeps the principal's
 * id, so memberships and grants from an earlier run still apply.
 */
export async function upsertFixtureLogin(email: string, password: string): Promise<string> {
  const context = await getAtlasAuth().$context;
  const found = (await context.internalAdapter.findUserByEmail(email, {
    includeAccounts: true,
  })) as Accountable | null;
  const user =
    found?.user ??
    (await context.internalAdapter.createUser(
      { email, name: "", emailVerified: true },
      { method: "email-password" },
    ));
  // A principal from an earlier login system, or a disabled fixture: active
  // and verified again, as the pipeline expects.
  await context.internalAdapter.updateUser(user.id, {
    emailVerified: true,
    globalStatus: "active",
  });

  const hash = await context.password.hash(password);
  if (found?.accounts.some((account) => account.providerId === "credential")) {
    await context.internalAdapter.updatePassword(user.id, hash);
  } else {
    await context.internalAdapter.linkAccount({
      userId: user.id,
      providerId: "credential",
      accountId: user.id,
      password: hash,
    });
  }
  return user.id;
}

/**
 * Replaces the principal's authenticator with a new, verified one and returns
 * its secret, which the journeys turn into codes at the challenge. A real
 * enrollment: sign in, set up the app, confirm it with a code.
 */
export async function enrolFixtureAuthenticator(args: {
  principalId: string;
  email: string;
  password: string;
  host: string;
}): Promise<string> {
  const auth = getAtlasAuth();
  const context = await auth.$context;
  // The old factor goes first, so the sign-in below isn't stopped at a challenge.
  await context.adapter.deleteMany({
    model: "twoFactor",
    where: [{ field: "userId", value: args.principalId }],
  });
  await context.internalAdapter.updateUser(args.principalId, { twoFactorEnabled: false });

  const signedIn = await auth.api.signInEmail({
    body: { email: args.email, password: args.password },
    headers: betterAuthHeaders({ host: args.host, userAgent: "atlas-e2e-seed" }),
    returnHeaders: true,
  });
  const ctx: AuthRequestContext = {
    host: args.host,
    cookie: cookiePairs(signedIn.headers.getSetCookie()),
    userAgent: "atlas-e2e-seed",
  };
  const enabled = await enableTwoFactor({ ctx, password: args.password });
  await verifySecondFactor({ ctx, code: totp(enabled.secret) });

  // The seeding sessions aren't the journeys'; they end here.
  await context.internalAdapter.deleteUserSessions(args.principalId);
  return enabled.secret;
}
