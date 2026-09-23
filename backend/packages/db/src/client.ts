import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { PrismaClient } from "./generated/prisma/client";
import { connectionTimeoutMillis, instrumentPool } from "./pool-instrumentation";

declare global {
  var __atlasPrisma: PrismaClient | undefined;
  var __atlasPgPool: Pool | undefined;
}

function getPool(): Pool {
  const max = Number.parseInt(process.env["DATABASE_POOL_MAX"] ?? "20", 10);

  globalThis.__atlasPgPool ??= new Pool({
    connectionString: process.env["DATABASE_URL"],
    // Admin/studio shells fire several parallel authenticated probes; the default
    // pg pool size of 10 starves under that fan-out and cascades into ITX timeouts.
    max: Number.isFinite(max) && max > 0 ? max : 20,
    connectionTimeoutMillis: connectionTimeoutMillis(process.env["DATABASE_CONNECTION_TIMEOUT_MS"]),
  });
  instrumentPool(globalThis.__atlasPgPool, {
    enabled: process.env["DATABASE_POOL_METRICS"] === "1",
    poolName: "tenant",
  });
  return globalThis.__atlasPgPool;
}

function createPrismaClient(): PrismaClient {
  const adapter = new PrismaPg(getPool());

  return new PrismaClient({
    adapter,
    log: process.env["NODE_ENV"] === "development" ? ["query", "error", "warn"] : ["error"],
  });
}

export const prisma = globalThis.__atlasPrisma ?? createPrismaClient();

if (process.env["NODE_ENV"] !== "production") {
  globalThis.__atlasPrisma = prisma;
}

export type AtlasPrismaClient = typeof prisma;
