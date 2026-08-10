import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { PrismaClient } from "./generated/prisma/client";

declare global {
  var __atlasPlatformPrisma: PrismaClient | undefined;
  var __atlasPlatformPgPool: Pool | undefined;
}

export class PlatformDatabaseConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PlatformDatabaseConfigError";
  }
}

function getPlatformPool(): Pool {
  const platformDatabaseUrl = process.env["PLATFORM_DATABASE_URL"];

  if (!platformDatabaseUrl) {
    throw new PlatformDatabaseConfigError(
      "Missing PLATFORM_DATABASE_URL for platform database access",
    );
  }

  const max = Number.parseInt(process.env["PLATFORM_DATABASE_POOL_MAX"] ?? "10", 10);

  globalThis.__atlasPlatformPgPool ??= new Pool({
    connectionString: platformDatabaseUrl,
    max: Number.isFinite(max) && max > 0 ? max : 10,
  });
  return globalThis.__atlasPlatformPgPool;
}

function createPlatformPrisma(): PrismaClient {
  const adapter = new PrismaPg(getPlatformPool());

  return new PrismaClient({
    adapter,
    log: process.env["NODE_ENV"] === "development" ? ["query", "error", "warn"] : ["error"],
  });
}

export function getPlatformPrisma(): PrismaClient {
  globalThis.__atlasPlatformPrisma ??= createPlatformPrisma();
  return globalThis.__atlasPlatformPrisma;
}
