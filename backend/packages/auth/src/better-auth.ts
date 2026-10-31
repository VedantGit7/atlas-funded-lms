import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { twoFactor } from "better-auth/plugins/two-factor";
import { createUuidV7 } from "@atlas/core/id/uuid-v7";

import { REFRESH_TOKEN_MAX_AGE_SECONDS } from "./cookie-names";
import { NEW_PASSWORD_MIN_LENGTH } from "./password-policy";

/** Replaces atlas_access_token and atlas_refresh_token (design note, section 1). */
export const ATLAS_SESSION_COOKIE = "atlas_session";

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
};

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

  return betterAuth({
    appName: "Atlas LMS",
    secret: options.secret,
    baseURL: { allowedHosts: options.allowedHosts, protocol },
    database: prismaAdapter(options.prisma, { provider: "postgresql", transaction: true }),
    telemetry: { enabled: false },
    advanced: {
      database: { generateId: () => createUuidV7() },
      useSecureCookies: protocol === "https",
      cookies: { session_token: { name: ATLAS_SESSION_COOKIE } },
    },
    emailAndPassword: {
      enabled: true,
      // A principal is only created for an address its owner has proven (H6).
      requireEmailVerification: true,
      minPasswordLength: NEW_PASSWORD_MIN_LENGTH,
    },
    user: {
      modelName: "authPrincipal",
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
      },
    },
    session: {
      modelName: "authSession",
      expiresIn: SESSION_EXPIRES_IN_SECONDS,
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
    plugins: [
      twoFactor({
        issuer: "Atlas LMS",
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
            // A disabled or unclaimed principal gets no session. global_status
            // is still read on every request, as it is today.
            const principal: Record<string, unknown> | null | undefined =
              await ctx?.context.internalAdapter.findUserById(session.userId);
            if (!principal || principal["globalStatus"] !== "active") return false;

            const secondFactor = ctx !== null && SECOND_FACTOR_SESSION_PATHS.has(ctx.path);
            return {
              data: {
                ...session,
                assuranceLevel: secondFactor ? "aal2" : "aal1",
                mfaVerifiedAt: secondFactor ? new Date() : null,
              },
            };
          },
        },
      },
    },
  });
}

export type AtlasAuth = ReturnType<typeof createAtlasAuth>;
