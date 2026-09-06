import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';
import { env, isProduction } from '../env.js';

/**
 * Prisma 7 talks to Postgres through a driver adapter instead of a bundled
 * query engine, so the connection string lives here rather than in the schema.
 */
const adapter = new PrismaPg(env.DATABASE_URL);

export const prisma = new PrismaClient({
  adapter,
  log: isProduction ? ['warn', 'error'] : ['warn', 'error'],
});

export type Db = typeof prisma;
