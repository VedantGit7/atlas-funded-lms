import { describe, expect, it } from "vitest";
import { withTenantTx } from "@atlas/db";
import {
  completePracticeSession,
  startPracticeSession,
  submitPracticeResponse,
} from "../../backend/apps/api/src/server/practice/practice.service";
import {
  authoringTenantTx,
  createPracticeFixture,
  instructorCtx,
  learnerCtx,
} from "../fixtures/practice-fixture";

const describeWithDb =
  process.env["DATABASE_URL"] && process.env["PLATFORM_DATABASE_URL"] ? describe : describe.skip;

describeWithDb("practice authorization", () => {
  it("denies foreign session response and completion", async () => {
    const fixture = await createPracticeFixture();
    const learner = learnerCtx(fixture, "req_practice_auth_learner");
    const foreign = instructorCtx(fixture, "req_practice_auth_foreign");

    const started = await withTenantTx(
      authoringTenantTx(fixture, fixture.learnerMembershipId),
      async (tx) =>
        startPracticeSession(tx, learner, { mode: "due", maxItems: 1 }, "auth-practice"),
    );

    const card = started.data.card;
    if (!card) {
      throw new Error("Expected a starting card.");
    }

    const itemId = card.itemId;

    await expect(
      withTenantTx(authoringTenantTx(fixture, fixture.instructorMembershipId), async (tx) =>
        submitPracticeResponse(
          tx,
          foreign,
          started.data.session.id,
          { itemId, action: "known" },
          "auth-response",
        ),
      ),
    ).rejects.toMatchObject({ status: 404 });

    await withTenantTx(authoringTenantTx(fixture, fixture.learnerMembershipId), async (tx) => {
      await submitPracticeResponse(
        tx,
        learner,
        started.data.session.id,
        { itemId, action: "known" },
        "auth-response-learner",
      );
    });

    await expect(
      withTenantTx(authoringTenantTx(fixture, fixture.instructorMembershipId), async (tx) =>
        completePracticeSession(tx, foreign, started.data.session.id, "auth-complete"),
      ),
    ).rejects.toMatchObject({ status: 404 });
  });
});
