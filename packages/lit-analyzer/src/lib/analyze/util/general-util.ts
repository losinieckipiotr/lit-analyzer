/* eslint-disable @typescript-eslint/no-explicit-any */
import { LitHtmlAttributeModifier } from "../constants.js";

export type Newable<T> = { new (...args: any[]): T };
export type Omit<T, K extends keyof T> = Pick<T, Exclude<keyof T, K>>;

/**
 * Parses an attribute name returning a name and eg. a modifier.
 * Examples:
 *  - ?disabled="..."
 *  - .myProp="..."
 *  - @click="..."
 * @param attributeName
 */
export function parseLitAttrName(attributeName: string): {
  name: string;
  modifier?: LitHtmlAttributeModifier;
} {
  const [, modifier, name] = attributeName.match(/^([.?@])?(.*)/) || [
    "",
    "",
    "",
  ];
  return { name, modifier: modifier as LitHtmlAttributeModifier };
}

export function lazy<T extends (...args: unknown[]) => unknown>(func: T): T {
  // FIXME: disabled cache for now
  // let called = false;
  // let value: unknown;

  return ((...args: unknown[]) => {
    // if (!called) {
    //   called = true;
    //   value = func(...args);
    // }

    // return value;
    return func(...args);
  }) as T;
}
