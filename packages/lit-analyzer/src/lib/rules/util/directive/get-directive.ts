import { Expression, Type } from "typescript";
import { RuleModuleContext } from "../../../analyze/rule-collection.js";
import {
  HtmlNodeAttrAssignment,
  HtmlNodeAttrAssignmentKind,
} from "../../../analyze/types/html-node/html-node-attr-assignment-types.js";
import { isLitDirective } from "./is-lit-directive.js";

export type BuiltInDirectiveKind =
  | "ifDefined"
  | "guard"
  | "classMap"
  | "styleMap"
  | "unsafeHTML"
  | "cache"
  | "repeat"
  | "live"
  | "templateContent"
  | "unsafeSVG"
  | "asyncReplace"
  | "asyncAppend";

export interface UserDefinedDirectiveKind {
  name: string;
}

interface Directive {
  kind: BuiltInDirectiveKind | UserDefinedDirectiveKind;
  actualType?: () => Type | undefined;
  args: Expression[];
}

export function getDirective(
  assignment: HtmlNodeAttrAssignment,
  context: RuleModuleContext,
): Directive | undefined {
  const { ts, program } = context;
  const checker = program.getTypeChecker();

  if (assignment.kind !== HtmlNodeAttrAssignmentKind.EXPRESSION) return;

  // Type check lit-html directives
  if (ts.isCallExpression(assignment.expression)) {
    const functionName = assignment.expression.expression.getText() as
      BuiltInDirectiveKind | string;
    const args = Array.from(assignment.expression.arguments);

    switch (functionName) {
      case "ifDefined": {
        // Example: html`<img src="${ifDefined(imageUrl)}">`;
        // Take the argument to ifDefined and remove undefined from the type union (if possible).
        // This new type becomes the actual type of the expression
        return {
          kind: "ifDefined",
          actualType: () => {
            if (args.length >= 1) {
              const returnType = checker.getTypeAtLocation(args[0]);

              if (returnType.isUnion()) {
                return returnType.getNonNullableType();
              }

              return checker.getAnyType();
            }

            return undefined;
          },
          args,
        };
      }

      case "live": {
        // Example: html`<input .value=${live(x)}>`
        // The actual type will be the type of the first argument to live

        return {
          kind: "live",
          actualType: () => {
            if (args.length >= 1) {
              return checker.getTypeAtLocation(args[0]);
            }

            return undefined;
          },
          args,
        };
      }

      case "guard": {
        // Example: html`<img src="${guard([imageUrl], () => Math.random() > 0.5 ? imageUrl : "nothing.png")}>`;
        // The return type of the function becomes the actual type of the expression
        const actualType = () => {
          if (args.length >= 2) {
            const returnFunctionType = checker.getTypeAtLocation(args[1]);

            const callSignatures = returnFunctionType.getCallSignatures();

            if (callSignatures.length > 0) {
              return returnFunctionType;
            }
          }

          return undefined;
        };

        return {
          kind: "guard",
          actualType,
          args,
        };
      }

      case "classMap":
      case "styleMap":
        return {
          kind: functionName,
          actualType: () => checker.getStringType(),
          args,
        };

      case "unsafeHTML":
      case "unsafeSVG":
      case "cache":
      case "repeat":
      case "templateContent":
      case "asyncReplace":
      case "asyncAppend":
        return {
          kind: functionName,
          args,
        };

      default:
        // Grab the type of the expression and get a SimpleType
        if (assignment.kind === HtmlNodeAttrAssignmentKind.EXPRESSION) {
          const typeB = checker.getTypeAtLocation(assignment.expression);
          const typeBString = checker.typeToString(typeB);
          const callSignatures = typeB.getCallSignatures();

          if (callSignatures.length > 0) {
            return {
              kind: {
                name: typeBString,
              },
              args,
              actualType: () => typeB,
            };
          }

          if (isLitDirective(typeB)) {
            // FIXME: Implement handling for Lit directives
            throw new Error("Lit directive handling not implemented");
            // Factories can mark which parameters might be assigned to the property with the generic type in DirectiveFn<T>
            // Here we get the actual type of the directive if the it is a generic directive with type. Example: DirectiveFn<string>
            // Read more: https://github.com/Polymer/lit-html/pull/1151
            // const actualType =
            //   typeB.kind === "GENERIC_ARGUMENTS" &&
            //   typeB.target.name === "DirectiveFn" &&
            //   typeB.typeArguments.length > 0 // && typeB.typeArguments[0].kind !== "UNKNOWN"
            //     ? () => typeB.typeArguments[0]
            //     : undefined;

            // // Now we have an unknown (user defined) directive.
            // return {
            //   kind: {
            //     name: functionName,
            //   },
            //   args,
            //   actualType,
            // };
          }
        }
    }
  }

  return;
}
