import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { magicLink } from "better-auth/plugins/magic-link";
import { twoFactor } from "better-auth/plugins/two-factor";
import { createUuidV7 } from "@atlas/core/id/uuid-v7";

import { ATLAS_SESSION_COOKIE, REFRESH_TOKEN_MAX_AGE_SECONDS } from "./cookie-names";
import { NEW_PASSWORD_MIN_LENGTH } from "./password-policy";

export { ATLAS_SESSION_COOKIE };

/** Sessions slide: one used on a new day is extended, at most one write a day. */
export const SESSION_EXPIRES_IN_SECONDS = REFRESH_TOKEN_MAX_AGE_SECONDS;
export const SESSION_UPDATE_AGE_SECONDS = 60 * 60 * 24;

/**
 * The endpoints whose new session has passed a second factor. Better Auth
 * creates a session here only after the TOTP or backup code is accepted; every
 * other path (password without MFA, Google, email codes) makes an aal1 session.
 */
const SECOND_FACTOR_SESSION_PATHS = new Set([
  "/two-factor/verify-totp",
  "/two-factor/verify-backup-code",
]);

export type AtlasAuthOptions = {
  /** `authPrisma()` from `@atlas/db/auth-client`, connected as atlas_auth. */
  prisma: Parameters<typeof prismaAdapter>[0];
  /** BETTER_AUTH_SECRET: signs cookies and encrypts authenticator secrets. */
  secret: string;
  /** Hosts this deployment answers for; the API refuses unknown hosts first. */
  allowedHosts: string[];
  /** `http` only for local hosts; deployments are always https. */
  protocol?: "http" | "https";
  /**
   * Receives each verification and password-reset email Better Auth asks for.
   * Our route sends it, with the academy's sender, after the call returns.
   */
  onAuthEmail?: (email: AuthEmail) => void;
  /** Whether the principal holds an unrevoked platform grant (audit H6). */
  hasActivePlatformGrant: (principalId: string) => Promise<boolean>;
  /** The Google OAuth client for this environment (launch plan 0.4); none on the platform. */
  google?: { clientId: string; clientSecret: string } | undefined;
};

/**
 * Better Auth's routes sit under /auth, so Google's redirect address is
 * `https://<academy>/auth/callback/google`, the one registered on the Google
 * clients (decision doc, "Google sign-in"). The web app's route of that name
 * hands the callback to the API.
 */
export const BETTER_AUTH_BASE_PATH = "/auth";

/** Where Better Auth sends a finished social sign-in or link; the API reads the redirect. */
export const OAUTH_DONE_PATH = "/auth/oauth/done";
export const OAUTH_LINKED_PATH = "/auth/oauth/linked";
export const OAUTH_ERROR_PATH = "/auth/oauth/error";

/** An email Better Auth asked us to send. The token is single-use and expires. */
export type AuthEmail = {
  /**
   * verify-email: confirm a new account's address. verify-new-email: confirm
   * the new address of an email change. confirm-email-change: ask the current
   * address to approve a change. magic-link: sign in without a password.
   */
  kind:
    | "verify-email"
    | "verify-new-email"
    | "confirm-email-change"
    | "magic-link"
    | "reset-password";
  email: string;
  token: string;
  /** For confirm-email-change: the address the account would move to. */
  newEmail?: string;
};

/**
 * Better Auth's verification token is a JWT; one for an email change names the
 * new address (`updateTo`). Read for the email's wording only, never trusted:
 * Better Auth verifies the token when the link is opened.
 */
function isEmailChangeToken(token: string): boolean {
  try {
    const payload: unknown = JSON.parse(
      Buffer.from(token.split(".")[1] ?? "", "base64url").toString("utf8"),
    );
    return typeof payload === "object" && payload !== null && "updateTo" in payload;
  } catch {
    return false;
  }
}

function refuseUnsentEmail(): never {
  throw new Error("Better Auth asked for an email outside a route that sends it");
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Better Auth on our existing tables (docs/engineering/better-auth-design.md).
 *
 * `auth_principals` is the user table, and the field names map Better Auth's
 * model onto the Prisma models in `backend/prisma/schema.prisma`. Called only
 * from our own route handlers through `auth.api.*`; its HTTP handler is not
 * mounted. The flows are configured in launch plan tasks 3.2 to 3.6.
 */
export function createAtlasAuth(options: AtlasAuthOptions) {
  const protocol = options.protocol ?? "https";
  const onAuthEmail = options.onAuthEmail ?? refuseUnsentEmail;

  return betterAuth({
    appName: "Atlas LMS",
    secret: options.secret,
    baseURL: { allowedHosts: options.allowedHosts, protocol },
    basePath: BETTER_AUTH_BASE_PATH,
    database: prismaAdapter(options.prisma, { provider: "postgresql", transaction: true }),
    telemetry: { enabled: false },
    advanced: {
      database: { generateId: () => createUuidV7() },
      useSecureCookies: protocol === "https",
      // Better Auth's own cookies (the pending two-factor challenge, "don't
      // remember me") are named atlas.*; the session cookie is atlas_session.
      cookiePrefix: "atlas",
      cookies: { session_token: { name: ATLAS_SESSION_COOKIE } },
    },
    emailAndPassword: {
      enabled: true,
      // A principal is only created for an address its owner has proven (H6).
      requireEmailVerification: true,
      minPasswordLength: NEW_PASSWORD_MIN_LENGTH,
      resetPasswordTokenExpiresIn: 60 * 60,
      // A reset ends every session, so a stolen one doesn't outlive it.
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: ({ user, token }) => {
        onAuthEmail({ kind: "reset-password", email: user.email, token });
        return Promise.resolve();
      },
    },
    emailVerification: {
      sendOnSignUp: true,
      autoSignInAfterVerification: true,
      expiresIn: 60 * 60 * 24,
      sendVerificationEmail: ({ user, token }) => {
        onAuthEmail({
          kind: isEmailChangeToken(token) ? "verify-new-email" : "verify-email",
          email: user.email,
          token,
        });
        return Promise.resolve();
      },
    },
    user: {
      modelName: "authPrincipal",
      // Two steps, like Supabase's secure email change: the current address
      // approves, then the new one is verified, and only then does it change.
      changeEmail: {
        enabled: true,
        sendChangeEmailConfirmation: ({ user, newEmail, token }) => {
          onAuthEmail({ kind: "confirm-email-change", email: user.email, token, newEmail });
          return Promise.resolve();
        },
      },
      fields: {
        emailVerified: "email_verified",
        createdAt: "created_at",
        updatedAt: "updated_at",
      },
      additionalFields: {
        emailNormalized: {
          type: "string",
          fieldName: "email_normalized",
          required: false,
          input: false,
          returned: false,
        },
        globalStatus: {
          type: "string",
          fieldName: "global_status",
          required: false,
          input: false,
          returned: false,
        },
        lastLoginAt: {
          type: "date",
          fieldName: "last_login_at",
          required: false,
          input: false,
          returned: false,
        },
      },
    },
    session: {
      modelName: "authSession",
      expiresIn: SESSION_EXPIRES_IN_SECONDS,
      // Our routes decide what is sensitive (MFA step-up, audit H4), not the
      // session's age: otherwise unlinking a login method failed a day after
      // sign-in.
      freshAge: 0,
      updateAge: SESSION_UPDATE_AGE_SECONDS,
      fields: {
        userId: "user_id",
        expiresAt: "expires_at",
        ipAddress: "ip_address",
        userAgent: "user_agent",
        createdAt: "created_at",
        updatedAt: "updated_at",
      },
      additionalFields: {
        assuranceLevel: {
          type: "string",
          fieldName: "assurance_level",
          required: false,
          input: false,
          defaultValue: "aal1",
        },
        mfaVerifiedAt: {
          type: "date",
          fieldName: "mfa_verified_at",
          required: false,
          input: false,
        },
      },
    },
    account: {
      modelName: "authAccount",
      encryptOAuthTokens: true,
      // Google signs in to an existing account only when Google has verified
      // the address and so have we (requireLocalEmailVerified, the default).
      // Listing Google as trusted would skip Google's half of that.
      accountLinking: { enabled: true, trustedProviders: [], allowDifferentEmails: false },
      fields: {
        userId: "user_id",
        accountId: "account_id",
        providerId: "provider_id",
        accessToken: "access_token",
        refreshToken: "refresh_token",
        idToken: "id_token",
        accessTokenExpiresAt: "access_token_expires_at",
        refreshTokenExpiresAt: "refresh_token_expires_at",
        createdAt: "created_at",
        updatedAt: "updated_at",
      },
    },
    verification: {
      modelName: "authVerification",
      fields: {
        expiresAt: "expires_at",
        createdAt: "created_at",
        updatedAt: "updated_at",
      },
    },
    ...(options.google
      ? {
          socialProviders: {
            google: {
              clientId: options.google.clientId,
              clientSecret: options.google.clientSecret,
              prompt: "select_account" as const,
              // A new account from an address Google hasn't verified gets no
              // session (audit H6): Better Auth sends our verification email.
              requireEmailVerification: true,
            },
          },
        }
      : {}),
    plugins: [
      // Sign-in links for existing accounts; signing up still needs a password.
      // The token is stored hashed, so the database alone can't sign anyone in.
      magicLink({
        disableSignUp: true,
        expiresIn: 60 * 10,
        storeToken: "hashed",
        sendMagicLink: ({ email, token }) => {
          onAuthEmail({ kind: "magic-link", email, token });
          return Promise.resolve();
        },
      }),
      twoFactor({
        issuer: "Atlas LMS",
        // A Google-only account has no password to confirm; one with a
        // password still confirms it to set up an authenticator.
        allowPasswordless: true,
        schema: {
          user: { fields: { twoFactorEnabled: "mfa_enabled" } },
          twoFactor: {
            modelName: "authTwoFactor",
            fields: {
              userId: "user_id",
              backupCodes: "backup_codes",
              failedVerificationCount: "failed_verification_count",
              lockedUntil: "locked_until",
            },
          },
        },
      }),
    ],
    databaseHooks: {
      user: {
        create: {
          before: (user) =>
            Promise.resolve({
              data: { ...user, emailNormalized: normalizeEmail(user.email) },
            }),
        },
        update: {
          before: (user) =>
            Promise.resolve(
              typeof user.email === "string"
                ? { data: { ...user, emailNormalized: normalizeEmail(user.email) } }
                : undefined,
            ),
        },
      },
      session: {
        create: {
          before: async (session, ctx) => {
            // A disabled principal gets no session. global_status is still read
            // on every request, as it is today.
            const principal: Record<string, unknown> | null | undefined =
              await ctx?.context.internalAdapter.findUserById(session.userId);
            if (!principal) return false;
            if (principal["globalStatus"] === "unclaimed") {
              // A placeholder made before its owner signed up (audit H6) is
              // claimed by its owner's first sign-in with a proven address,
              // unless it carries a platform grant.
              if (principal["emailVerified"] !== true) return false;
              if (await options.hasActivePlatformGrant(session.userId)) return false;
              await ctx?.context.internalAdapter.updateUser(session.userId, {
                globalStatus: "active",
              });
            } else if (principal["globalStatus"] !== "active") {
              return false;
            }

            const secondFactor = ctx !== null && SECOND_FACTOR_SESSION_PATHS.has(ctx.path);
            return {
              data: {
                ...session,
                assuranceLevel: secondFactor ? "aal2" : "aal1",
                mfaVerifiedAt: secondFactor ? new Date() : null,
              },
            };
          },
          after: async (session, ctx) => {
            await ctx?.context.internalAdapter.updateUser(session.userId, {
              lastLoginAt: new Date(),
            });
          },
        },
      },
    },
  });
}

export type AtlasAuth = ReturnType<typeof createAtlasAuth>;
