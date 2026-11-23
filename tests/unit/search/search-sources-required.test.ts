import { describe, expect, it } from "vitest";
import type { TenantTx } from "@atlas/db";
import { querySearch } from "@atlas/domain/search/search.service";

/**
 * QA review 1 C9: with no search sources loaded, every result was dropped and
 * search quietly returned nothing. It now fails loudly instead, so a process
 * that forgets to load the sources shows up as an error, not as empty results.
 * (This file deliberately loads no sources.)
 */
describe("search without its sources", () => {
  it("fails loudly instead of returning nothing", async () => {
    await expect(
      querySearch(
        {} as TenantTx,
        { tenantId: "t", actorMembershipId: "m", requestId: "r" },
        {
          q: "candles",
        },
      ),
    ).rejects.toThrow("SEARCH_SOURCES_NOT_REGISTERED");
  });
});
