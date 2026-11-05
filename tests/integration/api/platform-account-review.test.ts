import { randomUUID } from "node:crypto";
import { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { withGlobalDb } from "@atlas/db/global-db";
import { withPlatformScope, type PlatformTx } from "@atlas/db";
import { findActiveSessionPrincipal } from "@atlas/auth";
import {
  lookupPlatformAccount,
  setPlatformAccountStatus,
} from "../../../backend/apps/api/src/server/platform-identity/account-review.service";

/**
 * Audit H6: the platform decides account status. An operator finds the account
 * behind an email and disables or re-enables it, audited, never their own; a
 * disabled account gets no session principal until it is re-enabled.
 */

const suite =
  process.env.DATABASE_URL && process.env.PLATFORM_DATABASE_URL ? describe : describe.skip;

const emailPrefix = "h6-review-";
const freshEmail = () => `${emailPrefix}${randomUUID().slice(0, 12)}@example.test`;

const perStatement = {
  $queryRaw<T = unknown>(query: TemplateStringsArray, ...values: unknown[]): Promise<T> {
    return withGlobalDb((db) => db.$queryRaw<T>(query, ...values));
  },
};

suite("platform account review (audit H6)", () => {
  let owner: Client;
  let operatorId: string;
  const ctx = () => ({ platformPrincipalId: operatorId, requestId: randomUUID() });
  const asPlatform = <T>(fn: (tx: PlatformTx) => Promise<T>) =>
    withPlatformScope(
      {
        principalId: operatorId,
        requestId: randomUUID(),
        requiredPermission: "platform.identity.manage",
        platformPermissions: ["platform.identity.manage"],
      },
      "H6 account review integration test",
      fn,
    );

  async function activePrincipal(email: string): Promise<string> {
    const id = randomUUID();
    await owner.query(
      `insert into auth_principals (id, email, email_normalized, global_status, updated_at)
       values ($1, $2, $2, 'active', now())`,
      [id, email],
    );
    return id;
  }

  async function auditActions(principalId: string) {
    return asPlatform(
      (tx) =>
        tx.$queryRaw<Array<{ action: string }>>`
        select action from audit_entries where target_id = ${principalId} order by occurred_at
      `,
    );
  }

  beforeAll(async () => {
    owner = new Client({ connectionString: process.env.DATABASE_URL });
    await owner.connect();
    operatorId = await activePrincipal(freshEmail());
  });

  afterAll(async () => {
    await owner.query("delete from auth_principals where email_normalized like $1", [
      `${emailPrefix}%`,
    ]);
    await owner.end();
  });

  it("disables and re-enables an account, audited, and never the operator's own", async () => {
    const email = freshEmail();
    const principalId = await activePrincipal(email);

    expect((await asPlatform((tx) => lookupPlatformAccount(tx, email))).data).toMatchObject({
      id: principalId,
      status: "active",
    });

    const disabled = await asPlatform((tx) =>
      setPlatformAccountStatus(tx, ctx(), principalId, {
        status: "disabled",
        reason: "Ticket SUP-5: compromised account",
      }),
    );
    expect(disabled.data.status).toBe("disabled");
    await expect(
      findActiveSessionPrincipal({ db: perStatement, principalId }),
    ).rejects.toMatchObject({ code: "ACCOUNT_DISABLED" });

    await asPlatform((tx) =>
      setPlatformAccountStatus(tx, ctx(), principalId, {
        status: "active",
        reason: "Ticket SUP-5: owner verified, restored",
      }),
    );
    await expect(
      findActiveSessionPrincipal({ db: perStatement, principalId }),
    ).resolves.toMatchObject({ id: principalId });

    expect((await auditActions(principalId)).map((entry) => entry.action)).toEqual([
      "platform.identity.status_changed",
      "platform.identity.status_changed",
    ]);

    await expect(
      asPlatform((tx) =>
        setPlatformAccountStatus(tx, ctx(), operatorId, {
          status: "disabled",
          reason: "Ticket SUP-6: self-lockout attempt",
        }),
      ),
    ).rejects.toMatchObject({ status: 409 });
  });

  it("returns nothing for an email no account uses", async () => {
    expect((await asPlatform((tx) => lookupPlatformAccount(tx, freshEmail()))).data).toBeNull();
  });
});
