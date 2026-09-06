/** The same object with every explicitly-undefined key removed. */
type Defined<T> = { [K in keyof T]?: Exclude<T[K], undefined> };

/**
 * Under `exactOptionalPropertyTypes`, passing `{ title: undefined }` to Prisma
 * is a type error even though the intent is "leave this field alone". This
 * drops those keys instead of asking every call site to spell out conditionals.
 */
export function omitUndefined<T extends object>(value: T): Defined<T> {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined),
  ) as Defined<T>;
}
