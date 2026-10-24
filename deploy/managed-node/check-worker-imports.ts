import { main } from "../../backend/apps/api/src/worker/main";
import { OUTBOX_PROCESSORS } from "../../backend/apps/api/src/worker/outbox-processors";
import { PrismaClient } from "@atlas/db/generated/prisma/client";
import { drainTenantUsageEvents } from "@atlas/api/tenant-usage-meter";

// Import the real worker graph with its production loader/configuration. No
// bootstrap, database request or external provider call runs during this check.
// Deployed workers also load Sentry (main.ts), which this check's test
// environment otherwise skips; the error capture helper requires the same
// module. With no DSN set, Sentry initializes disabled.
await import("../../backend/apps/api/sentry.server.config");

if (
  typeof main !== "function" ||
  typeof PrismaClient !== "function" ||
  typeof drainTenantUsageEvents !== "function" ||
  !OUTBOX_PROCESSORS.some((processor) => processor.name === "scorm")
) {
  throw new Error("Worker runtime imports are incomplete");
}
console.info(
  JSON.stringify({
    check: "worker-runtime-imports",
    passed: true,
    processors: OUTBOX_PROCESSORS.length,
  }),
);
process.exit(0);
