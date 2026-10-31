import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { PrismaClient } from "./generated/prisma/client";
import { connectionTimeoutMillis, instrumentPool } from "./pool-instrumentation";
import { prismaLogLevels } from "./prisma-logging";

declare global {
  var __atlasAuthPrisma: PrismaClient | undefined;
}

/**
 * Better Auth's database client (docs/engineering/better-auth-design.md).
 *
 * Its own small pool, whose connections start as `atlas_auth` through the
 * `role` startup parameter: the only role that may read password hashes,
 * authenticator secrets and session tokens. The API's login may switch to it
 * but does not inherit it, so nothing else on this login can read them. Every
 * Better Auth query, including its interactive transactions, runs as that
 * role without a SET ROLE of its own.
 *
 * Created on first use, so processes that never authenticate (the worker, the
 * migration job) open no connection for it.
 */
export function authPrisma(connectionString = process.env["DATABASE_URL"]): PrismaClient {
  if (globalThis.__atlasAuthPrisma) return globalThis.__atlasAuthPrisma;

  const max = Number.parseInt(process.env["AUTH_DATABASE_POOL_MAX"] ?? "5", 10);
  const pool = new Pool({
    connectionString,
    options: "-c role=atlas_auth",
    max: Number.isFinite(max) && max > 0 ? max : 5,
    connectionTimeoutMillis: connectionTimeoutMillis(process.env["DATABASE_CONNECTION_TIMEOUT_MS"]),
  });
  instrumentPool(pool, {
    enabled: process.env["DATABASE_POOL_METRICS"] === "1",
    poolName: "auth",
  });

  globalThis.__atlasAuthPrisma = new PrismaClient({
    adapter: new PrismaPg(pool),
    log: prismaLogLevels(),
  });
  return globalThis.__atlasAuthPrisma;
}

/** Tests point the client at their own database and close it afterwards. */
export async function closeAuthPrismaForTests(): Promise<void> {
  const client = globalThis.__atlasAuthPrisma;
  globalThis.__atlasAuthPrisma = undefined;
  await client?.$disconnect();
}
