import { PrismaClient } from "@prisma/client";
import { loadDatabaseEnv } from "./load-database-env";

loadDatabaseEnv();

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
