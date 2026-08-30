/**
 * Filters an array returning only defined items.
 */
export function arrayDefined<T>(array: (T | undefined)[]): T[] {
  return array.filter((item): item is NonNullable<typeof item> => !!item);
}

/**
 * Joins an array with a custom final splitter.
 */
export function joinArray(
  items: string[],
  splitter = ", ",
  finalSplitter = "or",
): string {
  return items.join(splitter).replace(/, ([^,]*)$/, ` ${finalSplitter} $1`);
}
