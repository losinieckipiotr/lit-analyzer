export type LitHtmlAttributeModifier = "." | "?" | "@";

export const LIT_HTML_BOOLEAN_ATTRIBUTE_MODIFIER = "?";
export const LIT_HTML_EVENT_LISTENER_ATTRIBUTE_MODIFIER = "@";
export const LIT_HTML_PROP_ATTRIBUTE_MODIFIER = ".";

export const LIT_HTML_ATTRIBUTE_MODIFIERS: LitHtmlAttributeModifier[] = [
  LIT_HTML_PROP_ATTRIBUTE_MODIFIER,
  LIT_HTML_BOOLEAN_ATTRIBUTE_MODIFIER,
  LIT_HTML_EVENT_LISTENER_ATTRIBUTE_MODIFIER,
];

export const MAX_RUNNING_TIME_PER_OPERATION = 150; // Default to small timeouts. Opt in to larger timeouts where necessary.

export const TS_IGNORE_FLAG = "@ts-ignore";

// TODO: get version based on package.json during build
export const VERSION = "3.0.0";
