import { MarkupContent } from "vscode-languageserver-types";
import {
  SimpleType,
  SimpleTypeKind,
  SimpleTypeStringLiteral,
} from "../../../../web-component-analyzer/src/api.js";
import type {
  HTMLDataV1,
  IAttributeData,
  ITagData,
  IValueData,
} from "../../data/html-data-types.js";
import {
  HtmlAttr,
  HtmlDataCollection,
  HtmlEvent,
  HtmlTag,
} from "./html-tag.js";

export interface ParseVscodeHtmlDataConfig {
  builtIn?: boolean;
  typeMap?: Map<string, SimpleType>;
}

export function parseVscodeHtmlData(
  data: HTMLDataV1,
  config: ParseVscodeHtmlDataConfig = {},
): HtmlDataCollection {
  switch (data.version) {
    case 1:
    case 1.1:
      return parseVscodeDataV1(data, config);
  }
}

function parseVscodeDataV1(
  data: HTMLDataV1,
  config: ParseVscodeHtmlDataConfig,
): HtmlDataCollection {
  const { valueSets = [], globalAttributes = [], tags = [] } = data;

  const valueSetTypeMap = new Map(
    valueSets.map((valueSet) => {
      const { name, values } = valueSet;

      return [name, attrValuesToUnion(values)];
    }),
  );
  valueSetTypeMap.set("v", { kind: SimpleTypeKind.BOOLEAN });

  const { typeMap, builtIn } = config;

  // Transfer existing typemap to new typemap
  if (typeMap) {
    for (const [k, v] of typeMap.entries()) {
      valueSetTypeMap.set(k, v);
    }
  }

  const newConfig: ParseVscodeHtmlDataConfig = {
    typeMap: valueSetTypeMap,
    builtIn,
  };

  const globalAttributesParsed = globalAttributes.map((tagDataAttr) =>
    tagDataToHtmlTagAttr(tagDataAttr, newConfig),
  );

  const globalEvents = attrsToEvents(globalAttributesParsed).map((evt) => {
    return Object.assign({}, evt, { global: true });
  });

  const tagsParsed = tags.map((tagData) =>
    tagDataToHtmlTag(tagData, newConfig),
  );

  return {
    tags: tagsParsed,
    global: {
      attributes: globalAttributesParsed,
      events: globalEvents,
    },
  };
}

function tagDataToHtmlTag(
  tagData: ITagData,
  config: ParseVscodeHtmlDataConfig,
): HtmlTag {
  const { name, description } = tagData;

  const attributes = tagData.attributes.map((tagDataAttr) =>
    tagDataToHtmlTagAttr(tagDataAttr, config, name),
  );

  const events = attrsToEvents(attributes);

  return {
    tagName: name,
    description: stringOrMarkupContentToString(description),
    attributes,
    events,
    properties: [],
    slots: [],
    builtIn: config.builtIn,
    cssParts: [],
    cssProperties: [],
  };
}

function tagDataToHtmlTagAttr(
  tagDataAttr: IAttributeData,
  config: ParseVscodeHtmlDataConfig,
  fromTagName?: string,
): HtmlAttr {
  const { name, description, valueSet, values } = tagDataAttr;

  return {
    kind: "attribute",
    name,
    description: stringOrMarkupContentToString(description),
    fromTagName,
    getType: () => {
      let type: SimpleType | undefined;

      if (valueSet) {
        const mappedType = config.typeMap?.get(valueSet);

        if (mappedType) {
          type = mappedType;
        } else {
          if (values) {
            const valuesUnion = attrValuesToUnion(values);
            type = valuesUnion;
          }
        }
      }

      return type || { kind: SimpleTypeKind.ANY };
    },
    builtIn: config.builtIn,
  };
}

function attrValuesToUnion(attrValues: IValueData[]): SimpleType {
  // FIXME: for now just filter undefined values in global attributes
  const attrValuesFiltered = attrValues.filter(
    ({ name }) => name !== "undefined",
  );

  return {
    kind: SimpleTypeKind.UNION,
    types: attrValuesFiltered.map(({ name }) => {
      if (name === "null") {
        throw new Error(
          "Attribute value 'null' is not allowed in union types.",
        );
      }
      const stringLiteral: SimpleTypeStringLiteral = {
        value: name,
        kind: SimpleTypeKind.STRING_LITERAL,
      };

      return stringLiteral;
    }),
  };
}

function stringOrMarkupContentToString(
  str: string | MarkupContent | undefined,
): string | undefined {
  if (str === undefined || typeof str === "string") {
    return str;
  }

  return str.value;
}

function attrsToEvents(htmlAttrs: HtmlAttr[]): HtmlEvent[] {
  return htmlAttrs
    .filter((htmlAttr) => htmlAttr.name.startsWith("on"))
    .map((htmlAttr) => ({
      name: htmlAttr.name.replace(/^on/, ""),
      description: htmlAttr.description,
      fromTagName: htmlAttr.fromTagName,
      getType: () => ({ kind: SimpleTypeKind.ANY }),
      builtIn: htmlAttr.builtIn,
    }));
}
