import type { Prisma } from '../generated/prisma/client.js';

/**
 * Prisma's JSON column input requires a value with a string index signature,
 * which a precise interface never has. The round-trip through JSON is not a
 * cast for the sake of the compiler: it is exactly what the driver stores, so
 * anything that cannot survive it (a Date, a Map, undefined) is dropped here
 * rather than silently mangled inside the database.
 */
export function toJsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}
