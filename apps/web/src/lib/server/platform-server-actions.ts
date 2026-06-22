"use server";

import { loadActiveSupportSessionsProjection as loadSupportSessions } from "./platform-internal-read";
import { loadDeadLetterListProjection as loadDeadLetters } from "./platform-internal-read";
import type { DeadLetterListQuery } from "@atlas/events/schemas/dead-letter-list";

export async function loadActiveSupportSessionsAction(reason: string) {
  return loadSupportSessions(reason);
}

export async function loadDeadLetterListAction(reason: string, query: DeadLetterListQuery) {
  return loadDeadLetters(reason, query);
}
