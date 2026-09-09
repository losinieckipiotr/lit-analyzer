import { PropertySignature } from "typescript";
import { RuleModule } from "../analyze/types/rule/rule-module.js";
import { findParent, getNodeIdentifier } from "../analyze/util/ast-util.js";
import { iterableFind } from "../analyze/util/iterable-util.js";
import { rangeFromNode } from "../analyze/util/range-util.js";

/**
 * This rule validates that legacy Polymer attribute bindings are not used.
 */
const rule: RuleModule = {
  id: "no-missing-element-type-definition",
  meta: {
    priority: "low",
  },
  visitComponentDefinition(definition, context) {
    // Don't run this rule on non-typescript files and declaration files
    if (
      context.file.isDeclarationFile ||
      !context.file.fileName.endsWith(".ts")
    ) {
      return;
    }

    const { declaration, tagName } = definition;

    if (!declaration) {
      // TODO: log
      // throw new Error("No declaration found for this custom element");
      return;
    }

    // get custom element class name
    const componentClassName = getNodeIdentifier(declaration.node, context.ts);

    if (!componentClassName) {
      // TODO: log
      // throw new Error("No class name found for this custom element");
      return;
    }

    const componentClassNameText = componentClassName.text;

    function validatePropertySignature(declaration: PropertySignature) {
      const { type } = declaration;

      if (!type) {
        // TODO: log
        // const declarationName = declaration.name.getText();
        // throw new Error(
        // `Expected a type for member '${declarationName}' in HTMLElementTagNameMap`,
        // );
        return;
      }

      const declarationTypeName = type.getText();

      // check if class name matches the type in HTMLElementTagNameMap
      if (componentClassNameText === declarationTypeName) {
        return true;
      }

      return false;
    }

    // Try to find the tag name node on "interface HTMLElementTagNameMap"
    const htmlElementTagNameMapTagNameNode = iterableFind(
      definition.tagNameNodes,
      (node) =>
        !!findParent(node, (node) => {
          if (
            context.ts.isInterfaceDeclaration(node) &&
            context.ts.isModuleBlock(node.parent) &&
            node.name.getText() === "HTMLElementTagNameMap"
          ) {
            // tag name exists in HTMLElementTagNameMap
            for (const declaration of node.members) {
              if (
                context.ts.isPropertySignature(declaration) &&
                validatePropertySignature(declaration)
              ) {
                return true;
              }
            }

            return false;
          }

          return false;
        }),
    );

    // we found extendding HTMLElementTagNameMap for this tag
    if (htmlElementTagNameMapTagNameNode) {
      return;
    }

    const checker = context.program.getTypeChecker();

    // resolve global HTMLElementTagNameMap interface
    const resolvedName = checker.resolveName(
      "HTMLElementTagNameMap",
      undefined,
      context.ts.SymbolFlags.Interface,
      false,
    );

    if (!resolvedName) {
      // TODO: log
      // throw new Error("HTMLElementTagNameMap interface not found");
      return;
    }

    const { members: htmlElementsTagMap } = resolvedName;

    if (!htmlElementsTagMap) {
      // TODO: log
      // throw new Error(
      // "Members of HTMLElementTagNameMap interface are undefined",
      // );
      return;
    }

    // find the corresponding entry in HTMLElementTagNameMap for this custom element
    for (const [key, member] of htmlElementsTagMap) {
      // interface keys has weird key type, so we convert it to string
      const keyStr = key.toString();

      if (keyStr !== tagName) {
        continue;
      }

      // tag found in HTMLElementTagNameMap, now validate its type against the component class

      const { declarations } = member;

      if (!declarations) {
        // TODO: log
        // throw new Error(
        //   `Expected declarations for member '${keyStr}' in HTMLElementTagNameMap`,
        // );
        return;
      }

      if (declarations.length !== 1) {
        // TODO: log
        // throw new Error(
        //   `Expected exactly one declaration for member '${keyStr}' in HTMLElementTagNameMap`,
        // );
        return;
      }

      const declaration = declarations[0];

      if (!context.ts.isPropertySignature(declaration)) {
        // TODO: log
        // throw new Error(
        // `Expected a property signature for member '${keyStr}' in HTMLElementTagNameMap`,
        // );
        return;
      }

      if (validatePropertySignature(declaration)) {
        return;
      }
    }

    // Only report diagnostic if the tag is not built in,
    const tag = context.htmlStore.getHtmlTag(tagName);
    if (tag && tag.builtIn) {
      return;
    }

    const location = rangeFromNode(componentClassName);

    context.report({
      location: location,
      message: `'${tagName}' has not been registered on HTMLElementTagNameMap`,
      fix: () => {
        return {
          message: `Register '${tagName}' on HTMLElementTagNameMap`,
          actions: [
            {
              kind: "extendGlobalDeclaration",
              file: context.file,
              name: "HTMLElementTagNameMap",
              newMembers: [`"${tagName}": ${componentClassName.text}`],
            },
          ],
        };
      },
    });
  },
};

export default rule;
