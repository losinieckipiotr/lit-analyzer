import {
  Expression,
  MethodDeclaration,
  ObjectType,
  Symbol as TsSymbol,
  Type,
  TypeReference,
} from "typescript";
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

    // FIXME: custom handling of directives by name, can I get rid of that?

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

          // User defined directive
          if (isLitDirective(typeB, ts)) {
            function isReferenceType(type: ObjectType): type is TypeReference {
              return (type.objectFlags & ts.ObjectFlags.Reference) !== 0;
            }

            let actualType: Type = checker.getAnyType();

            if (isReferenceType(typeB)) {
              const typeArguments = typeB.typeArguments || [];
              const directiveClassType = typeArguments.at(0);

              if (directiveClassType) {
                const { symbol } = directiveClassType;
                const { members } = symbol;

                if (members) {
                  let renderMember: TsSymbol | undefined;

                  for (const [key, member] of members) {
                    if (key === "render") {
                      renderMember = member;
                      break;
                    }
                  }

                  if (renderMember) {
                    const declarations = renderMember.getDeclarations() || [];
                    const dec = declarations[0];

                    if (dec) {
                      if (dec.kind === ts.SyntaxKind.MethodDeclaration) {
                        const sig = checker.getSignatureFromDeclaration(
                          dec as MethodDeclaration,
                        );

                        if (sig) {
                          actualType = sig.getReturnType();
                        }
                      }
                    }
                  }
                }
              }
            }

            return {
              kind: {
                name: typeBString,
              },
              args,
              actualType: () => actualType,
            };
          }
        }
    }
  }

  return;
}
