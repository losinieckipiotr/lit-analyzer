import { Type, TypeChecker } from "typescript";
import {
  getUnionType,
  SimpleTypeContext,
} from "../../../../web-component-analyzer/src/simple-type.js";
import type {
  HTMLDataV1,
  IAttributeData,
  ITagData,
  IValueData,
  MarkupContent,
} from "../../data/html-data-types.js";
import {
  HtmlAttr,
  HtmlDataCollection,
  HtmlEvent,
  HtmlTag,
} from "./html-tag.js";

export interface ParseVscodeHtmlDataConfig {
  builtIn?: boolean;
  typeMap?: Map<string, Type>;
}

export function parseVscodeHtmlData(
  data: HTMLDataV1,
  simpleTypeContext: SimpleTypeContext,
  config: ParseVscodeHtmlDataConfig = {},
): HtmlDataCollection {
  switch (data.version) {
    case 1:
    case 1.1:
      return parseVscodeDataV1(data, simpleTypeContext, config);
  }
}

function parseVscodeDataV1(
  data: HTMLDataV1,
  simpleTypeContext: SimpleTypeContext,
  config: ParseVscodeHtmlDataConfig,
): HtmlDataCollection {
  const { checker } = simpleTypeContext;
  const { valueSets = [], globalAttributes = [], tags = [] } = data;

  function attrValuesToUnion(attrValues: IValueData[]): Type {
    // FIXME: for now just filter undefined values in global attributes
    const attrValuesFiltered = attrValues.filter(
      ({ name }) => name !== "undefined",
    );

    const { checker } = simpleTypeContext;

    const types = attrValuesFiltered.map(({ name }) => {
      if (name === "null") {
        throw new Error(
          "Attribute value 'null' is not allowed in union types.",
        );
      }
      return checker.getStringLiteralType(name);
    });

    return getUnionType(types, simpleTypeContext);
  }

  const valueSetTypeMap = new Map(
    valueSets.map((valueSet) => {
      const { name, values } = valueSet;

      return [name, attrValuesToUnion(values)];
    }),
  );
  valueSetTypeMap.set("v", checker.getBooleanType());

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
        let type: Type | undefined;

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

        return type || checker.getAnyType();
      },
      builtIn: config.builtIn,
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

    const events = attrsToEvents(attributes, checker);

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

  const globalAttributesParsed = globalAttributes.map((tagDataAttr) =>
    tagDataToHtmlTagAttr(tagDataAttr, newConfig),
  );

  const globalEvents = attrsToEvents(globalAttributesParsed, checker).map(
    (evt) => {
      return Object.assign({}, evt, { global: true });
    },
  );

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

function stringOrMarkupContentToString(
  str: string | MarkupContent | undefined,
): string | undefined {
  if (str === undefined || typeof str === "string") {
    return str;
  }

  return str.value;
}

function attrsToEvents(
  htmlAttrs: HtmlAttr[],
  checker: TypeChecker,
): HtmlEvent[] {
  return htmlAttrs
    .filter((htmlAttr) => htmlAttr.name.startsWith("on"))
    .map((htmlAttr) => ({
      name: htmlAttr.name.replace(/^on/, ""),
      description: htmlAttr.description,
      fromTagName: htmlAttr.fromTagName,
      getType: () => checker.getAnyType(),
      builtIn: htmlAttr.builtIn,
    }));
}
