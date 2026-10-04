import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import {
  assertPasswordNotBreached,
  isPasswordBreached,
  NEW_PASSWORD_MIN_LENGTH,
  readPasswordBreachCheckMode,
} from "@atlas/auth/password-policy";
import { publicSignupInputSchema } from "@atlas/auth/schemas";
import {
  NEW_PASSWORD_MIN_LENGTH as CONTRACT_MIN_LENGTH,
  PublicLoginRequestSchema,
  PublicPasswordResetCompleteSchema,
  PublicSignupRequestSchema,
} from "../../../backend/packages/domain/identity/src/schemas/public-auth";
import { ChangePasswordRequestSchema } from "../../../backend/packages/domain/identity/src/schemas/account-security";
import { SetInvitationPasswordRequestSchema } from "../../../backend/packages/domain/identity/src/schemas/invitation-public";
import { NEW_PASSWORD_MIN_LENGTH as FRONTEND_CONTRACT_MIN_LENGTH } from "../../../frontend/packages/contracts/src/domain-identity/schemas/public-auth";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function sha1(value: string): string {
  return createHash("sha1").update(value, "utf8").digest("hex").toUpperCase();
}

function rangeResponse(lines: string[], status = 200) {
  return vi.fn(async () => new Response(lines.join("\r\n"), { status }));
}

describe("new password policy (audit H6)", () => {
  it("uses one minimum everywhere a password is set, including Supabase config", () => {
    expect(NEW_PASSWORD_MIN_LENGTH).toBe(10);
    expect(CONTRACT_MIN_LENGTH).toBe(NEW_PASSWORD_MIN_LENGTH);
    expect(FRONTEND_CONTRACT_MIN_LENGTH).toBe(NEW_PASSWORD_MIN_LENGTH);
    const config = readFileSync(
      resolve(import.meta.dirname, "../../../supabase/config.toml"),
      "utf8",
    );
    expect(config).toMatch(
      new RegExp(`^minimum_password_length = ${String(NEW_PASSWORD_MIN_LENGTH)}$`, "m"),
    );
    expect(config).toMatch(/^enable_confirmations = true$/m);
    expect(config).toMatch(/^secure_password_change = true$/m);
  });

  it("rejects a nine-character password wherever one is set, but still lets it sign in", () => {
    const nine = "abcdefghi";
    expect(
      PublicSignupRequestSchema.safeParse({
        email: "a@example.com",
        password: nine,
        displayName: "Ann",
      }).success,
    ).toBe(false);
    expect(
      PublicPasswordResetCompleteSchema.safeParse({ password: nine, accessToken: "t" }).success,
    ).toBe(false);
    expect(
      ChangePasswordRequestSchema.safeParse({ currentPassword: "old-password", newPassword: nine })
        .success,
    ).toBe(false);
    expect(
      SetInvitationPasswordRequestSchema.safeParse({
        token: "t".repeat(32),
        accessToken: "a",
        password: nine,
      }).success,
    ).toBe(false);
    expect(
      publicSignupInputSchema.safeParse({ email: "a@example.com", password: nine }).success,
    ).toBe(false);
    expect(
      PublicLoginRequestSchema.safeParse({ email: "a@example.com", password: "abcdefgh" }).success,
    ).toBe(true);
  });

  it("finds a breached password by its hash suffix and sends only the five-character prefix", async () => {
    const password = "correct horse battery staple";
    const digest = sha1(password);
    const fetchImpl = rangeResponse([
      "0000000000000000000000000000000000A:0",
      `${digest.slice(5)}:42`,
    ]);

    await expect(isPasswordBreached(password, { fetchImpl, mode: "enforce" })).resolves.toBe(true);
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(`https://api.pwnedpasswords.com/range/${digest.slice(0, 5)}`);
    expect(url).not.toContain(digest.slice(5));
    expect(new Headers(init.headers).get("Add-Padding")).toBe("true");
  });

  it("treats padding rows (count 0) as not breached", async () => {
    const password = "a long unique passphrase 9f2";
    const fetchImpl = rangeResponse([`${sha1(password).slice(5)}:0`]);
    await expect(isPasswordBreached(password, { fetchImpl, mode: "enforce" })).resolves.toBe(false);
  });

  it("fails open when the lookup is unavailable", async () => {
    const down = vi.fn(async () => {
      throw new TypeError("fetch failed");
    });
    await expect(
      isPasswordBreached("whatever-password", { fetchImpl: down, mode: "enforce" }),
    ).resolves.toBe(false);
    await expect(
      isPasswordBreached("whatever-password", {
        fetchImpl: rangeResponse([], 503),
        mode: "enforce",
      }),
    ).resolves.toBe(false);
  });

  it("throws the generic policy rejection for a breached password", async () => {
    const password = "password1234";
    await expect(
      assertPasswordNotBreached(password, {
        fetchImpl: rangeResponse([`${sha1(password).slice(5)}:3`]),
        mode: "enforce",
      }),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR", status: 400 });
  });

  it("makes no request when the check is off", async () => {
    const fetchImpl = rangeResponse([]);
    await expect(isPasswordBreached("anything-at-all", { fetchImpl, mode: "off" })).resolves.toBe(
      false,
    );
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("defaults to off only in the test runtime", () => {
    expect(readPasswordBreachCheckMode({ NODE_ENV: "test" })).toBe("off");
    expect(readPasswordBreachCheckMode({ NODE_ENV: "production", APP_ENV: "production" })).toBe(
      "enforce",
    );
    expect(
      readPasswordBreachCheckMode({ NODE_ENV: "test", PASSWORD_BREACH_CHECK: "enforce" }),
    ).toBe("enforce");
    expect(
      readPasswordBreachCheckMode({ NODE_ENV: "production", PASSWORD_BREACH_CHECK: "off" }),
    ).toBe("off");
  });
});
