import * as tsModule from "typescript";
import { Node, Program } from "typescript";
import {
  SimpleType,
  SimpleTypeEnumMember,
  SimpleTypeKind,
  toSimpleType
} from "../../simple-type.js";

/**
 * Relax the type so that for example "string literal" become "string" and "function" become "any"
 * This is used for javascript files to provide type checking with Typescript type inferring
 * @param type
 */
export function relaxType(type: SimpleType): SimpleType {
  switch (type.kind) {
    case SimpleTypeKind.INTERSECTION:
    case SimpleTypeKind.UNION:
      return {
        ...type,
        types: type.types.map(t => relaxType(t))
      };

    case SimpleTypeKind.ENUM:
      return {
        ...type,
        types: type.types.map(
          // FIXME: is relaxType returns valid SimpleTypeEnumMember?
          t => relaxType(t) as unknown as SimpleTypeEnumMember
        )
      };

    case SimpleTypeKind.ARRAY:
      return {
        ...type,
        type: relaxType(type.type)
      };

    case SimpleTypeKind.PROMISE:
      return {
        ...type,
        type: relaxType(type.type)
      };

    case SimpleTypeKind.OBJECT:
      return {
        name: type.name,
        kind: SimpleTypeKind.OBJECT
      };
    case SimpleTypeKind.INTERFACE:
    case SimpleTypeKind.FUNCTION:
    case SimpleTypeKind.CLASS:
      return {
        name: type.name,
        kind: SimpleTypeKind.ANY
      };

    case SimpleTypeKind.NUMBER_LITERAL:
      return { kind: SimpleTypeKind.NUMBER };
    case SimpleTypeKind.STRING_LITERAL:
      return { kind: SimpleTypeKind.STRING };
    case SimpleTypeKind.BOOLEAN_LITERAL:
      return { kind: SimpleTypeKind.BOOLEAN };
    case SimpleTypeKind.BIG_INT_LITERAL:
      return { kind: SimpleTypeKind.BIG_INT };

    case SimpleTypeKind.ENUM_MEMBER:
      return {
        ...type,
        type: relaxType(type.type)
      } as SimpleTypeEnumMember;

    case SimpleTypeKind.ALIAS:
      return {
        ...type,
        target: relaxType(type.target)
      };

    case SimpleTypeKind.NULL:
    case SimpleTypeKind.UNDEFINED:
      return { kind: SimpleTypeKind.ANY };

    default:
      return type;
  }
}

// Only search in "lib.dom.d.ts" performance reasons for now
const LIB_FILE_NAMES = ["lib.dom.d.ts"];

// Map "tsModule => name => SimpleType"
const LIB_TYPE_CACHE: WeakMap<
  typeof tsModule,
  Map<string, SimpleType | undefined>
> = new Map();

/**
 * Return a Typescript library type with a specific name.
 */
export function getLibTypeWithName(
  name: string,
  { ts, program }: { program: Program; ts: typeof tsModule }
): SimpleType | undefined {
  const nameTypeCache = LIB_TYPE_CACHE.get(ts) || new Map();

  if (nameTypeCache.has(name)) {
    return nameTypeCache.get(name);
  } else {
    LIB_TYPE_CACHE.set(ts, nameTypeCache);
  }

  let node: Node | undefined;

  for (const libFileName of LIB_FILE_NAMES) {
    const sourceFile =
      program.getSourceFile(libFileName) ||
      program.getSourceFiles().find(f => f.fileName.endsWith(libFileName));
    if (sourceFile == null) {
      continue;
    }

    for (const statement of sourceFile.statements) {
      if (
        ts.isInterfaceDeclaration(statement) &&
        statement.name?.text === name
      ) {
        node = statement;
        break;
      }
    }

    if (node != null) {
      break;
    }
  }

  const checker = program.getTypeChecker();
  let type = node == null ? undefined : toSimpleType(node, checker);

  if (type != null) {
    // Apparently Typescript wraps the type in "generic arguments" when take the type from the interface declaration
    // Remove "generic arguments" here
    if (type.kind === "GENERIC_ARGUMENTS") {
      type = type.target;
    }
  }

  nameTypeCache.set(name, type);

  return type;
}
