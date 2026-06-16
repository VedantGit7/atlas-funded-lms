import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { PrismaClient } from "./generated/prisma/client";

declare global {
  var __atlasPrisma: PrismaClient | undefined;
  var __atlasPgPool: Pool | undefined;
}

function getPool(): Pool {
  globalThis.__atlasPgPool ??= new Pool({
    connectionString: process.env["DATABASE_URL"],
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
