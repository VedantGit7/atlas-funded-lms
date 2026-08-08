"use server";

import { loadActiveSupportSessionsProjection as loadSupportSessions } from "./platform-internal-read";
import { loadDeadLetterListProjection as loadDeadLetters } from "./platform-internal-read";

type DeadLetterListQuery = {
  limit?: number;
  cursor?: string;
};

export async function loadActiveSupportSessionsAction(reason: string) {
  return loadSupportSessions(reason);
}

export async function loadDeadLetterListAction(reason: string, query: DeadLetterListQuery) {
  return loadDeadLetters(reason, query);
}
