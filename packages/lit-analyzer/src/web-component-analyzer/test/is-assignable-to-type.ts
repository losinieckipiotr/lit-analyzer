import { isAssignableToPrimitiveType } from "../src/is-assignable-to-type.js";
import {
  isSimpleType,
  SimpleTypeKind,
  SimpleTypeStringLiteral
} from "../src/simple-type.js";
import { tsTest } from "./helpers/ts-test.js";

const EMPTY_STRING_LITERAL: SimpleTypeStringLiteral = {
  kind: SimpleTypeKind.STRING_LITERAL,
  value: ""
};

tsTest("isAssignableToPrimitiveType: empty string should be primitive", t => {
  t.truthy(isSimpleType(EMPTY_STRING_LITERAL));

  t.truthy(isAssignableToPrimitiveType(EMPTY_STRING_LITERAL));
});
