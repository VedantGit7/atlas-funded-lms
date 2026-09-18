/**
 * Outbox worker entrypoint. Run with `pnpm worker:outbox`.
 *
 * This file exists only so `main.ts` stays importable by tests without the run
 * loop starting on import.
 */
import { bootstrap } from "./main";

bootstrap();
