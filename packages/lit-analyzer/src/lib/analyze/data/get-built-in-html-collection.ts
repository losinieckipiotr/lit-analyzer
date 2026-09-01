import { UnionType } from "typescript";
import type { HTMLDataV1 } from "../data/html-data-types.js";
import {
  HtmlAttr,
  HtmlDataCollection,
} from "../parse/parse-html-data/html-tag.js";
// FIXME:
// "@vscode/web-custom-data": "^0.6.3",
// @vscode/web-custom-data/data/browsers.html-data.json
import { SimpleTypeContext } from "../../../web-component-analyzer/src/simple-type.js";
import { parseVscodeHtmlData } from "../parse/parse-html-data/parse-vscode-html-data.js";
import { browsersHtmlData } from "./browsers-html-data.js";
import {
  EXTRA_HTML5_EVENTS,
  hasTypeForAttrName,
  html5TagAttrType,
} from "./extra-html-data.js";

export function getBuiltInHtmlCollection(
  simpleTypeContext: SimpleTypeContext,
): HtmlDataCollection {
  // FIXME: no type validation here
  const vscodeHtmlData = browsersHtmlData as HTMLDataV1;
  const version = vscodeHtmlData.version;
  const globalAttributes = [...(vscodeHtmlData.globalAttributes ?? [])];

  // Modify valueSets
  const valueSets = (vscodeHtmlData.valueSets || []).map((valueSet) => {
    // It seems like the autocompletion value map for <select>, <textarea> and <input> needs "on" and "off" values
    if (valueSet.name === "inputautocomplete") {
      return {
        ...valueSet,
        values: [{ name: "on" }, { name: "off" }, ...valueSet.values],
      };
    }

    return valueSet;
  });

  // Modify tags
  const tags = (vscodeHtmlData.tags || []).map((tag) => {
    switch (tag.name) {
      case "audio":
        return {
          ...tag,
          attributes: [
            ...tag.attributes,
            {
              name: "controlslist",
              description: "",
            },
          ],
        };

      case "video":
        return {
          ...tag,
          attributes: [
            ...tag.attributes,
            {
              name: "controlslist",
              description: "",
            },
            {
              name: "disablepictureinpicture",
              valueSet: "v", // "v" is the undocumented boolean type
            },
            {
              name: "playsinline",
              description:
                'The playsinline attribute is a boolean attribute. If present, it serves as a hint to the user agent that the video ought to be displayed "inline" in the document by default, constrained to the element\'s playback area, instead of being displayed fullscreen or in an independent resizable window.',
              valueSet: "v", // "v" is the undocumented boolean type
            },
          ],
        };
    }

    return tag;
  });

  // Add missing html tags
  tags.push(
    {
      name: "svg",
      attributes: [],
    },
    {
      name: "slot",
      description: "",
      attributes: [
        {
          name: "name",
          description: "",
        },
        {
          name: "onslotchange",
          description:
            "The slotchange event is fired on an HTMLSlotElement instance (<slot> element) when the node(s) contained in that slot change.\n\nNote: the slotchange event doesn't fire if the children of a slotted node change — only if you change (e.g. add or delete) the actual nodes themselves.",
        },
      ],
    },
  );

  // Add missing global attributes
  globalAttributes.push(
    // Combine data with extra html5 events because vscode-html-language-service hasn't included all events yet.
    ...EXTRA_HTML5_EVENTS.filter((evt) =>
      globalAttributes.some((existingEvt) => existingEvt.name === evt.name),
    ),
    {
      name: "tabindex",
      description: "",
    },
    {
      name: "slot",
      description: "",
    },
    {
      name: "part",
      description: `This attribute specifies a "styleable" part on the element in your shadow tree.`,
    },
    {
      name: "theme",
      description: `This attribute specifies a global "styleable" part on the element.`,
    },
    {
      name: "exportparts",
      description: `This attribute is used to explicitly forward a child’s part to be styleable outside of the parent’s shadow tree.

The value must be a comma-separated list of part mappings:
  - "some-box, some-input"
  - "some-input: foo-input"
`,
    },
  );

  const { checker, ts } = simpleTypeContext;

  // Parse vscode html data
  const result = parseVscodeHtmlData(
    {
      version,
      globalAttributes,
      tags,
      valueSets,
    },
    simpleTypeContext,
    {
      builtIn: true,
    },
  );

  // Add missing properties to the result, because they are not included in vscode html data
  for (const tag of result.tags) {
    switch (tag.tagName) {
      case "textarea":
        tag.properties.push({
          kind: "property",
          name: "value",
          builtIn: true,
          fromTagName: "textarea",
          getType: () => {
            const union: UnionType = {
              ...checker.getAnyType(),
              flags: ts.TypeFlags.Union,
              types: [checker.getStringType(), checker.getNullType()],
            };

            return union;
          },
        });
        break;

      case "img":
        tag.attributes.push({
          kind: "attribute",
          name: "loading",
          builtIn: true,
          fromTagName: "img",
          getType: () => {
            const union: UnionType = {
              ...checker.getAnyType(),
              flags: ts.TypeFlags.Union,
              types: [
                checker.getStringLiteralType("lazy"),
                checker.getStringLiteralType("auto"),
                checker.getStringLiteralType("eager"),
              ],
            };

            return union;
          },
        });
        break;

      case "input":
        tag.properties.push({
          kind: "property",
          name: "value",
          builtIn: true,
          fromTagName: "input",
          getType: () => {
            const union: UnionType = {
              ...checker.getAnyType(),
              flags: ts.TypeFlags.Union,
              types: [checker.getStringType(), checker.getNullType()],
            };

            return union;
          },
        });
        break;
    }
  }

  // Add missing global properties to the result
  result.global.properties = [
    ...(result.global.properties || []),
    {
      builtIn: true,
      description: `This attribute specifies a "styleable" part on the element in your shadow tree.`,
      getType: () => checker.getStringType(),
      kind: "property",
      name: "part",
    },
  ];

  const addMissingAttrTypes = (attrs: HtmlAttr[]): HtmlAttr[] => {
    return attrs.map((attr) => {
      const attrType = attr.getType();

      if (
        hasTypeForAttrName(attr.name) ||
        (attrType.flags & checker.getAnyType().flags) !== 0
      ) {
        return {
          ...attr,
          getType: () => html5TagAttrType(attr.name),
        };
      }

      return attr;
    });
  };

  return {
    ...result,
    tags: result.tags.map((tag) => ({
      ...tag,
      builtIn: true,
      attributes: addMissingAttrTypes(
        tag.attributes.map((attr) => ({ ...attr, builtIn: true })),
      ),
    })),
    global: {
      ...result.global,
      attributes: addMissingAttrTypes(
        result.global.attributes?.map((attr) => ({ ...attr, builtIn: true })) ||
          [],
      ),
      events: result.global.events?.map((event) => ({
        ...event,
        builtIn: true,
      })),
    },
  };
}
