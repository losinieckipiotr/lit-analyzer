/**
 * Compares two strings case insensitive.
 */
export function caseInsensitiveEquals(strA: string, strB: string): boolean {
  return strA.localeCompare(strB, undefined, { sensitivity: "accent" }) === 0;
}

/**
 * Replaces the given prefix in the string with an empty string.
 */
export function replacePrefix(str: string, prefix: string): string {
  return str.replace(new RegExp("^" + escapeRegExp(prefix)), "");
}

function escapeRegExp(text: string): string {
  return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
}

/**
 * Converts from camel case to snake case.
 */
export function camelToDashCase(str: string): string {
  return str.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
}

/**
 * Converts from snake case to camel case
 * @param str
 */
export function dashToCamelCase(str: string): string {
  return str.replace(/(-\w)/g, (m) => m[1].toUpperCase());
}

/**
 * Returns if a name is private (starts with "_" or "#").
 */
export function isNamePrivate(name: string): boolean {
  return name.startsWith("_") || name.startsWith("#");
}
